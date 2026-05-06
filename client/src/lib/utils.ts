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
/**
 * 過濾用戶輸入文字入面嘅隱形／不可見／不支援字符（會喺瀏覽器顯示成方框 □）：
 * - C0 控制字符（除咗 \n \r \t）
 * - DEL / C1 控制字符
 * - 零寬空格／零寬連字（U+200B-U+200D）
 * - 方向標記／隱形排版控制（U+200E-U+200F, U+202A-U+202E, U+2066-U+2069）
 * - BOM 同 noncharacter 字符（U+FEFF, U+2060-U+206F）
 * - Private Use Area（U+E000-U+F8FF — 通常係 macOS / iOS  字體 icon，普通設備見唔到）
 * 保留正常 emoji（U+1F000+ 由 surrogate pair 構成，唔會觸發呢個 regex）。
 */
export function sanitizeUserText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "");
}

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
