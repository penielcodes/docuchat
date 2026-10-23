import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRBAC() {
  // Every distinct action DocuChat can eventually gate — some of these
  // (documents:*, conversations:*) don't have real routes yet since you
  // haven't built those features. Seeding them now means the permission
  // already exists once you build the route that needs it.
  const permissionDefs = [
    { name: 'documents:create', resource: 'documents', action: 'create', description: 'Upload documents' },
    { name: 'documents:read', resource: 'documents', action: 'read', description: 'View documents' },
    { name: 'documents:update', resource: 'documents', action: 'update', description: 'Edit document metadata' },
    { name: 'documents:delete', resource: 'documents', action: 'delete', description: 'Delete documents' },
    { name: 'conversations:create', resource: 'conversations', action: 'create', description: 'Start conversations' },
    { name: 'conversations:read', resource: 'conversations', action: 'read', description: 'View conversations' },
    { name: 'users:read', resource: 'users', action: 'read', description: 'View user list' },
    { name: 'users:manage', resource: 'users', action: 'manage', description: 'Manage user accounts' },
    { name: 'roles:manage', resource: 'roles', action: 'manage', description: 'Manage roles and permissions' },
  ];

  // upsert = "create if missing, otherwise leave it alone" — this makes
  // the seed script safe to run more than once without creating duplicates.
  const permissions: Record<string, { id: string }> = {};
  for (const perm of permissionDefs) {
    permissions[perm.name] = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  const roleDefs = [
    { name: 'admin', description: 'Full system access', isDefault: false, permissions: Object.keys(permissions) },
    {
      name: 'member',
      description: 'Standard user',
      isDefault: true, // new registrations get this role
      permissions: ['documents:create', 'documents:read', 'documents:update', 'conversations:create', 'conversations:read'],
    },
    {
      name: 'viewer',
      description: 'Read-only access',
      isDefault: false,
      permissions: ['documents:read', 'conversations:read'],
    },
  ];

  for (const roleDef of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isDefault: roleDef.isDefault,
      },
    });

    // Wire this role up to each of its permissions via the join table
    for (const permName of roleDef.permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permissions[permName].id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permissions[permName].id },
      });
    }
  }

  console.log('RBAC seeded: 3 roles, 9 permissions');
}

async function main() {
  await seedRBAC();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });