import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Lets the client skip re-downloading a response that hasn't changed —
// compares a hash of the body against what the client already has.
export function conditionalGet() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      const content = JSON.stringify(body);
      const etag = `"${crypto.createHash('md5').update(content).digest('hex')}"`;
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return res;
      }
      return originalJson(body);
    };

    next();
  };
}