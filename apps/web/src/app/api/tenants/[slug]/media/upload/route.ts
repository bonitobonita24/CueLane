// Wave 7.7c-T3 — Media Manager multipart upload Route Handler. Large Big Display video files
// (up to 800MB, PRODUCT.md "Media limits by tier") CANNOT go through the tRPC httpBatchLink
// (JSON-batched request body, memory-bound for a 300-800MB payload) — this is a dedicated Next.js
// Route Handler instead, using the Fetch API `Request.formData()` (multipart/form-data), per
// Next.js's documented pattern (context7 /vercel/next.js/v15.1.8 "Read FormData Request Body in
// Route Handlers").
//
// This route MANUALLY re-implements the `adminProcedure` guard (apps/web/src/server/trpc/trpc.ts)
// since it sits outside tRPC entirely: resolve the Auth.js session → assert authenticated →
// assert role includes Admin → assert the SESSION's tenantId (never a client-supplied one) matches
// the `[slug]` route param's resolved tenantId. This mirrors kioskProcedure's tenant-resolution
// pattern (UNGUARDED `prismaRaw` for the initial slug lookup — no AsyncLocalStorage context exists
// yet) and adminProcedure's role/tenant assertions exactly, just expressed inline because Route
// Handlers cannot import tRPC procedure builders.
//
// SECURITY: tenantId is ALWAYS the session's tenantId, resolved server-side — the `[slug]` URL
// param is used ONLY to look up which tenant this request claims to target, and is then checked
// for equality against the session's tenantId. A caller can never write to a tenant they don't
// belong to by editing the URL.
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import { prismaRaw, withTenantContext, prisma } from '@cuelane/db';
import { Role, TenantTier, MediaType } from '@cuelane/shared';
import { putObject, getMaxUploadBytesForTier, StorageValidationError, type UploadTier } from '@cuelane/storage';
import { AdminDomainError } from '@/server/domain/admin';
import { assertWithinPlaylistLimit, assertWithinUploadedFilesLimit } from '@/server/domain/media';
import { rateLimiters } from '@/server/lib/rate-limit';

// A real Node.js Buffer + AWS SDK S3 client — not Edge-safe. Never statically optimized/cached
// (every request is a distinct upload).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  // ── 1. Auth — mirrors protectedProcedure's null/empty-string guard exactly ──────────────────
  const session = await auth();
  const userId = session?.user?.id;
  if (session == null || userId == null || userId === '') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Role — mirrors adminProcedure's Admin-only gate ──────────────────────────────────────
  const roles = session.user.roles ?? [];
  if (!roles.includes(Role.TenantAdmin) && !roles.includes(Role.TenantSuperadmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    rateLimiters.upload.check(userId);
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  // ── 3. Tenant resolution + ownership check — session tenantId is authoritative, never the URL ──
  const tenant = await prismaRaw.tenant.findUnique({
    where: { slug },
    select: { id: true, tier: true, status: true },
  });
  if (tenant == null || tenant.status !== 'active') {
    return NextResponse.json({ error: 'Unknown tenant.' }, { status: 404 });
  }
  if (session.user.tenantId == null || session.user.tenantId !== tenant.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // ── 4. Parse multipart body ──────────────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data body.' }, { status: 400 });
  }

  const file = formData.get('file');
  const titleRaw = formData.get('title');
  if (!(file instanceof File) || typeof titleRaw !== 'string' || titleRaw.trim() === '') {
    return NextResponse.json({ error: "Missing required 'file' and 'title' fields." }, { status: 400 });
  }
  const title = titleRaw.trim().slice(0, 200);

  const tier = tenant.tier as TenantTier;
  const uploadTier: UploadTier = tier === TenantTier.Premium ? 'premium' : 'free';
  const maxBytes = getMaxUploadBytesForTier(uploadTier);

  // Buffer the whole upload — acceptable for dev/this wave's scope (see docs/DECISIONS_LOG.md
  // 2026-07-09 "Wave 7.7c-T3"). A true streaming multipart parser (busboy/formidable piping
  // straight into an S3 multipart upload) is a follow-up if 800MB in-memory buffering proves to
  // be a real memory pressure problem in production — not verified in this session.
  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  if (body.byteLength > maxBytes) {
    const capMb = (maxBytes / 1024 / 1024).toFixed(0);
    return NextResponse.json({ error: `File exceeds the ${capMb}MB limit for this tier.` }, { status: 400 });
  }

  try {
    // ASYNC arrow required — a plain arrow returning a lazy Prisma thenable loses the
    // AsyncLocalStorage tenant context by resolve time (the L6 lesson flagged in this wave's brief).
    const entry = await withTenantContext(tenant.id, async () => {
      await assertWithinPlaylistLimit(prismaRaw, tenant.id, tier);
      await assertWithinUploadedFilesLimit(prismaRaw, tenant.id, tier);

      const upload = await putObject({
        tenantId: tenant.id,
        entityType: 'media',
        body,
        mimeType: file.type,
        originalFilename: file.name,
        sizeBytes: body.byteLength,
        maxBytes,
      });

      const ext = upload.key.includes('.') ? upload.key.split('.').pop()! : 'mp4';
      const agg = await prisma.playlistEntry.aggregate({ where: { tenantId: tenant.id }, _max: { sortOrder: true } });
      return prisma.playlistEntry.create({
        data: {
          tenantId: tenant.id,
          type: MediaType.Local,
          title,
          storageKey: upload.key,
          fileName: file.name.slice(0, 255),
          fileSize: body.byteLength,
          fileExt: ext,
          sortOrder: (agg._max.sortOrder ?? -1) + 1,
        },
      });
    });

    return NextResponse.json({ id: entry.id, storageKey: entry.storageKey }, { status: 201 });
  } catch (e) {
    if (e instanceof StorageValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof AdminDomainError) {
      return NextResponse.json({ error: e.message }, { status: e.code === 'FORBIDDEN' ? 403 : 404 });
    }
    console.error('[media/upload] unexpected error:', e);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
