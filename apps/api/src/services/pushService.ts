import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { rawPrisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { platformEventsQueue } from '../queues/index.js';

/**
 * THE single Expo Push SDK call surface. Nothing outside this file imports
 * `expo-server-sdk`.
 *
 * Expo fans a single token format out to APNs (iOS) + FCM (Android) — no
 * direct Apple/Google integration. Sends are best-effort: a push failure must
 * never break the action that triggered it (booking, payment, reminder).
 *
 * Delivery is two-phase: `sendPushNotificationsAsync` returns *tickets*
 * immediately; the real per-device outcome arrives later as *receipts*. We
 * enqueue a delayed `check-push-receipts` job (handled by the platform-events
 * worker) to reconcile — that's where stale tokens get deactivated.
 */

const expo = new Expo();

/** Delay before the receipt-check job runs — Expo needs time to deliver. */
const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;

export interface SendPushParams {
  userId: string;
  title: string;
  body: string;
  /** Deep-link payload delivered to the device (type, referenceId, …). */
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
}

export interface SendPushResult {
  sent: number;
  failed: number;
  tickets: ExpoPushTicket[];
}

/** Re-export Expo's token-format check so routes never import the SDK. */
export function isValidExpoToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

// ---------------------------------------------------------------------------
// Token registration
// ---------------------------------------------------------------------------

export async function registerToken(
  userId: string,
  tenantId: string | null,
  token: string,
  platform: string,
  deviceName?: string,
) {
  return rawPrisma.devicePushToken.upsert({
    // Expo identifies the installation, not the signed-in account. If the
    // device changes accounts, transfer ownership so it cannot receive the
    // previous client's future notifications.
    where: { token },
    create: { userId, tenantId, token, platform, deviceName: deviceName ?? null },
    update: {
      userId,
      tenantId,
      isActive: true,
      lastSeenAt: new Date(),
      platform,
      deviceName: deviceName ?? null,
    },
  });
}

/** Soft-deregister — keep the row for audit, just flip it inactive. */
export async function deregisterToken(userId: string, token: string) {
  const res = await rawPrisma.devicePushToken.updateMany({
    where: { userId, token },
    data: { isActive: false },
  });
  return { deregistered: res.count };
}

export async function getUserTokens(userId: string) {
  return rawPrisma.devicePushToken.findMany({
    where: { userId, isActive: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function buildMessages(tokens: string[], params: SendPushParams): ExpoPushMessage[] {
  const messages: ExpoPushMessage[] = [];
  for (const token of tokens) {
    // Invalid tokens (malformed, or a non-Expo string) are skipped silently —
    // a bad row shouldn't poison the whole batch.
    if (!Expo.isExpoPushToken(token)) {
      logger.warn({ token }, 'push.invalid_token_skipped');
      continue;
    }
    messages.push({
      to: token,
      title: params.title,
      body: params.body,
      sound: params.sound === undefined ? 'default' : params.sound,
      ...(params.badge !== undefined ? { badge: params.badge } : {}),
      ...(params.data ? { data: params.data } : {}),
    });
  }
  return messages;
}

async function dispatch(messages: ExpoPushMessage[]): Promise<SendPushResult> {
  if (messages.length === 0) return { sent: 0, failed: 0, tickets: [] };

  // Expo caps a request at 100 notifications — chunk to stay under it.
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    try {
      tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
    } catch (err) {
      logger.error({ err }, 'push.send_chunk_failed');
    }
  }

  const sent = tickets.filter((t) => t.status === 'ok').length;

  // Queue the async receipt check for every accepted ticket.
  const receiptIds = tickets
    .filter((t): t is ExpoPushTicket & { status: 'ok'; id: string } => t.status === 'ok')
    .map((t) => t.id);
  if (receiptIds.length > 0) {
    try {
      await platformEventsQueue.add(
        'check-push-receipts',
        { receiptIds },
        { delay: RECEIPT_CHECK_DELAY_MS, attempts: 1 },
      );
    } catch (err) {
      logger.error({ err }, 'push.receipt_enqueue_failed');
    }
  }

  return { sent, failed: tickets.length - sent, tickets };
}

/** Send one notification to every active device of a single user. */
export async function sendPushNotification(params: SendPushParams): Promise<SendPushResult> {
  const tokens = await rawPrisma.devicePushToken.findMany({
    where: { userId: params.userId, isActive: true },
    select: { token: true },
  });
  if (tokens.length === 0) return { sent: 0, failed: 0, tickets: [] };
  return dispatch(buildMessages(tokens.map((t) => t.token), params));
}

/**
 * Batch send — one notification body to every active device of every listed
 * user. Used to fan a single event out to e.g. owner + assigned staff.
 */
export async function sendPushToMany(
  userIds: string[],
  params: Omit<SendPushParams, 'userId'>,
): Promise<SendPushResult> {
  if (userIds.length === 0) return { sent: 0, failed: 0, tickets: [] };
  const tokens = await rawPrisma.devicePushToken.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { token: true },
  });
  if (tokens.length === 0) return { sent: 0, failed: 0, tickets: [] };
  return dispatch(buildMessages(tokens.map((t) => t.token), { ...params, userId: '' }));
}

// ---------------------------------------------------------------------------
// Receipt checking — runs ~15 min after a send, via the platform-events worker
// ---------------------------------------------------------------------------

export interface ReceiptCheckResult {
  checked: number;
  deregistered: number;
  errors: number;
}

/** Expo embeds the offending token in the DeviceNotRegistered error message. */
function tokenFromReceiptMessage(message: string | undefined): string | null {
  const m = message?.match(/ExponentPushToken\[[^\]]+\]/);
  return m ? m[0] : null;
}

export async function checkPushReceipts(receiptIds: string[]): Promise<ReceiptCheckResult> {
  let checked = 0;
  let deregistered = 0;
  let errors = 0;

  for (const chunk of expo.chunkPushNotificationReceiptIds(receiptIds)) {
    let receipts;
    try {
      receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    } catch (err) {
      logger.error({ err }, 'push.receipt_fetch_failed');
      continue;
    }

    for (const [, receipt] of Object.entries(receipts)) {
      checked++;
      if (receipt.status !== 'error') continue;
      errors++;
      const code = receipt.details?.error;
      if (code === 'DeviceNotRegistered') {
        // The device uninstalled the app — flip its token inactive so we
        // stop wasting sends on it.
        const token = tokenFromReceiptMessage(receipt.message);
        if (token) {
          const res = await rawPrisma.devicePushToken.updateMany({
            where: { token },
            data: { isActive: false },
          });
          deregistered += res.count;
        }
      } else if (code === 'MessageTooBig') {
        logger.warn({ receipt }, 'push.receipt_message_too_big');
      } else if (code === 'InvalidCredentials') {
        logger.error({ receipt }, 'push.receipt_invalid_credentials — check Expo/EAS credentials');
      } else {
        logger.warn({ receipt }, 'push.receipt_error');
      }
    }
  }

  return { checked, deregistered, errors };
}
