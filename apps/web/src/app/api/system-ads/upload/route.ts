// Wave 7.8-T1 — System Ads global upload Route Handler. Mirrors the Wave 7.7c-T3 tenant Media
// Manager upload route (apps/web/src/app/api/tenants/[slug]/media/upload/route.ts) exactly, minus
// any tenant scoping: an uploaded SystemAd is a GLOBAL object (`system-ads/` prefix — see
// packages/storage's `putGlobalObject` + `assertGlobalKey`), managed only by Super Admin
// (docs/PRODUCT.md "System Ads Manager ... Ads stored globally in MinIO/S3 under `system-ads/`
// prefix"). Large video files (up to the same MIME/size envelope as tenant media) cannot go
// through the tRPC httpBatchLink, same rationale as the tenant route.
//
// SECURITY: this route manually re-implements the `superAdminProcedure` guard (trpc.ts) since it
// sits outside tRPC entirely — resolve the Auth.js session → assert authenticated → assert
// Role.TenantManager. There is no tenant to check (Super Admin is platform-global).
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import { Role } from '@cuelane/shared';
import { putGlobalObject, StorageValidationError, MAX_UPLOAD_BYTES_BY_TIER } from '@cuelane/storage';
import { rateLimiters } from '@/server/lib/rate-limit';

// A real Node.js Buffer + AWS SDK S3 client — not Edge-safe. Never statically optimized/cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// System ads reuse the Premium upload cap (800MB) — a Super-Admin-managed system ad is not
// subject to the Free-tier per-tenant cap (that cap governs what a TENANT may upload, not the
// platform operator). [HOW] decision (Wave 7.8-T1, recorded in docs/DECISIONS_LOG.md).
const MAX_SYSTEM_AD_BYTES = MAX_UPLOAD_BYTES_BY_TIER.premium;

export async function POST(request: NextRequest): Promise<Response> {
  // ── 1. Auth ──────────────────────────────────────────────────────────────────────────────────
  const session = await auth();
  const userId = session?.user?.id;
  if (session == null || userId == null || userId === '') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Role — Super Admin only ───────────────────────────────────────────────────────────────
  const roles = session.user.roles ?? [];
  if (!roles.includes(Role.TenantManager)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    rateLimiters.upload.check(userId);
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  // ── 3. Parse multipart body ──────────────────────────────────────────────────────────────────
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

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  if (body.byteLength > MAX_SYSTEM_AD_BYTES) {
    const capMb = (MAX_SYSTEM_AD_BYTES / 1024 / 1024).toFixed(0);
    return NextResponse.json({ error: `File exceeds the ${capMb}MB limit.` }, { status: 400 });
  }

  try {
    const upload = await putGlobalObject({
      body,
      mimeType: file.type,
      originalFilename: file.name,
      maxBytes: MAX_SYSTEM_AD_BYTES,
    });

    return NextResponse.json(
      { storageKey: upload.key, fileName: file.name.slice(0, 255), fileSize: body.byteLength },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof StorageValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('[system-ads/upload] unexpected error:', e);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
