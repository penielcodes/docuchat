import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '../lib/metrics';

// Collapses /documents/abc-123 and /documents/def-456 into one series
// (/documents/:id) — without this, every unique ID creates a new metric
// series, which can crash Prometheus at scale ("cardinality explosion").
function normalizePath(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ':id')
    .replace(/\/c[a-z0-9]{20,}/gi, '/:id') // also catches Prisma's cuid() format
    .replace(/\/\d+/g, '/:num');
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = normalizePath(req.route?.path || req.path);
  const end = httpRequestDuration.startTimer({ method: req.method, path });

  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, path, status_code: res.statusCode.toString() });
    end();
  });

  next();
}