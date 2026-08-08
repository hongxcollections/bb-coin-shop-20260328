// Facebook Pixel event helpers
// Pixel ID: 959625897053104 (已在 index.html 初始化)
//
// event_id 用於與伺服器端 Facebook Conversions API (CAPI) 去重。
// 呼叫方應將 mutation 回傳的 fbEventId 傳入，Facebook 會自動過濾重複事件。

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbq(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq(...args);
  }
}

/** 瀏覽商品頁（卡牌 / 拍賣） */
export function trackViewContent(params: {
  content_name: string;
  content_category?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
  eventId?: string;
}) {
  const { eventId, ...rest } = params;
  fbq("track", "ViewContent", { currency: "HKD", ...rest }, eventId ? { eventID: eventId } : undefined);
}

/** 搜尋 */
export function trackSearch(query: string, eventId?: string) {
  fbq("track", "Search", { search_string: query }, eventId ? { eventID: eventId } : undefined);
}

/** 加心願清單 / 收藏 */
export function trackAddToWishlist(params: {
  content_name: string;
  content_ids?: string[];
  value?: number;
  eventId?: string;
}) {
  const { eventId, ...rest } = params;
  fbq("track", "AddToWishlist", { currency: "HKD", ...rest }, eventId ? { eventID: eventId } : undefined);
}

/** 聯絡賣家（開聊天室） */
export function trackContact(eventId?: string) {
  fbq("track", "Contact", {}, eventId ? { eventID: eventId } : undefined);
}

/** 完成出價 / 落單 */
export function trackPurchase(params: { value: number; content_name: string; eventId?: string }) {
  const { eventId, ...rest } = params;
  fbq("track", "Purchase", { currency: "HKD", ...rest }, eventId ? { eventID: eventId } : undefined);
}
