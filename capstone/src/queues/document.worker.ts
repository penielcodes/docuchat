import { Worker, Job } from 'bullmq';
import { redisConnection } from './connection';
import { prisma } from '../lib/prisma';
import { appEvents } from '../lib/events';
import { DOC_EVENTS } from '../events/document.events';
import { splitIntoChunks, estimateTokens } from '../lib/chunker';
import { deadLetterQueue } from './dead-letter.queue';

const worker = new Worker(
  'document-processing',
  async (job: Job) => {
    const { documentId } = job.data;
    const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

    await prisma.document.update({ where: { id: documentId }, data: { status: 'processing' } });

    try {
      await job.updateProgress(10);
      const chunks = splitIntoChunks(doc.content, 500);
      await job.updateProgress(40);

      await prisma.$transaction(async (tx) => {
        // Delete-then-recreate makes this idempotent — safe to run
        // twice if the job gets retried, no duplicate chunks.
        await tx.chunk.deleteMany({ where: { documentId } });
        await tx.chunk.createMany({
          data: chunks.map((text, index) => ({ documentId, index, content: text, tokenCount: estimateTokens(text) })),
        });
        await tx.document.update({ where: { id: documentId }, data: { status: 'ready', chunkCount: chunks.length } });
      });

      await job.updateProgress(100);
      appEvents.emit(DOC_EVENTS.PROCESSED, { documentId, chunkCount: chunks.length });
      return { success: true, chunks: chunks.length };
    } catch (error) {
      // Only mark the document "failed" once all retries are exhausted —
      // otherwise the user sees "failed" while BullMQ is still retrying.
      if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'failed', error: (error as Error).message },
        });
      }
      throw error; // re-throw so BullMQ actually retries
    }
  },
  { connection: redisConnection, concurrency: 3 }
);

worker.on('completed', (job) => console.log(`Job ${job.id} completed: ${job.returnvalue?.chunks} chunks`));

worker.on('failed', async (job, error) => {
  console.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, error.message);
  if (!job) return;
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await deadLetterQueue.add('failed-document', {
      originalJobId: job.id,
      data: job.data,
      error: error.message,
      attempts: job.attemptsMade,
    });
  }
});

// Required — without this listener, a Redis connection error crashes your whole process
worker.on('error', (error) => console.error('Worker error:', error));

export { worker };