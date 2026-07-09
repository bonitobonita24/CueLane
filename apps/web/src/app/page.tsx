// Wave 7.9-T2 — public marketing landing page. Replaces the Phase-4 scaffold placeholder.
// Server Component: no client-side state, no data fetching — pure static marketing content, so
// this route stays fast and fully prerenderable.
import type { Metadata } from 'next';
import { SiteHeader } from './_components/landing/site-header';
import { HeroSection } from './_components/landing/hero-section';
import { FeaturesSection } from './_components/landing/features-section';
import { PricingSection } from './_components/landing/pricing-section';
import { CtaSection } from './_components/landing/cta-section';
import { SiteFooter } from './_components/landing/site-footer';

export const metadata: Metadata = {
  title: 'CueLane — Smart Queue Management',
  description:
    'Multi-tenant queue management for walk-in service centers — banks, clinics, government offices, and telcos. Kiosk, Employee Station, Big Display, and analytics, live in minutes.',
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
