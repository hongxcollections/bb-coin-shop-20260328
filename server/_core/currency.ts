// Server-side currency symbol helper (mirrors client-side getCurrencySymbol)
const CURRENCY_MAP: Record<string, string> = {
  HKD: "HK$",
  USD: "US$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  TWD: "NT$",
  SGD: "S$",
  MYR: "RM",
  THB: "฿",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_MAP[currency] ?? currency + "$";
}
