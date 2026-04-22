/**
 * In-memory OTP store with expiry.
 * Key: phone number, Value: { code, expiresAt, attempts }
 *
 * DoS protections:
 * - 60s resend cooldown for ALL numbers (not just China)
 * - Max 3 OTP sends per phone per hour
 * - Max 5 verification attempts per OTP code
 */

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

// Separate send-time log for rate limiting (survives OTP expiry/use)
// phone → sorted list of send timestamps (within rolling 1-hour window)
const sendLog = new Map<string, number[]>();

const OTP_TTL_MS = 10 * 60 * 1000;        // 10 minutes OTP validity
const MAX_ATTEMPTS = 5;                     // Max wrong guesses per OTP
const RESEND_COOLDOWN_MS = 60 * 1000;      // 60 seconds between resends
const HOURLY_WINDOW_MS = 60 * 60 * 1000;  // 1 hour sliding window
const MAX_SENDS_PER_HOUR = 3;              // Max OTP sends per phone per hour

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setOtp(phone: string, code: string): void {
  store.set(phone, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}

export type VerifyResult = "ok" | "expired" | "invalid" | "too_many_attempts";

export function verifyOtp(phone: string, code: string): VerifyResult {
  const entry = store.get(phone);
  if (!entry) return "expired";
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return "expired";
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(phone);
    return "too_many_attempts";
  }
  if (entry.code !== code) {
    entry.attempts += 1;
    return "invalid";
  }
  store.delete(phone);
  return "ok";
}

export function hasValidOtp(phone: string): boolean {
  const entry = store.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return false;
  }
  return true;
}

/**
 * Check if we can send an OTP to this phone.
 * Applies to ALL numbers (Hong Kong, international, and China).
 * Returns { ok: true } if allowed, or { ok: false, reason, waitSecs } if blocked.
 */
export function canSendOtp(phone: string): { ok: boolean; reason?: string; waitSecs?: number } {
  const now = Date.now();

  // Purge old entries from sendLog
  const history = (sendLog.get(phone) ?? []).filter(t => now - t < HOURLY_WINDOW_MS);
  sendLog.set(phone, history);

  // 1. 60-second resend cooldown: check last send time
  if (history.length > 0) {
    const lastSent = history[history.length - 1];
    const elapsed = now - lastSent;
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSecs = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { ok: false, reason: `請等候 ${waitSecs} 秒後再重新發送`, waitSecs };
    }
  }

  // 2. Hourly send limit: max 3 per phone per hour
  if (history.length >= MAX_SENDS_PER_HOUR) {
    const oldestInWindow = history[0];
    const resetSecs = Math.ceil((HOURLY_WINDOW_MS - (now - oldestInWindow)) / 1000 / 60);
    return { ok: false, reason: `此號碼今小時已發送上限，請 ${resetSecs} 分鐘後再試` };
  }

  return { ok: true };
}

/**
 * Record that an OTP was successfully sent to this phone.
 * Must be called after each successful SMS dispatch.
 */
export function recordOtpSend(phone: string): void {
  const now = Date.now();
  const history = (sendLog.get(phone) ?? []).filter(t => now - t < HOURLY_WINDOW_MS);
  history.push(now);
  sendLog.set(phone, history);
}

/** @deprecated Use canSendOtp() instead */
export function canResend(phone: string): boolean {
  return canSendOtp(phone).ok;
}
