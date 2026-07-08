interface StationPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function StationPage({ params }: StationPageProps) {
  const { tenant } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Employee Station</h1>
        <p className="mt-2 text-muted-foreground">
          Tenant: <code className="font-mono text-sm">{tenant}</code>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Placeholder — station UI (PIN auth, serve/skip/complete) wired in feature sessions.
        </p>
      </div>
    </main>
  );
}
