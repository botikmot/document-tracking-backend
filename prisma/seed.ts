import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  /*
   |--------------------------------------------------------------------------
   | Seed Roles
   |--------------------------------------------------------------------------
   */

  const roles = [
    'SUPER_ADMIN',
    'OFFICE_ADMIN',
    'SUPERVISOR',
    'ENCODER',
    'SECRETARY',
    'VIEWER',
  ];

  for (const roleName of roles) {
    await prisma.role.upsert({
      where: {
        name: roleName,
      },

      update: {},

      create: {
        name: roleName,
      },
    });
  }

  console.log('Roles seeded');

  const documentTypes = [
    'Memorandum',
    'Purchase Request',
    'Contract',
    'Payroll',
    'Letter',
  ];

  for (const name of documentTypes) {
    await prisma.documentType.upsert({
      where: {
        name,
      },

      update: {},

      create: {
        name,
      },
    });
  }

  console.log('Document types seeded');

  const documentStatuses = [
    'DRAFT',
    'PENDING',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'COMPLETED',
  ];

  for (const name of documentStatuses) {
    await prisma.documentStatus.upsert({
      where: {
        name,
      },

      update: {},

      create: {
        name,
      },
    });
  }

  console.log('Document statuses seeded');

  /*
   |--------------------------------------------------------------------------
   | Get SUPER_ADMIN Role
   |--------------------------------------------------------------------------
   */

  const superAdminRole = await prisma.role.findUnique({
    where: {
      name: 'SUPER_ADMIN',
    },
  });

  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found');
  }

  /*
   |--------------------------------------------------------------------------
   | Hash Password
   |--------------------------------------------------------------------------
   */

  const passwordHash = await bcrypt.hash('admin123', 10);

  /*
   |--------------------------------------------------------------------------
   | Create Admin User
   |--------------------------------------------------------------------------
   */

  const adminUser = await prisma.user.upsert({
    where: {
      username: 'admin',
    },

    update: {},

    create: {
      employeeId: 'EMP-0001',
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@mail.com',
      username: 'admin',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  console.log('Admin user seeded');

  /*
   |--------------------------------------------------------------------------
   | Assign SUPER_ADMIN Role
   |--------------------------------------------------------------------------
   */

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },

    update: {},

    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
    },
  });

  console.log('SUPER_ADMIN role assigned');

  console.log('Database seeding completed');
}

main()
  .catch((error) => {
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
