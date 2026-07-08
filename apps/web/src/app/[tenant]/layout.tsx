import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@cuelane/db';

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({
  params,
}: TenantLayoutProps): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenantRecord = await prisma.tenant.findUnique({
    where: { slug },
    select: { companyName: true },
  });
  return {
    title: tenantRecord ? `${tenantRecord.companyName} — CueLane` : 'CueLane',
  };
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenant: slug } = await params;

  // Verify tenant exists — middleware also guards this, but defense-in-depth
  const tenantRecord = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (!tenantRecord || tenantRecord.status !== 'active') {
    notFound();
  }

  return <>{children}</>;
}
