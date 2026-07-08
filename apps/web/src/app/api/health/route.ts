import { NextResponse } from 'next/server';
import { prisma } from '@cuelane/db';

// Health / readiness probe. Referenced by the Docker + compose healthchecks
// (`GET /api/health`). Returns 200 when the app can reach Postgres, 503 otherwise.
// Node runtime (default for route handlers) — Prisma is not edge-safe.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'up', ts: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'down',
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
