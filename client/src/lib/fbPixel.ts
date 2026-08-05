// Facebook Pixel event helpers
// Pixel ID: 959625897053104 (已在 index.html 初始化)

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
}) {
  fbq("track", "ViewContent", {
    currency: "HKD",
    ...params,
  });
}

/** 搜尋 */
export function trackSearch(query: string) {
  fbq("track", "Search", { search_string: query });
}

/** 加心願清單 / 收藏 */
export function trackAddToWishlist(params: {
  content_name: string;
  content_ids?: string[];
  value?: number;
}) {
  fbq("track", "AddToWishlist", { currency: "HKD", ...params });
}

/** 聯絡賣家（開聊天室） */
export function trackContact() {
  fbq("track", "Contact");
}

/** 完成出價 */
export function trackPurchase(params: { value: number; content_name: string }) {
  fbq("track", "Purchase", { currency: "HKD", ...params });
}
