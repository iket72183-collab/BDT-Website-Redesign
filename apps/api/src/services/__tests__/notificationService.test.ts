import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Email-transport tests for notificationService.
 *
 * What we're proving:
 *   1. Dev path (`NODE_ENV != production`) logs to pino and NEVER calls Resend
 *      — keeps local dev zero-config and reset/verify links visible in console.
 *   2. Prod path dispatches via Resend with the right from/to/subject/text.
 *   3. Resend typed errors surface as HttpError(502, email_send_failed).
 *   4. Missing RESEND_API_KEY / RESEND_FROM in prod surfaces as
 *      HttpError(500, email_provider_unconfigured).
 *   5. sendPasswordResetEmail + sendEmailVerificationEmail build the right
 *      `${PUBLIC_APP_URL}/<path>?token=…&tenant=…` URL.
 */

// Hoisted state so vi.mock factories can capture references safely (factories
// are hoisted above imports; outer `const` declarations are not).
const { sendMock, loggerMock, mockConfig, dbMock, pushMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  dbMock: {
    notification: { create: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
  },
  pushMock: { sendPushNotification: vi.fn() },
  mockConfig: {
    nodeEnv: 'development' as 'development' | 'test' | 'production',
    publicUrl: 'http://localhost:4000',
    publicAppUrl: 'http://localhost:3000' as string | undefined,
    resend: {
      apiKey: 're_test_key' as string | undefined,
      from: 'BDT Connect <test@example.com>' as string | undefined,
    },
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../../config/env.js', () => ({ config: mockConfig }));

// Stub the Prisma client module so importing notificationService doesn't
// spin up Prisma.
vi.mock('../../lib/db.js', () => ({
  db: dbMock,
  rawPrisma: dbMock,
}));
// Mock pushService — importing the real one pulls in expo-server-sdk + the
// BullMQ/Redis connection, which would hang vitest.
vi.mock('../pushService.js', () => pushMock);
// notify() now stamps tenantId via getTenantId(); supply a tenant context.
vi.mock('../../lib/tenantContext.js', () => ({ getTenantId: () => 'tenant_test_id' }));

// Imports happen AFTER the mocks above are hoisted.
import {
  _resetEmailClientForTests,
  sendEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  notify,
} from '../notificationService.js';

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: 'em_test_id' }, error: null });
  loggerMock.info.mockReset();
  loggerMock.error.mockReset();
  loggerMock.warn.mockReset();
  dbMock.notification.create.mockReset().mockResolvedValue({ id: 'notif_1' });
  dbMock.notificationPreference.findUnique.mockReset();
  pushMock.sendPushNotification.mockReset().mockResolvedValue({ sent: 1, failed: 0, tickets: [] });
  _resetEmailClientForTests();

  // Reset config to baseline before each test.
  mockConfig.nodeEnv = 'development';
  mockConfig.publicAppUrl = 'http://localhost:3000';
  mockConfig.resend.apiKey = 're_test_key';
  mockConfig.resend.from = 'BDT Connect <test@example.com>';
});

// =============================================================================
// sendEmail
// =============================================================================

describe('sendEmail — dev path', () => {
  it('logs to pino and does NOT call Resend', async () => {
    mockConfig.nodeEnv = 'development';
    await sendEmail({ to: 'a@b.com', subject: 'Hello', text: 'Body' });

    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', subject: 'Hello', body: 'Body' }),
      'email.devsend',
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('still logs in dev even if RESEND_API_KEY is unset', async () => {
    mockConfig.nodeEnv = 'development';
    mockConfig.resend.apiKey = undefined;
    mockConfig.resend.from = undefined;
    await expect(sendEmail({ to: 'a@b.com', subject: 'S', text: 'T' })).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('sendEmail — prod path', () => {
  it('dispatches via Resend with from/to/subject/text', async () => {
    mockConfig.nodeEnv = 'production';
    await sendEmail({ to: 'user@example.com', subject: 'Hi', text: 'Body' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: 'BDT Connect <test@example.com>',
      to: 'user@example.com',
      subject: 'Hi',
      text: 'Body',
    });
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', id: 'em_test_id' }),
      'email.sent',
    );
  });

  it('includes html when provided', async () => {
    mockConfig.nodeEnv = 'production';
    await sendEmail({
      to: 'a@b.com',
      subject: 'S',
      text: 'T',
      html: '<p>HTML</p>',
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ html: '<p>HTML</p>' }));
  });

  it('throws email_send_failed (502) when Resend returns an error', async () => {
    mockConfig.nodeEnv = 'production';
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'validation_error', message: 'invalid recipient' },
    });

    await expect(
      sendEmail({ to: 'bad@', subject: 'X', text: 'Y' }),
    ).rejects.toMatchObject({ code: 'email_send_failed', status: 502 });

    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'bad@' }),
      'email.resend_failed',
    );
  });

  it('throws email_provider_unconfigured (500) when RESEND_API_KEY is unset', async () => {
    mockConfig.nodeEnv = 'production';
    mockConfig.resend.apiKey = undefined;

    await expect(
      sendEmail({ to: 'a@b.com', subject: 'X', text: 'Y' }),
    ).rejects.toMatchObject({ code: 'email_provider_unconfigured', status: 500 });

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws email_provider_unconfigured (500) when RESEND_FROM is unset', async () => {
    mockConfig.nodeEnv = 'production';
    mockConfig.resend.from = undefined;

    await expect(
      sendEmail({ to: 'a@b.com', subject: 'X', text: 'Y' }),
    ).rejects.toMatchObject({ code: 'email_provider_unconfigured', status: 500 });

    expect(sendMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// sendPasswordResetEmail
// =============================================================================

describe('sendPasswordResetEmail', () => {
  it('builds a /reset-password URL with token + tenant query params', async () => {
    mockConfig.nodeEnv = 'production';

    await sendPasswordResetEmail({
      to: 'marcus@vale.com',
      firstName: 'Marcus',
      rawToken: 'RAW_TOKEN_ABC',
      tenantSlug: 'vale-strength',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe('marcus@vale.com');
    expect(call.subject).toMatch(/reset your bdt connect password/i);
    expect(call.text).toContain('Hi Marcus');
    expect(call.text).toContain(
      'http://localhost:3000/reset-password?token=RAW_TOKEN_ABC&tenant=vale-strength',
    );
    expect(call.text).toMatch(/expires in 1 hour/);
  });

  it('omits the tenant query param when slug is null', async () => {
    mockConfig.nodeEnv = 'production';

    await sendPasswordResetEmail({
      to: 'admin@bdt.com',
      firstName: 'Devin',
      rawToken: 'T',
      tenantSlug: null,
    });

    const call = sendMock.mock.calls[0]![0];
    expect(call.text).toContain('?token=T');
    expect(call.text).not.toContain('&tenant=');
  });

  it('falls back to API public URL when PUBLIC_APP_URL is unset', async () => {
    mockConfig.nodeEnv = 'production';
    mockConfig.publicAppUrl = undefined;

    await sendPasswordResetEmail({
      to: 'a@b.com',
      firstName: 'A',
      rawToken: 'TOK',
    });

    const call = sendMock.mock.calls[0]![0];
    expect(call.text).toContain('http://localhost:4000/reset-password?token=TOK');
  });

  it('logs the link in dev WITHOUT calling Resend', async () => {
    mockConfig.nodeEnv = 'development';

    await sendPasswordResetEmail({
      to: 'a@b.com',
      firstName: 'A',
      rawToken: 'TOK',
      tenantSlug: 'foo',
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        subject: expect.stringMatching(/reset your bdt connect password/i),
        body: expect.stringContaining('?token=TOK&tenant=foo'),
      }),
      'email.devsend',
    );
  });
});

// =============================================================================
// sendEmailVerificationEmail
// =============================================================================

describe('sendEmailVerificationEmail', () => {
  it('builds a /verify-email URL with token + tenant', async () => {
    mockConfig.nodeEnv = 'production';

    await sendEmailVerificationEmail({
      to: 'sofia@spa.com',
      firstName: 'Sofia',
      rawToken: 'VERIFY_XYZ',
      tenantSlug: 'cardamom-spa',
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0]![0];
    expect(call.to).toBe('sofia@spa.com');
    expect(call.subject).toMatch(/confirm your bdt connect email/i);
    expect(call.text).toContain('Hi Sofia');
    expect(call.text).toContain(
      'http://localhost:3000/verify-email?token=VERIFY_XYZ&tenant=cardamom-spa',
    );
    expect(call.text).toMatch(/expires in 24 hours/);
  });

  it('logs the link in dev WITHOUT calling Resend', async () => {
    mockConfig.nodeEnv = 'development';

    await sendEmailVerificationEmail({
      to: 'sofia@spa.com',
      firstName: 'Sofia',
      rawToken: 'V',
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sofia@spa.com',
        body: expect.stringContaining('/verify-email?token=V'),
      }),
      'email.devsend',
    );
  });
});

// =============================================================================
// notify — in-app record + push fan-out
// =============================================================================

describe('notify — push fan-out', () => {
  const input = {
    userId: 'user_1',
    type: 'message_reply' as const,
    title: 'Reply received',
    body: 'See you soon',
    referenceType: 'booking',
    referenceId: 'bk1',
  };

  it('creates the in-app notification record', async () => {
    dbMock.notificationPreference.findUnique.mockResolvedValue({ pushEnabled: true });
    await notify(input);
    expect(dbMock.notification.create).toHaveBeenCalledTimes(1);
  });

  it('dispatches a push when the user has pushEnabled', async () => {
    dbMock.notificationPreference.findUnique.mockResolvedValue({ pushEnabled: true });
    await notify(input);
    // Push dispatch is fire-and-forget — wait for the detached promise.
    await vi.waitFor(() => expect(pushMock.sendPushNotification).toHaveBeenCalled());
    expect(pushMock.sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        title: 'Reply received',
        data: expect.objectContaining({ type: 'message_reply', referenceId: 'bk1' }),
      }),
    );
  });

  it('skips the push when pushEnabled is false', async () => {
    dbMock.notificationPreference.findUnique.mockResolvedValue({ pushEnabled: false });
    await notify(input);
    await new Promise((r) => setImmediate(r)); // let the detached dispatch settle
    expect(pushMock.sendPushNotification).not.toHaveBeenCalled();
  });

  it('does not fail notify() when the push dispatch throws', async () => {
    dbMock.notificationPreference.findUnique.mockResolvedValue({ pushEnabled: true });
    pushMock.sendPushNotification.mockRejectedValue(new Error('expo down'));
    await expect(notify(input)).resolves.toEqual({ id: 'notif_1' });
    await vi.waitFor(() =>
      expect(loggerMock.error).toHaveBeenCalledWith(expect.any(Object), 'push.dispatch_failed'),
    );
  });
});
