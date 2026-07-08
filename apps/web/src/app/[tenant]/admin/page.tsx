// Wave 7.6-T5 — Admin index redirects to the Services tab (the layout already applied the
// role/tier guard; this page has no content of its own).
import { redirect } from 'next/navigation';

interface AdminPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { tenant } = await params;
  redirect(`/${tenant}/admin/services`);
}
