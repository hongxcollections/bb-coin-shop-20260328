import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  collectionPosts,
  collectionPostImages,
  collectionPostLikes,
  collectionPostComments,
  collectionPostSaves,
} from "../drizzle/schema";

/**
 * 防私下交易嘅內容過濾規則。
 * 觸發任何一條即標記 isFlagged + isHidden = 1，等 admin 審核。
 */
const FORBIDDEN_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /whats[\s\-_]?app/i, reason: "WhatsApp" },
  { re: /\btelegram\b/i, reason: "Telegram" },
  { re: /\btg\b/i, reason: "TG" },
  { re: /\bsignal\b/i, reason: "Signal" },
  { re: /\bline\b/i, reason: "Line" },
  { re: /we[\s\-_]?chat/i, reason: "WeChat" },
  { re: /微信|微訊|weixin/i, reason: "微信" },
  { re: /\bqq\b/i, reason: "QQ" },
  { re: /instagram|\big\b/i, reason: "IG" },
  { re: /messenger/i, reason: "Messenger" },
  { re: /\+852[\s\-]?\d{3,}/, reason: "電話 (+852)" },
  // HK 8 位電話：要求前後有電話相關關鍵字 / 符號，避免誤殺價格如「80000000」
  { re: /(?:電話|手機|手机|電話號碼|聯絡|聯絡電話|tel|phone|mobile|hp|whats?app|wtsapp|wts|☎|📱)[^\d]{0,8}[5-9]\d{7}\b/i, reason: "電話 (HK 8 位)" },
  // 顯式分組嘅電話 pattern (e.g. 9123-4567 / 9123 4567)
  { re: /\b[5-9]\d{3}[\s\-]\d{4}\b/, reason: "電話 pattern" },
  { re: /https?:\/\//i, reason: "外部 URL" },
  { re: /\bwww\.[a-z0-9]/i, reason: "外部 URL (www)" },
  { re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, reason: "電郵" },
  { re: /qr[\s\-]?code|二維碼|二维码|掃碼|扫码/i, reason: "QR code" },
  { re: /私聊|私訊|私下|私底下|\bdm\b|\binbox\b/i, reason: "私下聯絡用語" },
];

export function checkForbidden(text: string | null | undefined): { flagged: boolean; reason: string } {
  if (!text) return { flagged: false, reason: "" };
  const matched: string[] = [];
  for (const { re, reason } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) matched.push(reason);
  }
  if (matched.length === 0) return { flagged: false, reason: "" };
  return { flagged: true, reason: Array.from(new Set(matched)).join(", ") };
}

export type Intent = "display" | "seek_value" | "for_sale";

// 方案 B：商戶上架配額（每月）— 預設 3，將來可由 site setting 覆蓋
export const MERCHANT_POST_MONTHLY_LIMIT_DEFAULT = 3;

export async function getMerchantPostMonthlyLimit(): Promise<number> {
  try {
    const { getSiteSetting } = await import("./db");
    const v = await getSiteSetting("merchant_post_monthly_limit");
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 0 && n <= 50) return n;
    }
  } catch { /* ignore */ }
  return MERCHANT_POST_MONTHLY_LIMIT_DEFAULT;
}

/** 商戶呢個月已發咗幾多 isMerchantPost 嘅帖（無論隱藏與否，都算入配額避免洗版） */
export async function getMerchantPostQuotaInfo(userId: number): Promise<{
  isMerchant: boolean;
  used: number;
  limit: number;
  canPost: boolean;
}> {
  const db = await getDb();
  if (!db) return { isMerchant: false, used: 0, limit: 0, canPost: false };
  const merchRaw: any = await db.execute(sql`SELECT 1 FROM merchantApplications WHERE userId = ${userId} AND status = 'approved' LIMIT 1`);
  const merchRows = (Array.isArray(merchRaw) ? merchRaw[0] : merchRaw) as any[];
  const isMerchant = (merchRows?.length ?? 0) > 0;
  if (!isMerchant) return { isMerchant: false, used: 0, limit: 0, canPost: false };

  const limit = await getMerchantPostMonthlyLimit();
  // 算當月（本地 server 月份）
  const usedRaw: any = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM collectionPosts
    WHERE userId = ${userId}
      AND isMerchantPost = 1
      AND createdAt >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')
  `);
  const usedRows = (Array.isArray(usedRaw) ? usedRaw[0] : usedRaw) as any[];
  const used = Number(usedRows?.[0]?.cnt ?? 0);
  return { isMerchant, used, limit, canPost: used < limit };
}

export async function createCollectionPost(input: {
  userId: number;
  title: string;
  body: string;
  intent: Intent;
  tags: string[];
  imageUrls: string[];
  isMerchantPost?: boolean;
  merchantProductId?: number | null;
}): Promise<{ id: number; flagged: boolean; reason: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const combined = `${input.title}\n${input.body}\n${input.tags.join(" ")}`;
  const { flagged, reason } = checkForbidden(combined);

  const isMerchantPost = input.isMerchantPost ? 1 : 0;
  const merchantProductId = input.merchantProductId ?? null;

  const result: any = await db.insert(collectionPosts).values({
    userId: input.userId,
    title: input.title,
    body: input.body,
    intent: input.intent,
    tagsJson: JSON.stringify(input.tags || []),
    isHidden: flagged ? 1 : 0,
    isFlagged: flagged ? 1 : 0,
    flagReason: flagged ? reason.slice(0, 500) : null,
    isMerchantPost,
    merchantProductId,
  });
  const insertId = (result?.[0]?.insertId ?? result?.insertId ?? 0) as number;

  if (insertId > 0 && input.imageUrls.length > 0) {
    const rows = input.imageUrls.slice(0, 9).map((url, idx) => ({
      postId: insertId,
      imageUrl: url,
      displayOrder: idx,
    }));
    await db.insert(collectionPostImages).values(rows);
  }

  // Fire-and-forget: 通知 FB 抓 OG cache（藏品社區帖文）
  if (insertId > 0 && !flagged) {
    try {
      const { pingCommunityPostOg } = await import("./_core/facebook-og-refresh");
      pingCommunityPostOg(insertId);
    } catch {}
  }

  return { id: insertId, flagged, reason };
}

export async function listCollectionPosts(input: {
  intent: "all" | Intent;
  sort: "latest" | "hot";
  search?: string;
  cursor?: number;
  limit: number;
  viewerIsAdmin: boolean;
  viewerUserId: number | null;
  authorId?: number;
  /**
   * 方案 B：tab filter
   * - "community"（預設）：純會員分享，**唔包**商戶上架帖
   * - "merchant"：只 show 商戶上架帖
   * - "all"：兩種都包
   */
  tab?: "community" | "merchant" | "all";
  tag?: string;
}) {
  const db = await getDb();
  if (!db) return { items: [], nextCursor: null as number | null };

  const conds: any[] = [];
  if (!input.viewerIsAdmin) conds.push(sql`cp.isHidden = 0`);
  if (input.intent !== "all") conds.push(sql`cp.intent = ${input.intent}`);
  // 方案 B：tab 過濾（唔指定就當 community）
  const tab = input.tab ?? "community";
  if (tab === "community") conds.push(sql`cp.isMerchantPost = 0`);
  else if (tab === "merchant") conds.push(sql`cp.isMerchantPost = 1`);
  // tab === "all" 不過濾
  if (input.search && input.search.trim()) {
    const kw = `%${input.search.trim()}%`;
    conds.push(sql`(cp.title LIKE ${kw} OR cp.body LIKE ${kw})`);
  }
  if (input.authorId) conds.push(sql`cp.userId = ${input.authorId}`);
  if (input.tag && input.tag.trim()) {
    const tagLike = `%${input.tag.trim()}%`;
    conds.push(sql`cp.tagsJson LIKE ${tagLike}`);
  }
  if (input.cursor) {
    if (input.sort === "latest") {
      conds.push(sql`cp.id < ${input.cursor}`);
    } else {
      conds.push(sql`cp.id < ${input.cursor}`);
    }
  }

  const whereSql = conds.length
    ? sql`WHERE ${sql.join(conds, sql` AND `)}`
    : sql``;
  const orderSql =
    input.sort === "hot"
      ? sql`ORDER BY (cp.likeCount + cp.commentCount * 2) DESC, cp.id DESC`
      : sql`ORDER BY cp.id DESC`;

  const rowsRaw: any = await db.execute(sql`
    SELECT
      cp.id, cp.userId, cp.title, cp.body, cp.intent, cp.tagsJson,
      cp.isHidden, cp.isFlagged, cp.flagReason,
      cp.likeCount, cp.commentCount, cp.viewCount,
      cp.isMerchantPost, cp.merchantProductId,
      cp.displayAuthor,
      cp.createdAt,
      u.name AS authorName,
      COALESCE(NULLIF(TRIM((SELECT ma2.merchantIcon FROM merchantApplications ma2 WHERE ma2.userId = cp.userId AND ma2.status = 'approved' ORDER BY ma2.id DESC LIMIT 1)),''), NULLIF(TRIM(u.photoUrl),'')) AS authorPhoto,
      u.memberLevel AS authorMemberLevel,
      (SELECT cpi.imageUrl FROM collectionPostImages cpi WHERE cpi.postId = cp.id ORDER BY cpi.displayOrder, cpi.id LIMIT 1) AS coverImage,
      (SELECT COUNT(*) FROM collectionPostImages cpi WHERE cpi.postId = cp.id) AS imageCount
    FROM collectionPosts cp
    LEFT JOIN users u ON u.id = cp.userId
    ${whereSql}
    ${orderSql}
    LIMIT ${input.limit + 1}
  `);
  const rows = (Array.isArray(rowsRaw) ? rowsRaw[0] : rowsRaw) as any[];

  let nextCursor: number | null = null;
  let items = rows;
  if (rows.length > input.limit) {
    items = rows.slice(0, input.limit);
    nextCursor = items[items.length - 1].id;
  }

  // 查 viewer 嘅 like/save 狀態
  let likedSet = new Set<number>();
  let savedSet = new Set<number>();
  if (input.viewerUserId && items.length > 0) {
    const ids = items.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const [likeRows]: any = await (db as any).execute(sql.raw(
      `SELECT postId FROM collectionPostLikes WHERE userId = ${input.viewerUserId} AND postId IN (${placeholders})`
    ).queryChunks ? sql`SELECT postId FROM collectionPostLikes WHERE userId = ${input.viewerUserId} AND postId IN (${sql.join(ids.map(i => sql`${i}`), sql`,`)})` : sql`SELECT 1`);
    // Fallback simpler approach via drizzle:
    try {
      const liked = await db
        .select({ postId: collectionPostLikes.postId })
        .from(collectionPostLikes)
        .where(eq(collectionPostLikes.userId, input.viewerUserId));
      likedSet = new Set((liked as any[]).map((r) => r.postId));
      const saved = await db
        .select({ postId: collectionPostSaves.postId })
        .from(collectionPostSaves)
        .where(eq(collectionPostSaves.userId, input.viewerUserId));
      savedSet = new Set((saved as any[]).map((r) => r.postId));
    } catch { /* ignore */ }
  }

  return {
    items: items.map((r) => ({
      ...r,
      tags: safeParseTags(r.tagsJson),
      isLiked: likedSet.has(r.id),
      isSaved: savedSet.has(r.id),
    })),
    nextCursor,
  };
}

function safeParseTags(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function getCollectionPostDetail(postId: number, viewerUserId: number | null, viewerIsAdmin: boolean) {
  const db = await getDb();
  if (!db) return null;
  const rows: any[] = await db
    .select()
    .from(collectionPosts)
    .where(eq(collectionPosts.id, postId))
    .limit(1);
  if (rows.length === 0) return null;
  const post = rows[0];
  if (post.isHidden && !viewerIsAdmin && post.userId !== viewerUserId) return null;

  const images = await db
    .select()
    .from(collectionPostImages)
    .where(eq(collectionPostImages.postId, postId))
    .orderBy(collectionPostImages.displayOrder, collectionPostImages.id);

  // author info（商戶優先用 merchantIcon，否則用 users.photoUrl）
  const authorRowsRaw: any = await db.execute(sql`
    SELECT u.id, u.name,
      COALESCE(
        NULLIF(TRIM(ma.merchantIcon), ''),
        NULLIF(TRIM(u.photoUrl), '')
      ) AS photoUrl,
      u.memberLevel
    FROM users u
    LEFT JOIN merchantApplications ma ON ma.userId = u.id AND ma.status = 'approved'
    WHERE u.id = ${post.userId}
    LIMIT 1
  `);
  const authorRows = (Array.isArray(authorRowsRaw) ? authorRowsRaw[0] : authorRowsRaw) as any[];
  const author = authorRows?.[0] ?? null;

  // is merchant?
  const merchantRowsRaw: any = await db.execute(sql`SELECT 1 FROM merchantApplications WHERE userId = ${post.userId} AND status = 'approved' LIMIT 1`);
  const merchantRows = (Array.isArray(merchantRowsRaw) ? merchantRowsRaw[0] : merchantRowsRaw) as any[];
  const authorIsMerchant = (merchantRows?.length ?? 0) > 0;

  let isLiked = false;
  let isSaved = false;
  if (viewerUserId) {
    const lk: any[] = await db
      .select()
      .from(collectionPostLikes)
      .where(and(eq(collectionPostLikes.postId, postId), eq(collectionPostLikes.userId, viewerUserId)))
      .limit(1);
    isLiked = lk.length > 0;
    const sv: any[] = await db
      .select()
      .from(collectionPostSaves)
      .where(and(eq(collectionPostSaves.postId, postId), eq(collectionPostSaves.userId, viewerUserId)))
      .limit(1);
    isSaved = sv.length > 0;
  }

  // 增加 view count（非 author / 非 admin 才加）
  if (viewerUserId !== post.userId) {
    try { await db.execute(sql`UPDATE collectionPosts SET viewCount = viewCount + 1 WHERE id = ${postId}`); } catch { /* ignore */ }
  }

  // 方案 B：如果係商戶上架帖且有 link product，攞 product 簡介（必須仍 active）
  let merchantProduct: {
    id: number;
    title: string;
    price: string;
    currency: string;
    coverImage: string | null;
    merchantId: number;
    merchantName: string;
  } | null = null;
  if (post.isMerchantPost && post.merchantProductId) {
    try {
      const mpRaw: any = await db.execute(sql`
        SELECT id, title, price, currency, images, merchantId, merchantName
        FROM merchantProducts
        WHERE id = ${post.merchantProductId} AND status = 'active'
        LIMIT 1
      `);
      const mpRows = (Array.isArray(mpRaw) ? mpRaw[0] : mpRaw) as any[];
      const mp = mpRows?.[0];
      if (mp) {
        let coverImage: string | null = null;
        try {
          const arr = mp.images ? JSON.parse(mp.images) : [];
          if (Array.isArray(arr) && typeof arr[0] === "string") coverImage = arr[0];
        } catch { /* ignore */ }
        merchantProduct = {
          id: mp.id,
          title: mp.title,
          price: String(mp.price ?? ""),
          currency: mp.currency ?? "HKD",
          coverImage,
          merchantId: mp.merchantId,
          merchantName: mp.merchantName ?? "",
        };
      }
    } catch { /* ignore */ }
  }

  return {
    ...post,
    tags: safeParseTags(post.tagsJson),
    images,
    author,
    authorIsMerchant,
    isLiked,
    isSaved,
    merchantProduct,
  };
}

/**
 * SEO 用：lightweight post fetch（無 view bump、無 viewer 邏輯）。
 * 只 return 公開（isHidden = 0）嘅 post + 第一張圖。畀 OG meta injection / sitemap 用。
 */
export async function getCollectionPostForOg(postId: number): Promise<{
  id: number;
  title: string;
  body: string;
  intent: string;
  authorName: string | null;
  firstImageUrl: string | null;
  imageCount: number;
  tags: string[];
  updatedAt: Date | null;
  createdAt: Date | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const rows: any[] = await db
    .select()
    .from(collectionPosts)
    .where(and(eq(collectionPosts.id, postId), eq(collectionPosts.isHidden, 0)))
    .limit(1);
  if (rows.length === 0) return null;
  const post = rows[0];

  const imgs: any[] = await db
    .select()
    .from(collectionPostImages)
    .where(eq(collectionPostImages.postId, postId))
    .orderBy(collectionPostImages.displayOrder, collectionPostImages.id);

  let authorName: string | null = null;
  try {
    const aRaw: any = await db.execute(sql`SELECT name FROM users WHERE id = ${post.userId} LIMIT 1`);
    const aRows = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as any[];
    authorName = aRows?.[0]?.name ?? null;
  } catch { /* ignore */ }

  return {
    id: post.id,
    title: post.title,
    body: post.body ?? "",
    intent: post.intent,
    authorName,
    firstImageUrl: imgs[0]?.imageUrl ?? null,
    imageCount: imgs.length,
    tags: safeParseTags(post.tagsJson),
    updatedAt: post.updatedAt ?? null,
    createdAt: post.createdAt ?? null,
  };
}

/**
 * SEO 用：list 公開帖文，畀 sitemap.xml 用（最多 2000 條）。
 */
export async function listCollectionPostsForSitemap(): Promise<Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const raw: any = await db.execute(sql`
      SELECT id, updatedAt, createdAt
      FROM collectionPosts
      WHERE isHidden = 0
      ORDER BY COALESCE(updatedAt, createdAt) DESC
      LIMIT 2000
    `);
    const rows = (Array.isArray(raw) ? raw[0] : raw) as Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }>;
    return rows ?? [];
  } catch { return []; }
}

export async function listCollectionPostComments(postId: number, viewerIsAdmin: boolean) {
  const db = await getDb();
  if (!db) return [];
  const rowsRaw: any = await db.execute(sql`
    SELECT
      c.id, c.postId, c.userId, c.content, c.isHidden, c.isFlagged, c.createdAt,
      u.name AS authorName,
      COALESCE(
        NULLIF(TRIM((SELECT ma.merchantIcon FROM merchantApplications ma WHERE ma.userId = c.userId AND ma.status = 'approved' ORDER BY ma.id DESC LIMIT 1)), ''),
        NULLIF(TRIM(u.photoUrl), '')
      ) AS authorPhoto
    FROM collectionPostComments c
    LEFT JOIN users u ON u.id = c.userId
    WHERE c.postId = ${postId} ${viewerIsAdmin ? sql`` : sql`AND c.isHidden = 0`}
    ORDER BY c.id ASC
  `);
  const rows = (Array.isArray(rowsRaw) ? rowsRaw[0] : rowsRaw) as any[];
  return rows;
}

export async function addCollectionPostComment(postId: number, userId: number, content: string): Promise<{ id: number; flagged: boolean; reason: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { flagged, reason } = checkForbidden(content);

  const ins: any = await db.insert(collectionPostComments).values({
    postId,
    userId,
    content,
    isHidden: flagged ? 1 : 0,
    isFlagged: flagged ? 1 : 0,
  });
  const insertId = (ins?.[0]?.insertId ?? ins?.insertId ?? 0) as number;

  if (!flagged) {
    try { await db.execute(sql`UPDATE collectionPosts SET commentCount = commentCount + 1 WHERE id = ${postId}`); } catch { /* ignore */ }
  }
  return { id: insertId, flagged, reason };
}

export async function deleteCollectionPostComment(commentId: number, userId: number, isAdmin: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows: any[] = await db
    .select()
    .from(collectionPostComments)
    .where(eq(collectionPostComments.id, commentId))
    .limit(1);
  if (rows.length === 0) return false;
  const c = rows[0];
  if (!isAdmin && c.userId !== userId) return false;
  await db.delete(collectionPostComments).where(eq(collectionPostComments.id, commentId));
  if (!c.isHidden) {
    try { await db.execute(sql`UPDATE collectionPosts SET commentCount = GREATEST(commentCount - 1, 0) WHERE id = ${c.postId}`); } catch { /* ignore */ }
  }
  return true;
}

/**
 * Atomic like toggle 利用 unique key (postId, userId) + INSERT IGNORE / DELETE
 * 嘅 affectedRows 判斷實際變化，避免 read-then-write race condition。
 */
export async function toggleCollectionPostLike(postId: number, userId: number): Promise<{ isLiked: boolean }> {
  const db = await getDb();
  if (!db) return { isLiked: false };
  // 先嘗試 INSERT IGNORE — 如果無 row 則 affectedRows=1 表示新讚
  const insRes: any = await db.execute(sql`INSERT IGNORE INTO collectionPostLikes (postId, userId) VALUES (${postId}, ${userId})`);
  const insAffected = Number(insRes?.[0]?.affectedRows ?? insRes?.affectedRows ?? 0);
  if (insAffected > 0) {
    try { await db.execute(sql`UPDATE collectionPosts SET likeCount = likeCount + 1 WHERE id = ${postId}`); } catch { /* ignore */ }
    return { isLiked: true };
  }
  // 已存在 → DELETE，affectedRows=1 即真正移除
  const delRes: any = await db.execute(sql`DELETE FROM collectionPostLikes WHERE postId = ${postId} AND userId = ${userId}`);
  const delAffected = Number(delRes?.[0]?.affectedRows ?? delRes?.affectedRows ?? 0);
  if (delAffected > 0) {
    try { await db.execute(sql`UPDATE collectionPosts SET likeCount = GREATEST(likeCount - 1, 0) WHERE id = ${postId}`); } catch { /* ignore */ }
  }
  return { isLiked: false };
}

export async function toggleCollectionPostSave(postId: number, userId: number): Promise<{ isSaved: boolean }> {
  const db = await getDb();
  if (!db) return { isSaved: false };
  const insRes: any = await db.execute(sql`INSERT IGNORE INTO collectionPostSaves (postId, userId) VALUES (${postId}, ${userId})`);
  const insAffected = Number(insRes?.[0]?.affectedRows ?? insRes?.affectedRows ?? 0);
  if (insAffected > 0) return { isSaved: true };
  await db.execute(sql`DELETE FROM collectionPostSaves WHERE postId = ${postId} AND userId = ${userId}`);
  return { isSaved: false };
}

export async function deleteCollectionPost(postId: number, userId: number, isAdmin: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows: any[] = await db.select().from(collectionPosts).where(eq(collectionPosts.id, postId)).limit(1);
  if (rows.length === 0) return false;
  if (!isAdmin && rows[0].userId !== userId) return false;
  await db.delete(collectionPostImages).where(eq(collectionPostImages.postId, postId));
  await db.delete(collectionPostLikes).where(eq(collectionPostLikes.postId, postId));
  await db.delete(collectionPostComments).where(eq(collectionPostComments.postId, postId));
  await db.delete(collectionPostSaves).where(eq(collectionPostSaves.postId, postId));
  await db.delete(collectionPosts).where(eq(collectionPosts.id, postId));
  return true;
}

export async function adminSetPostHidden(postId: number, hidden: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(collectionPosts).set({ isHidden: hidden ? 1 : 0, isFlagged: hidden ? 1 : 0 }).where(eq(collectionPosts.id, postId));
  return true;
}

export async function adminListFlaggedPosts(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const rowsRaw: any = await db.execute(sql`
    SELECT cp.id, cp.userId, cp.title, cp.body, cp.intent, cp.flagReason, cp.isHidden, cp.isFlagged, cp.createdAt,
           u.name AS authorName,
           (SELECT cpi.imageUrl FROM collectionPostImages cpi WHERE cpi.postId = cp.id ORDER BY cpi.displayOrder LIMIT 1) AS coverImage
    FROM collectionPosts cp
    LEFT JOIN users u ON u.id = cp.userId
    WHERE cp.isFlagged = 1
    ORDER BY cp.id DESC
    LIMIT 200
  `);
  return (Array.isArray(rowsRaw) ? rowsRaw[0] : rowsRaw) as any[];
}

/**
 * 藏品社區：用戶統計（發帖數 + 收到讚總數 + 收到收藏總數）
 * 只計公開（isHidden = 0）嘅帖。
 */
export async function getCommunityUserStats(userId: number): Promise<{
  postCount: number;
  totalLikes: number;
  totalSaves: number;
}> {
  const db = await getDb();
  if (!db) return { postCount: 0, totalLikes: 0, totalSaves: 0 };
  try {
    const raw: any = await db.execute(sql`
      SELECT
        COUNT(*) AS postCount,
        COALESCE(SUM(likeCount), 0) AS totalLikes,
        (SELECT COUNT(*) FROM collectionPostSaves s
           JOIN collectionPosts p ON p.id = s.postId
          WHERE p.userId = ${userId} AND p.isHidden = 0) AS totalSaves
      FROM collectionPosts
      WHERE userId = ${userId} AND isHidden = 0
    `);
    const rows = (Array.isArray(raw) ? raw[0] : raw) as any[];
    const r = rows?.[0] ?? {};
    return {
      postCount: Number(r.postCount ?? 0),
      totalLikes: Number(r.totalLikes ?? 0),
      totalSaves: Number(r.totalSaves ?? 0),
    };
  } catch (e) {
    console.error("[community] getCommunityUserStats failed:", e);
    return { postCount: 0, totalLikes: 0, totalSaves: 0 };
  }
}

/**
 * 本週熱門分享者：過去 7 日收到最多讚嘅 user（top N）。
 * 只計公開帖；只 return 過去 7 日有新讚嘅 user。
 */
export async function listTopWeeklyCreators(limit: number = 5): Promise<Array<{
  userId: number;
  authorName: string | null;
  authorPhoto: string | null;
  weeklyLikes: number;
  postCount: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  try {
    const lim = Math.max(1, Math.min(20, limit));
    // Helper：用唔同時間窗口去揾 top 創作者
    async function queryWindow(days: number): Promise<any[]> {
      const r: any = await db!.execute(sql`
        SELECT
          weekly.userId AS userId,
          u.name AS authorName,
          COALESCE(NULLIF(TRIM(u.photoUrl),''), NULLIF(TRIM(ma.merchantIcon),'')) AS authorPhoto,
          weekly.weeklyLikes AS weeklyLikes,
          COALESCE(pc.postCount, 0) AS postCount
        FROM (
          SELECT p.userId AS userId, COUNT(l.id) AS weeklyLikes
          FROM collectionPostLikes l
          JOIN collectionPosts p ON p.id = l.postId
          WHERE p.isHidden = 0
            AND l.createdAt >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
            AND l.userId != p.userId
          GROUP BY p.userId
          ORDER BY weeklyLikes DESC
          LIMIT ${lim}
        ) AS weekly
        LEFT JOIN users u ON u.id = weekly.userId
        LEFT JOIN merchantApplications ma ON ma.userId = weekly.userId AND ma.status = 'approved'
        LEFT JOIN (
          SELECT userId, COUNT(*) AS postCount
          FROM collectionPosts
          WHERE isHidden = 0
          GROUP BY userId
        ) AS pc ON pc.userId = weekly.userId
        ORDER BY weekly.weeklyLikes DESC, pc.postCount DESC
      `);
      return (Array.isArray(r) ? r[0] : r) as any[];
    }
    // Step 1: 7 日窗口；冇結果 fallback 去發帖最多嘅活躍藏家
    let rows = (await queryWindow(7)) ?? [];
    if (rows.length === 0) {
      const r2: any = await db.execute(sql`
        SELECT
          p.userId AS userId,
          u.name AS authorName,
          COALESCE(NULLIF(TRIM(u.photoUrl),''), NULLIF(TRIM(ma.merchantIcon),'')) AS authorPhoto,
          0 AS weeklyLikes,
          COUNT(*) AS postCount
        FROM collectionPosts p
        LEFT JOIN users u ON u.id = p.userId
        LEFT JOIN merchantApplications ma ON ma.userId = p.userId AND ma.status = 'approved'
        WHERE p.isHidden = 0
        GROUP BY p.userId, u.name, u.photoUrl, ma.merchantIcon
        ORDER BY postCount DESC, p.userId DESC
        LIMIT ${lim}
      `);
      rows = (Array.isArray(r2) ? r2[0] : r2) as any[];
    }
    return (rows ?? []).map((r) => ({
      userId: Number(r.userId),
      authorName: r.authorName ?? null,
      authorPhoto: r.authorPhoto ?? null,
      weeklyLikes: Number(r.weeklyLikes ?? 0),
      postCount: Number(r.postCount ?? 0),
    }));
  } catch (e) {
    console.error("[community] listTopWeeklyCreators failed:", e);
    return [];
  }
}

export async function adminCountFlagged(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rowsRaw: any = await db.execute(sql`SELECT COUNT(*) AS cnt FROM collectionPosts WHERE isFlagged = 1`);
  const rows = (Array.isArray(rowsRaw) ? rowsRaw[0] : rowsRaw) as any[];
  return Number(rows?.[0]?.cnt ?? 0);
}
