import { prisma } from '../client.js';
import { type Service } from '@prisma/client';

export async function listServices(tenantId: string): Promise<Service[]> {
  return prisma.service.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });
}

export async function findServiceById(tenantId: string, id: string): Promise<Service | null> {
  return prisma.service.findFirst({ where: { tenantId, id } });
}
