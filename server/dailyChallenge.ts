import { and, desc, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { getDb } from "./db";
import { dailyChallenges, dailyChallengeAnswers } from "../drizzle/schema";
import { storagePut } from "./storage";

export type ImageRegion = { x: number; y: number; w: number; h: number };

/**
 * 為圖片指定矩形區域加馬賽克（pixelate）。
 * regions 用 0-1 ratio 表示，方便前端唔需要知原圖實際 px。
 * 用 sharp：每個 region extract → resize 到細 → resize 回原 size（nearest）→ composite 返落原圖。
 */
export async function pixelateRegions(srcBuffer: Buffer, regions: ImageRegion[]): Promise<Buffer> {
  if (!regions || regions.length === 0) return srcBuffer;
  const meta = await sharp(srcBuffer).metadata();
  const W = meta.width || 0;
  const H = meta.height || 0;
  if (!W || !H) return srcBuffer;

  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (const r of regions) {
    const left = Math.max(0, Math.floor(r.x * W));
    const top = Math.max(0, Math.floor(r.y * H));
    let width = Math.min(W - left, Math.max(1, Math.floor(r.w * W)));
    let height = Math.min(H - top, Math.max(1, Math.floor(r.h * H)));
    if (width < 4 || height < 4) continue;

    // 馬賽克強度：取較短邊嘅 1/12，clamp 2-25 px
    const block = Math.max(2, Math.min(25, Math.floor(Math.min(width, height) / 12)));
    const smallW = Math.max(2, Math.floor(width / block));
    const smallH = Math.max(2, Math.floor(height / block));

    const tile = await sharp(srcBuffer)
      .extract({ left, top, width, height })
      .resize(smallW, smallH, { kernel: "nearest" })
      .resize(width, height, { kernel: "nearest" })
      .toBuffer();
    composites.push({ input: tile, left, top });
  }
  if (composites.length === 0) return srcBuffer;
  return sharp(srcBuffer).composite(composites).jpeg({ quality: 88 }).toBuffer();
}

/**
 * 由 imageUrl 下載原圖、套用馬賽克、上載 censored 版本到 S3，返回新 URL。
 */
export async function generateCensoredImage(imageUrl: string, regions: ImageRegion[]): Promise<string> {
  const r = await fetch(imageUrl, { headers: { "User-Agent": "hongxcollections/1.0" } });
  if (!r.ok) throw new Error(`下載原圖失敗（HTTP ${r.status}）`);
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);
  const out = await pixelateRegions(buf, regions);
  const key = `daily-challenge/censored-${Date.now()}.jpg`;
  const { url } = await storagePut(key, out, "image/jpeg");
  return url;
}

export const CHALLENGE_COUNTRIES = [
  "香港", "中國", "英國", "美國", "日本", "加拿大", "澳洲",
  "法國", "德國", "意大利", "俄羅斯", "印度", "新加坡", "馬來西亞", "其他",
] as const;

export const CHALLENGE_CATEGORIES = [
  "銅幣", "銀幣", "金幣", "紙幣", "紀念幣", "流通幣", "其他",
] as const;

/** HK 當日 YYYY-MM-DD（UTC+8，無 DST） */
export function hkTodayStr(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const norm = (s: string) => (s || "").trim();

export async function adminCreateChallenge(input: {
  imageUrl: string;
  publishDate: string;
  answerCountry: string;
  answerYear: number;
  yearTolerance: number;
  answerCategory: string;
  hint?: string | null;
  description?: string | null;
  status: "draft" | "published";
  createdBy: number;
}): Promise<{ id: number }> {
  const db = await getDb();
  const r: any = await db.insert(dailyChallenges).values({
    imageUrl: input.imageUrl,
    publishDate: input.publishDate,
    answerCountry: input.answerCountry,
    answerYear: input.answerYear,
    yearTolerance: input.yearTolerance,
    answerCategory: input.answerCategory,
    hint: input.hint || null,
    description: input.description || null,
    status: input.status,
    createdBy: input.createdBy,
  });
  const id = Number((r?.[0]?.insertId ?? r?.insertId ?? 0));
  return { id };
}

export async function adminUpdateChallenge(
  id: number,
  patch: Partial<{
    imageUrl: string;
    publishDate: string;
    answerCountry: string;
    answerYear: number;
    yearTolerance: number;
    answerCategory: string;
    hint: string | null;
    description: string | null;
    status: "draft" | "published" | "closed";
    imageRegions: string | null;
    imageUrlCensored: string | null;
  }>
): Promise<void> {
  const db = await getDb();
  await db.update(dailyChallenges).set(patch as any).where(eq(dailyChallenges.id, id));
}

export async function adminDeleteChallenge(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(dailyChallengeAnswers).where(eq(dailyChallengeAnswers.challengeId, id));
  await db.delete(dailyChallenges).where(eq(dailyChallenges.id, id));
}

export async function adminListChallenges(limit = 50): Promise<any[]> {
  const db = await getDb();
  const rows = await db.select().from(dailyChallenges).orderBy(desc(dailyChallenges.publishDate), desc(dailyChallenges.id)).limit(limit);
  return rows as any[];
}

export async function getTodayChallenge(): Promise<any | null> {
  const db = await getDb();
  const today = hkTodayStr();
  const rows = await db.select().from(dailyChallenges)
    .where(and(eq(dailyChallenges.publishDate, today), eq(dailyChallenges.status, "published")))
    .limit(1);
  return (rows[0] as any) || null;
}

export async function getChallengeById(id: number): Promise<any | null> {
  const db = await getDb();
  const rows = await db.select().from(dailyChallenges).where(eq(dailyChallenges.id, id)).limit(1);
  return (rows[0] as any) || null;
}

/**
 * 用戶提交答案。一次過判正確 + 分數 + 排名。
 * 規則：每挑戰每用戶只可答一次。年代允許 ±tolerance；國家／種類 exact match。
 * 分數：1st=5、2nd=3、3rd=2、其他正確=1、錯=0。
 */
export async function submitChallengeAnswer(input: {
  challengeId: number;
  userId: number;
  answerCountry: string;
  answerYear: number;
  answerCategory: string;
}): Promise<{
  isCorrect: boolean;
  answerRank: number | null;
  pointsAwarded: number;
  correctAnswer: { country: string; year: number; category: string; tolerance: number; description: string | null };
}> {
  const db = await getDb();
  const c = await getChallengeById(input.challengeId);
  if (!c) throw new Error("挑戰不存在");
  if (c.status !== "published") throw new Error("挑戰未開放或已結束");

  const existing = await db.select().from(dailyChallengeAnswers)
    .where(and(
      eq(dailyChallengeAnswers.challengeId, input.challengeId),
      eq(dailyChallengeAnswers.userId, input.userId),
    ))
    .limit(1);
  if (existing.length > 0) throw new Error("你已回答過今日挑戰");

  const tol = Number(c.yearTolerance ?? 5);
  const countryOk = norm(input.answerCountry) === norm(c.answerCountry);
  const categoryOk = norm(input.answerCategory) === norm(c.answerCategory);
  const yearOk = Math.abs(input.answerYear - Number(c.answerYear)) <= tol;
  const isCorrect = countryOk && categoryOk && yearOk ? 1 : 0;

  let answerRank: number | null = null;
  let pointsAwarded = 0;
  if (isCorrect) {
    const r: any = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM dailyChallengeAnswers
      WHERE challengeId = ${input.challengeId} AND isCorrect = 1
    `);
    const rows = (Array.isArray(r) ? r[0] : r) as any[];
    const existingCorrect = Number(rows?.[0]?.cnt ?? 0);
    answerRank = existingCorrect + 1;
    if (answerRank === 1) pointsAwarded = 5;
    else if (answerRank === 2) pointsAwarded = 3;
    else if (answerRank === 3) pointsAwarded = 2;
    else pointsAwarded = 1;
  }

  await db.insert(dailyChallengeAnswers).values({
    challengeId: input.challengeId,
    userId: input.userId,
    answerCountry: input.answerCountry,
    answerYear: input.answerYear,
    answerCategory: input.answerCategory,
    isCorrect,
    answerRank,
    pointsAwarded,
  });

  return {
    isCorrect: !!isCorrect,
    answerRank,
    pointsAwarded,
    correctAnswer: {
      country: c.answerCountry,
      year: Number(c.answerYear),
      category: c.answerCategory,
      tolerance: tol,
      description: c.description || null,
    },
  };
}

export async function getMyAnswerForChallenge(challengeId: number, userId: number): Promise<any | null> {
  const db = await getDb();
  const rows = await db.select().from(dailyChallengeAnswers)
    .where(and(
      eq(dailyChallengeAnswers.challengeId, challengeId),
      eq(dailyChallengeAnswers.userId, userId),
    ))
    .limit(1);
  return (rows[0] as any) || null;
}

export async function getChallengeStats(challengeId: number): Promise<{ total: number; correct: number }> {
  const db = await getDb();
  const r: any = await db.execute(sql`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) AS correct
    FROM dailyChallengeAnswers WHERE challengeId = ${challengeId}
  `);
  const rows = (Array.isArray(r) ? r[0] : r) as any[];
  const row = rows?.[0] || {};
  return { total: Number(row.total ?? 0), correct: Number(row.correct ?? 0) };
}

export async function getChallengeWinners(challengeId: number, limit = 20): Promise<any[]> {
  const db = await getDb();
  const r: any = await db.execute(sql`
    SELECT a.id, a.userId, a.answerRank AS \`rank\`, a.pointsAwarded, a.submittedAt,
           u.name AS userName, u.photoUrl AS userPhoto
    FROM dailyChallengeAnswers a
    LEFT JOIN users u ON u.id = a.userId
    WHERE a.challengeId = ${challengeId} AND a.isCorrect = 1
    ORDER BY a.answerRank ASC LIMIT ${limit}
  `);
  return ((Array.isArray(r) ? r[0] : r) as any[]) || [];
}

export async function getLeaderboard(limit = 20): Promise<any[]> {
  const db = await getDb();
  const r: any = await db.execute(sql`
    SELECT a.userId,
           SUM(a.pointsAwarded) AS totalPoints,
           SUM(CASE WHEN a.isCorrect = 1 THEN 1 ELSE 0 END) AS correctCount,
           SUM(CASE WHEN a.answerRank = 1 THEN 1 ELSE 0 END) AS goldCount,
           SUM(CASE WHEN a.answerRank = 2 THEN 1 ELSE 0 END) AS silverCount,
           SUM(CASE WHEN a.answerRank = 3 THEN 1 ELSE 0 END) AS bronzeCount,
           u.name AS userName, u.photoUrl AS userPhoto
    FROM dailyChallengeAnswers a
    LEFT JOIN users u ON u.id = a.userId
    GROUP BY a.userId, u.name, u.photoUrl
    HAVING totalPoints > 0
    ORDER BY totalPoints DESC, correctCount DESC
    LIMIT ${limit}
  `);
  return ((Array.isArray(r) ? r[0] : r) as any[]) || [];
}

export async function getMyChallengeStats(userId: number): Promise<{
  totalPoints: number;
  totalAttempts: number;
  correctCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
}> {
  const db = await getDb();
  const r: any = await db.execute(sql`
    SELECT
      SUM(pointsAwarded) AS totalPoints,
      COUNT(*) AS totalAttempts,
      SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) AS correctCount,
      SUM(CASE WHEN answerRank = 1 THEN 1 ELSE 0 END) AS goldCount,
      SUM(CASE WHEN answerRank = 2 THEN 1 ELSE 0 END) AS silverCount,
      SUM(CASE WHEN answerRank = 3 THEN 1 ELSE 0 END) AS bronzeCount
    FROM dailyChallengeAnswers WHERE userId = ${userId}
  `);
  const rows = (Array.isArray(r) ? r[0] : r) as any[];
  const row = rows?.[0] || {};
  return {
    totalPoints: Number(row.totalPoints ?? 0),
    totalAttempts: Number(row.totalAttempts ?? 0),
    correctCount: Number(row.correctCount ?? 0),
    goldCount: Number(row.goldCount ?? 0),
    silverCount: Number(row.silverCount ?? 0),
    bronzeCount: Number(row.bronzeCount ?? 0),
  };
}

export async function listMyAnswerHistory(userId: number, limit = 30): Promise<any[]> {
  const db = await getDb();
  const r: any = await db.execute(sql`
    SELECT a.id, a.challengeId, a.answerCountry, a.answerYear, a.answerCategory,
           a.isCorrect, a.answerRank AS \`rank\`, a.pointsAwarded, a.submittedAt,
           c.imageUrl, c.publishDate,
           c.answerCountry AS correctCountry, c.answerYear AS correctYear, c.answerCategory AS correctCategory
    FROM dailyChallengeAnswers a
    LEFT JOIN dailyChallenges c ON c.id = a.challengeId
    WHERE a.userId = ${userId}
    ORDER BY a.submittedAt DESC LIMIT ${limit}
  `);
  return ((Array.isArray(r) ? r[0] : r) as any[]) || [];
}
