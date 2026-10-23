import { appEvents } from '../lib/events';

// Placeholder audit logging — swap console.log for a real UsageLog/AuditLog
// table write once you build that model later in the bootcamp.
appEvents.on('admin:role-assigned', async (data: any) => {
  try {
    console.log('[AUDIT] role assigned', data);
  } catch (error) {
    console.error('Failed to log role assignment:', error);
  }
});

appEvents.on('admin:role-revoked', async (data: any) => {
  try {
    console.log('[AUDIT] role revoked', data);
  } catch (error) {
    console.error('Failed to log role revocation:', error);
  }
});