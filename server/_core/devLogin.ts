/**
 * Dev/Sandbox Mock Login
 * 僅在非 production 環境下啟用，用於沙盒測試
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

export function registerDevLoginRoutes(app: Express) {
  // 只在非 production 環境下啟用
  if (ENV.isProduction) return;

  // GET /api/dev/login-page — 顯示模擬登入頁面
  app.get("/api/dev/login-page", (req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>沙盒測試登入 — 大BB錢幣店</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .logo { text-align: center; margin-bottom: 8px; font-size: 40px; }
    h1 { text-align: center; font-size: 22px; color: #1a1a2e; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #888; font-size: 13px; margin-bottom: 28px; }
    .badge {
      display: inline-block;
      background: #fef3c7; color: #d97706;
      border: 1px solid #fde68a;
      border-radius: 20px; padding: 4px 12px;
      font-size: 12px; font-weight: 600; margin-bottom: 24px;
    }
    .badge-wrap { text-align: center; }
    label { display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input[type="text"] {
      width: 100%; padding: 12px 16px;
      border: 2px solid #e5e7eb; border-radius: 10px;
      font-size: 15px; outline: none; transition: border-color 0.2s; margin-bottom: 16px;
    }
    input[type="text"]:focus { border-color: #f59e0b; }
    .role-group { display: flex; gap: 10px; margin-bottom: 24px; }
    .role-btn {
      flex: 1; padding: 10px;
      border: 2px solid #e5e7eb; border-radius: 10px;
      background: white; cursor: pointer;
      font-size: 13px; font-weight: 600; color: #6b7280;
      transition: all 0.2s; text-align: center;
    }
    .role-btn.active { border-color: #f59e0b; background: #fffbeb; color: #d97706; }
    .role-btn:hover { border-color: #f59e0b; }
    .btn-login {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white; border: none; border-radius: 10px;
      font-size: 16px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s; letter-spacing: 0.5px;
    }
    .btn-login:hover { opacity: 0.9; }
    .note {
      margin-top: 20px; padding: 12px 16px;
      background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 8px; font-size: 12px; color: #166534; line-height: 1.5;
    }
    .error { color: #dc2626; font-size: 13px; margin-top: -8px; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💰</div>
    <h1>大BB錢幣店</h1>
    <p class="subtitle">專業錢幣拍賣平台</p>
    <div class="badge-wrap"><span class="badge">🧪 沙盒測試模式</span></div>
    <form id="loginForm" onsubmit="doLogin(event)">
      <label for="username">用戶名稱</label>
      <input type="text" id="username" placeholder="輸入任意名稱（例如：測試用戶）" autocomplete="off" />
      <p class="error" id="errMsg">請輸入用戶名稱</p>
      <label>登入身份</label>
      <div class="role-group">
        <div class="role-btn active" id="roleUser" onclick="selectRole('user')">👤 一般用戶</div>
        <div class="role-btn" id="roleAdmin" onclick="selectRole('admin')">🔑 管理員</div>
      </div>
      <button type="submit" class="btn-login">立即登入測試</button>
    </form>
    <div class="note">
      ⚠️ 此為沙盒測試環境，登入資料不會影響正式系統。<br>
      選擇「管理員」可測試後台管理功能。
    </div>
  </div>
  <script>
    let selectedRole = 'user';
    function selectRole(role) {
      selectedRole = role;
      document.getElementById('roleUser').classList.toggle('active', role === 'user');
      document.getElementById('roleAdmin').classList.toggle('active', role === 'admin');
    }
    async function doLogin(e) {
      e.preventDefault();
      const name = document.getElementById('username').value.trim();
      const errMsg = document.getElementById('errMsg');
      if (!name) { errMsg.style.display = 'block'; return; }
      errMsg.style.display = 'none';
      try {
        const res = await fetch('/api/dev/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role: selectedRole }),
          credentials: 'include'
        });
        const data = await res.json();
        if (data.success) { window.location.href = '/'; }
        else { alert('登入失敗：' + (data.error || '未知錯誤')); }
      } catch(err) { alert('網路錯誤，請重試'); }
    }
  </script>
</body>
</html>`);
  });

  // POST /api/dev/login — 建立模擬 session
  app.post("/api/dev/login", async (req: Request, res: Response) => {
    try {
      const { name, role } = req.body as { name?: string; role?: string };
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ success: false, error: "Name is required" });
        return;
      }

      const cleanName = name.trim().slice(0, 50);
      const isAdmin = role === "admin";

      const openId = isAdmin
        ? "dev-admin-sandbox"
        : `dev-user-${cleanName.replace(/\s+/g, "-").toLowerCase()}`;

      await db.upsertUser({
        openId,
        name: cleanName,
        email: null,
        loginMethod: "dev-sandbox",
        lastSignedIn: new Date(),
      });

      // 若是管理員，強制設定 role 為 admin
      if (isAdmin) {
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { users } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await dbInstance.update(users).set({ role: "admin" }).where(eq(users.openId, openId));
        }
      }

      const sessionToken = await sdk.createSessionToken(openId, {
        name: cleanName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({ success: true, name: cleanName, role: isAdmin ? "admin" : "user" });
    } catch (error) {
      console.error("[DevLogin] Error:", error);
      res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  // POST /api/dev/logout — 登出
  app.post("/api/dev/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });

  console.log("[DevLogin] Sandbox mock login enabled at /api/dev/login-page");
}
