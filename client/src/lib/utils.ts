import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 構建 WhatsApp 連結
 * - 自動為 8 位香港本地號碼補上區號 852
 * - 少於 7 位視為無效，返回空字串
 * - 使用 whatsapp:// 協議直接開啟 app（跳過 wa.me 網頁中轉）
 *   桌面瀏覽器不支援時會以 https://wa.me 作備用
 */
export function buildWhatsAppUrl(rawPhone: string, text: string): string {
  const digits = (() => {
    const d = rawPhone.replace(/[^0-9]/g, "");
    // 8 位港澳號碼 (5xx / 6xx / 9xx) → 補 852
    if (d.length === 8 && /^[569]/.test(d)) return "852" + d;
    // 8 位澳門號碼 (6xx) → 補 853（已包含在上面，若需區分可擴充）
    return d;
  })();
  if (digits.length < 7) return "";
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${encoded}`;
}
