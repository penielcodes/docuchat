import { appEvents } from '../lib/events';
import { prisma } from '../lib/prisma';

export const DOC_EVENTS = {
  CREATED: 'doc:created',
  PROCESSED: 'doc:processed',
  DELETED: 'doc:deleted',
} as const;

appEvents.on(DOC_EVENTS.CREATED, async (data: any) => {
  try {
    await prisma.usageLog.create({
      data: { userId: data.userId, action: 'document_created', metadata: JSON.stringify(data) },
    });
  } catch (error) {
    console.error('Failed to log document creation:', error);
  }
});

appEvents.on(DOC_EVENTS.DELETED, async (data: any) => {
  try {
    await prisma.usageLog.create({
      data: { userId: data.deletedBy, action: 'document_deleted', metadata: JSON.stringify(data) },
    });
  } catch (error) {
    console.error('Failed to log document deletion:', error);
  }
});