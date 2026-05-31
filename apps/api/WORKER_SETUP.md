# BDT Connect — Background Workers (BullMQ)

> The async processing layer: appointment reminders, abandoned-payment
> cleanup, and off-request event logging. Runs as a **separate process** from
> the API server so a worker crash never takes HTTP down.

Companion docs: [BOOKING_ENGINE.md](BOOKING_ENGINE.md) §10/§11 (reminder +
cleanup design), [STRIPE_SETUP.md](STRIPE_SETUP.md) (PaymentIntents).

---

## 1. Architecture

```
┌────────────────┐      enqueue        ┌─────────┐      consume     ┌────────────────┐
│  API server    │ ──────────────────▶ │  Redis  │ ◀────────────────│  worker process│
│  (src/index.ts)│   src/queues/*.ts   │ (BullMQ)│  src/workers/*   │  (worker.ts)   │
└────────────────┘                     └─────────┘                  └────────────────┘
```

Three queues, one worker process (one BullMQ `Worker` per queue):

| Queue | Jobs | Producer | Worker |
|---|---|---|---|
| `booking-reminders` | per-booking delayed reminders (24h + 1h) | `src/queues/bookingReminders.ts` | `src/workers/bookingReminders.worker.ts` |
| `payment-cleanup` | 30-min-delayed abandoned-payment check | `src/queues/paymentCleanup.ts` | `src/workers/paymentCleanup.worker.ts` |
| `platform-events` | async audit/analytics writes | `src/queues/platformEvents.ts` | `src/workers/platformEvents.worker.ts` |

Connection + shared job options live in `src/queues/index.ts`. Default job
options: `attempts: 3`, exponential backoff (5s base), keep last 100 completed
/ 500 failed. `platform-events` overrides `attempts: 1` (analytics isn't worth
retrying).

**Far-future jobs survive restarts.** BullMQ persists delayed jobs in Redis —
a reminder scheduled 24h out is stored in Redis, not in worker memory, so a
worker restart (or a 23-hour downtime) doesn't lose it.

---

## 2. Local Redis

```bash
docker run -d --name bdt-redis -p 6379:6379 redis:7-alpine
```

Stop / start later with `docker stop bdt-redis` / `docker start bdt-redis`.
Set `REDIS_URL=redis://localhost:6379` in `.env` (the default).

---

## 3. Running API + workers together

They are two processes. In separate terminals:

```bash
pnpm --filter @bdt/api dev       # API server  (HTTP)
pnpm --filter @bdt/api worker:dev # worker process (queues)
```

Or run both with one command via `concurrently`:

```bash
pnpm --filter @bdt/api add -D concurrently
# then, in apps/api/package.json scripts:
#   "dev:all": "concurrently -n api,worker \"pnpm dev\" \"pnpm worker:dev\""
```

Production scripts (already added):

```
pnpm --filter @bdt/api worker      # tsx worker.ts
pnpm --filter @bdt/api worker:dev  # tsx watch worker.ts
```

---

## 4. Graceful shutdown

`worker.ts` traps `SIGTERM` / `SIGINT`:

1. `worker.close()` on each worker — stops pulling NEW jobs, lets in-flight
   jobs finish.
2. `closeQueues()` — closes the queue handles and quits the Redis connection.
3. `process.exit(0)`.

A second signal during shutdown is ignored (the `shuttingDown` guard). Hosting
platforms send `SIGTERM` then wait ~30s before `SIGKILL` — long enough for any
in-flight reminder/cleanup job to complete.

---

## 5. Queue monitoring

`src/queues/monitor.ts` exposes `getQueueHealth()` → waiting/active/delayed/
completed/failed counts per queue. **TODO (scaffold):** wire it to
`GET /api/admin/queue-health` (`requireRole('platform_admin')`) for the
superadmin dashboard.

For a full visual dashboard, add **Bull Board** later:

```bash
pnpm --filter @bdt/api add @bull-board/api @bull-board/express
```

Then mount once in `src/server.ts` (one `createBullBoard(...)` + `app.use`).
Not built now — keep it behind platform-admin auth when you do.

---

## 6. Re-queueing failed jobs manually

Failed jobs are retained (last 500 per queue). To inspect / retry from a Node
REPL or a one-off script:

```ts
import { bookingRemindersQueue } from './src/queues/index.js';

const failed = await bookingRemindersQueue.getFailed();      // Job[]
for (const job of failed) {
  console.log(job.id, job.failedReason);
  await job.retry();                                         // re-queue one
}
```

Bull Board (above) gives the same retry button in a UI.

---

## 7. Production deployment

- **Workers = separate service.** On Render/Railway, deploy `apps/api` twice:
  one **Web Service** (`pnpm start`) and one **Background Worker**
  (`pnpm worker`). Same image/repo, different start command.
- **Redis:** Upstash (serverless, generous free tier) or a Railway/Render
  Redis add-on. Set `REDIS_URL` to the provider's connection string. Upstash
  needs `rediss://` (TLS) — ioredis handles it from the URL scheme.
- `maxRetriesPerRequest: null` is set on the connection — **required** by
  BullMQ for the worker's blocking commands. Do not remove it.
- Scale workers horizontally by running more worker instances — BullMQ
  distributes jobs across them automatically. `WORKER_CONCURRENCY` controls
  in-process parallelism per worker.
- **Redis down ≠ API down.** Producers wrap every `add()` in try/catch and
  log; the connection's `error` event is handled. The API keeps serving
  requests; only background processing pauses until Redis returns.

---

## 8. Consistency risks (where a job failure could leave bad state)

These are the spots to watch — flagged per the build brief:

1. **Reminder marked-sent ordering.** The reminder worker sends the email,
   then stamps `reminder{24h,1h}SentAt`. If the *stamp* write fails after the
   email sent, BullMQ retries the whole job → a second email. The conditional
   `updateMany (WHERE col IS NULL)` prevents a *third*, but one duplicate
   email is possible. Acceptable (a duplicate reminder is mild); tighten by
   claiming the row before sending if it ever matters.

2. **Booking created but reminders never scheduled.** If `queue.add()` fails
   (Redis down) when a booking is created, the producer logs and returns —
   the booking exists with **no reminders**. There is no reconciliation sweep.
   Mitigation path: a periodic repeatable job that finds confirmed bookings
   with no queued reminder. Not built.

3. **Payment cleanup vs. webhook race.** `payment_intent.succeeded` must call
   `cancelPaymentCleanup(bookingId)`. If it doesn't, the cleanup job still
   runs its `booking.status !== 'pending'` guard and skips a confirmed
   booking — safe. The genuine danger is only if the booking were *still*
   `pending` when the worker runs; the worker re-checks the live PI status
   with Stripe (`getPaymentIntentStatus`) before cancelling, so a succeeded
   PI is recovered, not cancelled.

4. **`processing` PI.** If the bank is still deciding, the worker re-queues
   the check 5 minutes out instead of cancelling — cancelling a `processing`
   PI risks a charge with no booking.

5. **WIRING NOT YET DONE (next session).** The producers/workers are built
   and typecheck clean, but the calls into `bookingService` (schedule on
   create, cancel on cancel, reschedule on reschedule) and `webhooks.ts`
   (`cancelPaymentCleanup` on `payment_intent.succeeded`) are **not wired
   yet** — see this session's stopping-point note. Until wired, no jobs are
   ever produced.
