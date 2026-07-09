// Wave 7.7d-T2 — thin wrapper around the YouTube IFrame Player API (docs verified via context7
// /websites/developers_google_youtube "iframe_api_reference": bootstrap script
// `https://www.youtube.com/iframe_api`, global `onYouTubeIframeAPIReady` callback, constructor
// `new YT.Player(elementId, { videoId, playerVars, events: { onReady, onStateChange } })`,
// `YT.PlayerState.ENDED`). Used by the Big Display video panel to detect when a YouTube playlist
// entry or ad finishes playing, so the panel can auto-advance/resume without polling.
//
// [HOW] decision: the API docs do NOT confirm a supported `host` constructor option for
// youtube-nocookie.com privacy-enhanced embeds (only iframe-tag-based embeds document that via a
// different mechanism) — using an unverified param would violate the "don't guess the API"
// context7 discipline. This hook therefore embeds via the STANDARD youtube.com IFrame API path
// (documented, always works); the CSP (next.config.ts) still allow-lists youtube-nocookie.com
// defensively for a future switch, but the player itself uses youtube.com. Recorded in
// docs/DECISIONS_LOG.md "Wave 7.7d-T2".
'use client';

import { useEffect, useRef } from 'react';

// Minimal shape of the global `YT` namespace this hook actually uses — the full IFrame API
// surface is much larger; typing only what's consumed here avoids an untyped `any` leaking into
// every call site while not requiring the (unofficial) @types/youtube package as a dependency.
interface YTPlayerVars {
  autoplay?: 0 | 1;
  controls?: 0 | 1;
  disablekb?: 0 | 1;
  modestbranding?: 0 | 1;
  rel?: 0 | 1;
  playsinline?: 0 | 1;
  mute?: 0 | 1;
  loop?: 0 | 1;
  playlist?: string;
}
interface YTPlayerEvent {
  data: number;
  target: YTPlayer;
}
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  destroy(): void;
}
interface YTPlayerConstructorOptions {
  videoId: string;
  playerVars?: YTPlayerVars;
  events?: {
    onReady?: (e: YTPlayerEvent) => void;
    onStateChange?: (e: YTPlayerEvent) => void;
    onError?: (e: YTPlayerEvent) => void;
  };
}
interface YTNamespace {
  Player: new (elementId: string, options: YTPlayerConstructorOptions) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number; UNSTARTED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<YTNamespace> | null = null;

/** Loads the IFrame Player API script exactly once per page (shared across every player
 *  instance — the Big Display may have both a main playlist player and an ad player mounted at
 *  different times, but never needs to reload the bootstrap script twice). */
function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    // SSR guard — this hook only ever runs client-side ('use client' + useEffect), but keep the
    // function callable without throwing during any accidental server evaluation.
    return new Promise(() => {
      /* never resolves server-side */
    });
  }
  if (window.YT?.Player != null) return Promise.resolve(window.YT);
  if (apiLoadPromise != null) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT != null) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return apiLoadPromise;
}

interface UseYouTubePlayerOptions {
  /** Container element id — must be unique among simultaneously-mounted players. */
  containerId: string;
  videoId: string | null;
  /** Fires once, when playback reaches the ENDED state — the caller advances the playlist/ad
   *  rotation from here. Not fired for a live-stream embed (YouTube LIVE videos never emit ENDED
   *  while live). */
  onEnded?: () => void;
}

/** Mounts (and tears down) a YouTube IFrame Player bound to `containerId`, re-creating it
 *  whenever `videoId` changes. Muted-autoplay by default — the Big Display is a public wall
 *  screen with no user gesture to unlock audio, and PRODUCT.md doesn't specify sound requirements
 *  for the video panel; muted matches browser autoplay policy without needing a user click. */
export function useYouTubePlayer({ containerId, videoId, onEnded }: UseYouTubePlayerOptions): void {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    if (videoId == null) return;
    let cancelled = false;
    let player: YTPlayer | null = null;

    void loadYouTubeIframeApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          mute: 1,
        },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) onEndedRef.current?.();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
    };
  }, [containerId, videoId]);
}
