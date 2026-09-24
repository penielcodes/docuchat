import { appEvents } from '../lib/events';
import { prisma } from '../lib/prisma';

export const AUTH_EVENTS = {
  USER_REGISTERED: 'auth:user-registered',
  USER_LOGGED_IN: 'auth:user-logged-in',
  USER_LOGGED_OUT: 'auth:user-logged-out',
  TOKEN_REFRESHED: 'auth:token-refreshed',
  LOGIN_FAILED: 'auth:login-failed',
} as const;

appEvents.on(AUTH_EVENTS.USER_REGISTERED, async (user) => {
  try {
    console.log('Signup logged for', user.email);
  } catch (error) {
    console.error('Failed to log signup:', error);
  }
});

appEvents.on(AUTH_EVENTS.USER_LOGGED_IN, async (data) => {
  try {
    console.log('Login logged for user', data.userId);
  } catch (error) {
    console.error('Failed to log login:', error);
  }
});

appEvents.on(AUTH_EVENTS.LOGIN_FAILED, async (data) => {
  try {
    console.warn(`Failed login attempt for ${data.email} from ${data.deviceInfo}`);
  } catch (error) {
    console.error('Failed to log failed login:', error);
  }
});