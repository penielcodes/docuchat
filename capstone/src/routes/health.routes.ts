import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { cacheRedis } from '../lib/cache';

const router = Router();

// Liveness: is the process alive? (restart if this fails)
router.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Readiness: can it actually serve requests? (route traffic away if this fails)
// A health check that always returns 200 hides real outages — this one
// genuinely pings the database and Redis.
router.get('/health/ready', async (req, res) => {
  const checks: Record<string, any> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch (error) {
    checks.database = { status: 'error', message: (error as Error).message };
  }

  try {
    await cacheRedis.ping();
    checks.redis = { status: 'ok' };
  } catch (error) {
    checks.redis = { status: 'error', message: (error as Error).message };
  }

  const allHealthy = Object.values(checks).every((c: any) => c.status === 'ok');
  res.status(allHealthy ? 200 : 503).json({ status: allHealthy ? 'ok' : 'degraded', checks });
});

export default router;