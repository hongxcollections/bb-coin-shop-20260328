import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import axios from "axios";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

// ─── Facebook OAuth helpers ──────────────────────────────────────────────────

async function exchangeFacebookCode(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    code,
    client_id: ENV.facebookAppId,
    client_secret: ENV.facebookAppSecret,
    redirect_uri: redirectUri,
  });
  const { data } = await axios.get<{ access_token: string }>(
    `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`
  );
  return data.access_token;
}

interface FacebookUserInfo {
  id: string;
  name: string;
  email?: string;
  picture?: { data?: { url?: string } };
}

async function getFacebookUserInfo(accessToken: string): Promise<FacebookUserInfo> {
  const { data } = await axios.get<FacebookUserInfo>(
    `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture&access_token=${accessToken}`
  );
  return data;
}

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
const GOOGLE_OAUTH_NEW_USER_ENABLED = true;

export function registerOAuthRoutes(app: Express) {
  // ─── Facebook Login: redirect to FB OAuth ────────────────────────────────
  app.get("/api/auth/facebook", async (req: Request, res: Response) => {
    const enabled = await db.getSiteSetting("facebookLoginEnabled");
    if (enabled !== "true") {
      res.redirect(302, "/login?error=" + encodeURIComponent("Facebook 登入功能未開啟"));
      return;
    }
    if (!ENV.facebookAppId) {
      res.redirect(302, "/login?error=" + encodeURIComponent("Facebook 登入未設定"));
      return;
    }
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : req.protocol;
    const host = req.get("host");
    const redirectUri = `${protocol}://${host}/api/auth/facebook/callback`;
    const params = new URLSearchParams({
      client_id: ENV.facebookAppId,
      redirect_uri: redirectUri,
      scope: "public_profile",
      response_type: "code",
    });
    res.redirect(302, `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
  });

  // ─── Facebook Login: handle callback ─────────────────────────────────────
  app.get("/api/auth/facebook/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const fbError = getQueryParam(req, "error");
    if (fbError || !code) {
      res.redirect(302, "/login?error=" + encodeURIComponent("Facebook 登入取消或失敗，請重試"));
      return;
    }
    try {
      const enabled = await db.getSiteSetting("facebookLoginEnabled");
      if (enabled !== "true") {
        res.redirect(302, "/login?error=" + encodeURIComponent("Facebook 登入功能未開啟"));
        return;
      }
      const forwardedProto = req.headers["x-forwarded-proto"];
      const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : req.protocol;
      const host = req.get("host");
      const redirectUri = `${protocol}://${host}/api/auth/facebook/callback`;
      const accessToken = await exchangeFacebookCode(code, redirectUri);
      const userInfo = await getFacebookUserInfo(accessToken);
      const openId = `facebook_${userInfo.id}`;
      console.log(`[Facebook OAuth] User login - openId: ${openId}, name: ${userInfo.name}, hasEmail: ${!!userInfo.email}`);
      // 只在用戶尚未有 email 時才填入 FB email，避免覆蓋用戶手動設定的 email
      const existing = await db.getUserByOpenId(openId);
      const isNewUser = !existing;
      const emailToSave = existing?.email ? undefined : (userInfo.email ?? null);
      await db.upsertUser({
        openId,
        name: userInfo.name || null,
        ...(emailToSave !== undefined ? { email: emailToSave } : {}),
        loginMethod: "facebook",
        lastSignedIn: new Date(),
        photoUrl: userInfo.picture?.data?.url ?? null,
      });
      // 新用戶自動升銀會員
      if (isNewUser) {
        try {
          const newUser = await db.getUserByOpenId(openId);
          if (newUser?.id) {
            await db.setUserMemberLevel(newUser.id, 'silver');
            console.log(`[Facebook OAuth] New user auto-upgraded to silver: userId=${newUser.id}`);
          }
        } catch (e) {
          console.error('[Facebook OAuth] Failed to set silver level for new user', e);
        }
      }
      const sessionToken = await sdk.createSessionToken(openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (err) {
      console.error("[Facebook OAuth] Callback failed", err);
      res.redirect(302, "/login?error=" + encodeURIComponent("Facebook 登入失敗，請稍後再試"));
    }
  });

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

        const existing = await db.getUserByOpenId(openId);
        const isNewGoogleUser = !existing;

        if (!existing && !GOOGLE_OAUTH_NEW_USER_ENABLED) {
          console.warn(`[OAuth] Blocked new Google registration - openId: ${openId}, email: ${userInfo.email}`);
          res.redirect(302, "/login?error=" + encodeURIComponent("Google 註冊功能暫時停用，請使用手機號碼註冊"));
          return;
        }

        console.log(`[OAuth] Google user login - openId: ${openId}, email: ${userInfo.email}, name: ${userInfo.name}, isNew: ${isNewGoogleUser}`);

        await db.upsertUser({
          openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: "google",
          lastSignedIn: new Date(),
          photoUrl: userInfo.picture ?? null,
        });

        // 新用戶自動升銀會員
        if (isNewGoogleUser) {
          try {
            const newUser = await db.getUserByOpenId(openId);
            if (newUser?.id) {
              await db.setUserMemberLevel(newUser.id, 'silver');
              console.log(`[OAuth] New Google user auto-upgraded to silver: userId=${newUser.id}`);
            }
          } catch (e) {
            console.error('[OAuth] Failed to set silver level for new Google user', e);
          }
        }

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
