import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * messageService tests.
 *
 * Coverage:
 *   1. sendMessage persists to DB + emails BDTTalentGroup@yahoo.com + pushes
 *      to platform admins.
 *   2. Validation: empty body → 400 message_empty; >2000 chars → 400 too_long.
 *   3. Tenant + plan name appear in the agency email body.
 *   4. Email failure does NOT block the message-send — message row still
 *      returned and the error is logged.
 *   5. listMessages returns rows ordered DESC by sentAt, with pagination.
 *   6. markRead returns 404 for unknown ids.
 */

const { dbMock, rawPrismaMock, sendEmailMock, pushMock, eventMock, loggerMock, queueMock } = vi.hoisted(() => ({
  dbMock: {
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : (ops as unknown),
    ),
  },
  rawPrismaMock: {
    tenant:        { findUnique: vi.fn() },
    user:          { findUnique: vi.fn() },
    message:       { findUnique: vi.fn(), update: vi.fn() },
    platformAdmin: { findMany: vi.fn() },
  },
  sendEmailMock: vi.fn(),
  pushMock: { sendPushToMany: vi.fn() },
  eventMock: vi.fn().mockResolvedValue(undefined),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  queueMock: { add: vi.fn() },
}));

vi.mock('../../lib/db.js', () => ({ db: dbMock, rawPrisma: rawPrismaMock }));
vi.mock('../../lib/tenantContext.js', () => ({ getTenantId: () => 'tenant_test_id' }));
vi.mock('../../lib/logger.js', () => ({ logger: loggerMock }));
vi.mock('../notificationService.js', () => ({ sendEmail: sendEmailMock }));
vi.mock('../pushService.js', () => pushMock);
vi.mock('../platformEventService.js', () => ({ logEvent: eventMock }));
vi.mock('../../queues/index.js', () => ({ platformEventsQueue: queueMock }));

import { sendMessage, listMessages, markRead, retryAgencyEmail } from '../messageService.js';

const TENANT = {
  id: 'tenant_test_id',
  businessName: 'Acme Salon',
  subscriptionTier: 'premium' as const,
};

const USER = {
  id: 'user_1',
  email: 'owner@acme.com',
  firstName: 'Jane',
  lastName: 'Doe',
};

beforeEach(() => {
  dbMock.message.create.mockReset();
  dbMock.message.findMany.mockReset();
  dbMock.message.findUnique.mockReset();
  dbMock.message.update.mockReset();
  dbMock.message.count.mockReset();
  rawPrismaMock.tenant.findUnique.mockReset();
  rawPrismaMock.user.findUnique.mockReset();
  rawPrismaMock.message.findUnique.mockReset();
  rawPrismaMock.message.update.mockReset().mockResolvedValue({});
  rawPrismaMock.platformAdmin.findMany.mockReset();
  sendEmailMock.mockReset().mockResolvedValue(undefined);
  pushMock.sendPushToMany.mockReset().mockResolvedValue({ sent: 0, failed: 0, tickets: [] });
  eventMock.mockReset().mockResolvedValue(undefined);
  loggerMock.error.mockReset();
  queueMock.add.mockReset().mockResolvedValue({});

  rawPrismaMock.tenant.findUnique.mockResolvedValue(TENANT);
  rawPrismaMock.user.findUnique.mockResolvedValue(USER);
  rawPrismaMock.platformAdmin.findMany.mockResolvedValue([{ userId: 'admin_1' }]);
  dbMock.message.create.mockResolvedValue({
    id: 'msg_1',
    tenantId: TENANT.id,
    userId: USER.id,
    subject: 'Quick question',
    body: 'Hi BDT, can we discuss the new landing page?',
    status: 'unread',
    sentAt: new Date('2026-05-23T12:00:00Z'),
    createdAt: new Date('2026-05-23T12:00:00Z'),
  });
});

describe('sendMessage', () => {
  it('persists to DB and emails BDTTalentGroup@yahoo.com', async () => {
    const result = await sendMessage({
      tenantId: TENANT.id,
      userId: USER.id,
      subject: 'Quick question',
      body: 'Hi BDT, can we discuss the new landing page?',
    });

    expect(result.id).toBe('msg_1');
    expect(dbMock.message.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT.id,
        userId: USER.id,
        subject: 'Quick question',
        body: 'Hi BDT, can we discuss the new landing page?',
      },
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmailMock.mock.calls[0]![0];
    expect(emailArgs.to).toBe('BDTTalentGroup@yahoo.com');
    expect(emailArgs.subject).toBe('New message from Acme Salon — Quick question');
    expect(emailArgs.text).toContain('Business: Acme Salon');
    expect(emailArgs.text).toContain('Plan: Premium');
    expect(emailArgs.text).toContain('From: Jane Doe (owner@acme.com)');
    expect(emailArgs.text).toContain('Hi BDT, can we discuss the new landing page?');
  });

  it('uses "No subject" in email subject when subject is omitted', async () => {
    dbMock.message.create.mockResolvedValueOnce({
      id: 'msg_2',
      tenantId: TENANT.id,
      userId: USER.id,
      subject: null,
      body: 'hi',
      status: 'unread',
      sentAt: new Date(),
      createdAt: new Date(),
    });
    await sendMessage({ tenantId: TENANT.id, userId: USER.id, body: 'hi' });
    expect(sendEmailMock.mock.calls[0]![0].subject).toBe('New message from Acme Salon — No subject');
  });

  it('pushes to every platform admin', async () => {
    rawPrismaMock.platformAdmin.findMany.mockResolvedValue([
      { userId: 'admin_1' },
      { userId: 'admin_2' },
    ]);
    await sendMessage({ tenantId: TENANT.id, userId: USER.id, body: 'hi' });
    expect(pushMock.sendPushToMany).toHaveBeenCalledWith(
      ['admin_1', 'admin_2'],
      expect.objectContaining({
        title: 'New message from Acme Salon',
        data: expect.objectContaining({ type: 'message_reply', messageId: 'msg_1' }),
      }),
    );
  });

  it('rejects empty / whitespace-only bodies', async () => {
    await expect(
      sendMessage({ tenantId: TENANT.id, userId: USER.id, body: '   ' }),
    ).rejects.toMatchObject({ status: 400, code: 'message_empty' });
  });

  it('rejects bodies longer than 2000 chars', async () => {
    await expect(
      sendMessage({ tenantId: TENANT.id, userId: USER.id, body: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({ status: 400, code: 'message_too_long' });
  });

  it('still succeeds when the email transport throws', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('resend down'));
    const result = await sendMessage({ tenantId: TENANT.id, userId: USER.id, body: 'hi' });
    expect(result.id).toBe('msg_1');
    expect(loggerMock.error).toHaveBeenCalled();
    expect(queueMock.add).toHaveBeenCalledWith(
      'deliver-agency-message-email',
      { messageId: 'msg_1' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('does not resend an email that delivered when only delivery-status persistence fails', async () => {
    rawPrismaMock.message.update.mockRejectedValueOnce(new Error('status write down'));

    const result = await sendMessage({ tenantId: TENANT.id, userId: USER.id, body: 'hi' });

    expect(result.id).toBe('msg_1');
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('404s when the tenant is missing', async () => {
    rawPrismaMock.tenant.findUnique.mockResolvedValueOnce(null);
    await expect(
      sendMessage({ tenantId: TENANT.id, userId: USER.id, body: 'hi' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('retryAgencyEmail', () => {
  it('retries a failed inbox email and marks it delivered', async () => {
    rawPrismaMock.message.findUnique.mockResolvedValue({
      id: 'msg_1',
      subject: 'Question',
      body: 'hello',
      emailDeliveryStatus: 'failed',
      tenant: TENANT,
      user: USER,
    });

    await retryAgencyEmail('msg_1');

    expect(sendEmailMock).toHaveBeenCalled();
    expect(rawPrismaMock.message.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ emailDeliveryStatus: 'sent' }) }),
    );
  });
});

describe('listMessages', () => {
  it('returns rows + total, ordered DESC by sentAt', async () => {
    const rows = [{ id: 'msg_1' }, { id: 'msg_2' }];
    dbMock.message.findMany.mockResolvedValue(rows);
    dbMock.message.count.mockResolvedValue(2);

    const result = await listMessages({ page: 1, limit: 20 });

    expect(dbMock.message.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { sentAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toEqual({ rows, total: 2 });
  });

  it('filters by status when provided', async () => {
    dbMock.message.findMany.mockResolvedValue([]);
    dbMock.message.count.mockResolvedValue(0);
    await listMessages({ page: 2, limit: 10, status: 'read' });
    expect(dbMock.message.findMany).toHaveBeenCalledWith({
      where: { status: 'read' },
      orderBy: { sentAt: 'desc' },
      skip: 10,
      take: 10,
    });
  });
});

describe('markRead', () => {
  it('updates an existing message to read', async () => {
    dbMock.message.findUnique.mockResolvedValue({ id: 'msg_1' });
    dbMock.message.update.mockResolvedValue({ id: 'msg_1', status: 'read' });
    const result = await markRead('msg_1');
    expect(result.status).toBe('read');
    expect(dbMock.message.update).toHaveBeenCalledWith({
      where: { id: 'msg_1' },
      data: { status: 'read' },
    });
  });

  it('404s when the id is unknown', async () => {
    dbMock.message.findUnique.mockResolvedValue(null);
    await expect(markRead('msg_missing')).rejects.toMatchObject({ status: 404 });
  });
});
