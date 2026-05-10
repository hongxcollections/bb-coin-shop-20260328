/**
 * Facebook Open Graph Cache Refresh Helper
 *
 * 透過 Graph API POST /?id={url}&scrape=true 強制 FB 重新抓取 OG meta，
 * 解決商品/拍賣新上架後 FB 第一次分享出 "空白卡" 嘅問題。
 *
 * 用法：fire-and-forget。所有 ping 都 setTimeout 2s（等 DB commit + cache settle），
 * 失敗只 log 唔 throw，永遠唔阻塞主流程。
 *
 * Env：
 * - FACEBOOK_APP_ID / FACEBOOK_APP_SECRET：Meta App credentials（缺一即 skip + warn 一次）
 * - SITE_URL：base URL（例 https://hongxcollections.com）。若無設 / 唔包 hongxcollections.com → skip（dev local）
 */

import { ENV } from "./env";

const FB_GRAPH_URL = "https://graph.facebook.com/";
const PING_DELAY_MS = 2000;

let warnedMissingCreds = false;

function getAccessToken(): string | null {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    if (!warnedMissingCreds) {
      console.warn("[FB-OG] FACEBOOK_APP_ID / FACEBOOK_APP_SECRET 未設，跳過自動 OG cache refresh");
      warnedMissingCreds = true;
    }
    return null;
  }
  return `${appId}|${appSecret}`;
}

function getBaseUrl(): string | null {
  const url = ((ENV as any).siteUrl || process.env.SITE_URL || "").trim();
  if (!url) return null;
  // 只 ping 真正 public 嘅 domain，避免 dev local 污染
  if (!/hongxcollections\.com/i.test(url)) return null;
  return url.replace(/\/$/, "");
}

/**
 * 立即 ping FB Graph API 強制 re-scrape 一條 URL。
 * 內部用，會 await response。一般情況用底下 schedulePing 包一層 setTimeout。
 */
async function pingFacebookCacheNow(targetUrl: string): Promise<void> {
  const token = getAccessToken();
  if (!token) return;

  const params = new URLSearchParams({
    id: targetUrl,
    scrape: "true",
    access_token: token,
  });

  try {
    const res = await fetch(FB_GRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[FB-OG] Refresh failed for ${targetUrl}: ${res.status} ${text.slice(0, 300)}`);
      return;
    }
    // 成功時 FB 會 return JSON 含 OG fields，太大唔 log 全文
    console.log(`[FB-OG] ✅ Refreshed cache for ${targetUrl}`);
  } catch (err) {
    console.error(`[FB-OG] Network error refreshing ${targetUrl}:`, err);
  }
}

/**
 * Fire-and-forget。Schedule 一個 ping，2 秒後執行。
 * 永遠唔 throw，永遠唔阻塞 caller。
 */
export function schedulePing(targetUrl: string): void {
  setTimeout(() => {
    void pingFacebookCacheNow(targetUrl);
  }, PING_DELAY_MS);
}

export function pingAuctionOg(auctionId: number | string): void {
  const base = getBaseUrl();
  if (!base) return;
  schedulePing(`${base}/auctions/${auctionId}`);
}

export function pingProductOg(productId: number | string): void {
  const base = getBaseUrl();
  if (!base) return;
  schedulePing(`${base}/merchant-products/${productId}`);
}

export function pingCommunityPostOg(postId: number | string): void {
  const base = getBaseUrl();
  if (!base) return;
  schedulePing(`${base}/collection-square/${postId}`);
}

/**
 * 同步版本（俾 admin/merchant 手動 trigger 用，await response 顯示成功/失敗）
 */
export async function refreshOgNow(targetUrl: string): Promise<{ ok: boolean; message: string }> {
  const token = getAccessToken();
  if (!token) return { ok: false, message: "FB credentials 未設定" };
  const base = getBaseUrl();
  if (!base) return { ok: false, message: "SITE_URL 未設或非 production domain" };

  try {
    const params = new URLSearchParams({
      id: targetUrl,
      scrape: "true",
      access_token: token,
    });
    const res = await fetch(FB_GRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `FB API ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, message: "已通知 Facebook 重新抓取，幾秒內生效" };
  } catch (err: any) {
    return { ok: false, message: `Network error: ${err?.message ?? String(err)}` };
  }
}
