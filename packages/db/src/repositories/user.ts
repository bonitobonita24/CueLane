import { prisma } from '../client';
import { type User, type UserRole } from '@prisma/client';

export async function findUserByPin(
  tenantId: string,
  hashedPin: string
): Promise<(User & { userServices: { serviceId: string }[] }) | null> {
  return prisma.user.findFirst({
    where: { tenantId, pin: hashedPin },
    include: { userServices: { select: { serviceId: true } } },
  });
}

export async function listUsersByRole(tenantId: string, role?: UserRole): Promise<User[]> {
  return prisma.user.findMany({
    where: { tenantId, ...(role !== undefined ? { role } : {}) },
    orderBy: { name: 'asc' },
  });
}

export async function findUserById(tenantId: string, id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { tenantId, id } });
}
