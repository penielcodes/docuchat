import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

// Wipes the test database clean before each test suite.
// Order matters: RefreshToken has a foreign key pointing to User, so we
// must delete RefreshToken rows FIRST — otherwise the database rejects
// deleting a User that still has RefreshToken rows referencing it.
export async function resetDatabase() {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

// Creates a real user directly in the database (bypassing the API),
// so tests can quickly set up "this user already exists" scenarios.
export async function createTestUser(overrides: Partial<{ email: string }> = {}) {
  // Only 4 bcrypt rounds here instead of the real 12 — hashing is
  // deliberately slow, and running it at full strength hundreds of times
  // across a test suite would make it take minutes instead of seconds.
  const hash = await bcrypt.hash('TestPassword1!', 4);

  return prisma.user.create({
    data: {
      name: 'Test User',
      email: 'test@docuchat.dev',
      passwordHash: hash,
      ...overrides,
    },
  });
}