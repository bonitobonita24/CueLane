// Wave 7.7c-T4 — Media admin tab. No tier gate here (PRODUCT.md: Media is visible on BOTH tiers,
// with limits — unlike Theme's custom-picker-only gate). Same thin server→client handoff as
// windows/page.tsx / theme/page.tsx.
import { MediaClient } from './media-client';

export default function MediaPage() {
  return <MediaClient />;
}
