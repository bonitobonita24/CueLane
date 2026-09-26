import Image from 'next/image';
import { cn } from '@cuelane/ui';

// Official Powerbyte IT Solutions brand lockup (vendor credit — NOT the tenant's white-label logo).
// Source kit: Branding-Marketing-Framework/brand-assets/official-logo (copied to public/brand).
// Uses the 250x65 PNG rasters, not the SVGs: the kit's SVGs are ~870KB raster-wrapped files, far
// too heavy for a tiny footer mark (README: PNG rasters are for fixed-size spots).
// Theme rule: both variants render; the class-based `.dark` theme swaps them so the lockup is never
// dark-on-dark or light-on-light.
interface PowerbyteBrandMarkProps {
  className?: string;
}

export function PowerbyteBrandMark({ className }: PowerbyteBrandMarkProps) {
  return (
    <>
      <Image
        src="/brand/250x65pxLogoBrandWhiteBG.png"
        alt="Powerbyte IT Solutions"
        width={250}
        height={65}
        className={cn('h-5 w-auto dark:hidden', className)}
      />
      <Image
        src="/brand/250x65pxLogoBrandDarkBG.png"
        alt="Powerbyte IT Solutions"
        width={250}
        height={65}
        className={cn('hidden h-5 w-auto dark:block', className)}
      />
    </>
  );
}
