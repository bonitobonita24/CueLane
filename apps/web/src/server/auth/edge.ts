import NextAuth from 'next-auth';
import { authConfigEdge } from './config.edge';

// Edge-safe NextAuth instance for use in middleware ONLY.
// Built from the provider-less, Prisma-free base config so the Edge runtime
// bundle never pulls in `@cuelane/db` / `@prisma/client`. With the JWT session
// strategy this is sufficient to decode the token into `req.auth` for route
// protection. Server/route-handler code must import the full `auth` from
// ./index (which includes the DB-backed Credentials providers).
export const { auth } = NextAuth(authConfigEdge);
