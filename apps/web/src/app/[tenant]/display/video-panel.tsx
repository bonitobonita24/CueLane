// Wave 7.7d-T2 — Big Display video panel + free-tier System-Ad / premium Tenant-Ad interrupt
// engine. Public, unauthenticated (fed by displayRouter.media, same posture as queue.state).
// Per docs/PRODUCT.md "Big Display Screen":
//   - Mode A Playlist: loops PlaylistEntry (YouTube + local uploads) in sortOrder, auto-advancing.
//   - Mode B YouTube LIVE: single continuous liveStreamUrl embed.
//   - Free tier: EVERY 5 MINUTES the panel interrupts to play a System Ad (chronological order),
//     then resumes the previous video/stream. Non-negotiable — cannot be skipped/disabled.
//   - Premium tier: no system ads ever. LIVE mode only: the tenant's own Tenant Ads interrupt
//     instead, every 5 minutes. Playlist mode on Premium has NO interruptions at all.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/trpc';
import { useYouTubePlayer } from './use-youtube-player';

const client = createClient('/api/trpc');

/** PRODUCT.md "every 5 minutes". */
const AD_INTERVAL_MS = 5 * 60 * 1000;
/** A playlist entry that is ITSELF a YouTube live embed (PlaylistEntry.isLive) never emits an
 *  IFrame-API ENDED event — there is no natural "end" to rotate on. Dwell for a fixed window
 *  before advancing instead of hanging on one entry forever. Not specified by PRODUCT.md — a
 *  reasonable default, documented here rather than in DECISIONS_LOG since it's a minor UX detail. */
const LIVE_PLAYLIST_ENTRY_DWELL_MS = 60_000;
/** Safety fallback for a YouTube ad if the IFrame API's ENDED event never fires (misconfigured/
 *  unembeddable ad video) — advance using the admin-entered `duration` + a small buffer, per
 *  PRODUCT.md "duration (seconds — admin-entered estimate)". */
const AD_DURATION_BUFFER_SEC = 5;

interface DisplayPlaylistEntry {
  id: string;
  type: 'youtube' | 'local';
  title: string;
  videoId: string | null;
  url: string | null;
  isLive: boolean;
}
interface DisplayAdEntry {
  id: string;
  type: 'youtube' | 'uploaded';
  title: string;
  videoId: string | null;
  url: string | null;
  duration: number;
}
interface DisplayMedia {
  tier: string;
  videoMode: 'playlist' | 'live';
  liveStreamUrl: string | null;
  playlist: DisplayPlaylistEntry[];
  ads: DisplayAdEntry[];
  tenantAds: DisplayAdEntry[];
}

interface VideoPanelProps {
  tenantSlug: string;
  reducedMotion: boolean;
}

/** Extracts an 11-char YouTube video id from any of the common URL shapes an admin might paste
 *  for `liveStreamUrl` (watch?v=, youtu.be/, /live/, /embed/). Returns null (renders the
 *  placeholder) rather than guessing on an unrecognized shape. */
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0];
      return id != null && id !== '' ? id : null;
    }
    const v = u.searchParams.get('v');
    if (v != null && v !== '') return v;
    const liveMatch = /\/live\/([^/?]+)/.exec(u.pathname);
    if (liveMatch?.[1] != null) return liveMatch[1];
    const embedMatch = /\/embed\/([^/?]+)/.exec(u.pathname);
    if (embedMatch?.[1] != null) return embedMatch[1];
    return null;
  } catch {
    return null;
  }
}

export function VideoPanel({ tenantSlug, reducedMotion }: VideoPanelProps) {
  const [media, setMedia] = useState<DisplayMedia | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [adState, setAdState] = useState<{ active: boolean; index: number }>({ active: false, index: 0 });
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const savedLocalTimeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    client.display.media
      .query({ tenantSlug })
      .then((result: DisplayMedia) => {
        if (!cancelled) setMedia(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // Free tier → System Ads; Premium + LIVE mode → Tenant Ads; every other combination → no
  // interruptions at all (PRODUCT.md "In Playlist mode, premium tenants have no ad interruptions").
  const adPool = useMemo<DisplayAdEntry[]>(() => {
    if (media == null) return [];
    if (media.tier === 'premium') return media.videoMode === 'live' ? media.tenantAds : [];
    return media.ads;
  }, [media]);

  const advanceAd = useCallback(() => {
    setAdState((s) => ({ active: false, index: adPool.length === 0 ? 0 : (s.index + 1) % adPool.length }));
  }, [adPool.length]);

  // The 5-minute interrupt timer — only runs when there is at least one ad to show.
  useEffect(() => {
    if (adPool.length === 0) return;
    const timer = setInterval(() => {
      if (localVideoRef.current != null) savedLocalTimeRef.current = localVideoRef.current.currentTime;
      setAdState((s) => ({ active: true, index: s.index }));
    }, AD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [adPool.length]);

  const currentAd = adState.active ? (adPool[adState.index % Math.max(adPool.length, 1)] ?? null) : null;

  // Safety-timeout advance for a YouTube ad (belt-and-suspenders alongside the ENDED event) and
  // the sole advance mechanism for an uploaded ad without native <video onEnded> support (there is
  // none missing — <video> always fires onEnded — kept as a shared fallback for consistency /
  // in case a corrupt file never fires it).
  useEffect(() => {
    if (currentAd == null) return;
    const timeout = setTimeout(advanceAd, (currentAd.duration + AD_DURATION_BUFFER_SEC) * 1000);
    return () => clearTimeout(timeout);
  }, [currentAd, advanceAd]);

  useYouTubePlayer({
    containerId: 'cl-ad-yt-player',
    videoId: currentAd?.type === 'youtube' ? currentAd.videoId : null,
    onEnded: advanceAd,
  });

  // Main content.
  const playlist = media?.playlist ?? [];
  const currentEntry =
    media?.videoMode === 'playlist' && playlist.length > 0 ? (playlist[playlistIndex % playlist.length] ?? null) : null;

  const advancePlaylist = useCallback(() => {
    setPlaylistIndex((i) => (playlist.length === 0 ? 0 : (i + 1) % playlist.length));
  }, [playlist.length]);

  // A playlist entry that is itself a YouTube live embed never ends — dwell then advance.
  useEffect(() => {
    if (currentAd != null || currentEntry == null || !currentEntry.isLive) return;
    const timer = setTimeout(advancePlaylist, LIVE_PLAYLIST_ENTRY_DWELL_MS);
    return () => clearTimeout(timer);
  }, [currentAd, currentEntry, advancePlaylist]);

  useYouTubePlayer({
    containerId: 'cl-main-yt-player',
    videoId: currentAd == null && currentEntry?.type === 'youtube' ? currentEntry.videoId : null,
    onEnded: advancePlaylist,
  });

  const liveVideoId = media?.liveStreamUrl != null ? extractYouTubeId(media.liveStreamUrl) : null;
  useYouTubePlayer({
    containerId: 'cl-live-yt-player',
    videoId: currentAd == null && media?.videoMode === 'live' ? liveVideoId : null,
    // A LIVE embed never emits ENDED — no-op.
    onEnded: () => {
      /* no-op — YouTube LIVE streams do not end from the client's perspective */
    },
  });

  const fadeClass = reducedMotion ? '' : 'cl-fade-in';

  let body: React.ReactNode;
  if (loadError) {
    body = <PlaceholderMessage text="Reconnecting to the media service…" />;
  } else if (currentAd != null) {
    body =
      currentAd.type === 'youtube' ? (
        <div key={`ad-${currentAd.id}`} id="cl-ad-yt-player" className={`h-full w-full ${fadeClass}`} />
      ) : (
        <video
          key={`ad-${currentAd.id}`}
          className={`h-full w-full object-contain ${fadeClass}`}
          src={currentAd.url ?? undefined}
          autoPlay
          muted
          playsInline
          onEnded={advanceAd}
          onError={advanceAd}
        />
      );
  } else if (media?.videoMode === 'live') {
    body =
      liveVideoId != null ? (
        <div id="cl-live-yt-player" className={`h-full w-full ${fadeClass}`} />
      ) : (
        <PlaceholderMessage text="No video playing" />
      );
  } else if (currentEntry != null) {
    body =
      currentEntry.type === 'youtube' ? (
        <div key={currentEntry.id} id="cl-main-yt-player" className={`h-full w-full ${fadeClass}`} />
      ) : (
        <video
          key={currentEntry.id}
          ref={localVideoRef}
          className={`h-full w-full object-contain ${fadeClass}`}
          src={currentEntry.url ?? undefined}
          autoPlay
          muted
          playsInline
          onEnded={advancePlaylist}
          onError={advancePlaylist}
          onLoadedMetadata={() => {
            if (localVideoRef.current != null && savedLocalTimeRef.current > 0) {
              localVideoRef.current.currentTime = savedLocalTimeRef.current;
            }
            savedLocalTimeRef.current = 0;
          }}
        />
      );
  } else {
    // PRODUCT.md "if no videos in playlist, shows 'No video playing' placeholder."
    body = <PlaceholderMessage text="No video playing" />;
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg"
      style={{ background: '#000', border: '1px solid rgba(178, 182, 189, 0.15)' }}
      data-testid="cl-video-panel"
    >
      {body}
      {currentAd != null ? (
        <div
          className="absolute left-2 top-2 rounded px-2 py-0.5"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#efeff1', fontSize: 'clamp(0.5rem, 0.9vw, 0.65rem)' }}
        >
          Advertisement
        </div>
      ) : null}
    </div>
  );
}

function PlaceholderMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ color: '#656a76' }}>
      <span style={{ fontSize: 'clamp(0.75rem, 1.4vw, 1rem)' }}>{text}</span>
    </div>
  );
}
