import { BarChart3, MonitorPlay, Ticket, Users2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Real, already-shipped modules only (Phase 7 waves 7.1-7.8) — no aspirational or invented
// capabilities. Copy pulled from docs/PRODUCT.md's Modules + Features section.
const FEATURES: Feature[] = [
  {
    icon: Ticket,
    title: 'Customer Kiosk',
    description:
      'A touch-friendly transaction grid customers use to pull a ticket in seconds — regular or priority lane for PWD, senior citizens, and pregnant customers.',
  },
  {
    icon: Users2,
    title: 'Employee Station',
    description:
      'Staff sign in, pick a window, and call the next ticket with one tap. A bell chime and a spoken announcement handle the rest — no shouting across the room.',
  },
  {
    icon: MonitorPlay,
    title: 'Big Display',
    description:
      'A wall-mounted TV or monitor shows Now Serving per window, Up Next, and total waiting — with your own video playlist or a live stream running in the background.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard & Analytics',
    description:
      'Daily, monthly, and yearly views of completion rate, no-show rate, hourly traffic, and per-window and per-employee performance — searchable ticket log included.',
  },
];

export function FeaturesSection() {
  return (
    <section className="border-b border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="cl-label text-muted-foreground">Everything a branch needs</span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
            Four modules, one queue
          </h2>
          <p className="mt-3 text-muted-foreground">
            Kiosk, Station, Display, and Dashboard all stay in sync in real time — a ticket called
            at the Station updates the Display and the Dashboard instantly.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-[0_1px_1px_rgba(97,104,117,0.05),0_2px_2px_rgba(97,104,117,0.05)]"
            >
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary">
                <feature.icon aria-hidden className="size-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
