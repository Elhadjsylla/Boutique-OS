// ─── GoTrue rate-limit error parsing ─────────────────────────────────────────
//
// Email operations (resetPasswordForEmail, signInWithOtp, sendMagicLink) return:
//   HTTP 429  +  msg: "For security purposes, you can only request this after 56 seconds."
// The exact wait time is embedded in the message by GoTrue — we parse it.
//
// Sign-in password attempts return:
//   HTTP 429  +  msg: "Request rate limit reached"  (no timing info)
// For those we apply a configurable fallback window.

const LS_PREFIX = 'sb_rl_';

/** Extracts the wait time in seconds from a GoTrue rate-limit message, or null. */
export function parseWaitSeconds(message: string): number | null {
  const m = message.match(/after\s+(\d+)\s+second/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Returns true if the error looks like a Supabase 429 rate-limit. */
export function isRateLimitError(err: any): boolean {
  return (
    err?.status === 429 ||
    (err?.message || '').toLowerCase().includes('rate limit') ||
    (err?.message || '').toLowerCase().includes('security purposes')
  );
}

// ─── localStorage persistence ─────────────────────────────────────────────────

/** Records a rate-limit expiry timestamp for a named action. */
export function setRateLimitExpiry(action: string, waitSeconds: number): void {
  const expiresAt = Date.now() + waitSeconds * 1000;
  try {
    localStorage.setItem(`${LS_PREFIX}${action}`, String(expiresAt));
  } catch {
    // localStorage unavailable (private browsing edge case) — fail silently
  }
}

/**
 * Returns the expiry timestamp (ms since epoch) for a rate-limited action,
 * or null if no active limit exists.
 */
export function getRateLimitExpiry(action: string): number | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${action}`);
    if (!raw) return null;
    const expiresAt = parseInt(raw, 10);
    if (Date.now() >= expiresAt) {
      localStorage.removeItem(`${LS_PREFIX}${action}`);
      return null;
    }
    return expiresAt;
  } catch {
    return null;
  }
}

/** Clears a rate-limit record (e.g. on successful retry). */
export function clearRateLimit(action: string): void {
  try {
    localStorage.removeItem(`${LS_PREFIX}${action}`);
  } catch {
    /* noop */
  }
}
