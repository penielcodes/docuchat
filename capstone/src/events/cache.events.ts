import { appEvents } from '../lib/events';
import { cacheDel } from '../lib/cache';
import { logger } from '../lib/logger';

// Event-based invalidation is the FAST path (instant); the TTL above is
// the safety net (eventually correct even if an event listener fails).
appEvents.on('admin:role-assigned', async (data: any) => {
  try {
    await cacheDel(`permissions:${data.targetUserId}`);
  } catch (error) {
    logger.error({ error }, 'Failed to bust permissions cache');
  }
});

appEvents.on('admin:role-revoked', async (data: any) => {
  try {
    await cacheDel(`permissions:${data.targetUserId}`);
  } catch (error) {
    logger.error({ error }, 'Failed to bust permissions cache');
  }
});

appEvents.on('doc:deleted', async (data: any) => {
  try {
    await cacheDel(`doc:${data.documentId}`);
  } catch (error) {
    logger.error({ error }, 'Failed to bust document cache');
  }
});