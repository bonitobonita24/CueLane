import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import type { Role } from '@cuelane/shared';

export type Context = {
  session: Session | null;
  userId: string | null;
  roles: Role[];
  tenantId: string | null;
  req: NextRequest;
};

export async function createTRPCContext({
  req,
}: {
  req: NextRequest;
}): Promise<Context> {
  // Call the no-arg overload of auth() which returns Session | null.
  // Cast is needed because TypeScript may infer the middleware overload.
  const session = (await (auth as () => Promise<Session | null>)()) ?? null;

  return {
    session,
    userId: session?.user?.id ?? null,
    roles: session?.user?.roles ?? [],
    tenantId: session?.user?.tenantId ?? null,
    req,
  };
}
