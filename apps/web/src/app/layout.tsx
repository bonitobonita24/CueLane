import type { Metadata } from 'next';
import { DM_Sans, Outfit, Space_Mono } from 'next/font/google';
// Imported from the dedicated './toaster' subpath, NOT the main '@cuelane/ui' barrel — the root
// layout is a Server Component, and pulling the full barrel (which re-exports RHF-backed form.tsx)
// into that module graph makes webpack resolve react-hook-form's "react-server" export condition
// even for the client-only bits, breaking `FormProvider`/`Controller` named exports at build time.
import { Toaster } from '@cuelane/ui/toaster';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CueLane',
  description: 'Smart Queue Management',
  // Official Powerbyte favicon kit (apps/web/public, copied from Branding-Marketing-Framework
  // brand-assets/official-logo/favicon). middleware.ts bypasses these paths (lib/static-paths.ts).
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${outfit.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
