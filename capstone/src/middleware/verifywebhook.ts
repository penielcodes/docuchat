import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function verifyWebhookSignature(secret: string, headerName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers[headerName.toLowerCase()] as string;
    if (!signature) return res.status(401).json({ error: 'Missing signature header' });

    const rawBody = (req as any).rawBody;
    if (!rawBody) return res.status(500).json({ error: 'Raw body not captured' });

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // timingSafeEqual instead of === — a naive comparison leaks timing
    // info an attacker can use to guess the signature byte by byte.
    const providedBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    next();
  };
}