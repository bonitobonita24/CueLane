// Wave 7.7a-T3 — pure formatting helpers for the Dashboard. No DB/session access — unit-testable,
// tenant-agnostic (no tenant-specific formatting rules).

/** Formats a duration in seconds as `m:ss` (or `h:mm:ss` once past an hour). Rounds to whole
 *  seconds; 0 or negative input renders as `0:00`. */
export function formatDurationSec(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Formats a 0..1 fraction as a whole-number percent string, e.g. 0.4286 -> "43%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
