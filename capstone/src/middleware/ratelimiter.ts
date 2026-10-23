import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { cacheRedis } from '../lib/cache';
import { Request } from 'express';

function createLimiter(options: {
  windowMs: number;
  max: number | ((req: Request) => number);
  message: string;
  keyGenerator?: (req: Request) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => (cacheRedis as any).call(...args),
    }),
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: options.message },
    },
    // ipKeyGenerator normalizes IPv6 addresses (e.g. collapses an address
    // to its /64 subnet) so a user can't dodge limits by requesting a new
    // IPv6 address within the same block — raw req.ip doesn't do this.
    keyGenerator: options.keyGenerator || ((req: Request) => (req as any).user?.id || ipKeyGenerator(req.ip || '') || 'anonymous'),
  });
}

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auth attempts. Please try again later.',
  keyGenerator: (req) => ipKeyGenerator(req.ip || 'anonymous'),
});

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: (req: Request) => {
    const tier = (req as any).user?.tier || 'free';
    return { free: 100, pro: 500, enterprise: 2000 }[tier] || 100;
  },
  message: 'Rate limit exceeded. Please slow down.',
});

export const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: (req: Request) => {
    const tier = (req as any).user?.tier || 'free';
    return { free: 5, pro: 50, enterprise: 500 }[tier] || 5;
  },
  message: 'Upload limit reached. Please try again later.',
});

export const chatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: (req: Request) => {
    const tier = (req as any).user?.tier || 'free';
    return { free: 10, pro: 30, enterprise: 100 }[tier] || 10;
  },
  message: 'Too many queries. Please slow down.',
});