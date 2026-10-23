import { prisma } from '../lib/prisma';
import { cacheGetOrSet, CACHE_TTL } from '../lib/cache';

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const permissionsArray = await cacheGetOrSet(
    `permissions:${userId}`,
    CACHE_TTL.PERMISSIONS,
    async () => {
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });

      const permissions = new Set<string>();
      for (const ur of userRoles) {
        for (const rp of ur.role.permissions) {
          permissions.add(rp.permission.name);
        }
      }
      return [...permissions]; // arrays serialize to JSON; Sets don't
    }
  );

  return new Set(permissionsArray);
}