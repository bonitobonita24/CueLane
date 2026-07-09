// Wave 7.7c-T4 — pure YouTube-input parsing + reorder helpers for the Media admin tab, kept
// side-effect-free so they're unit-testable in this repo's node-environment vitest setup (same
// convention as admin/_lib/access.ts + admin/_lib/limits.ts).
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts either a bare 11-char YouTube video ID or a full YouTube URL (watch/youtu.be/embed/
 * shorts/live) and returns the extracted video ID, or `null` if nothing valid was found. Mirrors
 * the server's `youtubeVideoIdSchema` regex (packages/shared/src/schemas/index.ts) — this is a
 * UI-convenience parser only; the server always re-validates the extracted id independently.
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID_RE.test(id) ? id : null;
  }

  if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
    const v = url.searchParams.get('v');
    if (v != null && YOUTUBE_ID_RE.test(v)) return v;
    const match = /\/(?:live|embed|shorts)\/([A-Za-z0-9_-]{11})/.exec(url.pathname);
    if (match?.[1] != null) return match[1];
  }

  return null;
}

/** Reorders `ids` by moving the element at `index` one position up or down. No-op at either
 *  boundary (moving the first item up, or the last item down). Returns a NEW array. */
export function moveItem(ids: readonly string[], index: number, direction: 'up' | 'down'): string[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return [...ids];
  const next = [...ids];
  const tmp = next[index]!;
  next[index] = next[targetIndex]!;
  next[targetIndex] = tmp;
  return next;
}
