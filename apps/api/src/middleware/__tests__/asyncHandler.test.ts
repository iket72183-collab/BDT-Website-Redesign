import { describe, expect, it, vi } from 'vitest';
import { asyncHandler } from '../asyncHandler.js';

/**
 * asyncHandler regression — confirms a rejected promise from an async route
 * handler reaches the Express error pipeline via `next(err)` instead of
 * becoming an unhandled rejection (which would hang the request).
 *
 * The bug we're guarding against: Express 4 does NOT auto-catch promise
 * rejections from async route handlers. Without this wrapper, every
 * `await thing.thatThrows()` inside a handler hangs forever.
 */

/** Test helper — wait for vitest's microtask queue to drain. The wrapper
 *  catches asynchronously, so the assertion must run *after* all
 *  microtasks settle. */
function flush(): Promise<void> {
  return new Promise((r) => setImmediate(r));
}

describe('asyncHandler', () => {
  it('forwards async rejections to next', async () => {
    const next = vi.fn();
    const boom = new Error('boom');
    const handler = asyncHandler(async () => {
      throw boom;
    });

    handler({} as never, {} as never, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards synchronous throws to next', async () => {
    const next = vi.fn();
    const boom = new Error('sync-boom');
    const handler = asyncHandler(() => {
      throw boom;
    });

    handler({} as never, {} as never, next);
    await flush();

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('does NOT call next on a successful handler', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async () => 'done');

    handler({} as never, {} as never, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
  });
});
