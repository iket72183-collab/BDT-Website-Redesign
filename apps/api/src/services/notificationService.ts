import { Resend } from 'resend';
import type { NotificationType } from '@prisma/client';
import { db } from '../lib/db.js';
import { getTenantId } from '../lib/tenantContext.js';
import { HttpError } from '../middleware/error.js';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import * as pushService from './pushService.js';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string | undefined;
  referenceId?: string | undefined;
  /** Extra deep-link payload merged into the push `data` field. */
  data?: Record<string, unknown> | undefined;
}

/**
 * Create an in-app notification, then fan out a push notification.
 *
 * The DB record is the source of truth (awaited). The push is fire-and-forget
 * — a push failure (Expo down, no tokens, prefs off) must NEVER fail notify()
 * or the request/job that called it.
 *
 * REALTIME-CANDIDATE: emit "notification.new" on a per-user channel so the
 * in-app badge updates immediately.
 */
export async function notify(input: CreateNotificationInput) {
  const n = await db.notification.create({
    data: {
      tenantId: getTenantId(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
    },
  });

  // Push fan-out — detached. notify()'s contract (create the in-app row) is
  // already fulfilled; the push is a best-effort second channel.
  void dispatchPush(input).catch((err) =>
    logger.error({ err, userId: input.userId }, 'push.dispatch_failed'),
  );

  return n;
}

/**
 * Send the matching push notification, respecting the user's push preference.
 * Separated out so notify() can fire it without awaiting.
 */
async function dispatchPush(input: CreateNotificationInput): Promise<void> {
  const prefs = await db.notificationPreference.findUnique({
    where: { userId: input.userId },
    select: { pushEnabled: true },
  });
  // No prefs row → treat as enabled (the schema default for pushEnabled).
  if (prefs && !prefs.pushEnabled) return;

  await pushService.sendPushNotification({
    userId: input.userId,
    title: input.title,
    body: input.body,
    sound: 'default',
    data: {
      type: input.type,
      ...(input.referenceType ? { referenceType: input.referenceType } : {}),
      ...(input.referenceId ? { referenceId: input.referenceId } : {}),
      ...(input.data ?? {}),
    },
  });
}

export async function listForUser(userId: string, opts: { unreadOnly: boolean; page: number; limit: number }) {
  const where = {
    userId,
    ...(opts.unreadOnly ? { isRead: false } : {}),
  };
  const [rows, total] = await db.$transaction([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    db.notification.count({ where }),
  ]);
  return { rows, total };
}

export async function markRead(id: string, userId: string) {
  const n = await db.notification.findUnique({ where: { id } });
  if (!n || n.userId !== userId) throw new HttpError(404, 'not_found', 'not_found');
  return db.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function getPreferences(userId: string) {
  const pref = await db.notificationPreference.findUnique({ where: { userId } });
  if (!pref) throw new HttpError(404, 'preferences_not_found', 'preferences_not_found');
  return pref;
}

export async function updatePreferences(userId: string, data: Partial<{
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  marketing: boolean;
}>) {
  return db.notificationPreference.update({
    where: { userId },
    data,
  });
}

// ===========================================================================
// Email channel — Resend transport
// ---------------------------------------------------------------------------
// In dev (NODE_ENV != production) we log the message to pino so you can copy
// the reset / verify link straight from the console — no API key required.
// In production we dispatch via Resend (https://resend.com). See AUTH_FLOW.md
// for the one-time setup (domain verification, API key, env vars).
// ===========================================================================

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plaintext body. HTML is optional; Resend auto-derives one from the other. */
  text: string;
  html?: string;
  /** When set, "Reply" in the recipient's mail client targets this address
   *  instead of `from`. Used by the agency-inbox flow so replies land in the
   *  client's mailbox, not in our noreply@ address. */
  replyTo?: string;
}

/** Lazy Resend singleton — only constructed when the prod path actually runs. */
let _resend: Resend | null = null;
function getResendClient(): Resend {
  if (_resend) return _resend;
  if (!config.resend.apiKey) {
    logger.error('email.provider_not_configured');
    throw new HttpError(500, 'email_provider_unconfigured', 'email_provider_unconfigured');
  }
  _resend = new Resend(config.resend.apiKey);
  return _resend;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  // Dev path: log only. Identical behavior to before — preserved on purpose
  // so local development stays zero-config and reset/verify links are visible.
  if (config.nodeEnv !== 'production') {
    logger.info(
      {
        to: message.to,
        subject: message.subject,
        body: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      },
      'email.devsend',
    );
    return;
  }

  if (!config.resend.from) {
    logger.error('email.from_not_configured');
    throw new HttpError(500, 'email_provider_unconfigured', 'email_provider_unconfigured');
  }

  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: config.resend.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html   ? { html: message.html }      : {}),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  });

  if (error) {
    // Resend returns typed errors instead of throwing — bubble as 502 so the
    // caller (authService) can decide whether to swallow (best-effort) or
    // surface (operator-initiated).
    logger.error({ err: error, to: message.to }, 'email.resend_failed');
    throw new HttpError(502, 'email_send_failed', 'email_send_failed');
  }

  logger.info({ to: message.to, id: data?.id }, 'email.sent');
}

/** Test-only hook for resetting the cached client between cases. */
export function _resetEmailClientForTests(): void {
  _resend = null;
}

/**
 * The frontend reset / verify pages live at `${PUBLIC_APP_URL}/<path>?token=…`.
 * Set PUBLIC_APP_URL in prod env to your web app domain; falls back to the API
 * URL so dev / API-only setups still produce reachable links.
 */
function publicUrl(): string {
  return config.publicAppUrl ?? config.publicUrl;
}

export async function sendPasswordResetEmail(args: {
  to: string;
  firstName: string;
  rawToken: string;
  tenantSlug?: string | null;
}): Promise<void> {
  const url = new URL('/reset-password', publicUrl());
  url.searchParams.set('token', args.rawToken);
  if (args.tenantSlug) url.searchParams.set('tenant', args.tenantSlug);

  await sendEmail({
    to: args.to,
    subject: 'Reset your BDT Connect password',
    text:
      `Hi ${args.firstName},\n\n` +
      `Someone (hopefully you) asked to reset the password on your BDT Connect account.\n` +
      `Click the link below to set a new password. It expires in 1 hour.\n\n` +
      `${url.toString()}\n\n` +
      `If you didn't request this, you can safely ignore this email.\n`,
  });
}

export async function sendEmailVerificationEmail(args: {
  to: string;
  firstName: string;
  rawToken: string;
  tenantSlug?: string | null;
}): Promise<void> {
  const url = new URL('/verify-email', publicUrl());
  url.searchParams.set('token', args.rawToken);
  if (args.tenantSlug) url.searchParams.set('tenant', args.tenantSlug);

  await sendEmail({
    to: args.to,
    subject: 'Confirm your BDT Connect email',
    text:
      `Hi ${args.firstName},\n\n` +
      `Welcome to BDT Connect. Confirm your email address so we can send you service ` +
      `updates and important account notices. The link expires in 24 hours.\n\n` +
      `${url.toString()}\n`,
  });
}
