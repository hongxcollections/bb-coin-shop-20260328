/**
 * Facebook Conversions API (CAPI) — 伺服器端事件上報
 *
 * iOS 14+ 令客戶端 Pixel 漏報率高達 40-60%。
 * 本模組在伺服器直接向 Facebook 上報事件，與客戶端 Pixel 配對去重（透過 event_id）。
 *
 * 文檔：https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { createHash } from "crypto";
import type { IncomingMessage } from "http";
import { ENV } from "./_core/env";

const PIXEL_ID = "959625897053104";
const CAPI_URL = `https://graph.facebook.com/v20.0/${PIXEL_ID}/events`;

/** SHA-256 hash（Facebook 要求所有 PII 先 hash） */
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** 從 request 取得客戶端 IP */
function getClientIp(req?: IncomingMessage): string | undefined {
  if (!req) return undefined;
  const forwarded = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return forwarded || (req.socket?.remoteAddress ?? undefined);
}

/** 從 request 取得 User-Agent */
function getUserAgent(req?: IncomingMessage): string | undefined {
  return req?.headers["user-agent"] ?? undefined;
}

/** 從 request cookies 取得 fbp / fbc（用於 cookie 比對） */
function getFbCookies(req?: IncomingMessage): { fbp?: string; fbc?: string } {
  if (!req) return {};
  const cookieHeader = req.headers["cookie"] ?? "";
  const fbp = cookieHeader.match(/_fbp=([^;]+)/)?.[1];
  const fbc = cookieHeader.match(/_fbc=([^;]+)/)?.[1];
  return { fbp, fbc };
}

export interface CapiUserData {
  userId?: number;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

export interface CapiPurchaseData {
  value: number;
  currency: string;
  contentName: string;
  contentIds?: string[];
  orderId?: string;
}

export interface CapiContactData {
  contentName?: string;
}

export interface CapiSearchData {
  searchString: string;
}

/**
 * 上報 Purchase 事件（出價成功 / 落單成功）
 */
export function sendCapiPurchase(opts: {
  eventId: string;
  user: CapiUserData;
  data: CapiPurchaseData;
  req?: IncomingMessage;
}): void {
  _sendEvent({
    event_name: "Purchase",
    event_id: opts.eventId,
    user: opts.user,
    req: opts.req,
    custom_data: {
      value: opts.data.value,
      currency: opts.data.currency,
      content_name: opts.data.contentName,
      content_ids: opts.data.contentIds ?? [],
      content_type: "product",
      order_id: opts.data.orderId,
    },
  });
}

/**
 * 上報 Contact 事件（買家開聊天室聯絡商戶）
 */
export function sendCapiContact(opts: {
  eventId: string;
  user: CapiUserData;
  data?: CapiContactData;
  req?: IncomingMessage;
}): void {
  _sendEvent({
    event_name: "Contact",
    event_id: opts.eventId,
    user: opts.user,
    req: opts.req,
    custom_data: opts.data?.contentName
      ? { content_name: opts.data.contentName }
      : undefined,
  });
}

/**
 * 上報 Search 事件
 */
export function sendCapiSearch(opts: {
  eventId: string;
  user: CapiUserData;
  data: CapiSearchData;
  req?: IncomingMessage;
}): void {
  _sendEvent({
    event_name: "Search",
    event_id: opts.eventId,
    user: opts.user,
    req: opts.req,
    custom_data: {
      search_string: opts.data.searchString,
    },
  });
}

// ─── 內部實作 ────────────────────────────────────────────────────────────────

interface EventPayload {
  event_name: string;
  event_id: string;
  user: CapiUserData;
  req?: IncomingMessage;
  custom_data?: Record<string, unknown>;
}

function _sendEvent(payload: EventPayload): void {
  const accessToken =
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.FACEBOOK_DEBUG_ACCESS_TOKEN;

  if (!accessToken) {
    // 無 token 時靜默跳過，不影響主流程
    return;
  }

  // 非同步上報，不阻塞主請求
  _doSend(payload, accessToken).catch((err) => {
    console.warn("[CAPI] Failed to send event:", payload.event_name, err?.message ?? err);
  });
}

async function _doSend(payload: EventPayload, accessToken: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ip = getClientIp(payload.req);
  const ua = getUserAgent(payload.req);
  const { fbp, fbc } = getFbCookies(payload.req);

  // 建構 user_data（所有 PII 必須 SHA-256 hash）
  const userData: Record<string, string | undefined> = {
    client_ip_address: ip,
    client_user_agent: ua,
    fbp,
    fbc,
  };

  if (payload.user.email) {
    userData.em = sha256(payload.user.email);
  }
  if (payload.user.phone) {
    // 標準化電話：移除非數字字符
    const phone = payload.user.phone.replace(/\D/g, "");
    if (phone.length >= 8) userData.ph = sha256(phone);
  }
  if (payload.user.userId) {
    userData.external_id = sha256(String(payload.user.userId));
  }

  // 移除 undefined 字段
  const cleanUserData = Object.fromEntries(
    Object.entries(userData).filter(([, v]) => v !== undefined)
  );

  const eventData: Record<string, unknown> = {
    event_name: payload.event_name,
    event_time: now,
    event_id: payload.event_id,
    action_source: "website",
    user_data: cleanUserData,
  };

  if (payload.custom_data) {
    // 移除 undefined custom_data 字段
    eventData.custom_data = Object.fromEntries(
      Object.entries(payload.custom_data).filter(([, v]) => v !== undefined)
    );
  }

  const body: Record<string, unknown> = {
    data: [eventData],
    access_token: accessToken,
  };

  // 測試模式：加 test_event_code 可在 Events Manager 中看到測試事件
  if (process.env.FACEBOOK_TEST_EVENT_CODE) {
    body.test_event_code = process.env.FACEBOOK_TEST_EVENT_CODE;
  }

  const resp = await fetch(CAPI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.warn(`[CAPI] HTTP ${resp.status} for ${payload.event_name}:`, text.slice(0, 300));
  } else {
    const isDebug = !!process.env.FACEBOOK_DEBUG_ACCESS_TOKEN;
    if (isDebug || process.env.NODE_ENV !== "production") {
      console.log(`[CAPI] Sent ${payload.event_name} (event_id=${payload.event_id})`);
    }
  }
}
