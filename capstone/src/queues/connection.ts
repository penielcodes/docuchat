import IORedis from 'ioredis';
import { config } from '../lib/config';

// maxRetriesPerRequest: null is REQUIRED by BullMQ — without it ioredis
// throws on BullMQ's internal long-polling commands.
export const redisConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});