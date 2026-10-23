import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function attachFingerprint(req: Request, res: Response, next: NextFunction) {
  const signals = [
    req.ip,
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ];
  (req as any).fingerprint = crypto.createHash('sha256').update(signals.join('|')).digest('hex').substring(0, 16);
  next();
}