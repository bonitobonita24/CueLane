// Wave 7.9-T1 — Cloudflare Turnstile verification seam.
//
// Dev/test: TURNSTILE_SECRET_KEY is unset OR set to Cloudflare's official dummy always-pass key
// (`1x0000000000000000000000000000000AA`, per .env.dev / .env.example — "dev uses official
// Cloudflare test keys (always pass)") — this function no-ops and returns true, so signup/login
// never blocks on a real widget the dev/test environment doesn't render. See docs/DECISIONS_LOG.md
// "Wave 7.9 stub seams" for the owner-pending-live-key record.
//
// Production: once the owner supplies a LIVE TURNSTILE_SECRET_KEY (Phase-6 CREDENTIALS.md
// rollout), this same function starts performing the real server-side siteverify call — no other
// code needs to change, this is the one seam.
const DUMMY_SECRET_PREFIX = '1x0000';

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secretKey = process.env['TURNSTILE_SECRET_KEY'];

  if (secretKey == null || secretKey === '' || secretKey.startsWith(DUMMY_SECRET_PREFIX)) {
    return true;
  }

  if (token == null || token === '') return false;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
