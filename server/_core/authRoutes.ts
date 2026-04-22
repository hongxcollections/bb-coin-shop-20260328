import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";
import { sendOtpSms, sendOtpWhatsApp, checkViaTwilioVerify, isMainlandChina } from "./sms";
import { generateOtp, setOtp, verifyOtp, canSendOtp, recordOtpSend } from "./otpStore";
import { generateEmailOtp, setEmailOtp, verifyEmailOtp, canSendEmailOtp, recordEmailOtpSend } from "./emailOtpStore";
import { sendOtpFallbackEmail, sendEmailWithDetails } from "../email";
import { addResetRequest } from "./resetRequestStore";

// ─── IP-based OTP rate limiter (configurable from Admin → 站點設定) ───────────
const ipOtpLog = new Map<string, number[]>();

interface IpOtpConfig {
  windowMs: number;
  maxRequests: number;
}

const ipOtpConfig: IpOtpConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
};

export function updateIpOtpConfig(partial: Partial<IpOtpConfig>): void {
  Object.assign(ipOtpConfig, partial);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function checkIpRateLimit(req: Request): { ok: boolean } {
  const ip = getClientIp(req);
  const now = Date.now();
  const log = (ipOtpLog.get(ip) ?? []).filter(t => now - t < ipOtpConfig.windowMs);
  if (log.length >= ipOtpConfig.maxRequests) {
    ipOtpLog.set(ip, log);
    return { ok: false };
  }
  log.push(now);
  ipOtpLog.set(ip, log);
  return { ok: true };
}

// ─── Server-side phone format validation ──────────────────────────────────────
function serverValidatePhone(phone: string): string | null {
  // phone is already in E.164 format e.g. +85261234567
  if (!phone || !phone.startsWith("+")) return "電話號碼格式不正確";
  const rest = phone.slice(1); // strip leading +
  if (phone.startsWith("+852")) {
    const local = rest.slice(3);
    if (!/^[25689]\d{7}$/.test(local))
      return "香港號碼須為 8 位數字，首位為 2、5、6 或 9";
  } else if (phone.startsWith("+86")) {
    const local = rest.slice(2);
    if (!/^1\d{10}$/.test(local))
      return "中國大陸號碼須為 11 位數字，首位為 1";
  } else if (phone.startsWith("+853")) {
    const local = rest.slice(3);
    if (!/^6\d{7}$/.test(local)) return "澳門號碼須為 8 位數字，首位為 6";
  } else if (phone.startsWith("+886")) {
    const local = rest.slice(3);
    if (!/^9\d{8}$/.test(local)) return "台灣號碼須為 9 位數字，首位為 9";
  } else if (phone.startsWith("+65")) {
    const local = rest.slice(2);
    if (!/^[89]\d{7}$/.test(local))
      return "新加坡號碼須為 8 位數字，首位為 8 或 9";
  } else if (phone.startsWith("+60")) {
    const local = rest.slice(2);
    if (!/^1\d{8,9}$/.test(local)) return "馬來西亞號碼須為 9–10 位數字，首位為 1";
  } else {
    // Generic: total digits (excl +) should be 7–15 per E.164
    if (rest.length < 7 || rest.length > 15) return "電話號碼位數不正確";
  }
  return null;
}

export function registerAuthRoutes(app: Express) {

  // POST /api/auth/send-otp — 發送電話驗證碼
  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        res.status(400).json({ error: "請提供手機號碼" });
        return;
      }
      const fmtErr = serverValidatePhone(phone);
      if (fmtErr) {
        res.status(400).json({ error: fmtErr });
        return;
      }

      // IP rate limit: max 10 OTP requests per IP per 15 minutes
      if (!checkIpRateLimit(req).ok) {
        res.status(429).json({ error: "請求過於頻繁，請稍後再試" });
        return;
      }

      // Phone rate limit: 60s cooldown + max 3 sends per hour (all number types)
      const phoneLimit = canSendOtp(phone);
      if (!phoneLimit.ok) {
        res.status(429).json({ error: phoneLimit.reason ?? "請稍候再重新發送驗證碼" });
        return;
      }

      // Check if phone already registered
      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }
      const existing = await database.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (existing.length > 0 && existing[0].password) {
        res.status(400).json({ error: "此手機號碼已被註冊" });
        return;
      }

      // For China (+86): generate code ourselves + use Alibaba
      // For others: Twilio Verify generates the code
      const code = generateOtp();
      if (isMainlandChina(phone)) {
        setOtp(phone, code);
      }

      const smsResult = await sendOtpSms(phone, code);

      if (!smsResult.ok) {
        console.error(`[Auth] OTP send failed for ${phone}: ${smsResult.error}`);
        res.status(500).json({ error: "驗證碼發送失敗", detail: smsResult.error });
        return;
      }

      // Record successful send for rate limiting
      recordOtpSend(phone);
      res.json({ success: true, message: "驗證碼已發送" });
    } catch (err) {
      console.error("[Auth] send-otp error:", err);
      res.status(500).json({ error: "發送失敗，請稍後再試" });
    }
  });

  // POST /api/auth/send-otp-whatsapp — WhatsApp 備用發送（短訊收不到時使用）
  app.post("/api/auth/send-otp-whatsapp", async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone) { res.status(400).json({ error: "請提供手機號碼" }); return; }

      const fmtErr = serverValidatePhone(phone);
      if (fmtErr) { res.status(400).json({ error: fmtErr }); return; }

      if (isMainlandChina(phone)) {
        res.status(400).json({ error: "中國大陸號碼暫不支援 WhatsApp 備用發送" });
        return;
      }

      // IP rate limit
      if (!checkIpRateLimit(req).ok) {
        res.status(429).json({ error: "請求過於頻繁，請稍後再試" });
        return;
      }

      // Phone rate limit (same pool as SMS — WhatsApp counts toward hourly limit)
      const phoneLimit = canSendOtp(phone);
      if (!phoneLimit.ok) {
        res.status(429).json({ error: phoneLimit.reason ?? "請稍候再重新發送驗證碼" });
        return;
      }

      const waResult = await sendOtpWhatsApp(phone);
      if (!waResult.ok) {
        console.error(`[Auth] WhatsApp OTP send failed for ${phone}: ${waResult.error}`);
        res.status(500).json({ error: waResult.error || "WhatsApp 發送失敗，請改用短訊驗證碼" });
        return;
      }

      recordOtpSend(phone);
      res.json({ success: true, message: "驗證碼已透過 WhatsApp 發送" });
    } catch (err) {
      console.error("[Auth] send-otp-whatsapp error:", err);
      res.status(500).json({ error: "發送失敗，請稍後再試" });
    }
  });

  // POST /api/auth/send-otp-email-fallback — 短訊收不到時，改用電郵發送驗證碼
  app.post("/api/auth/send-otp-email-fallback", async (req: Request, res: Response) => {
    try {
      const { phone, email } = req.body;
      if (!phone || !email) {
        res.status(400).json({ error: "請提供手機號碼及電郵地址" });
        return;
      }
      const fmtErr = serverValidatePhone(phone);
      if (fmtErr) { res.status(400).json({ error: fmtErr }); return; }

      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "電郵地址格式不正確" });
        return;
      }

      // IP rate limit
      if (!checkIpRateLimit(req).ok) {
        res.status(429).json({ error: "請求過於頻繁，請稍後再試" });
        return;
      }

      // Email send limit
      const emailLimit = canSendEmailOtp(email);
      if (!emailLimit.ok) {
        res.status(429).json({ error: emailLimit.reason ?? "電郵發送次數過多，請稍後再試" });
        return;
      }

      // Check phone not already registered
      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }
      const existing = await database.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (existing.length > 0 && existing[0].password) {
        res.status(400).json({ error: "此手機號碼已被註冊" });
        return;
      }

      // Generate and store email OTP
      const code = generateEmailOtp();
      setEmailOtp(phone, email, code);

      // OTP emails always use the verified domain address (transactional, not marketing)
      const settings = await db.getNotificationSettings();
      const senderName = settings?.senderName ?? "大BB錢幣店";
      const senderEmail = "noreply@hongxcollections.com";

      console.log(`[Auth] Email fallback OTP: senderEmail=${senderEmail}, to=${email}`);

      const sendResult = await sendEmailWithDetails({
        to: email,
        senderName,
        senderEmail,
        subject: `【大BB錢幣店】手機驗證碼：${code}`,
        html: `<p>您正在驗證手機號碼 <strong>${phone}</strong>。</p><p>驗證碼：<strong style="font-size:24px;letter-spacing:6px">${code}</strong></p><p>有效期 10 分鐘。</p>`,
      });
      if (!sendResult.ok) {
        const detail = sendResult.resendError ?? "unknown";
        console.error(`[Auth] Email fallback OTP send failed: ${detail}`);
        res.status(500).json({
          error: "電郵發送失敗，請確認電郵地址正確或稍後再試",
          _debug: detail,  // visible in browser devtools for admin diagnosis
        });
        return;
      }

      recordEmailOtpSend(email);
      console.log(`[Auth] Email fallback OTP sent for phone ${phone} to ${email}`);
      res.json({ success: true, message: "驗證碼已發送至您的電郵" });
    } catch (err) {
      console.error("[Auth] send-otp-email-fallback error:", err);
      res.status(500).json({ error: "發送失敗，請稍後再試" });
    }
  });

  // POST /api/auth/register — 註冊（電話需已通過 OTP 驗證）
  // ─── 暫時停用：電郵註冊功能 ───────────────────────────────────────────────────
  // 若需重新啟用，移除下方 EMAIL_REGISTER_ENABLED 守衛，並同步更新 Login.tsx 的 EMAIL_FEATURE_ENABLED
  const EMAIL_REGISTER_ENABLED = false;
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, phone, password, name, otpCode, emailFallback, fallbackEmail } = req.body;

      // 電郵註冊暫時停用守衛
      if (!EMAIL_REGISTER_ENABLED && email && !phone) {
        res.status(503).json({ error: "電郵註冊功能暫時停用，請使用手機號碼註冊" });
        return;
      }

      if (!password || password.length < 6) {
        res.status(400).json({ error: "密碼至少需要6個字符" });
        return;
      }
      if (!email && !phone) {
        res.status(400).json({ error: "請提供電郵或手機號碼" });
        return;
      }

      // Phone registration requires OTP verification
      if (phone) {
        if (!otpCode) {
          res.status(400).json({ error: "請輸入電話驗證碼", requireOtp: true });
          return;
        }

        if (emailFallback && fallbackEmail) {
          // Email fallback: verify against our email OTP store
          const result = verifyEmailOtp(phone, otpCode);
          if (result === "expired") {
            res.status(400).json({ error: "電郵驗證碼已過期，請重新發送", otpExpired: true });
            return;
          }
          if (result === "invalid") {
            res.status(400).json({ error: "電郵驗證碼不正確，請重新輸入" });
            return;
          }
        } else if (isMainlandChina(phone)) {
          // China: verify against our local OTP store (Alibaba sent it)
          const result = verifyOtp(phone, otpCode);
          if (result === "expired") {
            res.status(400).json({ error: "驗證碼已過期，請重新發送", otpExpired: true });
            return;
          }
          if (result === "too_many_attempts") {
            res.status(400).json({ error: "驗證碼錯誤次數過多，請重新發送", otpExpired: true });
            return;
          }
          if (result === "invalid") {
            res.status(400).json({ error: "驗證碼不正確，請重新輸入" });
            return;
          }
        } else {
          // Non-China: verify via Twilio Verify API
          const verifyResult = await checkViaTwilioVerify(phone, otpCode);
          if (verifyResult === "error") {
            res.status(500).json({ error: "驗證碼確認時出現錯誤，請稍後再試" });
            return;
          }
          if (verifyResult !== "approved") {
            res.status(400).json({ error: "驗證碼不正確或已過期，請重新發送" });
            return;
          }
        }
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      if (email) {
        const existing = await database.select().from(users).where(eq(users.email, email)).limit(1);
        if (existing.length > 0 && existing[0].password) {
          res.status(400).json({ error: "此電郵已被註冊" });
          return;
        }
      }
      if (phone) {
        const existing = await database.select().from(users).where(eq(users.phone, phone)).limit(1);
        if (existing.length > 0 && existing[0].password) {
          res.status(400).json({ error: "此手機號碼已被註冊" });
          return;
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const identifier = email || phone;
      const openId = `local_${identifier}`;

      await db.upsertUser({
        openId,
        name: name || (email ? email.split("@")[0] : phone) || null,
        email: email || null,
        loginMethod: email ? "email" : "phone",
        lastSignedIn: new Date(),
      });

      if (phone) {
        await database.update(users).set({ phone }).where(eq(users.openId, openId));
      }
      await database.update(users).set({ password: hashedPassword }).where(eq(users.openId, openId));

      const sessionToken = await sdk.createSessionToken(openId, {
        name: name || identifier || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // 電話新用戶自動試領每日早鳥名額（名額未滿 + 未領過 + 今日新註冊）
      if (phone && !email) {
        try {
          const { tryClaimEarlyBirdForUser } = await import("../loyalty");
          const result = await tryClaimEarlyBirdForUser(openId);
          if (result.claimed) {
            console.log(`[Auth] Early bird claimed by new phone user ${openId}: ${result.trialLevel} until ${result.trialExpiresAt?.toISOString()}`);
          }
        } catch (err) {
          console.warn("[Auth] Early bird claim warning:", err instanceof Error ? err.message : err);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "註冊失敗，請稍後再試" });
    }
  });

  // POST /api/auth/email-reset-request — 電郵忘記密碼：驗證電郵、生成臨時密碼、通知管理員
  // ─── 暫時停用：電郵忘記密碼功能 ─────────────────────────────────────────────────
  // 若需重新啟用，移除下方 EMAIL_RESET_ENABLED 守衛，並同步更新 Login.tsx 的 EMAIL_FEATURE_ENABLED
  const EMAIL_RESET_ENABLED = false;
  app.post("/api/auth/email-reset-request", async (req: Request, res: Response) => {
    try {
      // 電郵忘記密碼暫時停用守衛
      if (!EMAIL_RESET_ENABLED) {
        res.status(503).json({ error: "電郵重設密碼功能暫時停用，請使用手機號碼驗證重設密碼" });
        return;
      }

      const { email } = req.body;
      if (!email || typeof email !== "string") {
        res.status(400).json({ error: "請提供電郵地址" }); return;
      }
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        res.status(400).json({ error: "電郵格式不正確，請重新確認" }); return;
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      const found = await database
        .select({ id: users.id, name: users.name, email: users.email, password: users.password })
        .from(users)
        .where(eq(users.email, trimmed))
        .limit(1);

      if (found.length === 0 || !found[0].password) {
        res.status(404).json({ error: "此電郵未曾登記，請重新確認" }); return;
      }

      // Generate an 8-char alphanumeric temp password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let tempPassword = "";
      for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

      const hashed = await bcrypt.hash(tempPassword, 10);
      await database.update(users).set({ password: hashed }).where(eq(users.id, found[0].id));

      addResetRequest({
        email: trimmed,
        userName: found[0].name,
        tempPassword,
        createdAt: new Date(),
      });

      console.log(`[Auth] Email reset request for ${trimmed} — temp pw generated (admin notified)`);
      res.json({ success: true });
    } catch (err) {
      console.error("[Auth] email-reset-request error:", err);
      res.status(500).json({ error: "處理失敗，請稍後再試" });
    }
  });

  // POST /api/auth/forgot-password/send-otp — 忘記密碼：向已登記手機發送 OTP
  app.post("/api/auth/forgot-password/send-otp", async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone) { res.status(400).json({ error: "請提供手機號碼" }); return; }

      const fmtErr = serverValidatePhone(phone);
      if (fmtErr) { res.status(400).json({ error: fmtErr }); return; }

      // IP rate limit: max 10 OTP requests per IP per 15 minutes
      if (!checkIpRateLimit(req).ok) {
        res.status(429).json({ error: "請求過於頻繁，請稍後再試" });
        return;
      }

      // Phone rate limit: 60s cooldown + max 3 sends per hour (all number types)
      const phoneLimit = canSendOtp(phone);
      if (!phoneLimit.ok) {
        res.status(429).json({ error: phoneLimit.reason ?? "請稍候再重新發送驗證碼" });
        return;
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      const found = await database.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (found.length === 0 || !found[0].password) {
        res.status(404).json({ error: "此手機號碼未曾登記，請重新確認" });
        return;
      }

      const code = generateOtp();
      if (isMainlandChina(phone)) setOtp(phone, code);

      const smsResult = await sendOtpSms(phone, code);
      if (!smsResult.ok) {
        console.error(`[Auth] forgot-pw OTP failed for ${phone}: ${smsResult.error}`);
        res.status(500).json({ error: "驗證碼發送失敗", detail: smsResult.error });
        return;
      }

      // Record successful send for rate limiting
      recordOtpSend(phone);
      res.json({ success: true });
    } catch (err) {
      console.error("[Auth] forgot-password/send-otp error:", err);
      res.status(500).json({ error: "發送失敗，請稍後再試" });
    }
  });

  // POST /api/auth/forgot-password/reset — 忘記密碼：驗證 OTP 後更新密碼
  app.post("/api/auth/forgot-password/reset", async (req: Request, res: Response) => {
    try {
      const { phone, otpCode, newPassword } = req.body;
      if (!phone || !otpCode || !newPassword) {
        res.status(400).json({ error: "資料不完整" }); return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: "密碼須至少 6 個字元" }); return;
      }

      // Verify OTP
      if (isMainlandChina(phone)) {
        const result = verifyOtp(phone, otpCode);
        if (result === "expired") {
          res.status(400).json({ error: "驗證碼已過期，請重新發送", otpExpired: true }); return;
        }
        if (result === "too_many_attempts") {
          res.status(400).json({ error: "驗證碼錯誤次數過多，請重新發送", otpExpired: true }); return;
        }
        if (result === "invalid") {
          res.status(400).json({ error: "驗證碼不正確，請重新輸入" }); return;
        }
      } else {
        const verifyResult = await checkViaTwilioVerify(phone, otpCode);
        if (verifyResult === "error") {
          res.status(500).json({ error: "驗證時出現錯誤，請稍後再試" }); return;
        }
        if (verifyResult !== "approved") {
          res.status(400).json({ error: "驗證碼不正確或已過期，請重新發送" }); return;
        }
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await database.update(users).set({ password: hashedPassword }).where(eq(users.phone, phone));

      res.json({ success: true });
    } catch (err) {
      console.error("[Auth] forgot-password/reset error:", err);
      res.status(500).json({ error: "重設密碼失敗，請稍後再試" });
    }
  });

  // POST /api/auth/login — 登入
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        res.status(400).json({ error: "請提供電郵/手機號碼和密碼" });
        return;
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      const result = await database
        .select({
          id: users.id,
          openId: users.openId,
          name: users.name,
          password: users.password,
          mustChangePassword: users.mustChangePassword,
        })
        .from(users)
        .where(or(eq(users.email, identifier), eq(users.phone, identifier)))
        .limit(1);

      if (result.length === 0 || !result[0].password) {
        res.status(401).json({ error: "帳號或密碼不正確" });
        return;
      }

      const user = result[0];
      const isValid = await bcrypt.compare(password, user.password!);
      if (!isValid) {
        res.status(401).json({ error: "帳號或密碼不正確" });
        return;
      }

      await database.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      // mustChangePassword: 管理員設定密碼後，首次登入須強制更改
      res.json({ success: true, mustChangePassword: user.mustChangePassword === 1 });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "登入失敗，請稍後再試" });
    }
  });

  // POST /api/auth/change-password-forced — 強制更改密碼（管理員設定後首次登入時呼叫）
  app.post("/api/auth/change-password-forced", async (req: Request, res: Response) => {
    try {
      // 驗證已登入
      const currentUser = await sdk.authenticateRequest(req);
      if (!currentUser) {
        res.status(401).json({ error: "未登入" });
        return;
      }

      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        res.status(400).json({ error: "新密碼至少需要6個字符" });
        return;
      }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      const hashed = await bcrypt.hash(newPassword, 10);
      await database.update(users)
        .set({ password: hashed, mustChangePassword: 0 })
        .where(eq(users.id, currentUser.id));

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] change-password-forced error:", error);
      res.status(500).json({ error: "更改密碼失敗，請稍後再試" });
    }
  });
}
