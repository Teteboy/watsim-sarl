import { Queue, Worker, QueueEvents, JobsOptions } from 'bullmq';
import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { processRepaymentJob } from './repayment.job';
import { processScoreUpdateJob } from './score-update.job';
import { processKycVerifyJob } from './kyc-verify.job';

export const QUEUE_NAMES = {
  REPAYMENT: 'repayment',
  SCORE_UPDATE: 'score-update',
  KYC_VERIFY: 'kyc-verify',
} as const;

let queues: Record<string, Queue> = {};
let workers: Worker[] = [];
let events: QueueEvents[] = [];
let redisAvailable = false;

function isRedisAvailable(): boolean {
  const redis = getRedis();
  return !!redis && 'defineCommand' in redis;
}

function getBullConnection() {
  return { url: env.REDIS_URL };
}

function makeQueue(name: string): Queue | null {
  if (!redisAvailable) return null;
  if (!queues[name]) queues[name] = new Queue(name, { connection: getBullConnection() });
  return queues[name];
}

export async function enqueueScoreUpdate(userId: string, opts?: JobsOptions): Promise<void> {
  const q = makeQueue(QUEUE_NAMES.SCORE_UPDATE);
  if (!q) return;
  await q.add('score-update', { userId }, { removeOnComplete: 100, removeOnFail: 100, ...opts });
}

export async function enqueueKycVerification(docId: string, opts?: JobsOptions): Promise<void> {
  const q = makeQueue(QUEUE_NAMES.KYC_VERIFY);
  if (!q) return;
  await q.add('kyc-verify', { docId }, { removeOnComplete: 100, removeOnFail: 100, ...opts });
}

export async function enqueueRepaymentScan(opts?: JobsOptions): Promise<void> {
  const q = makeQueue(QUEUE_NAMES.REPAYMENT);
  if (!q) return;
  await q.add('repayment-scan', {}, { removeOnComplete: 50, removeOnFail: 50, ...opts });
}

export async function startWorkers(): Promise<void> {
  redisAvailable = isRedisAvailable();
  if (!redisAvailable) {
    logger.info('BullMQ workers skipped (no Redis)');
    return;
  }

  const connection = getBullConnection();
  workers.push(new Worker(QUEUE_NAMES.SCORE_UPDATE, async (job) => processScoreUpdateJob(job.data as { userId: string }), { connection }));
  workers.push(new Worker(QUEUE_NAMES.KYC_VERIFY, async (job) => processKycVerifyJob(job.data as { docId: string }), { connection }));
  workers.push(new Worker(QUEUE_NAMES.REPAYMENT, async () => processRepaymentJob(), { connection }));

  workers.forEach((w) => {
    w.on('failed', (job, err) => logger.error({ queue: w.name, jobId: job?.id, err }, 'Job failed'));
    w.on('completed', (job) => logger.debug({ queue: w.name, jobId: job.id }, 'Job completed'));
  });

  // Daily repayment scan: cron 0 6 * * * Africa/Douala (UTC+1 -> 0 5 UTC)
  const repaymentQueue = makeQueue(QUEUE_NAMES.REPAYMENT)!;
  await repaymentQueue.add(
    'daily-scan',
    {},
    { repeat: { pattern: '0 6 * * *', tz: 'Africa/Douala' }, jobId: 'daily-repayment-scan' },
  );

  events.push(new QueueEvents(QUEUE_NAMES.REPAYMENT, { connection: getBullConnection() }));
  logger.info('BullMQ workers started');
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(events.map((e) => e.close()));
  await Promise.all(Object.values(queues).map((q) => q.close()));
  workers = []; events = []; queues = {};
}
