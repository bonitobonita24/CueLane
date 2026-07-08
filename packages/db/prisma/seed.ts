// CueLane dev seed — creates a realistic demo tenant with services, windows, users, and tickets.
//
// SUPER ADMIN NOTE:
// The platform super_admin (webmaster@powerbyteitsolutions.com) is managed by Auth.js v5
// and its credentials are rolled out separately from Server-Setups/secrets/universal-admin.enc.yaml
// (SOPS+age encrypted). Do NOT hardcode the password here.
// Production super_admin seeding is a manual one-time operation, not part of this seed.
//
// Run: pnpm --filter @cuelane/db db:seed
// Requires: DATABASE_URL env var pointing to a running Postgres instance

import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// PIN hash — bcrypt, to MATCH the Auth.js credentials provider which verifies
// with bcrypt.compare(password, user.pin). (Previously SHA-256, which silently
// failed every login because the provider never SHA-hashes the input.)
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding CueLane dev database...');

  // ─── Demo Tenant ───────────────────────────────────────────────────────────

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      companyName: 'Demo Branch Co.',
      tagline: 'Fast, friendly, and organized service.',
      tier: 'premium',
      status: 'active',
      settings: {
        videoMode: 'playlist',
        liveStreamUrl: null,
        tickerText: 'Welcome to Demo Branch — please take a number and we will serve you shortly.',
        businessName: 'Demo Branch Co.',
        theme: {
          preset: 'indigo',
        },
        printerConfig: {
          enabled: true,
          paperWidth: '80mm',
          autoCut: true,
        },
      } satisfies Prisma.InputJsonValue,
    },
  });

  console.log(`  ✓ Tenant: ${tenant.companyName} (slug: ${tenant.slug})`);

  // ─── Demo Subscription (Premium) ───────────────────────────────────────────

  const sub = await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      tier: 'premium',
      startDate: new Date('2026-01-01'),
      paymentStatus: 'active',
    },
  });

  console.log(`  ✓ Subscription: ${sub.tier} / ${sub.paymentStatus}`);

  // ─── Services (Transaction Types) ──────────────────────────────────────────

  const serviceData = [
    { name: 'Cash Deposit',    icon: '💰', color: '#3B82F6', avgTime: 5 },
    { name: 'Loan Inquiry',    icon: '📋', color: '#10B981', avgTime: 15 },
    { name: 'Account Opening', icon: '📂', color: '#8B5CF6', avgTime: 20 },
    { name: 'Withdrawal',      icon: '💳', color: '#F59E0B', avgTime: 7 },
  ];

  // number = 1-based per-tenant ordinal in serviceData order — matches the ROW_NUMBER()
  // backfill in migration 20260708120000_queue_engine_backbone for pre-existing rows, and
  // seeds it correctly for a fresh tenant. Two-phase + sequential (not Promise.all): a reseed's
  // `number` reassignment can collide with the live (tenant_id, number) unique constraint if the
  // existing DB order (by created_at, set by a prior concurrent seed run) differs from
  // serviceData's declared order — phase 1 moves every row to a negative scratch number (never
  // collides with a real 1..N), phase 2 assigns the final positive numbers.
  const serviceIds = serviceData.map(
    (s) => `seed-svc-${tenant.id}-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
  );
  for (const [idx, id] of serviceIds.entries()) {
    await prisma.service.upsert({
      where: { id },
      update: { number: -(idx + 1) },
      create: {
        id,
        tenantId: tenant.id,
        number: -(idx + 1),
        name: serviceData[idx]!.name,
        icon: serviceData[idx]!.icon,
        color: serviceData[idx]!.color,
        avgTime: serviceData[idx]!.avgTime,
      },
    });
  }
  const services: Awaited<ReturnType<typeof prisma.service.upsert>>[] = [];
  for (const [idx, id] of serviceIds.entries()) {
    const svc = await prisma.service.update({ where: { id }, data: { number: idx + 1 } });
    services.push(svc);
  }

  console.log(`  ✓ Services: ${services.map((s) => s.name).join(', ')}`);

  // ─── Windows ───────────────────────────────────────────────────────────────

  const windowData = ['Window 1', 'Window 2', 'Window 3'];

  const windows = await Promise.all(
    windowData.map((name) =>
      prisma.window.upsert({
        where: { id: `seed-win-${tenant.id}-${name.toLowerCase().replace(/\s+/g, '-')}` },
        update: {},
        create: {
          id: `seed-win-${tenant.id}-${name.toLowerCase().replace(/\s+/g, '-')}`,
          tenantId: tenant.id,
          name,
        },
      })
    )
  );

  console.log(`  ✓ Windows: ${windows.map((w) => w.name).join(', ')}`);

  // ─── Users ─────────────────────────────────────────────────────────────────
  // Seed admin uses dev hash of PIN '0000'.
  // PRODUCTION: roll out the universal-admin credential from Server-Setups separately.
  // Employee PINs are dev-only values — never use in production.

  const adminUser = await prisma.user.upsert({
    where: { id: `seed-usr-${tenant.id}-admin` },
    update: {},
    create: {
      id: `seed-usr-${tenant.id}-admin`,
      tenantId: tenant.id,
      name: 'Branch Admin',
      role: 'admin',
      pin: hashPin('0000'),
    },
  });

  const employee1 = await prisma.user.upsert({
    where: { id: `seed-usr-${tenant.id}-emp1` },
    update: {},
    create: {
      id: `seed-usr-${tenant.id}-emp1`,
      tenantId: tenant.id,
      name: 'Alice Santos',
      role: 'employee',
      pin: hashPin('1234'),
    },
  });

  const employee2 = await prisma.user.upsert({
    where: { id: `seed-usr-${tenant.id}-emp2` },
    update: {},
    create: {
      id: `seed-usr-${tenant.id}-emp2`,
      tenantId: tenant.id,
      name: 'Bob Reyes',
      role: 'employee',
      pin: hashPin('5678'),
    },
  });

  console.log(`  ✓ Users: ${adminUser.name} (admin), ${employee1.name}, ${employee2.name}`);

  // ─── UserService assignments ────────────────────────────────────────────────

  // Alice handles Cash Deposit and Withdrawal; Bob handles all four services
  const alice = employee1;
  const bob = employee2;

  const [svcDeposit, svcLoan, svcAccount, svcWithdrawal] = services as [
    typeof services[0],
    typeof services[0],
    typeof services[0],
    typeof services[0],
  ];

  const assignments = [
    { userId: alice.id, serviceId: svcDeposit.id },
    { userId: alice.id, serviceId: svcWithdrawal.id },
    { userId: bob.id, serviceId: svcDeposit.id },
    { userId: bob.id, serviceId: svcLoan.id },
    { userId: bob.id, serviceId: svcAccount.id },
    { userId: bob.id, serviceId: svcWithdrawal.id },
  ];

  await Promise.all(
    assignments.map(({ userId, serviceId }) =>
      prisma.userService.upsert({
        where: { userId_serviceId: { userId, serviceId } },
        update: {},
        create: { tenantId: tenant.id, userId, serviceId },
      })
    )
  );

  console.log(`  ✓ Service assignments: Alice (2), Bob (4)`);

  // ─── Sample Tickets ─────────────────────────────────────────────────────────

  const [win1, win2] = windows as [typeof windows[0], typeof windows[0]];

  // number/sequence backfilled to match the same scheme as migration
  // 20260708120000_queue_engine_backbone: regular tickets sequence per tenant+service,
  // priority tickets sequence per tenant, both "P-NNN" / "{service.number}-NNN" 3-digit padded.
  const ticket1 = await prisma.ticket.upsert({
    where: { id: `seed-tkt-${tenant.id}-001` },
    update: { number: `${svcDeposit.number}-001`, sequence: 1 },
    create: {
      id: `seed-tkt-${tenant.id}-001`,
      tenantId: tenant.id,
      serviceId: svcDeposit.id,
      number: `${svcDeposit.number}-001`,
      sequence: 1,
      status: 'waiting',
      priority: false,
    },
  });

  const ticket2 = await prisma.ticket.upsert({
    where: { id: `seed-tkt-${tenant.id}-002` },
    update: { number: `${svcLoan.number}-001`, sequence: 1 },
    create: {
      id: `seed-tkt-${tenant.id}-002`,
      tenantId: tenant.id,
      serviceId: svcLoan.id,
      number: `${svcLoan.number}-001`,
      sequence: 1,
      status: 'serving',
      priority: false,
      windowId: win1.id,
      servedBy: bob.id,
      calledAt: new Date(),
    },
  });

  const ticket3 = await prisma.ticket.upsert({
    where: { id: `seed-tkt-${tenant.id}-003` },
    update: { number: 'P-001', sequence: 1 },
    create: {
      id: `seed-tkt-${tenant.id}-003`,
      tenantId: tenant.id,
      serviceId: svcDeposit.id,
      number: 'P-001',
      sequence: 1,
      status: 'completed',
      priority: true,
      windowId: win2.id,
      servedBy: alice.id,
      calledAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  });

  console.log(`  ✓ Tickets: ${[ticket1, ticket2, ticket3].map((t) => `${t.id}(${t.status})`).join(', ')}`);

  // ─── SequenceCounter reservations ───────────────────────────────────────────
  // The 3 seed tickets above set `number`/`sequence` directly, bypassing the atomic
  // SequenceCounter allocator (apps/web/src/server/domain/queue.ts issueTicket) that live
  // ticket issuance uses. Without a matching counter row, the FIRST live issueTicket() call
  // for demo today would start from 0 again and re-issue "1-001"/"P-001" — a duplicate of
  // what's already seeded. Reserve the counters at `value: 1` for each key the seed just
  // consumed (mirrors this file's own todayKey/pad3 scheme). `update: {}` is intentional — if
  // a real issueTicket() call already bumped this counter higher (e.g. dev testing between
  // reseeds), a reseed must NOT roll it back and re-open a collision window.
  function todayKey(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  const reservedCounterKeys = [`${svcDeposit.id}:${todayKey()}`, `${svcLoan.id}:${todayKey()}`, `priority:${todayKey()}`];
  for (const key of reservedCounterKeys) {
    await prisma.sequenceCounter.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: { tenantId: tenant.id, key, value: 1 },
    });
  }
  console.log(`  ✓ SequenceCounter reservations: ${reservedCounterKeys.length} keys`);

  // ─── System Ad placeholder ──────────────────────────────────────────────────

  const existingAd = await prisma.systemAd.findFirst();
  if (!existingAd) {
    await prisma.systemAd.create({
      data: {
        type: 'youtube',
        title: 'CueLane — Smart Queue Management',
        videoId: 'dQw4w9WgXcQ', // placeholder YouTube ID
        fileName: 'placeholder-ad',
        fileSize: 0,
        duration: 30,
        enabled: true,
        sortOrder: 1,
      },
    });
    console.log('  ✓ SystemAd: placeholder created');
  }

  console.log('\n✅ Seed complete.');
  console.log(`   Tenant: ${tenant.companyName} — access at http://localhost:41716/${tenant.slug}/`);
  console.log('   Admin PIN: 0000 (dev hash only — production uses Server-Setups universal-admin)');
  console.log('   Employee PINs: Alice=1234, Bob=5678 (dev only)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
