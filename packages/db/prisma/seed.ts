// CueLane dev seed — creates two believable PH-context demo tenants for client presentation:
//   1. `demo`   (PREMIUM, flagship) — "Bayanihan Rural Bank, Lipa Branch" — a rural bank branch
//      with a rich service list, more windows/employees, and a live spread of tickets.
//   2. `clinic` (FREE tier, NEW — Wave 7.6-T9)  — "Barangay Bagong Pag-asa Health Station" — seeded
//      AT/NEAR its free-tier caps (services 6/6, windows 4/4, users ~9/10) so the Wave 7.6
//      usage-meters + tier-gating (Add disabled at cap, Theme tab hidden) are visibly demoable,
//      and so multi-tenancy is proven live with a SECOND browsable tenant added via seed data
//      only — zero code changes.
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
//                       (same rationale as Window/User — good enough to distinguish the fixed
//                       sample tickets below without inventing a DB constraint)
//
// Wave 7.6-T9 note: this seed is now DATA-DRIVEN per tenant (see `buildTenant` below) — a new
// tenant is added purely by appending a `TenantSeedSpec` entry, never by branching code on a
// tenant slug. Multi-tenancy stays sacred: `seedTenant()` is the ONLY function that talks to the
// DB, and every query inside it is scoped to the tenantId it just created/found.

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

function todayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// ─── Tenant spec types ─────────────────────────────────────────────────────────

interface ServiceSpec {
  name: string;
  icon: string;
  color: string;
  avgTime: number;
}

interface UserSpec {
  name: string;
  role: 'tenant_superadmin' | 'employee';
  pin: string;
  /** Indices into the tenant's `services` array this employee is assigned to. Admins ignore this. */
  services?: number[];
}

/** A ticket to seed, referencing services/windows/users by index into the tenant's own arrays. */
interface TicketSpec {
  serviceIdx: number;
  priority: boolean;
  sequence: number;
  status: 'waiting' | 'serving' | 'completed';
  windowIdx?: number;
  servedByIdx?: number; // index into `users`
  calledMinutesAgo?: number;
  completedMinutesAgo?: number;
}

interface TenantSeedSpec {
  slug: string;
  companyName: string;
  tagline: string;
  tier: 'free' | 'premium';
  settings: Prisma.InputJsonValue;
  services: ServiceSpec[];
  windows: string[];
  users: UserSpec[];
  tickets: TicketSpec[];
}

// ─── Tenant 1: `demo` (PREMIUM flagship) ───────────────────────────────────────
// "Bayanihan Rural Bank, Lipa Branch" — a believable PH rural-bank branch, enriched per Wave
// 7.6-T9 owner directive: 8 services, 5 windows, 6 users, a believable spread of tickets, a
// theme preset + ticker message.

const demoSpec: TenantSeedSpec = {
  slug: 'demo',
  companyName: 'Bayanihan Rural Bank — Lipa Branch',
  tagline: 'Serbisyong Mabilis, Tapat na Kapwa-Bayan.',
  tier: 'premium',
  settings: {
    videoMode: 'playlist',
    liveStreamUrl: null,
    tickerText: 'Magandang araw po! Kunin ang inyong numero at kami ay maglilingkod sa inyo agad. — Bayanihan Rural Bank, Lipa Branch',
    businessName: 'Bayanihan Rural Bank — Lipa Branch',
    theme: 'emerald',
    printerConfig: {
      enabled: false,
      paperWidth: '80mm',
      autoCut: true,
    },
  } satisfies Prisma.InputJsonValue,
  services: [
    { name: 'Cash Deposit',       icon: '💰', color: '#3B82F6', avgTime: 5 },
    { name: 'Cash Withdrawal',    icon: '💳', color: '#F59E0B', avgTime: 6 },
    { name: 'Loan Application',   icon: '📋', color: '#10B981', avgTime: 20 },
    { name: 'Account Opening',    icon: '📂', color: '#8B5CF6', avgTime: 18 },
    { name: 'Check Encashment',   icon: '🧾', color: '#EF4444', avgTime: 8 },
    { name: 'OFW Remittance',     icon: '🏦', color: '#06B6D4', avgTime: 10 },
    { name: 'Passbook Update',    icon: '📑', color: '#84CC16', avgTime: 4 },
    { name: 'Customer Inquiry',   icon: '👥', color: '#EC4899', avgTime: 7 },
  ],
  windows: ['Window 1', 'Window 2', 'Window 3', 'Window 4', 'Window 5'],
  users: [
    { name: 'Branch Admin',   role: 'tenant_superadmin', pin: '0000' },
    { name: 'Alice Santos',   role: 'employee', pin: '1234', services: [0, 1] },
    { name: 'Bob Reyes',      role: 'employee', pin: '5678', services: [0, 2, 3, 4] },
    { name: 'Carmela Cruz',   role: 'employee', pin: '2468', services: [5, 6] },
    { name: 'Dominic Ilagan', role: 'employee', pin: '1357', services: [2, 3, 7] },
    { name: 'Elena Mercado',  role: 'employee', pin: '9090', services: [1, 4, 5, 6, 7] },
  ],
  tickets: [
    // Waiting
    { serviceIdx: 0, priority: false, sequence: 1, status: 'waiting' },
    { serviceIdx: 2, priority: false, sequence: 1, status: 'waiting' },
    { serviceIdx: 6, priority: false, sequence: 1, status: 'waiting' },
    { serviceIdx: 3, priority: true,  sequence: 2, status: 'waiting' },
    // Serving
    { serviceIdx: 1, priority: false, sequence: 1, status: 'serving', windowIdx: 0, servedByIdx: 2, calledMinutesAgo: 2 },
    { serviceIdx: 5, priority: false, sequence: 1, status: 'serving', windowIdx: 1, servedByIdx: 3, calledMinutesAgo: 4 },
    { serviceIdx: 4, priority: true,  sequence: 1, status: 'serving', windowIdx: 2, servedByIdx: 4, calledMinutesAgo: 1 },
    // Completed
    { serviceIdx: 0, priority: true,  sequence: 1, status: 'completed', windowIdx: 3, servedByIdx: 1, calledMinutesAgo: 10, completedMinutesAgo: 5 },
    { serviceIdx: 7, priority: false, sequence: 1, status: 'completed', windowIdx: 4, servedByIdx: 4, calledMinutesAgo: 20, completedMinutesAgo: 15 },
  ],
};

// ─── Tenant 2: `clinic` (FREE tier, NEW — Wave 7.6-T9) ─────────────────────────
// "Barangay Bagong Pag-asa Health Station" — seeded AT/NEAR the free-tier caps
// (@cuelane/shared TIER_LIMITS.free = { users: 10, services: 6, windows: 4 }):
//   services 6/6 (AT cap → Add disabled), windows 4/4 (AT cap), users 9/10 (NEAR cap → meter
//   amber/red, Add still works). No theme preset (free tier hides the Theme tab); Big Display
//   shows "Powered by Powerbyte IT Solutions" (free-tier default, no per-tenant branding override).

const clinicSpec: TenantSeedSpec = {
  slug: 'clinic',
  companyName: 'Barangay Bagong Pag-asa Health Station',
  tagline: 'Malusog na Pamayanan, Ligtas na Kinabukasan.',
  tier: 'free',
  settings: {
    videoMode: 'playlist',
    liveStreamUrl: null,
    tickerText: 'Maligayang pagdating sa Barangay Health Station. Mangyaring kumuha ng numero at maghintay ng tawag.',
    businessName: 'Barangay Bagong Pag-asa Health Station',
    // Free tier: no `theme` key — Theme tab is hidden by tier gating (layout.tsx visibleAdminTabs).
    printerConfig: {
      enabled: false,
      paperWidth: '80mm',
      autoCut: false,
    },
  } satisfies Prisma.InputJsonValue,
  services: [
    { name: 'General Consultation', icon: '📋', color: '#10B981', avgTime: 12 },
    { name: 'Prenatal Check-up',     icon: '📄', color: '#EC4899', avgTime: 15 },
    { name: 'Vaccination',           icon: '🪪', color: '#3B82F6', avgTime: 8 },
    { name: 'Medicine Dispensing',   icon: '📦', color: '#F59E0B', avgTime: 5 },
    { name: 'Dental Referral',       icon: '🔑', color: '#8B5CF6', avgTime: 10 },
    { name: 'Senior Citizen ID',     icon: '✍️', color: '#64748B', avgTime: 7 },
  ],
  windows: ['Window 1', 'Window 2', 'Window 3', 'Window 4'],
  users: [
    { name: 'Nurse Admin',    role: 'tenant_superadmin', pin: '0001' },
    { name: 'Fely Bautista',  role: 'employee', pin: '1111', services: [0, 1] },
    { name: 'Grace Villamor', role: 'employee', pin: '2222', services: [2, 3] },
    { name: 'Hector Ramos',   role: 'employee', pin: '3333', services: [4, 5] },
    { name: 'Irene Salcedo',  role: 'employee', pin: '4444', services: [0, 3] },
    { name: 'Jun Aquino',     role: 'employee', pin: '5555', services: [1, 2] },
    { name: 'Kaye Dizon',     role: 'employee', pin: '6666', services: [3, 4] },
    { name: 'Leo Fernandez',  role: 'employee', pin: '7777', services: [5, 0] },
    { name: 'Mila Concepcion',role: 'employee', pin: '8888', services: [1, 4] },
  ],
  tickets: [
    { serviceIdx: 0, priority: false, sequence: 1, status: 'waiting' },
    { serviceIdx: 1, priority: false, sequence: 1, status: 'waiting' },
    { serviceIdx: 3, priority: true,  sequence: 1, status: 'waiting' },
    { serviceIdx: 2, priority: false, sequence: 1, status: 'serving', windowIdx: 0, servedByIdx: 2, calledMinutesAgo: 3 },
    { serviceIdx: 4, priority: false, sequence: 1, status: 'serving', windowIdx: 1, servedByIdx: 3, calledMinutesAgo: 2 },
    { serviceIdx: 0, priority: false, sequence: 2, status: 'completed', windowIdx: 2, servedByIdx: 1, calledMinutesAgo: 15, completedMinutesAgo: 10 },
  ],
};

// ─── Core per-tenant seeding logic (tenant-agnostic — no branching on slug) ────

async function seedTenant(spec: TenantSeedSpec): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: spec.slug },
    update: {
      companyName: spec.companyName,
      tagline: spec.tagline,
      tier: spec.tier,
      settings: spec.settings,
    },
    create: {
      slug: spec.slug,
      companyName: spec.companyName,
      tagline: spec.tagline,
      tier: spec.tier,
      status: 'active',
      settings: spec.settings,
    },
  });

  console.log(`  ✓ Tenant: ${tenant.companyName} (slug: ${tenant.slug}, tier: ${tenant.tier})`);

  // ─── Subscription ──────────────────────────────────────────────────────────

  const sub = await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { tier: spec.tier },
    create: {
      tenantId: tenant.id,
      tier: spec.tier,
      startDate: new Date('2026-01-01'),
      paymentStatus: spec.tier === 'premium' ? 'active' : 'free',
    },
  });

  console.log(`    ✓ Subscription: ${sub.tier} / ${sub.paymentStatus}`);

  // ─── Services (Transaction Types) ──────────────────────────────────────────
  // Natural key = (tenantId, number) — a real DB `@@unique` — so this is a true Prisma `upsert`
  // and Prisma mints a real cuid `id` on first create.

  const services: Awaited<ReturnType<typeof prisma.service.upsert>>[] = [];
  for (const [idx, data] of spec.services.entries()) {
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

  console.log(`    ✓ Services (${services.length}): ${services.map((s) => s.name).join(', ')}`);

  // ─── Windows ─────────────────────────────────────────────────────────────────

  const windows = await Promise.all(
    spec.windows.map((name) =>
      findOrUpsert(
        () => prisma.window.findFirst({ where: { tenantId: tenant.id, name } }),
        () => prisma.window.create({ data: { tenantId: tenant.id, name } }),
        (existing) => prisma.window.update({ where: { id: existing.id }, data: {} }),
      ),
    ),
  );

  console.log(`    ✓ Windows (${windows.length}): ${windows.map((w) => w.name).join(', ')}`);

  // ─── Users ───────────────────────────────────────────────────────────────────
  // Dev PINs only — never use these in production. Production auth rolls out separately
  // (Server-Setups universal-admin credential).

  async function findOrUpsertUser(name: string, role: 'tenant_superadmin' | 'employee', pin: string) {
    return findOrUpsert(
      () => prisma.user.findFirst({ where: { tenantId: tenant.id, name } }),
      () => prisma.user.create({ data: { tenantId: tenant.id, name, role, pin: hashPin(pin) } }),
      (existing) => prisma.user.update({ where: { id: existing.id }, data: { role, pin: hashPin(pin) } }),
    );
  }

  const users: Awaited<ReturnType<typeof findOrUpsertUser>>[] = [];
  for (const u of spec.users) {
    users.push(await findOrUpsertUser(u.name, u.role, u.pin));
  }

  console.log(`    ✓ Users (${users.length}): ${users.map((u) => `${u.name} (${u.role})`).join(', ')}`);

  // ─── UserService assignments ──────────────────────────────────────────────────
  // Real DB `@@unique([userId, serviceId])` — a true Prisma upsert.

  const assignments: { userId: string; serviceId: string }[] = [];
  spec.users.forEach((u, uIdx) => {
    for (const sIdx of u.services ?? []) {
      assignments.push({ userId: users[uIdx].id, serviceId: services[sIdx].id });
    }
  });

  await Promise.all(
    assignments.map(({ userId, serviceId }) =>
      prisma.userService.upsert({
        where: { userId_serviceId: { userId, serviceId } },
        update: {},
        create: { tenantId: tenant.id, userId, serviceId },
      }),
    ),
  );

  console.log(`    ✓ Service assignments: ${assignments.length}`);

  // ─── Sample Tickets ─────────────────────────────────────────────────────────
  // No DB unique constraint on Ticket beyond `id` — idempotency key here is
  // (tenantId, serviceId, priority, sequence).

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

  const now = Date.now();
  const tickets: Awaited<ReturnType<typeof findOrUpsertTicket>>[] = [];

  for (const t of spec.tickets) {
    const svc = services[t.serviceIdx];
    const numberPrefix = t.priority ? 'P' : String(svc.number);
    const data: Record<string, unknown> = {
      number: `${numberPrefix}-${String(t.sequence).padStart(3, '0')}`,
      status: t.status,
    };
    if (t.windowIdx !== undefined) data.windowId = windows[t.windowIdx].id;
    if (t.servedByIdx !== undefined) data.servedBy = users[t.servedByIdx].id;
    if (t.calledMinutesAgo !== undefined) data.calledAt = new Date(now - t.calledMinutesAgo * 60 * 1000);
    if (t.completedMinutesAgo !== undefined) data.completedAt = new Date(now - t.completedMinutesAgo * 60 * 1000);

    tickets.push(
      await findOrUpsertTicket({ serviceId: svc.id, priority: t.priority, sequence: t.sequence }, data),
    );
  }

  console.log(`    ✓ Tickets (${tickets.length}): ${tickets.map((tk) => `${(tk as { id: string }).id}(${(tk as { status: string }).status})`).join(', ')}`);

  // ─── SequenceCounter reservations ───────────────────────────────────────────
  // The seed tickets above set `number`/`sequence` directly, bypassing the atomic SequenceCounter
  // allocator (apps/web/src/server/domain/queue.ts issueTicket) that live ticket issuance uses.
  // Reserve each service's regular counter at its MAX seeded sequence (not always 1 — several
  // services below have 2+ seeded tickets), and reserve the priority counter at its max seeded
  // priority sequence, so the first live issueTicket() call today never collides with what's
  // already seeded. `update: {}` is intentional — a reseed must never roll a counter back.

  const maxRegularSeqByService = new Map<string, number>();
  let maxPrioritySeq = 0;
  for (const t of spec.tickets) {
    if (t.priority) {
      maxPrioritySeq = Math.max(maxPrioritySeq, t.sequence);
    } else {
      const svcId = services[t.serviceIdx].id;
      maxRegularSeqByService.set(svcId, Math.max(maxRegularSeqByService.get(svcId) ?? 0, t.sequence));
    }
  }

  const day = todayKey();
  const counterReservations: { key: string; value: number }[] = [];
  for (const [svcId, seq] of maxRegularSeqByService.entries()) {
    counterReservations.push({ key: `${svcId}:${day}`, value: seq });
  }
  if (maxPrioritySeq > 0) {
    counterReservations.push({ key: `priority:${day}`, value: maxPrioritySeq });
  }

  for (const { key, value } of counterReservations) {
    await prisma.sequenceCounter.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: {},
      create: { tenantId: tenant.id, key, value },
    });
  }
  console.log(`    ✓ SequenceCounter reservations: ${counterReservations.length} keys`);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding CueLane dev database (2 tenants — Wave 7.6-T9 rich demo dataset)...\n');

  for (const spec of [demoSpec, clinicSpec]) {
    await seedTenant(spec);
    console.log('');
  }

  // ─── System Ad placeholder (GLOBAL — no tenantId) ──────────────────────────

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
    console.log('✓ SystemAd: placeholder created\n');
  }

  console.log('✅ Seed complete.\n');
  console.log('=== Tenant 1 (PREMIUM, flagship) ===');
  console.log(`   ${demoSpec.companyName} — access at http://localhost:41716/${demoSpec.slug}/`);
  console.log(`   Admin login: "Branch Admin" / PIN 0000 (dev hash only)`);
  console.log(`   Employees: Alice Santos/1234, Bob Reyes/5678, Carmela Cruz/2468, Dominic Ilagan/1357, Elena Mercado/9090`);
  console.log('');
  console.log('=== Tenant 2 (FREE tier, NEW — Wave 7.6-T9) ===');
  console.log(`   ${clinicSpec.companyName} — access at http://localhost:41716/${clinicSpec.slug}/`);
  console.log(`   Admin login: "Nurse Admin" / PIN 0001 (dev hash only)`);
  console.log(`   Employees: Fely Bautista/1111, Grace Villamor/2222, Hector Ramos/3333, Irene Salcedo/4444,`);
  console.log(`              Jun Aquino/5555, Kaye Dizon/6666, Leo Fernandez/7777, Mila Concepcion/8888`);
  console.log(`   Free-tier caps (from @cuelane/shared TIER_LIMITS.free): services 6/6 (AT cap),`);
  console.log(`   windows 4/4 (AT cap), users 9/10 (NEAR cap).`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
