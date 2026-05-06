/**
 * 過濾用戶輸入入面嘅隱形／不可見字符（顯示成方框 □ 嘅元兇）：
 * - C0 / C1 控制字符（保留 \n \r \t）
 * - 隱形排版／BOM／LRM/RLM／embedding／isolate（保留 ZWJ U+200D 同 ZWNJ U+200C，emoji ZWJ sequences 要用）
 * - BMP Private Use Area（U+E000-U+F8FF — macOS Apple logo  等專屬字體 icon）
 * - Supplementary Private Use Area-A/B（U+F0000-U+10FFFD，需 surrogate pair）
 * 保留正常 emoji（包括 family ZWJ sequence、Variation Selectors）。
 */
export function sanitizeUserText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/[\uDB80-\uDBFF][\uDC00-\uDFFF]/g, "");
}
