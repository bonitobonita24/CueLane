import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-display text-base font-semibold tracking-tight text-foreground">
              CueLane
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">
              Smart queue management for walk-in service centers — banks, clinics, government
              offices, and telcos.
            </p>
          </div>

          <div className="flex gap-10 text-sm">
            <div className="flex flex-col gap-2">
              <span className="cl-label text-muted-foreground">Product</span>
              <Link href="/signup" className="text-foreground/80 hover:text-foreground">
                Get Started
              </Link>
              <Link href="/login" className="text-foreground/80 hover:text-foreground">
                Sign in
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="cl-label text-muted-foreground">Company</span>
              <span className="text-foreground/80">Powerbyte IT Solutions</span>
              <span className="text-foreground/80">Lipa City, Philippines</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Powerbyte IT Solutions. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
