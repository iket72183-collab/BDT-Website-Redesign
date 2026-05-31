# BDT Connect — Push Notifications (Expo)

> Expo Push delivers to APNs (iOS) + FCM (Android) through one token format
> and one send API — no direct Apple/Google integration. Free tier, no API
> key. This doc covers setup, testing, and production.

Companion docs: [WORKER_SETUP.md](WORKER_SETUP.md) (the queue that dispatches),
[API_REFERENCE.md](API_REFERENCE.md).

---

## 1. How it flows

```
Mobile app  → registers Expo token  → POST /api/push/register
                                          ↓
                                    device_push_tokens
                                          ↓
notify()  → in-app row + fire-and-forget pushService.sendPushNotification()
                                          ↓
                          Expo Push Service → APNs / FCM → device
                                          ↓ (tickets)
            platform-events queue: delayed `check-push-receipts` job (15 min)
                                          ↓
            checkPushReceipts() → deactivates DeviceNotRegistered tokens
```

Code map:

| Concern | File |
|---|---|
| Expo SDK call surface | `src/services/pushService.ts` |
| Push fan-out from notify() | `src/services/notificationService.ts` |
| Register / deregister / list routes | `src/routes/push.ts` |
| Receipt-check job handler | `src/workers/platformEvents.worker.ts` (`check-push-receipts`) |
| Token table | `device_push_tokens` (`prisma/schema.prisma`) |
| Mobile registration hook | `apps/mobile/src/hooks/usePushNotifications.ts` |

---

## 2. EAS project ID (required)

Expo push tokens are scoped to an EAS project. `getExpoPushTokenAsync` needs
the project's UUID.

1. Create a free account at <https://expo.dev>.
2. Create a project (or `eas init` from `apps/mobile`).
3. Copy the project UUID from the project's dashboard.
4. Put it in `apps/mobile/app.json`:

```json
"extra": { "eas": { "projectId": "<your-uuid>" } }
```

The committed value is the placeholder `00000000-0000-0000-0000-000000000000`
— **replace it** or token registration fails on a real device.

---

## 3. Mobile permissions + assets

The `expo-notifications` config plugin is registered in `app.json` with the
brand color `#C9A882`. Two **optional** assets are not wired (they'd break the
build if referenced before they exist) — add them when ready:

```json
["expo-notifications", {
  "color": "#C9A882",
  "icon": "./assets/notification-icon.png",   // 96x96 white-on-transparent PNG
  "sounds": ["./assets/notification.wav"]
}]
```

Permissions are requested at runtime by `usePushNotifications` — iOS shows the
system prompt on first call; Android grants on install (channel `bookings` is
created in `app/_layout.tsx`).

---

## 4. Testing

- **Use a physical device.** Simulators/emulators cannot receive remote push;
  `usePushNotifications` returns `null` on them (`Device.isDevice` check).
- Sign in on the device → `app/_layout.tsx` registers the token automatically.
- Verify the row: `device_push_tokens` has an `is_active=true` row for the user.
- Trigger any `notify()` path (create a booking, confirm a payment). The push
  arrives within seconds.
- Send a manual test from <https://expo.dev/notifications> using the token.

---

## 5. Receipt checking (production-important)

`sendPushNotificationsAsync` returns **tickets** (accepted/rejected by Expo),
NOT delivery confirmation. The real outcome is a **receipt**, available a few
minutes later. `pushService` enqueues a delayed `check-push-receipts` job (15
min) onto the `platform-events` queue; the worker calls `checkPushReceipts`:

- `DeviceNotRegistered` → the app was uninstalled. The token is flipped
  `is_active=false` so we stop sending to it.
- `MessageTooBig` → logged; trim the body.
- `InvalidCredentials` → logged critical — the EAS push credentials need
  attention.

Without receipt checking, stale tokens accumulate and waste every send.

---

## 6. Production checklist

- [ ] Real EAS `projectId` in `app.json`.
- [ ] **iOS:** `eas credentials` → let EAS manage the APNs key. No manual
      `.p8`/cert handling — EAS provisions it.
- [ ] **Android:** EAS manages the FCM v1 credentials; upload the Firebase
      service-account JSON via `eas credentials` (or the project dashboard).
- [ ] `expo-notifications` + `expo-device` installed in `apps/mobile`
      (`pnpm --filter @bdt/mobile install` — they were added to package.json).
- [ ] Notification icon + sound assets added (see §3).
- [ ] The worker process is running (`pnpm --filter @bdt/api worker`) — it
      owns receipt checking. No worker ⇒ stale tokens never get pruned.
- [ ] Consider Expo's paid tier only if you exceed the free send limits.

---

## 7. Monitoring the receipt-check queue

`check-push-receipts` jobs ride the existing `platform-events` queue, so they
show up in the same Bull Board dashboard described in
[WORKER_SETUP.md §5](WORKER_SETUP.md). Watch the `platform-events` failed
count — a spike there can mean Expo receipt fetches are erroring.
