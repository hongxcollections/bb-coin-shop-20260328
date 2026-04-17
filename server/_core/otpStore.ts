/**
 * In-memory OTP store with expiry.
 * Key: phone number, Value: { code, expiresAt, attempts }
 */

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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

export function canResend(phone: string): boolean {
  const entry = store.get(phone);
  if (!entry) return true;
  return Date.now() > entry.expiresAt - OTP_TTL_MS + 60_000;
}
