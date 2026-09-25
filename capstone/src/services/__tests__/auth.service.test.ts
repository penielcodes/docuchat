import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from '../auth.service';
import { prisma } from '../../lib/prisma';

// vi.mock replaces the ENTIRE module with a fake version.
// Every function we list becomes a vi.fn() — a mock we control in each test,
// instead of a real function that hits an actual database.
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// We also mock the event emitter so register() doesn't try to run
// real event listeners (which log to console, but could later hit a DB).
vi.mock('../../lib/events', () => ({
  appEvents: { emit: vi.fn(), on: vi.fn() },
}));

describe('auth.service.register', () => {
  // Runs before EVERY test in this block — wipes out any mock calls/return
  // values left over from the previous test so tests don't leak into each other.
  beforeEach(() => vi.clearAllMocks());

  it('creates a user with a hashed password', async () => {
    // Tell the mock: "when findUnique is called, pretend no user exists yet"
    (prisma.user.findUnique as any).mockResolvedValue(null);

    // Tell the mock: "when create is called, pretend it succeeded and
    // return this fake user object"
    (prisma.user.create as any).mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      tier: 'free',
      passwordHash: '$2b$12$fakehash',
    });

    const result = await authService.register({
      name: 'Test User',
      email: 'test@example.com',
      password: 'SecurePass1',
    });

    // Check that create() was called with a bcrypt-shaped hash, not the
    // plaintext password — proves hashing actually happened.
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'test@example.com',
        passwordHash: expect.stringMatching(/^\$2[aby]\$/),
      }),
    });

    // The returned object should never leak the password hash to the caller.
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toHaveProperty('id');
  });

  it('throws ConflictError if email exists', async () => {
    // This time, pretend a user with this email is already in the database.
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' });

    // .rejects.toThrow checks that the promise rejects with a matching error.
    await expect(
      authService.register({
        name: 'Test',
        email: 'taken@example.com',
        password: 'SecurePass1',
      })
    ).rejects.toThrow('Email already registered');
  });
});

describe('auth.service.login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns tokens for valid credentials', async () => {
    // We need a REAL bcrypt hash here (not a fake string) because login()
    // actually calls bcrypt.compare() against it — that part isn't mocked.
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('SecurePass1', 4); // low rounds = fast test

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      tier: 'free',
      isActive: true,
      passwordHash: hash,
    });
    (prisma.refreshToken.create as any).mockResolvedValue({});

    const result = await authService.login({
      email: 'test@example.com',
      password: 'SecurePass1',
    });

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe('test@example.com');
  });

  it('throws the same error for wrong password AND non-existent user', async () => {
    // This is a SECURITY test. If wrong-password and no-such-user returned
    // different messages, an attacker could use that to guess which emails
    // are registered (a "user enumeration" vulnerability).
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('RealPassword1', 4);

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      isActive: true,
      passwordHash: hash,
    });

    await expect(
      authService.login({ email: 'test@example.com', password: 'WrongPassword1' })
    ).rejects.toThrow('Invalid credentials');

    (prisma.user.findUnique as any).mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@example.com', password: 'Whatever1' })
    ).rejects.toThrow('Invalid credentials');
  });
});