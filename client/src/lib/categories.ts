export const DEFAULT_CATEGORIES = [
  "人民幣 1,2,3版",
  "人民幣 4,5版",
  "港鈔/港幣",
  "紀念鈔/幣",
  "金銀幣/章",
  "古錢/古幣",
  "外國鈔/幣",
  "古董/雜件",
  "錯體鈔/幣",
  "其它",
];

export function parseCategories(settings: Record<string, string> | undefined): string[] {
  if (settings?.productCategories) {
    try {
      const parsed = JSON.parse(settings.productCategories);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    } catch {}
  }
  return DEFAULT_CATEGORIES;
}
