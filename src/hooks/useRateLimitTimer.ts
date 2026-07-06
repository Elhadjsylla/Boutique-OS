import { useState, useEffect, useCallback, useRef } from 'react';
import {
  parseWaitSeconds,
  isRateLimitError,
  setRateLimitExpiry,
  getRateLimitExpiry,
  clearRateLimit,
} from '../lib/rateLimit';

export interface RateLimitState {
  /** True while the user must wait before retrying. */
  isRateLimited: boolean;
  /** Seconds remaining (counts down to 0). */
  secondsLeft: number;
  /** ISO-8601 timestamp of when the user may retry, or null if not rate-limited.
   *  Use this to show a human-readable "retry at HH:MM" if needed. */
  retryAt: string | null;
  /**
   * Call this when a Supabase Auth error occurs.
   * If it is a 429, the timer is started automatically.
   * Returns true when the error was a rate-limit (so callers can skip further handling).
   */
  handleError: (err: any, fallbackSeconds?: number) => boolean;
  /** Manually clears the rate limit (e.g. after a successful retry). */
  clear: () => void;
}

/**
 * Countdown timer that tracks Supabase rate limits for a named action.
 * Persists across page reloads via localStorage.
 *
 * @param action  Unique key for this action (e.g. 'otp_request', 'sign_in').
 * @param fallbackSeconds  Wait time when GoTrue doesn't provide a duration.
 *                         Defaults to 60s (covers both sign-in and OTP fallbacks).
 */
export function useRateLimitTimer(
  action: string,
  fallbackSeconds = 60
): RateLimitState {
  const [expiresAt, setExpiresAt] = useState<number | null>(() =>
    getRateLimitExpiry(action)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recompute secondsLeft every second while rate-limited
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (expiresAt === null) return;

    intervalRef.current = setInterval(() => {
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        clearRateLimit(action);
        setExpiresAt(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [action, expiresAt]);

  const secondsLeft =
    expiresAt !== null ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;

  const handleError = useCallback(
    (err: any, fallback = fallbackSeconds): boolean => {
      if (!isRateLimitError(err)) return false;

      const waitSecs = parseWaitSeconds(err?.message ?? '') ?? fallback;
      setRateLimitExpiry(action, waitSecs);
      setExpiresAt(Date.now() + waitSecs * 1000);
      return true;
    },
    [action, fallbackSeconds]
  );

  const clear = useCallback(() => {
    clearRateLimit(action);
    setExpiresAt(null);
  }, [action]);

  return {
    isRateLimited: secondsLeft > 0,
    secondsLeft,
    retryAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    handleError,
    clear,
  };
}
