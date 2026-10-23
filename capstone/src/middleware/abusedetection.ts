import { Request, Response, NextFunction } from 'express';
import { cacheRedis } from '../lib/cache';
import { logger } from '../lib/logger';

export async function trackSuspiciousActivity(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id;
  if (!userId) return next();

  if (req.path.match(/\/documents\/[\w-]+$/)) {
    const key = `access-pattern:${userId}`;
    const docId = req.params.id;

    if (docId) {
      // SADD deduplicates automatically — viewing the same doc twice
      // doesn't inflate the count, only genuinely unique docs do.
      await cacheRedis.sadd(key, docId);
      await cacheRedis.expire(key, 300);

      const uniqueDocs = await cacheRedis.scard(key);
      if (uniqueDocs > 50) {
        logger.warn({ userId, uniqueDocs }, 'Suspicious: many unique documents accessed in 5 min');
      }
    }
  }
  next();
}