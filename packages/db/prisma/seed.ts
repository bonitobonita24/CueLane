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
//
// T0 FIX (Wave 7.3 pre-flight, was a hard BLOCKER — see Wave 7.1-T4's
// queue.integration.test.ts header comment + prisma/seed.test.ts): every shared zod input schema
// validates id fields with `z.string().cuid()`, so a kiosk/staff procedure referencing a literal
// seeded id (the old `seed-svc-<tenantId>-cash-deposit` style strings) would 400 at input
// validation before ever reaching a resolver. Fix: NEVER assign a literal string id. Every row
// below is created with no `id` field, so Prisma's `@default(cuid())` mints a real cuid —
// idempotency on reseed is instead keyed on a NATURAL field per model:
//   - Tenant         → `slug`                              (real DB `@unique`)
//   - Subscription   → `tenantId`                           (real DB `@unique`)
//   - Service        → `(tenantId, number)`                 (real DB `@@unique`)
//   - Window / User  → `(tenantId, name)` via findFirst+create/update (no DB unique constraint
//                       exists for these two models — adding one is out of scope for a seed fix,
//                       so idempotency is enforced by the script, not the database)
//   - Ticket         → `(tenantId, serviceId, priority, sequence)` via findFirst+create/update
//                       (same rationale as Window/User — good enough to distinguish the 3 fixed
//                       sample tickets below without inventing a DB constraint)

import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// PIN hash — bcrypt, to MATCH the Auth.js credentials provider which verifies
// with bcrypt.compare(password, user.pin). (Previously SHA-256, which silently
// failed every login because the provider never SHA-hashes the input.)
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

/** Find-or-create-or-update by a natural key that has NO DB-level unique constraint (Window,
 *  User). Prisma's `upsert()` requires a unique `where` clause, which these models don't have —
 *  this is the deliberate fallback the T0 fix comment above describes. Not race-safe across
 *  concurrent seed runs (fine: this seed is a single sequential dev-only script, never run
 *  concurrently with itself). */
async function findOrUpsert<TFind, TResult>(
  find: () => Promise<TFind | null>,
  create: () => Promise<TResult>,
  update: (existing: TFind) => Promise<TResult>,
): Promise<TResult> {
  const existing = await find();
  if (existing != null) return update(existing);
  return create();
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
  // Natural key = (tenantId, number) — a real DB `@@unique` — so this is a true Prisma `upsert`
  // and Prisma mints a real cuid `id` on first create. No id/number collision dance needed: the
  // old two-phase negative-scratch-number workaround existed only because the previous version of
  // this seed upserted by a literal `id`, which meant renumbering had to avoid colliding with the
  // live (tenantId, number) constraint on unrelated rows. Upserting BY that same constraint
  // directly removes the need for the workaround entirely.

  const serviceData = [
    { name: 'Cash Deposit',    icon: '💰', color: '#3B82F6', avgTime: 5 },
    { name: 'Loan Inquiry',    icon: '📋', color: '#10B981', avgTime: 15 },
    { name: 'Account Opening', icon: '📂', color: '#8B5CF6', avgTime: 20 },
    { name: 'Withdrawal',      icon: '💳', color: '#F59E0B', avgTime: 7 },
  ];

  const services: Awaited<ReturnType<typeof prisma.service.upsert>>[] = [];
  for (const [idx, data] of serviceData.entries()) {
    const number = idx + 1;
    const svc = await prisma.service.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number } },
      update: { name: data.name, icon: data.icon, color: data.color, avgTime: data.avgTime },
      create: {
        tenantId: tenant.id,
        number,
        name: data.name,
        icon: data.icon,
        color: data.color,
        avgTime: data.avgTime,
      },
    });
    services.push(svc);
  }

  console.log(`  ✓ Services: ${services.map((s) => s.name).join(', ')}`);

  // ─── Windows ───────────────────────────────────────────────────────────────

  const windowData = ['Window 1', 'Window 2', 'Window 3'];

  const windows = await Promise.all(
    windowData.map((name) =>
      findOrUpsert(
        () => prisma.window.findFirst({ where: { tenantId: tenant.id, name } }),
        () => prisma.window.create({ data: { tenantId: tenant.id, name } }),
        (existing) => prisma.window.update({ where: { id: existing.id }, data: {} }),
      ),
    ),
  );

  console.log(`  ✓ Windows: ${windows.map((w) => w.name).join(', ')}`);

  // ─── Users ─────────────────────────────────────────────────────────────────
  // Seed admin uses dev hash of PIN '0000'.
  // PRODUCTION: roll out the universal-admin credential from Server-Setups separately.
  // Employee PINs are dev-only values — never use in production.

  async function findOrUpsertUser(name: string, role: 'admin' | 'employee', pin: string) {
    return findOrUpsert(
      () => prisma.user.findFirst({ where: { tenantId: tenant.id, name } }),
      () => prisma.user.create({ data: { tenantId: tenant.id, name, role, pin: hashPin(pin) } }),
      (existing) => prisma.user.update({ where: { id: existing.id }, data: { role, pin: hashPin(pin) } }),
    );
  }

  const adminUser = await findOrUpsertUser('Branch Admin', 'admin', '0000');
  const employee1 = await findOrUpsertUser('Alice Santos', 'employee', '1234');
  const employee2 = await findOrUpsertUser('Bob Reyes', 'employee', '5678');

  console.log(`  ✓ Users: ${adminUser.name} (admin), ${employee1.name}, ${employee2.name}`);

  // ─── UserService assignments ────────────────────────────────────────────────
  // Alice handles Cash Deposit and Withdrawal; Bob handles all four services.
  // Real DB `@@unique([userId, serviceId])` — a true Prisma upsert.

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
  // No DB unique constraint on Ticket beyond `id` — idempotency key here is
  // (tenantId, serviceId, priority, sequence), which is enough to distinguish these 3 fixed
  // sample rows (see T0 fix comment at the top of this file).

  const [win1, win2] = windows as [typeof windows[0], typeof windows[0]];

  async function findOrUpsertTicket(
    lookup: { serviceId: string; priority: boolean; sequence: number },
    data: Record<string, unknown>,
  ) {
    return findOrUpsert(
      () => prisma.ticket.findFirst({ where: { tenantId: tenant.id, ...lookup } }),
      () =>
        prisma.ticket.create({
          data: { tenantId: tenant.id, ...lookup, ...data } as Prisma.TicketUncheckedCreateInput,
        }),
      (existing) =>
        prisma.ticket.update({
          where: { id: (existing as { id: string }).id },
          data: data as Prisma.TicketUpdateInput,
        }),
    );
  }

  const ticket1 = await findOrUpsertTicket(
    { serviceId: svcDeposit.id, priority: false, sequence: 1 },
    {
      number: `${svcDeposit.number}-001`,
      status: 'waiting',
    },
  );

  const ticket2 = await findOrUpsertTicket(
    { serviceId: svcLoan.id, priority: false, sequence: 1 },
    {
      number: `${svcLoan.number}-001`,
      status: 'serving',
      windowId: win1.id,
      servedBy: bob.id,
      calledAt: new Date(),
    },
  );

  const ticket3 = await findOrUpsertTicket(
    { serviceId: svcDeposit.id, priority: true, sequence: 1 },
    {
      number: 'P-001',
      status: 'completed',
      windowId: win2.id,
      servedBy: alice.id,
      calledAt: new Date(Date.now() - 10 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  );

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
