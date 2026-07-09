// Wave 7.8-T3 — extractYoutubeVideoId, duplicated locally from [tenant]/admin/media/_lib/youtube.ts
// (UI-convenience parser only; the server's `youtubeVideoIdSchema` always re-validates independently).
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

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
