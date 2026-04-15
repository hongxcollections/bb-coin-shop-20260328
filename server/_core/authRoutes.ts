import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

/**
 * Register email/phone + password auth routes
 */
export function registerAuthRoutes(app: Express) {
  // POST /api/auth/register - 註冊
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, phone, password, name } = req.body;

      if (!password || password.length < 6) {
        res.status(400).json({ error: "密碼至少需要6個字符" });
        return;
      }

      if (!email && !phone) {
        res.status(400).json({ error: "請提供電郵或手機號碼" });
        return;
      }

      const database = await db.getDb();
      if (!database) {
        res.status(500).json({ error: "數據庫不可用" });
        return;
      }

      // Check if email or phone already exists
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

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate openId for email/phone users
      const identifier = email || phone;
      const openId = `local_${identifier}`;

      // Create user
      await db.upsertUser({
        openId,
        name: name || (email ? email.split("@")[0] : phone) || null,
        email: email || null,
        loginMethod: email ? "email" : "phone",
        lastSignedIn: new Date(),
      });

      // Update password and phone fields directly
      if (phone) {
        await database.update(users).set({ phone }).where(eq(users.openId, openId));
      }
      await database.update(users).set({ password: hashedPassword }).where(eq(users.openId, openId));

      // Create session
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

  // POST /api/auth/login - 登入
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        res.status(400).json({ error: "請提供電郵/手機號碼和密碼" });
        return;
      }

      const database = await db.getDb();
      if (!database) {
        res.status(500).json({ error: "數據庫不可用" });
        return;
      }

      // Find user by email or phone
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

      // Verify password
      const isValid = await bcrypt.compare(password, user.password!);
      if (!isValid) {
        res.status(401).json({ error: "帳號或密碼不正確" });
        return;
      }

      // Update last signed in
      await database.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // Create session
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
