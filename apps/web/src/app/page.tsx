export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold tracking-tight">CueLane</h1>
      <p className="text-muted-foreground">Smart Queue Management</p>
      <p className="text-sm text-muted-foreground">
        Navigate to{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          /{'{tenant}'}
        </code>{' '}
        to access your queue dashboard.
      </p>
    </main>
  );
}
