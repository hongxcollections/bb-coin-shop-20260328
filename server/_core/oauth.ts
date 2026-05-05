import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import axios from "axios";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  sub: string;
  name: string;
  email: string;
  picture: string;
  email_verified: boolean;
}

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const { data } = await axios.post<GoogleTokenResponse>(
    "https://oauth2.googleapis.com/token",
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return data;
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const { data } = await axios.get<GoogleUserInfo>(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

// ─── 暫時停用：Google OAuth / 電郵類註冊 ───────────────────────────────────────
// 現階段網站只接受手機號碼註冊。
// - GOOGLE_OAUTH_NEW_USER_ENABLED = false：Google OAuth 唔可以開新帳號（已存在嘅 Google 用戶仍然可以登入）
// - 若需重新啟用，將下方常數改為 true，並同步更新 client/src/const.ts 嘅 getLoginUrl()
const GOOGLE_OAUTH_NEW_USER_ENABLED = false;

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      // Use Google OAuth if Google credentials are configured
      if (ENV.googleClientId && ENV.googleClientSecret) {
        // Railway uses X-Forwarded-Proto which may contain multiple values like "https,http"
        // Take the first value (the outermost proxy protocol)
        const forwardedProto = req.headers["x-forwarded-proto"];
        const protocol = typeof forwardedProto === "string"
          ? forwardedProto.split(",")[0].trim()
          : req.protocol;
        const host = req.get("host");
        const redirectUri = `${protocol}://${host}/api/oauth/callback`;
        console.log(`[OAuth] Callback - protocol: ${protocol}, host: ${host}, redirectUri: ${redirectUri}`);
        const tokenResponse = await exchangeGoogleCode(code, redirectUri);
        const userInfo = await getGoogleUserInfo(tokenResponse.access_token);

        const openId = `google_${userInfo.sub}`;

        // ─── 守衛：Google OAuth 唔可以開新帳號 ──────────────────────────────────
        // 只允許「已存在嘅 Google 用戶」登入，新嘅 Google 帳號一律 reject
        const existing = await db.getUserByOpenId(openId);
        if (!existing && !GOOGLE_OAUTH_NEW_USER_ENABLED) {
          console.warn(`[OAuth] Blocked new Google registration - openId: ${openId}, email: ${userInfo.email}`);
          res.redirect(302, "/login?error=" + encodeURIComponent("Google 註冊功能暫時停用，請使用手機號碼註冊"));
          return;
        }

        console.log(`[OAuth] Existing Google user logged in - openId: ${openId}, email: ${userInfo.email}, name: ${userInfo.name}`);

        await db.upsertUser({
          openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: "google",
          lastSignedIn: new Date(),
          photoUrl: userInfo.picture ?? null,
        });

        // 註：早鳥領取只對電話註冊（/api/auth/register with phone）生效，Google OAuth 唔會觸發。

        const sessionToken = await sdk.createSessionToken(openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
        return;
      }

      // Fallback: Manus OAuth
      if (!state) {
        res.status(400).json({ error: "state is required" });
        return;
      }

      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
