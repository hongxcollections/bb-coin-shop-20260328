/**
 * In-memory email OTP store for phone registration fallback.
 * When a user can't receive SMS, they can verify their phone via email OTP instead.
 * Key: phone (E.164) → { email, code, expiresAt }
 */

interface EmailOtpEntry {
  email: string;
  code: string;
  expiresAt: number;
}

const store = new Map<string, EmailOtpEntry>();          // phone → entry
const sendLog = new Map<string, number[]>();             // email → send timestamps

const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;               // 10 minutes validity
const EMAIL_OTP_WINDOW_MS = 60 * 60 * 1000;            // 1 hour sliding window
const EMAIL_OTP_MAX_PER_HOUR = 3;                       // max sends per email per hour

export function generateEmailOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setEmailOtp(phone: string, email: string, code: string): void {
  store.set(phone, { email, code, expiresAt: Date.now() + EMAIL_OTP_TTL_MS });
}

export type EmailOtpVerifyResult = "ok" | "expired" | "invalid";

export function verifyEmailOtp(phone: string, code: string): EmailOtpVerifyResult {
  const entry = store.get(phone);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(phone);
    return "expired";
  }
  if (entry.code !== code) return "invalid";
  store.delete(phone);
  return "ok";
}

export function canSendEmailOtp(email: string): { ok: boolean; reason?: string } {
  const now = Date.now();
  const history = (sendLog.get(email) ?? []).filter(t => now - t < EMAIL_OTP_WINDOW_MS);
  sendLog.set(email, history);
  if (history.length >= EMAIL_OTP_MAX_PER_HOUR) {
    return { ok: false, reason: "此電郵今小時已達發送上限，請稍後再試" };
  }
  return { ok: true };
}

export function recordEmailOtpSend(email: string): void {
  const now = Date.now();
  const history = (sendLog.get(email) ?? []).filter(t => now - t < EMAIL_OTP_WINDOW_MS);
  history.push(now);
  sendLog.set(email, history);
}
