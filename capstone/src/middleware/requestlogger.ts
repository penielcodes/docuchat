import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const startTime = Date.now();

  logger.info({ correlationId, method: req.method, path: req.path, ip: req.ip }, 'Request received');

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logData = {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      userId: (req as any).user?.id,
    };

    if (res.statusCode >= 500) logger.error(logData, 'Request failed');
    else if (res.statusCode >= 400) logger.warn(logData, 'Request client error');
    else logger.info(logData, 'Request completed');
  });

  next();
}