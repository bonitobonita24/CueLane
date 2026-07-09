import Link from 'next/link';
import { Button } from '@cuelane/ui';

export function CtaSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Set up your branch in minutes.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Pick a workspace name, add your admin account, and your Kiosk, Employee Station, and Big
          Display are ready to use.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Get Started Free</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/login">I already have a workspace</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
