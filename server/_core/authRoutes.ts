import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";
import { sendOtpSms, checkViaTwilioVerify, isMainlandChina } from "./sms";
import { generateOtp, setOtp, verifyOtp, canResend } from "./otpStore";

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

      // Rate limit: 60s between resends (only used for Alibaba/China flow)
      if (isMainlandChina(phone) && !canResend(phone)) {
        res.status(429).json({ error: "請稍候再重新發送驗證碼" });
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

      res.json({ success: true, message: "驗證碼已發送" });
    } catch (err) {
      console.error("[Auth] send-otp error:", err);
      res.status(500).json({ error: "發送失敗，請稍後再試" });
    }
  });

  // POST /api/auth/register — 註冊（電話需已通過 OTP 驗證）
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, phone, password, name, otpCode } = req.body;

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

        if (isMainlandChina(phone)) {
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
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Register failed:", error);
      res.status(500).json({ error: "註冊失敗，請稍後再試" });
    }
  });

  // POST /api/auth/forgot-password/send-otp — 忘記密碼：向已登記手機發送 OTP
  app.post("/api/auth/forgot-password/send-otp", async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone) { res.status(400).json({ error: "請提供手機號碼" }); return; }

      const fmtErr = serverValidatePhone(phone);
      if (fmtErr) { res.status(400).json({ error: fmtErr }); return; }

      const database = await db.getDb();
      if (!database) { res.status(500).json({ error: "數據庫不可用" }); return; }

      const found = await database.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (found.length === 0 || !found[0].password) {
        res.status(404).json({ error: "此手機號碼未曾登記，請重新確認" });
        return;
      }

      if (isMainlandChina(phone) && !canResend(phone)) {
        res.status(429).json({ error: "請稍候再重新發送驗證碼" });
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
        .select()
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
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "登入失敗，請稍後再試" });
    }
  });
}
