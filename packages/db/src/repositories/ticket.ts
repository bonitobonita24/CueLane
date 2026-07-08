import { prisma } from '../client.js';
import { type Ticket, type TicketStatus } from '@prisma/client';

export async function listTicketsByStatus(
  tenantId: string,
  status: TicketStatus | TicketStatus[]
): Promise<Ticket[]> {
  const statusFilter = Array.isArray(status) ? { in: status } : status;
  return prisma.ticket.findMany({
    where: { tenantId, status: statusFilter },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function findTicketById(tenantId: string, id: string): Promise<Ticket | null> {
  return prisma.ticket.findFirst({ where: { tenantId, id } });
}

export async function countTicketsByStatus(
  tenantId: string,
  status: TicketStatus
): Promise<number> {
  return prisma.ticket.count({ where: { tenantId, status } });
}
