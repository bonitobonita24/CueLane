interface DisplayPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function DisplayPage({ params }: DisplayPageProps) {
  const { tenant } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Big Display</h1>
        <p className="mt-2 text-muted-foreground">
          Tenant: <code className="font-mono text-sm">{tenant}</code>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Placeholder — queue number display UI wired in feature sessions.
        </p>
      </div>
    </main>
  );
}
