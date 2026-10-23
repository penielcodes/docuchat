import { appEvents } from '../lib/events';
import { cacheRedis } from '../lib/cache';
import { logger } from '../lib/logger';

appEvents.on('auth:login-failed', async (data: any) => {
  try {
    const key = `login-failures:${data.deviceInfo}`;
    // INCR is atomic — safe even if many failed logins arrive at once
    const failures = await cacheRedis.incr(key);
    if (failures === 1) await cacheRedis.expire(key, 900);

    if (failures >= 5) {
      logger.warn({ failures, email: data.email, deviceInfo: data.deviceInfo }, 'Repeated failed logins');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to track login failure');
  }
});