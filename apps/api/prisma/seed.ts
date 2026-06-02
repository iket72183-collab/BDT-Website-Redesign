/**
 * BDT Connect — seed script.
 *
 * Creates a starter dataset for the agency client portal:
 *   - 1 platform admin (BDT team)
 *   - 2 demo tenants (agency clients) — both on the single Premium plan
 *   - per tenant: 1 client user + a couple of sample messages
 *
 * Idempotent: re-running wipes the seeded data first.
 *
 * Run: `pnpm db:seed` — DEV ONLY. Refuses to run in production because the
 * first step wipes existing data. Use `scripts/createAdmin.ts` to bootstrap
 * the first platform_admin in prod.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Seed must not run in production. Use scripts/createAdmin.ts instead.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 4); // cheap rounds — seed only
}

async function main() {
  console.log('🧹 wiping previous seed…');
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.platformEvent.deleteMany(),
    prisma.platformAdmin.deleteMany(),
    // Owner FK is SET NULL — nullify first, then delete users + tenants.
    prisma.tenant.updateMany({ data: { ownerId: null } }),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  // -- Platform admin --------------------------------------------------------
  console.log('👤 creating platform admin…');
  const adminPw = await hash('platform-admin-dev');
  const admin = await prisma.user.create({
    data: {
      email: 'ops@bdttalent.com',
      passwordHash: adminPw,
      firstName: 'Devin',
      lastName: 'Marsh',
      role: 'platform_admin',
      emailVerifiedAt: new Date(),
      platformAdmin: { create: { role: 'superadmin' } },
    },
  });

  // -- Tenant 1: Vale Strength Studio (Premium) ------------------------------
  console.log('🏋️  creating Vale Strength Studio…');
  await seedTenant({
    slug: 'vale-strength',
    businessName: 'Vale Strength Studio',
    tier: 'premium',
    owner: { first: 'Marcus', last: 'Vale', email: 'marcus@vale-strength.com' },
    websiteUrl: 'https://vale-strength.com',
    instagramUrl: 'https://instagram.com/valestrength',
  });

  // -- Tenant 2: Cardamom Spa (Premium) --------------------------------------
  console.log('💆  creating Cardamom Spa…');
  await seedTenant({
    slug: 'cardamom-spa',
    businessName: 'Cardamom Spa',
    tier: 'premium',
    owner: { first: 'Priya', last: 'Nair', email: 'priya@cardamomspa.com' },
    websiteUrl: 'https://cardamomspa.com',
    instagramUrl: 'https://instagram.com/cardamomspa',
    facebookUrl: 'https://facebook.com/cardamomspa',
    tiktokUrl: 'https://tiktok.com/@cardamomspa',
  });

  await prisma.platformEvent.createMany({
    data: [
      { eventType: 'platform.bootstrapped', userId: admin.id, payload: { seededAt: new Date().toISOString() } },
    ],
  });

  console.log('✅ seed complete.');
}

interface SeedTenantInput {
  slug: string;
  businessName: string;
  tier: 'premium';
  owner: { first: string; last: string; email: string };
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
}

async function seedTenant(input: SeedTenantInput) {
  const pwHash = await hash('demo-password');

  const tenant = await prisma.tenant.create({
    data: {
      slug: input.slug,
      businessName: input.businessName,
      subscriptionTier: input.tier,
      subscriptionStatus: 'active',
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      ...(input.websiteUrl ? { websiteUrl: input.websiteUrl } : {}),
      ...(input.instagramUrl ? { instagramUrl: input.instagramUrl } : {}),
      ...(input.facebookUrl ? { facebookUrl: input.facebookUrl } : {}),
      ...(input.tiktokUrl ? { tiktokUrl: input.tiktokUrl } : {}),
    },
  });

  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: input.owner.email,
      passwordHash: pwHash,
      firstName: input.owner.first,
      lastName: input.owner.last,
      role: 'client',
      emailVerifiedAt: new Date(),
      notificationPreference: { create: { tenantId: tenant.id } },
    },
  });

  await prisma.tenant.update({ where: { id: tenant.id }, data: { ownerId: owner.id } });

  // A couple of sample messages so the agency dashboard has something to look at.
  await prisma.message.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: owner.id,
        subject: 'Welcome question',
        body: `Hi BDT team! Excited to get started. When can we kick off the website redesign?`,
        status: 'read',
      },
      {
        tenantId: tenant.id,
        userId: owner.id,
        subject: null,
        body: 'Could you also take a look at our hero image? It feels a bit washed out.',
        status: 'unread',
      },
    ],
  });
}

main()
  .catch((err) => {
    console.error('seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
