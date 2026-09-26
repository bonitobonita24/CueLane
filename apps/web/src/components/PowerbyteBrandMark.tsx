'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@cuelane/ui';

// Official Powerbyte IT Solutions brand lockup (vendor credit — NOT the tenant's white-label logo).
// Source kit: Branding-Marketing-Framework/brand-assets/official-logo (copied to public/brand).
// Uses the 250x65 PNG rasters, not the SVGs: the kit's SVGs are ~870KB raster-wrapped files, far
// too heavy for a tiny footer mark (README: PNG rasters are for fixed-size spots).
//
// Contrast rule (fix/tenant-sidebar-logo-contrast): this mark renders inside the sidebar footer,
// on login, and across every admin/superadmin/employee shell. The surface it sits on is NOT
// governed by a `.dark` class — tenant themes inject sidebar/background colors as INLINE CSS
// custom properties (`--sidebar-background`, `--background`; see [tenant]/layout.tsx +
// resolveThemeVars), so a class-based `dark:` swap can't see a tenant-chosen dark surface and the
// dark-ink WhiteBG lockup ends up low-contrast on it. Instead we measure the ACTUAL rendered
// background luminance behind the mark and pick the variant that reads correctly on it:
//   • light surface  → WhiteBG asset (dark ink)
//   • dark  surface  → DarkBG  asset (light ink)
// A caller that already KNOWS its surface can skip detection via the `surface` prop.
type Surface = 'auto' | 'light' | 'dark';

interface PowerbyteBrandMarkProps {
  className?: string;
  /** Force a variant when the surface is known statically; defaults to runtime auto-detection. */
  surface?: Surface;
}

const WHITE_BG_SRC = '/brand/250x65pxLogoBrandWhiteBG.png';
const DARK_BG_SRC = '/brand/250x65pxLogoBrandDarkBG.png';

// WCAG relative luminance of an sRGB channel triple (0..255) → 0 (black) .. 1 (white).
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Parses a computed `rgb(...)`/`rgba(...)` color. Returns null for transparent (alpha 0) or
// unparseable values so the caller can keep walking up to a painted ancestor.
function parseOpaqueRgb(color: string): [number, number, number] | null {
  const body = /^rgba?\(([^)]+)\)$/.exec(color.trim())?.[1];
  if (body == null) return null;
  const parts = body.split(',').map((p) => Number.parseFloat(p.trim()));
  const [r, g, b, a] = parts;
  if (r == null || g == null || b == null) return null;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  if (a === 0) return null; // fully transparent — not the painted surface
  return [r, g, b];
}

// Walks up from `el` to the first ancestor with a non-transparent background-color and returns
// whether that surface reads as dark. Defaults to `false` (light) when nothing is painted.
function surfaceIsDark(el: HTMLElement | null): boolean {
  let node: HTMLElement | null = el;
  while (node != null) {
    const rgb = parseOpaqueRgb(getComputedStyle(node).backgroundColor);
    if (rgb != null) return relativeLuminance(...rgb) < 0.5;
    node = node.parentElement;
  }
  return false;
}

export function PowerbyteBrandMark({ className, surface = 'auto' }: PowerbyteBrandMarkProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Default to the light-surface variant: it is the common case (light shells + login) and matches
  // SSR, so there is no hydration mismatch and no flash on light surfaces. Auto-detection upgrades
  // to the dark variant after mount only when the measured surface is actually dark.
  const [isDark, setIsDark] = useState(surface === 'dark');

  useEffect(() => {
    if (surface !== 'auto') {
      setIsDark(surface === 'dark');
      return;
    }
    const measure = () => setIsDark(surfaceIsDark(ref.current?.parentElement ?? ref.current));
    measure();
    // Re-measure if the theme changes without a reload (e.g. a future dark-mode toggle or a live
    // theme edit that repaints the surface via class/style on the document root).
    const observer = new MutationObserver(measure);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, [surface]);

  return (
    <span ref={ref} className="contents">
      <Image
        src={isDark ? DARK_BG_SRC : WHITE_BG_SRC}
        alt="Powerbyte IT Solutions"
        width={250}
        height={65}
        className={cn('h-5 w-auto', className)}
      />
    </span>
  );
}
