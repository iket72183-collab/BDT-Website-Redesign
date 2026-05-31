import type { ServiceRequest, SubscriptionTier, RequestStatus } from '@prisma/client';
import { rawPrisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { sendEmail } from './notificationService.js';
import { sendPushToMany } from './pushService.js';
import { PLANS } from '../lib/plans.js';
import type { Attachment } from '../validators/request.validators.js';

/**
 * Fan a newly-created client request out to the BDT agency, mirroring the
 * messageService pattern: email BDTTalentGroup@yahoo.com + push every platform
 * admin. Both legs are best-effort and isolated — a notification failure must
 * never roll back the request the client just submitted, and one channel
 * failing must not block the other.
 */

const AGENCY_INBOX = 'BDTTalentGroup@yahoo.com';

const TYPE_LABELS: Record<ServiceRequest['type'], string> = {
  website_update: 'Website Update',
  social_media: 'Social Media',
  general: 'General Request',
  file_upload: 'File Upload',
};

/** Human-readable request type for subjects / push bodies. */
export function formatType(type: ServiceRequest['type']): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Lowercase labels for in-sentence client copy ("Your website update request
 * is now in progress."). Distinct from the Title-Case TYPE_LABELS used in
 * agency subjects. Mirrors the mobile requestMeta labels, lowercased.
 */
const CLIENT_TYPE_LABELS: Record<ServiceRequest['type'], string> = {
  website_update: 'website update',
  social_media: 'social media',
  general: 'general',
  file_upload: 'file upload',
};

/**
 * Notify the request's client when BDT advances the status — push + email, for
 * the two meaningful forward transitions only. Push and email run in parallel
 * (Promise.allSettled) and each swallows its own failure, so one channel
 * failing never blocks the other and nothing ever throws out of here (the
 * caller also fire-and-forgets). Push fires only if the client has a registered
 * device; email fires only if we have an address — the two are independent.
 */
export async function notifyClientStatusUpdate(
  request: ServiceRequest,
  newStatus: RequestStatus,
): Promise<void> {
  // Guard: only in_progress + completed notify the client.
  //   - pending: initial state, the client just submitted it themselves.
  //   - cancelled: TODO(copy) — needs a client-facing copy decision before we
  //     notify on cancellation; intentionally silent for now.
  if (newStatus !== 'in_progress' && newStatus !== 'completed') return;

  try {
    // The client's email is on the tenant's OWNER user (Tenant has no `email`
    // column). rawPrisma keeps this safe to run in the fire-and-forget path,
    // which may execute after the request's tenant context has unwound.
    const [tokens, tenant] = await Promise.all([
      rawPrisma.devicePushToken.findMany({
        where: { tenantId: request.tenantId, isActive: true },
        select: { userId: true },
      }),
      rawPrisma.tenant.findUnique({
        where: { id: request.tenantId },
        select: { businessName: true, owner: { select: { email: true } } },
      }),
    ]);

    const userIds = [...new Set(tokens.map((t) => t.userId))];
    const clientEmail = tenant?.owner?.email ?? null;
    const typeLabel = CLIENT_TYPE_LABELS[request.type] ?? request.type;

    const jobs: Promise<unknown>[] = [];

    // Push — only if the client has at least one active device registered.
    if (userIds.length > 0) {
      const push =
        newStatus === 'in_progress'
          ? { title: "We're on it! 🚀", body: `Your ${typeLabel} request is now in progress.` }
          : { title: 'Request completed ✅', body: `Your ${typeLabel} request has been completed.` };
      jobs.push(
        sendPushToMany(userIds, {
          title: push.title,
          body: push.body,
          data: { requestId: request.id, type: 'request_status_update', status: newStatus },
        }).catch((err) =>
          logger.error(
            { err, requestId: request.id, status: newStatus },
            'request.client_status_push_failed',
          ),
        ),
      );
    }

    // Email — only if we have an address (tenant + owner present). Skips
    // silently otherwise; push still fires.
    if (clientEmail && tenant) {
      const email = buildClientStatusEmail(newStatus, tenant.businessName, typeLabel, request.title);
      jobs.push(
        sendEmail({ to: clientEmail, subject: email.subject, text: email.text, html: email.html }).catch(
          (err) =>
            logger.error(
              { err, requestId: request.id, status: newStatus },
              'request.client_status_email_failed',
            ),
        ),
      );
    }

    await Promise.allSettled(jobs);
  } catch (err) {
    logger.error(
      { err, requestId: request.id, status: newStatus },
      'request.client_status_notify_failed',
    );
  }
}

/**
 * Client status-update email copy. Provides text + simple HTML, matching this
 * file's agency-email style (inline-tag HTML alongside a plain-text fallback).
 */
function buildClientStatusEmail(
  newStatus: 'in_progress' | 'completed',
  businessName: string,
  typeLabel: string,
  title: string,
): { subject: string; text: string; html: string } {
  if (newStatus === 'in_progress') {
    return {
      subject: "We're working on your request — BDT Connect",
      text:
        `Hi ${businessName},\n\n` +
        `Great news — we've started working on your ${typeLabel} request: "${title}".\n` +
        `We'll notify you again once it's complete.\n\n` +
        `– The BDT Talent Group Team\n`,
      html:
        `<p>Hi ${escapeHtml(businessName)},</p>` +
        `<p>Great news — we've started working on your ${escapeHtml(typeLabel)} request: ` +
        `&ldquo;${escapeHtml(title)}&rdquo;.</p>` +
        `<p>We'll notify you again once it's complete.</p>` +
        `<p>– The BDT Talent Group Team</p>`,
    };
  }
  return {
    subject: 'Your request is complete — BDT Connect',
    text:
      `Hi ${businessName},\n\n` +
      `Your ${typeLabel} request has been completed: "${title}".\n` +
      `Log in to BDT Connect to view the details.\n\n` +
      `– The BDT Talent Group Team\n`,
    html:
      `<p>Hi ${escapeHtml(businessName)},</p>` +
      `<p>Your ${escapeHtml(typeLabel)} request has been completed: &ldquo;${escapeHtml(title)}&rdquo;.</p>` +
      `<p>Log in to BDT Connect to view the details.</p>` +
      `<p>– The BDT Talent Group Team</p>`,
  };
}

interface NotifyTenant {
  businessName: string;
  subscriptionTier: SubscriptionTier;
}

export async function notifyBDTOfRequest(
  request: ServiceRequest,
  tenant: NotifyTenant,
): Promise<void> {
  // Run both notifications concurrently; allSettled so a rejection in one
  // never short-circuits the other. The inner helpers already swallow +
  // log, so this is belt-and-suspenders.
  await Promise.allSettled([
    emailAgency(request, tenant).catch((err) =>
      logger.error({ err, requestId: request.id }, 'request.notify_email_failed'),
    ),
    pushAdmins(request, tenant).catch((err) =>
      logger.error({ err, requestId: request.id }, 'request.notify_push_failed'),
    ),
  ]);
}

function attachmentsOf(request: ServiceRequest): Attachment[] {
  // `attachments` is a Json column; it's always written as an array by the
  // service, but guard against malformed rows.
  return Array.isArray(request.attachments) ? (request.attachments as unknown as Attachment[]) : [];
}

async function emailAgency(request: ServiceRequest, tenant: NotifyTenant): Promise<void> {
  const planName = PLANS[tenant.subscriptionTier].name;
  const typeLabel = formatType(request.type);
  const attachments = attachmentsOf(request);
  const submittedAt = request.createdAt.toISOString();

  // The bucket is private, so attachments no longer have a public URL — and a
  // signed URL would expire before this email is read. List name + size and let
  // the agency open the files from the request in the dashboard.
  const attachmentsText =
    attachments.length === 0
      ? 'None'
      : `${attachments.length}\n` +
        attachments.map((a) => `  - ${a.name} (${formatBytes(a.size)})`).join('\n');

  const attachmentsHtml =
    attachments.length === 0
      ? '<p><strong>Attachments:</strong> None</p>'
      : `<p><strong>Attachments (${attachments.length}):</strong></p><ul>` +
        attachments
          .map((a) => `<li>${escapeHtml(a.name)} (${formatBytes(a.size)})</li>`)
          .join('') +
        '</ul>';

  await sendEmail({
    to: AGENCY_INBOX,
    subject: `[BDT Connect] New ${typeLabel} request from ${tenant.businessName}`,
    text:
      `New ${typeLabel} request\n\n` +
      `Business: ${tenant.businessName} (${planName} plan)\n` +
      `Type: ${typeLabel}\n` +
      `Title: ${request.title}\n\n` +
      `${request.description}\n\n` +
      `Attachments: ${attachmentsText}\n\n` +
      `Submitted at: ${submittedAt}\n` +
      `---\n` +
      `Open the BDT Connect admin dashboard to review and update this request.\n`,
    html:
      `<h2>New ${escapeHtml(typeLabel)} request</h2>` +
      `<p><strong>${escapeHtml(tenant.businessName)}</strong> ` +
      `<span style="background:#C9A882;color:#0A0A0A;padding:2px 8px;border-radius:4px;` +
      `font-size:12px;letter-spacing:0.05em;">${escapeHtml(planName.toUpperCase())}</span></p>` +
      `<p><strong>Type:</strong> ${escapeHtml(typeLabel)}</p>` +
      `<p><strong>Title:</strong> ${escapeHtml(request.title)}</p>` +
      `<p><strong>Description:</strong></p><p>${escapeHtml(request.description)}</p>` +
      attachmentsHtml +
      `<p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>` +
      `<hr/><p>Open the BDT Connect admin dashboard to review and update this request.</p>`,
  });
}

async function pushAdmins(request: ServiceRequest, tenant: NotifyTenant): Promise<void> {
  const admins = await rawPrisma.platformAdmin.findMany({ select: { userId: true } });
  if (admins.length === 0) return;

  await sendPushToMany(
    admins.map((a) => a.userId),
    {
      title: `New request from ${tenant.businessName}`,
      body: `${formatType(request.type)}: ${request.title}`,
      data: { type: 'new_request', requestId: request.id },
    },
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
