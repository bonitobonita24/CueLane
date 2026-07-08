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
