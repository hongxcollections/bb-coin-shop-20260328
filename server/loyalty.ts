import { eq, and, gte, sql, desc, count, isNotNull, lt } from 'drizzle-orm';
import { getDb, getSiteSetting, setSiteSetting, getAllSiteSettings, getUserByOpenId } from './db';
import { users, bids, auctions, dailyEarlyBird, userAutoBidQuota } from '../drizzle/schema';

/**
 * Loyalty 會員活動等級系統
 * ─────────────────────────────
 * - 銅 / 銀 / 金 / VIP 四級（不收月費）
 * - 升降級靠行為：累積出價次數、累積成交次數、近 90 日競投總額
 * - 早鳥試用：每日首 N 名新註冊 → 試用銀/金 X 日
 * - 全部門檻由 Admin 後台喺 site_settings 控制
 */

export type MemberLevel = 'bronze' | 'silver' | 'gold' | 'vip';

export interface LoyaltyConfig {
  earlyBirdEnabled: boolean;
  earlyBirdDailyQuota: number;
  earlyBirdTrialLevel: MemberLevel;
  earlyBirdTrialDays: number;
  silverBidCount: number;
  silverWinCount: number;
  silver90DaySpend: number;
  goldWinCount: number;
  gold90DaySpend: number;
  inactivityDaysForDowngrade: number;
  silverCashbackRate: number;
  goldCashbackRate: number;
  vipCashbackRate: number;
  silverPreviewHours: number;
  goldPreviewHours: number;
  // 自理出價 / 匿名出價限制
  bronzeAutoBidQuota: number;       // 銅牌每月可用代理出價次數
  silverAutoBidMaxAmount: number;   // 銀牌單次代理出價上限（HKD）；0 = 無限制
  silverCanAnonymous: boolean;      // 銀牌可否匿名出價
  goldDefaultAnonymous: boolean;    // 金牌出價時匿名是否預設打開（前端 hint，不影響後端權限）
}

const DEFAULTS: LoyaltyConfig = {
  earlyBirdEnabled: true,
  earlyBirdDailyQuota: 10,
  earlyBirdTrialLevel: 'silver',
  earlyBirdTrialDays: 7,
  silverBidCount: 20,
  silverWinCount: 3,
  silver90DaySpend: 3000,
  goldWinCount: 20,
  gold90DaySpend: 30000,
  inactivityDaysForDowngrade: 90,
  silverCashbackRate: 0.01,
  goldCashbackRate: 0.02,
  vipCashbackRate: 0.03,
  silverPreviewHours: 24,
  goldPreviewHours: 48,
  bronzeAutoBidQuota: 3,
  silverAutoBidMaxAmount: 5000,
  silverCanAnonymous: true,
  goldDefaultAnonymous: true,
};

function parseBool(v: string | null | undefined, d: boolean): boolean {
  if (v === null || v === undefined) return d;
  return v === 'true' || v === '1';
}
function parseInt10(v: string | null | undefined, d: number): number {
  if (v === null || v === undefined) return d;
  const n = parseInt(v, 10);
  return isNaN(n) ? d : n;
}
function parseFloat10(v: string | null | undefined, d: number): number {
  if (v === null || v === undefined) return d;
  const n = parseFloat(v);
  return isNaN(n) ? d : n;
}
function parseLevel(v: string | null | undefined, d: MemberLevel): MemberLevel {
  if (v === 'silver' || v === 'gold' || v === 'vip') return v;
  return d;
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const all = await getAllSiteSettings();
  return {
    earlyBirdEnabled: parseBool(all['loyalty.earlyBirdEnabled'], DEFAULTS.earlyBirdEnabled),
    earlyBirdDailyQuota: parseInt10(all['loyalty.earlyBirdDailyQuota'], DEFAULTS.earlyBirdDailyQuota),
    earlyBirdTrialLevel: parseLevel(all['loyalty.earlyBirdTrialLevel'], DEFAULTS.earlyBirdTrialLevel),
    earlyBirdTrialDays: parseInt10(all['loyalty.earlyBirdTrialDays'], DEFAULTS.earlyBirdTrialDays),
    silverBidCount: parseInt10(all['loyalty.silverBidCount'], DEFAULTS.silverBidCount),
    silverWinCount: parseInt10(all['loyalty.silverWinCount'], DEFAULTS.silverWinCount),
    silver90DaySpend: parseInt10(all['loyalty.silver90DaySpend'], DEFAULTS.silver90DaySpend),
    goldWinCount: parseInt10(all['loyalty.goldWinCount'], DEFAULTS.goldWinCount),
    gold90DaySpend: parseInt10(all['loyalty.gold90DaySpend'], DEFAULTS.gold90DaySpend),
    inactivityDaysForDowngrade: parseInt10(all['loyalty.inactivityDaysForDowngrade'], DEFAULTS.inactivityDaysForDowngrade),
    silverCashbackRate: parseFloat10(all['loyalty.silverCashbackRate'], DEFAULTS.silverCashbackRate),
    goldCashbackRate: parseFloat10(all['loyalty.goldCashbackRate'], DEFAULTS.goldCashbackRate),
    vipCashbackRate: parseFloat10(all['loyalty.vipCashbackRate'], DEFAULTS.vipCashbackRate),
    silverPreviewHours: parseInt10(all['loyalty.silverPreviewHours'], DEFAULTS.silverPreviewHours),
    goldPreviewHours: parseInt10(all['loyalty.goldPreviewHours'], DEFAULTS.goldPreviewHours),
    bronzeAutoBidQuota: parseInt10(all['loyalty.bronzeAutoBidQuota'], DEFAULTS.bronzeAutoBidQuota),
    silverAutoBidMaxAmount: parseInt10(all['loyalty.silverAutoBidMaxAmount'], DEFAULTS.silverAutoBidMaxAmount),
    silverCanAnonymous: parseBool(all['loyalty.silverCanAnonymous'], DEFAULTS.silverCanAnonymous),
    goldDefaultAnonymous: parseBool(all['loyalty.goldDefaultAnonymous'], DEFAULTS.goldDefaultAnonymous),
  };
}

export async function updateLoyaltyConfig(partial: Partial<Record<keyof LoyaltyConfig, string | number | boolean>>): Promise<void> {
  const KEY_MAP: Record<keyof LoyaltyConfig, string> = {
    earlyBirdEnabled: 'loyalty.earlyBirdEnabled',
    earlyBirdDailyQuota: 'loyalty.earlyBirdDailyQuota',
    earlyBirdTrialLevel: 'loyalty.earlyBirdTrialLevel',
    earlyBirdTrialDays: 'loyalty.earlyBirdTrialDays',
    silverBidCount: 'loyalty.silverBidCount',
    silverWinCount: 'loyalty.silverWinCount',
    silver90DaySpend: 'loyalty.silver90DaySpend',
    goldWinCount: 'loyalty.goldWinCount',
    gold90DaySpend: 'loyalty.gold90DaySpend',
    inactivityDaysForDowngrade: 'loyalty.inactivityDaysForDowngrade',
    silverCashbackRate: 'loyalty.silverCashbackRate',
    goldCashbackRate: 'loyalty.goldCashbackRate',
    vipCashbackRate: 'loyalty.vipCashbackRate',
    silverPreviewHours: 'loyalty.silverPreviewHours',
    goldPreviewHours: 'loyalty.goldPreviewHours',
    bronzeAutoBidQuota: 'loyalty.bronzeAutoBidQuota',
    silverAutoBidMaxAmount: 'loyalty.silverAutoBidMaxAmount',
    silverCanAnonymous: 'loyalty.silverCanAnonymous',
    goldDefaultAnonymous: 'loyalty.goldDefaultAnonymous',
  };
  for (const [k, v] of Object.entries(partial)) {
    const key = KEY_MAP[k as keyof LoyaltyConfig];
    if (!key || v === undefined || v === null) continue;
    await setSiteSetting(key, String(v));
  }
}

// ─── 日期工具（以香港時區 UTC+8 計今日）──────────────────────────

function hkToday(): string {
  const now = new Date();
  const hkMs = now.getTime() + 8 * 3600 * 1000;
  return new Date(hkMs).toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── 早鳥名額 ────────────────────────────────────────────────────

export async function getEarlyBirdTodayStatus() {
  const config = await getLoyaltyConfig();
  if (!config.earlyBirdEnabled) {
    return { enabled: false, remaining: 0, total: 0, trialLevel: config.earlyBirdTrialLevel, trialDays: config.earlyBirdTrialDays };
  }
  const db = await getDb();
  if (!db) return { enabled: true, remaining: 0, total: config.earlyBirdDailyQuota, trialLevel: config.earlyBirdTrialLevel, trialDays: config.earlyBirdTrialDays };
  const today = hkToday();
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(dailyEarlyBird)
    .where(eq(dailyEarlyBird.claimDate, today));
  const claimed = Number(cnt ?? 0);
  return {
    enabled: true,
    remaining: Math.max(0, config.earlyBirdDailyQuota - claimed),
    total: config.earlyBirdDailyQuota,
    trialLevel: config.earlyBirdTrialLevel,
    trialDays: config.earlyBirdTrialDays,
  };
}

/**
 * 新用戶註冊 OAuth callback 後呼叫。
 * 若今日仲有名額、用戶未領過、且係新註冊（createdAt >= 今日 HK 00:00），則自動升至試用等級。
 * 返回 { claimed: boolean, trialLevel?, trialExpiresAt? }
 */
export async function tryClaimEarlyBirdForUser(openId: string): Promise<{ claimed: boolean; trialLevel?: MemberLevel; trialExpiresAt?: Date }> {
  const db = await getDb();
  if (!db) return { claimed: false };

  const user = await getUserByOpenId(openId);
  if (!user) return { claimed: false };

  // 已領過
  const existing = await db.select().from(dailyEarlyBird).where(eq(dailyEarlyBird.userId, user.id)).limit(1);
  if (existing.length > 0) return { claimed: false };

  const config = await getLoyaltyConfig();
  if (!config.earlyBirdEnabled) return { claimed: false };

  // 只有新註冊（createdAt 喺今日 HK）先有資格
  const todayHkStart = new Date();
  todayHkStart.setUTCHours(-8, 0, 0, 0); // HK 00:00 = UTC 前一日 16:00
  if (user.createdAt < todayHkStart) return { claimed: false };

  // 今日名額仲有冇？
  const today = hkToday();
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(dailyEarlyBird)
    .where(eq(dailyEarlyBird.claimDate, today));
  if (Number(cnt ?? 0) >= config.earlyBirdDailyQuota) return { claimed: false };

  // 落單！
  const trialExpiresAt = new Date(Date.now() + config.earlyBirdTrialDays * 24 * 3600 * 1000);
  try {
    await db.insert(dailyEarlyBird).values({
      userId: user.id,
      claimDate: today,
      trialLevel: config.earlyBirdTrialLevel,
      trialExpiresAt,
    });
  } catch (err) {
    // unique 衝突 = 剛剛已有另一 request 插入，safe fallback
    return { claimed: false };
  }

  // 提升 user.memberLevel + 設到期時間
  await db.update(users)
    .set({ memberLevel: config.earlyBirdTrialLevel, memberLevelExpiresAt: trialExpiresAt })
    .where(eq(users.id, user.id));

  console.log(`[Loyalty] Early bird claimed: userId=${user.id} level=${config.earlyBirdTrialLevel} expiresAt=${trialExpiresAt.toISOString()}`);
  return { claimed: true, trialLevel: config.earlyBirdTrialLevel, trialExpiresAt };
}

// ─── 用戶統計 ────────────────────────────────────────────────────

export interface UserLoyaltyStats {
  totalBidCount: number;
  totalWinCount: number;
  spend90Days: number;
  lastActivityAt: Date | null;
}

export async function getUserStats(userId: number): Promise<UserLoyaltyStats> {
  const db = await getDb();
  if (!db) return { totalBidCount: 0, totalWinCount: 0, spend90Days: 0, lastActivityAt: null };

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000);

  // 累積出價次數
  const [bidRow] = await db
    .select({ cnt: count(), last: sql<Date>`MAX(${bids.createdAt})`.as('last') })
    .from(bids)
    .where(eq(bids.userId, userId));

  // 累積成交次數 + 近 90 日成交總額（用 auctions.highestBidderId = userId AND status='ended'）
  const [winRow] = await db
    .select({ cnt: count() })
    .from(auctions)
    .where(and(eq(auctions.highestBidderId, userId), eq(auctions.status, 'ended')));

  const [spend90Row] = await db
    .select({ sum: sql<string>`COALESCE(SUM(${auctions.currentPrice}), 0)`.as('sum') })
    .from(auctions)
    .where(and(
      eq(auctions.highestBidderId, userId),
      eq(auctions.status, 'ended'),
      gte(auctions.endTime, ninetyDaysAgo),
    ));

  return {
    totalBidCount: Number(bidRow?.cnt ?? 0),
    totalWinCount: Number(winRow?.cnt ?? 0),
    spend90Days: parseFloat(String(spend90Row?.sum ?? '0')),
    lastActivityAt: bidRow?.last ? new Date(bidRow.last) : null,
  };
}

/**
 * 根據統計計出「自然升到」嘅等級（唔睇試用）
 */
export function naturalLevelFromStats(stats: UserLoyaltyStats, config: LoyaltyConfig): MemberLevel {
  // 金牌條件
  if (stats.totalWinCount >= config.goldWinCount || stats.spend90Days >= config.gold90DaySpend) {
    return 'gold';
  }
  // 銀牌條件
  if (
    stats.totalBidCount >= config.silverBidCount ||
    stats.totalWinCount >= config.silverWinCount ||
    stats.spend90Days >= config.silver90DaySpend
  ) {
    return 'silver';
  }
  return 'bronze';
}

const LEVEL_RANK: Record<MemberLevel, number> = { bronze: 0, silver: 1, gold: 2, vip: 3 };

/**
 * 重新評估用戶等級（喺出價 / 成交後呼叫）：
 * - 如果自然等級 ≥ 當前等級 → 永久升，清除試用 expiresAt
 * - 如果自然等級 < 當前等級 + 有未到期試用 → 保留試用
 * - 如果自然等級 < 當前等級 + 冇試用或試用已過 → 降到自然等級
 * VIP 唔會自動升級（留 Admin 手動授予），但可以由試用到期後 fallback 回銅／銀／金
 */
export async function recalculateUserLevel(userId: number): Promise<MemberLevel> {
  const db = await getDb();
  if (!db) return 'bronze';

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return 'bronze';

  const config = await getLoyaltyConfig();
  const stats = await getUserStats(userId);
  const natural = naturalLevelFromStats(stats, config);

  const currentLevel = user.memberLevel as MemberLevel;
  const currentExpiresAt: Date | null = user.memberLevelExpiresAt ?? null;
  const hasActiveTrial = !!currentExpiresAt && currentExpiresAt > new Date();

  // VIP 係 admin 專屬，維持現狀
  if (currentLevel === 'vip') {
    return 'vip';
  }

  let targetLevel: MemberLevel;
  let newExpiresAt: Date | null = currentExpiresAt;

  if (LEVEL_RANK[natural] >= LEVEL_RANK[currentLevel]) {
    targetLevel = natural;
    newExpiresAt = null;
  } else if (hasActiveTrial) {
    return currentLevel;
  } else {
    targetLevel = natural;
    newExpiresAt = null;
  }

  if (targetLevel !== currentLevel || (newExpiresAt === null && currentExpiresAt !== null)) {
    await db.update(users)
      .set({ memberLevel: targetLevel, memberLevelExpiresAt: newExpiresAt })
      .where(eq(users.id, userId));
    const expiresStr: string = newExpiresAt === null ? 'none' : (newExpiresAt as Date).toISOString();
    console.log(`[Loyalty] User ${userId}: ${currentLevel} → ${targetLevel} (expires: ${expiresStr})`);
  }
  return targetLevel;
}

// ─────────────────────────────────────────────────────────────────────────
// 自理出價（代理出價）+ 匿名出價 等級限制
// ─────────────────────────────────────────────────────────────────────────

function hkMonthKey(): string {
  // YYYY-MM (HK)
  const d = new Date(Date.now() + 8 * 3600 * 1000); // shift to HK then read UTC parts
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * 取用戶當前等級 + 自理出價 / 匿名出價權限狀態
 * UI 預先 fetch 以決定按鈕 enable/disable
 */
export async function getMyAutoBidStatus(userId: number): Promise<{
  level: MemberLevel;
  bronzeQuota: { used: number; total: number; remaining: number };
  silverMaxAmount: number; // 0 = 無限
  canUseAutoBid: boolean;
  canUseAnonymous: boolean;
  defaultAnonymous: boolean;
  monthKey: string;
}> {
  const config = await getLoyaltyConfig();
  const db = await getDb();
  const monthKey = hkMonthKey();

  let level: MemberLevel = 'bronze';
  let used = 0;

  if (db) {
    const [u] = await db.select({ memberLevel: users.memberLevel }).from(users).where(eq(users.id, userId)).limit(1);
    if (u?.memberLevel === 'silver' || u?.memberLevel === 'gold' || u?.memberLevel === 'vip') {
      level = u.memberLevel as MemberLevel;
    }
    if (level === 'bronze') {
      const [row] = await db
        .select({ used: userAutoBidQuota.used })
        .from(userAutoBidQuota)
        .where(and(eq(userAutoBidQuota.userId, userId), eq(userAutoBidQuota.monthKey, monthKey)))
        .limit(1);
      used = row?.used ?? 0;
    }
  }

  const total = config.bronzeAutoBidQuota;
  const remaining = Math.max(0, total - used);

  let canUseAutoBid = true;
  if (level === 'bronze') canUseAutoBid = remaining > 0;

  let canUseAnonymous = false;
  if (level === 'silver') canUseAnonymous = config.silverCanAnonymous;
  else if (level === 'gold' || level === 'vip') canUseAnonymous = true;

  const defaultAnonymous = (level === 'gold' || level === 'vip') && config.goldDefaultAnonymous;

  return {
    level,
    bronzeQuota: { used, total, remaining },
    silverMaxAmount: level === 'silver' ? config.silverAutoBidMaxAmount : 0,
    canUseAutoBid,
    canUseAnonymous,
    defaultAnonymous,
    monthKey,
  };
}

/**
 * 嘗試消耗銅牌一個月度配額，atomic upsert
 * @returns 成功 = true，配額用完 = false
 */
export async function tryConsumeBronzeAutoBidQuota(userId: number): Promise<{ ok: boolean; remaining: number; total: number }> {
  const db = await getDb();
  const config = await getLoyaltyConfig();
  const total = config.bronzeAutoBidQuota;
  if (!db) return { ok: false, remaining: 0, total };
  if (total <= 0) return { ok: false, remaining: 0, total };

  const monthKey = hkMonthKey();
  // upsert 行；用 ON DUPLICATE KEY 嚟處理
  await db.execute(sql`
    INSERT INTO userAutoBidQuota (userId, monthKey, used)
    VALUES (${userId}, ${monthKey}, 0)
    ON DUPLICATE KEY UPDATE userId = userId
  `);

  const [row] = await db
    .select()
    .from(userAutoBidQuota)
    .where(and(eq(userAutoBidQuota.userId, userId), eq(userAutoBidQuota.monthKey, monthKey)))
    .limit(1);

  const used = row?.used ?? 0;
  if (used >= total) return { ok: false, remaining: 0, total };

  await db
    .update(userAutoBidQuota)
    .set({ used: used + 1 })
    .where(and(eq(userAutoBidQuota.userId, userId), eq(userAutoBidQuota.monthKey, monthKey)));

  return { ok: true, remaining: total - (used + 1), total };
}

/**
 * 校驗用戶可否使用代理出價 + 該次 maxAmount 是否合規
 * - 銅牌：必須先 consume 月度配額
 * - 銀牌：maxAmount 必須 ≤ silverAutoBidMaxAmount（0 = 無限）
 * - 金牌 / VIP：完全無限制
 * 拋 Error 帶友善中文訊息畀 router 接住
 */
export async function enforceAutoBidLimit(userId: number, maxAmount: number): Promise<void> {
  const status = await getMyAutoBidStatus(userId);
  if (status.level === 'bronze') {
    if (status.bronzeQuota.total <= 0) {
      throw new Error(`代理出價功能僅限 🥈 銀牌或以上會員使用，立即升級解鎖無限次數`);
    }
    const r = await tryConsumeBronzeAutoBidQuota(userId);
    if (!r.ok) {
      throw new Error(`本月代理出價配額已用完（${r.total} / ${r.total}）。立即升 🥈 銀牌即可解鎖無限次代理出價`);
    }
    return;
  }
  if (status.level === 'silver') {
    if (status.silverMaxAmount > 0 && maxAmount > status.silverMaxAmount) {
      throw new Error(`🥈 銀牌會員代理出價單次上限為 HK$${status.silverMaxAmount.toLocaleString()}，升 🥇 金牌即可解除上限`);
    }
    return;
  }
  // gold / vip 無限制
}

/**
 * 校驗匿名出價權限
 * - 銅牌：完全唔可
 * - 銀牌：視乎 silverCanAnonymous
 * - 金牌 / VIP：always 可
 */
export async function enforceAnonymousBidPermission(userId: number): Promise<void> {
  const status = await getMyAutoBidStatus(userId);
  if (status.canUseAnonymous) return;
  if (status.level === 'bronze') {
    throw new Error(`匿名出價功能僅限 🥈 銀牌或以上會員使用，立即升級即可隱藏身份競投`);
  }
  // silver 但被 admin 關咗
  throw new Error(`匿名出價暫時關閉，請聯絡管理員`);
}

/**
 * Cron job: 每日一次
 * 1. 處理試用到期用戶：memberLevelExpiresAt < now → 重新評估
 * 2. 長期無活動降級（> N 日冇出價）→ 強制銅牌
 */
export async function runDailyLoyaltyMaintenance(): Promise<{ trialExpired: number; inactivityDowngraded: number }> {
  const db = await getDb();
  if (!db) return { trialExpired: 0, inactivityDowngraded: 0 };

  const config = await getLoyaltyConfig();
  const now = new Date();

  // 1. 試用到期
  const expired = await db.select().from(users)
    .where(and(isNotNull(users.memberLevelExpiresAt), lt(users.memberLevelExpiresAt, now)));
  for (const u of expired) {
    await recalculateUserLevel(u.id);
  }

  // 2. 長期無活動
  let downgraded = 0;
  if (config.inactivityDaysForDowngrade > 0) {
    const cutoff = new Date(now.getTime() - config.inactivityDaysForDowngrade * 24 * 3600 * 1000);
    // 查銀/金會員嘅最後出價時間
    const nonBronze = await db.select().from(users)
      .where(and(sql`${users.memberLevel} IN ('silver','gold')`));
    for (const u of nonBronze) {
      const [r] = await db.select({ last: sql<Date>`MAX(${bids.createdAt})`.as('last') }).from(bids).where(eq(bids.userId, u.id));
      const last = r?.last ? new Date(r.last) : null;
      if (!last || last < cutoff) {
        // 跌返銅牌（唔理自然等級，因為個 rule 係「長期無活動」）
        await db.update(users)
          .set({ memberLevel: 'bronze', memberLevelExpiresAt: null })
          .where(eq(users.id, u.id));
        downgraded++;
      }
    }
  }

  console.log(`[Loyalty] Daily maintenance: trial expired=${expired.length}, inactivity downgraded=${downgraded}`);
  return { trialExpired: expired.length, inactivityDowngraded: downgraded };
}

// ─── 用戶視圖：等級 + 下一級進度 ────────────────────────────────

export async function getMyLoyaltyStatus(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const config = await getLoyaltyConfig();
  const stats = await getUserStats(userId);
  const natural = naturalLevelFromStats(stats, config);

  const currentLevel = user.memberLevel as MemberLevel;
  const hasTrial = user.memberLevelExpiresAt && user.memberLevelExpiresAt > new Date();

  // 下一個要升嘅等級 + 仲差幾多
  let nextLevel: MemberLevel | null = null;
  let progress: { targetLevel: MemberLevel; conditions: { label: string; current: number; target: number; done: boolean }[] } | null = null;

  if (LEVEL_RANK[natural] < LEVEL_RANK['silver']) {
    nextLevel = 'silver';
    progress = {
      targetLevel: 'silver',
      conditions: [
        { label: '累積出價次數', current: stats.totalBidCount, target: config.silverBidCount, done: stats.totalBidCount >= config.silverBidCount },
        { label: '累積成交次數', current: stats.totalWinCount, target: config.silverWinCount, done: stats.totalWinCount >= config.silverWinCount },
        { label: '近 90 日競投總額 (HKD)', current: Math.floor(stats.spend90Days), target: config.silver90DaySpend, done: stats.spend90Days >= config.silver90DaySpend },
      ],
    };
  } else if (LEVEL_RANK[natural] < LEVEL_RANK['gold']) {
    nextLevel = 'gold';
    progress = {
      targetLevel: 'gold',
      conditions: [
        { label: '累積成交次數', current: stats.totalWinCount, target: config.goldWinCount, done: stats.totalWinCount >= config.goldWinCount },
        { label: '近 90 日競投總額 (HKD)', current: Math.floor(stats.spend90Days), target: config.gold90DaySpend, done: stats.spend90Days >= config.gold90DaySpend },
      ],
    };
  }

  return {
    currentLevel,
    naturalLevel: natural,
    trialExpiresAt: hasTrial ? user.memberLevelExpiresAt : null,
    stats: {
      totalBidCount: stats.totalBidCount,
      totalWinCount: stats.totalWinCount,
      spend90Days: Math.floor(stats.spend90Days),
    },
    nextLevel,
    progress,
    benefits: {
      cashbackRate: currentLevel === 'silver' ? config.silverCashbackRate : currentLevel === 'gold' ? config.goldCashbackRate : currentLevel === 'vip' ? config.vipCashbackRate : 0,
      previewHours: currentLevel === 'silver' ? config.silverPreviewHours : currentLevel === 'gold' ? config.goldPreviewHours : 0,
    },
  };
}
