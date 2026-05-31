/**
 * One-time bootstrap script for the first platform_admin user.
 *
 *   pnpm --filter @bdt/api tsx scripts/createAdmin.ts <email> <password>
 *
 * Refuses to run if any platform_admin already exists — by then you should
 * be onboarding new admins through the normal flow (an existing admin
 * promotes you in the admin UI, or via direct DB row in an emergency).
 *
 * Hard-coded to bcrypt rounds 12 (same as production register/login). Always
 * sets `emailVerifiedAt = now()` so the new admin can sign in immediately
 * without a verify-email round trip.
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const [, , emailArg, passwordArg] = process.argv;
  const email = emailArg?.trim().toLowerCase();
  const password = passwordArg;

  if (!email || !password) {
    console.error('Usage: tsx scripts/createAdmin.ts <email> <password>');
    process.exit(1);
  }

  if (!/.+@.+\..+/.test(email)) {
    console.error(`ERROR: "${email}" is not a valid email.`);
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('ERROR: password must be at least 12 characters.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.platformAdmin.count();
    if (existing > 0) {
      console.error(
        `ERROR: ${existing} platform admin(s) already exist. ` +
          'Use the admin UI to add another, or insert directly via psql.',
      );
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Platform',
        lastName: 'Admin',
        role: 'platform_admin',
        emailVerifiedAt: new Date(),
        platformAdmin: { create: { role: 'superadmin' } },
      },
      select: { id: true, email: true },
    });

    console.log(`✅ Created platform_admin user ${user.email} (id: ${user.id}).`);
    console.log('   Sign in at the admin dashboard /login.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Unique constraint')) {
      console.error(`ERROR: a user with email "${email}" already exists.`);
    } else {
      console.error('ERROR: failed to create admin:', message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
