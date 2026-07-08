// Wave 7.4-T3 — station announce hook. On a `called`/`recalled` event for the station's OWN
// window: plays a short Web Audio chime, then speaks "Now serving number {N}, window {W}" via
// SpeechSynthesis. Client-only + SSR-safe (every browser API access is behind typeof/window
// guards) and gracefully degrades when a browser lacks Web Audio / SpeechSynthesis support.
//
// Autoplay-policy note: both AudioContext and speechSynthesis.speak() require a prior user
// gesture in most browsers (Chrome's autoplay policy in particular). `unlock()` must be called
// from within a real click handler (the station's first "Call Next" tap) BEFORE the first
// `announce()` — this hook does not attempt to auto-unlock on mount, that would silently fail.
'use client';

import { useCallback, useRef, useState } from 'react';

export interface UseAnnounceResult {
  /** Call from a user-gesture handler (e.g. the first "Call Next" click) to satisfy the browser's
   *  autoplay policy before any chime/speech can play. Safe to call multiple times (idempotent). */
  unlock: () => void;
  /** Plays the chime, then speaks the announcement. No-op (never throws) if the browser lacks
   *  support, or if muted. */
  announce: (ticketNumber: string, windowName: string) => void;
  muted: boolean;
  toggleMute: () => void;
}

export function useAnnounce(): UseAnnounceResult {
  const [muted, setMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    if (typeof window === 'undefined') return;

    try {
      const AudioContextCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor != null) {
        audioCtxRef.current = new AudioContextCtor();
        // Some browsers create a suspended context until a gesture explicitly resumes it.
        void audioCtxRef.current.resume().catch(() => {
          // best-effort — a chime failure must never break the station.
        });
      }
    } catch {
      // Web Audio unsupported/blocked — chime degrades to voice-only (or silent, if that's also
      // unsupported); never throws into the caller.
    }

    // SpeechSynthesis also benefits from being "touched" inside the same gesture on some
    // browsers (an empty cancel() call primes it without producing audible output).
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // best-effort
      }
    }

    unlockedRef.current = true;
  }, []);

  const playChime = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx == null) return;
    try {
      // Two short ascending tones — a simple, unmistakable "attention" chime with no external
      // asset needed (Web Audio OscillatorNode).
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch {
      // best-effort — never breaks the station.
    }
  }, []);

  const speak = useCallback((ticketNumber: string, windowName: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(`Now serving number ${ticketNumber}, ${windowName}`);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {
      // SpeechSynthesis unsupported/blocked — the on-screen number is still the source of truth.
    }
  }, []);

  const announce = useCallback(
    (ticketNumber: string, windowName: string) => {
      if (muted) return;
      playChime();
      // Small delay so the chime is audibly distinct from the voice announcement.
      setTimeout(() => speak(ticketNumber, windowName), 350);
    },
    [muted, playChime, speak],
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { unlock, announce, muted, toggleMute };
}
