import type { Queue } from 'bullmq';
import { platformEventsQueue } from './index.js';
import { logger } from '../lib/logger.js';

export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

export interface QueueHealth {
  platformEvents: QueueCounts;
  /** False when Redis is unreachable — counts are zeroed in that case. */
  reachable: boolean;
}

async function countsFor(queue: Queue): Promise<QueueCounts> {
  const c = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
  return {
    waiting: c.waiting ?? 0,
    active: c.active ?? 0,
    delayed: c.delayed ?? 0,
    completed: c.completed ?? 0,
    failed: c.failed ?? 0,
  };
}

const ZERO: QueueCounts = { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 };

export async function getQueueHealth(): Promise<QueueHealth> {
  try {
    const platformEvents = await countsFor(platformEventsQueue);
    return { platformEvents, reachable: true };
  } catch (err) {
    logger.error({ err }, 'queue.health_check_failed');
    return { platformEvents: ZERO, reachable: false };
  }
}
