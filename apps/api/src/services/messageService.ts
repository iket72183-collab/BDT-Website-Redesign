import type { MessageStatus } from '@prisma/client';
import { db, rawPrisma } from '../lib/db.js';
import { getTenantId } from '../lib/tenantContext.js';
import { HttpError } from '../middleware/error.js';
import { logger } from '../lib/logger.js';
import { sendEmail } from './notificationService.js';
import { sendPushToMany } from './pushService.js';
import { logEvent } from './platformEventService.js';
import { PLANS } from '../lib/plans.js';
import { platformEventsQueue } from '../queues/index.js';

/**
 * Client → BDT messaging. A client composes a message in the app; we persist
 * the row, email the agency at BDTTalentGroup@yahoo.com, and ping any signed-in
 * platform admins via push.
 */

const AGENCY_INBOX = 'BDTTalentGroup@yahoo.com';

interface SendMessageInput {
  tenantId: string;
  userId: string;
  subject?: string | undefined;
  body: string;
}

export async function sendMessage(input: SendMessageInput) {
  if (!input.body || input.body.trim().length === 0) {
    throw new HttpError(400, 'message_empty', 'message_empty');
  }
  if (input.body.length > 2000) {
    throw new HttpError(400, 'message_too_long', 'message_too_long');
  }

  // Tenant + user lookups use rawPrisma so this works whether called inside or
  // outside a tenant context (e.g. webhook replays).
  const [tenant, user] = await Promise.all([
    rawPrisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, businessName: true, subscriptionTier: true },
    }),
    rawPrisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
  ]);
  if (!tenant) throw new HttpError(404, 'tenant_not_found');
  if (!user) throw new HttpError(404, 'user_not_found');

  const message = await db.message.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      subject: input.subject?.trim() || null,
      body: input.body.trim(),
    },
  });

  const agencyEmail = {
    businessName: tenant.businessName,
    plan: PLANS[tenant.subscriptionTier].name,
    fromName: `${user.firstName} ${user.lastName}`,
    fromEmail: user.email,
    subject: message.subject,
    body: message.body,
  };

  // The dashboard record is the source of truth. Email delivery is attempted
  // synchronously for speed, then durably retried through BullMQ on outage.
  try {
    await dispatchAgencyEmail(agencyEmail);
    await markEmailSent(message.id).catch((statusErr) =>
      logger.error({ statusErr, messageId: message.id }, 'message.email_sent_status_update_failed'),
    );
  } catch (err) {
    await markEmailFailed(message.id, err);
    await platformEventsQueue.add(
      'deliver-agency-message-email',
      { messageId: message.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    ).catch((queueErr) =>
      logger.error({ queueErr, messageId: message.id }, 'message.email_retry_enqueue_failed'),
    );
    logger.error({ err, messageId: message.id }, 'message.email_failed');
  }

  // Push to platform admins — surfaces messages in their device if they have
  // the app installed. Best-effort.
  await notifyPlatformAdmins({
    title: `New message from ${tenant.businessName}`,
    body: message.subject ?? message.body.slice(0, 120),
    messageId: message.id,
  }).catch((err) => logger.error({ err, messageId: message.id }, 'message.push_failed'));

  await logEvent('message.sent', { messageId: message.id, tenantId: tenant.id, userId: user.id });

  return message;
}

/** Worker entrypoint for retrying a previously failed agency inbox email. */
export async function retryAgencyEmail(messageId: string): Promise<void> {
  const message = await rawPrisma.message.findUnique({
    where: { id: messageId },
    include: {
      tenant: { select: { businessName: true, subscriptionTier: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  if (!message || message.emailDeliveryStatus === 'sent') return;

  try {
    await dispatchAgencyEmail({
      businessName: message.tenant.businessName,
      plan: PLANS[message.tenant.subscriptionTier].name,
      fromName: `${message.user.firstName} ${message.user.lastName}`,
      fromEmail: message.user.email,
      subject: message.subject,
      body: message.body,
    });
    await markEmailSent(message.id).catch((statusErr) =>
      logger.error({ statusErr, messageId: message.id }, 'message.email_sent_status_update_failed'),
    );
  } catch (err) {
    await markEmailFailed(message.id, err);
    throw err;
  }
}

interface ListMessagesInput {
  page: number;
  limit: number;
  status?: MessageStatus | undefined;
}

export async function listMessages(input: ListMessagesInput) {
  const where = input.status ? { status: input.status } : {};
  const [rows, total] = await db.$transaction([
    db.message.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    db.message.count({ where }),
  ]);
  return { rows, total };
}

export async function markRead(messageId: string) {
  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing) throw new HttpError(404, 'not_found', 'not_found');
  return db.message.update({
    where: { id: messageId },
    data: { status: 'read' },
  });
}

// ============================================================================
// helpers — keep close to the service so test mocks have one surface to stub
// ============================================================================

interface AgencyEmailInput {
  businessName: string;
  plan: string;
  fromName: string;
  fromEmail: string;
  subject: string | null;
  body: string;
}

async function dispatchAgencyEmail(input: AgencyEmailInput): Promise<void> {
  const subjectLine = input.subject?.trim() || 'No subject';
  // `replyTo: clientEmail` makes "Reply" in the agency inbox target the client
  // directly — no manual address copy/paste, no risk of the team replying to
  // the noreply@bdtconnect.com sender by accident.
  await sendEmail({
    to: AGENCY_INBOX,
    replyTo: input.fromEmail,
    subject: `New message from ${input.businessName} — ${subjectLine}`,
    text:
      `Business: ${input.businessName}\n` +
      `Plan: ${input.plan}\n` +
      `From: ${input.fromName} (${input.fromEmail})\n\n` +
      `${input.body}\n\n` +
      `---\n` +
      `Reply to this email to respond directly to the client.\n` +
      `Sent via BDT Connect\n`,
  });
}

async function markEmailSent(messageId: string): Promise<void> {
  await rawPrisma.message.update({
    where: { id: messageId },
    data: {
      emailDeliveryStatus: 'sent',
      emailDeliveredAt: new Date(),
      emailLastError: null,
    },
  });
}

async function markEmailFailed(messageId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await rawPrisma.message.update({
    where: { id: messageId },
    data: {
      emailDeliveryStatus: 'failed',
      emailLastError: message.slice(0, 1000),
    },
  }).catch((updateErr) =>
    logger.error({ updateErr, messageId }, 'message.email_status_update_failed'),
  );
}

async function notifyPlatformAdmins(input: {
  title: string;
  body: string;
  messageId: string;
}): Promise<void> {
  // Admins live outside the tenant scope so we can't create in-app
  // Notification rows for them (tenantId is required). Push is enough —
  // they primarily respond from the email side anyway.
  const admins = await rawPrisma.platformAdmin.findMany({ select: { userId: true } });
  if (admins.length === 0) return;

  await sendPushToMany(
    admins.map((a) => a.userId),
    {
      title: input.title,
      body: input.body,
      data: { type: 'message_reply', messageId: input.messageId },
    },
  );
}
