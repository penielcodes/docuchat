import { Queue } from 'bullmq';
import { redisConnection } from './connection';

// A holding pen for jobs that exhausted every retry — nothing processes
// this automatically; it's for manual inspection later.
export const deadLetterQueue = new Queue('dead-letter', { connection: redisConnection });