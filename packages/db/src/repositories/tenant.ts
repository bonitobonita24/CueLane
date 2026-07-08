import { prismaRaw } from '../client';
import { type Tenant, type TenantTier, type TenantStatus } from '@prisma/client';

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  return prismaRaw.tenant.findUnique({ where: { slug } });
}

export async function findTenantById(id: string): Promise<Tenant | null> {
  return prismaRaw.tenant.findUnique({ where: { id } });
}

export async function listTenants(params?: {
  status?: TenantStatus;
  tier?: TenantTier;
}): Promise<Tenant[]> {
  return prismaRaw.tenant.findMany({
    ...(params !== undefined ? { where: params } : {}),
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateTenantTier(id: string, tier: TenantTier): Promise<Tenant> {
  return prismaRaw.tenant.update({ where: { id }, data: { tier } });
}

export async function updateTenantStatus(id: string, status: TenantStatus): Promise<Tenant> {
  return prismaRaw.tenant.update({ where: { id }, data: { status } });
}
