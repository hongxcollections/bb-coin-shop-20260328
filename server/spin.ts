/**
 * 每日抽獎引擎 — 加權隨機選獎品
 */
import { getDb } from "./db";
import { dailySpins } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

export type PrizeType = "nothing" | "discount" | "credit" | "mystery" | "membership";

export interface Prize {
  id: string;
  label: string;
  emoji: string;
  weight: number;
  type: PrizeType;
  value?: number;
  color: string; // 轉盤扇形底色
  textColor: string; // 文字色
}

// 8 格轉盤獎品（順序對應扇形 0-7，從頂部 12 點順時針）
export const PRIZES: Prize[] = [
  { id: "discount-90", label: "手續費9折券", emoji: "🎟️", weight: 20, type: "discount", value: 10, color: "#fde68a", textColor: "#78350f" },
  { id: "nothing-1",   label: "再接再厲",    emoji: "🍀", weight: 20, type: "nothing",  color: "#e7e5e4", textColor: "#57534e" },
  { id: "credit-10",   label: "HK$10 競投券", emoji: "💵", weight: 15, type: "credit",   value: 10, color: "#a7f3d0", textColor: "#064e3b" },
  { id: "discount-80", label: "手續費8折券", emoji: "🎫", weight: 10, type: "discount", value: 20, color: "#fdba74", textColor: "#7c2d12" },
  { id: "nothing-2",   label: "明日再試",    emoji: "🌟", weight: 20, type: "nothing",  color: "#e7e5e4", textColor: "#57534e" },
  { id: "credit-50",   label: "HK$50 競投券", emoji: "💰", weight: 8,  type: "credit",   value: 50, color: "#86efac", textColor: "#14532d" },
  { id: "mystery",     label: "神秘錢幣福袋", emoji: "🎁", weight: 5,  type: "mystery",  color: "#f9a8d4", textColor: "#831843" },
  { id: "silver-1d",   label: "銀牌1日體驗",  emoji: "🥈", weight: 2,  type: "membership", value: 1, color: "#cbd5e1", textColor: "#1e293b" },
];

export function getPrizeBySliceIndex(index: number): Prize {
  return PRIZES[((index % PRIZES.length) + PRIZES.length) % PRIZES.length];
}

/** 加權隨機，返回獎品同 index */
export function pickRandomPrize(): { prize: Prize; index: number } {
  const totalWeight = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return { prize: PRIZES[i], index: i };
  }
  return { prize: PRIZES[PRIZES.length - 1], index: PRIZES.length - 1 };
}

/** 取得香港時區嘅今日日期字串 YYYY-MM-DD */
export function getHKTodayString(): string {
  const now = new Date();
  // HK = UTC+8
  const hk = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = hk.getUTCFullYear();
  const m = String(hk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(hk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 查詢用戶今日有冇抽過 */
export async function getTodaySpinForUser(userId: number) {
  const db = await getDb();
  const today = getHKTodayString();
  const rows = await db
    .select()
    .from(dailySpins)
    .where(and(eq(dailySpins.userId, userId), eq(dailySpins.spinDate, today)))
    .limit(1);
  return rows[0] ?? null;
}

/** 用戶最近 10 次中獎記錄 */
export async function getRecentSpinsForUser(userId: number, limit = 10) {
  const db = await getDb();
  return await db
    .select()
    .from(dailySpins)
    .where(eq(dailySpins.userId, userId))
    .orderBy(desc(dailySpins.createdAt))
    .limit(limit);
}

/** 抽獎 — 若今日已抽則拋錯。回傳獎品 + 扇形 index 用於前端動畫 */
export async function spinForUser(userId: number): Promise<{ prize: Prize; index: number }> {
  const today = getHKTodayString();
  const existing = await getTodaySpinForUser(userId);
  if (existing) {
    const idx = PRIZES.findIndex(p => p.id === existing.prizeId);
    return {
      prize: PRIZES[idx >= 0 ? idx : 0],
      index: idx >= 0 ? idx : 0,
    };
  }

  const { prize, index } = pickRandomPrize();
  const db = await getDb();
  try {
    await db.insert(dailySpins).values({
      userId,
      spinDate: today,
      prizeId: prize.id,
      prizeLabel: prize.label,
      prizeType: prize.type,
      prizeValue: prize.value ?? null,
      claimed: 0,
    });
  } catch (err) {
    // race condition: 同一秒兩次請求 → 重新讀已存在記錄
    const again = await getTodaySpinForUser(userId);
    if (again) {
      const idx = PRIZES.findIndex(p => p.id === again.prizeId);
      return {
        prize: PRIZES[idx >= 0 ? idx : 0],
        index: idx >= 0 ? idx : 0,
      };
    }
    throw err;
  }
  console.log(`[Spin] user=${userId} date=${today} prize=${prize.id} (${prize.label})`);
  return { prize, index };
}

/** 計算 HK 時區下次重置時間（明日 00:00 HKT） */
export function getNextResetTime(): Date {
  const now = new Date();
  const hk = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  hk.setUTCHours(24, 0, 0, 0);
  return new Date(hk.getTime() - 8 * 60 * 60 * 1000);
}
