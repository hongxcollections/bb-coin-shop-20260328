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
  { re: /\b[5-9]\d{7}\b/, reason: "8位電話號碼" },
  { re: /\b\d{3,4}[\s\-]\d{3,4}[\s\-]?\d{0,4}\b/, reason: "電話 pattern" },
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

export async function createCollectionPost(input: {
  userId: number;
  title: string;
  body: string;
  intent: Intent;
  tags: string[];
  imageUrls: string[];
}): Promise<{ id: number; flagged: boolean; reason: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const combined = `${input.title}\n${input.body}\n${input.tags.join(" ")}`;
  const { flagged, reason } = checkForbidden(combined);

  const result: any = await db.insert(collectionPosts).values({
    userId: input.userId,
    title: input.title,
    body: input.body,
    intent: input.intent,
    tagsJson: JSON.stringify(input.tags || []),
    isHidden: flagged ? 1 : 0,
    isFlagged: flagged ? 1 : 0,
    flagReason: flagged ? reason.slice(0, 500) : null,
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
}) {
  const db = await getDb();
  if (!db) return { items: [], nextCursor: null as number | null };

  const conds: any[] = [];
  if (!input.viewerIsAdmin) conds.push(sql`cp.isHidden = 0`);
  if (input.intent !== "all") conds.push(sql`cp.intent = ${input.intent}`);
  if (input.search && input.search.trim()) {
    const kw = `%${input.search.trim()}%`;
    conds.push(sql`(cp.title LIKE ${kw} OR cp.body LIKE ${kw})`);
  }
  if (input.authorId) conds.push(sql`cp.userId = ${input.authorId}`);
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
      cp.createdAt,
      u.name AS authorName,
      u.photoUrl AS authorPhoto,
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

  // author info
  const authorRowsRaw: any = await db.execute(sql`SELECT id, name, photoUrl FROM users WHERE id = ${post.userId} LIMIT 1`);
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

  return {
    ...post,
    tags: safeParseTags(post.tagsJson),
    images,
    author,
    authorIsMerchant,
    isLiked,
    isSaved,
  };
}

export async function listCollectionPostComments(postId: number, viewerIsAdmin: boolean) {
  const db = await getDb();
  if (!db) return [];
  const rowsRaw: any = await db.execute(sql`
    SELECT
      c.id, c.postId, c.userId, c.content, c.isHidden, c.isFlagged, c.createdAt,
      u.name AS authorName, u.photoUrl AS authorPhoto
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

export async function toggleCollectionPostLike(postId: number, userId: number): Promise<{ isLiked: boolean }> {
  const db = await getDb();
  if (!db) return { isLiked: false };
  const existing: any[] = await db
    .select()
    .from(collectionPostLikes)
    .where(and(eq(collectionPostLikes.postId, postId), eq(collectionPostLikes.userId, userId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(collectionPostLikes).where(and(eq(collectionPostLikes.postId, postId), eq(collectionPostLikes.userId, userId)));
    try { await db.execute(sql`UPDATE collectionPosts SET likeCount = GREATEST(likeCount - 1, 0) WHERE id = ${postId}`); } catch { /* ignore */ }
    return { isLiked: false };
  } else {
    await db.insert(collectionPostLikes).values({ postId, userId });
    try { await db.execute(sql`UPDATE collectionPosts SET likeCount = likeCount + 1 WHERE id = ${postId}`); } catch { /* ignore */ }
    return { isLiked: true };
  }
}

export async function toggleCollectionPostSave(postId: number, userId: number): Promise<{ isSaved: boolean }> {
  const db = await getDb();
  if (!db) return { isSaved: false };
  const existing: any[] = await db
    .select()
    .from(collectionPostSaves)
    .where(and(eq(collectionPostSaves.postId, postId), eq(collectionPostSaves.userId, userId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(collectionPostSaves).where(and(eq(collectionPostSaves.postId, postId), eq(collectionPostSaves.userId, userId)));
    return { isSaved: false };
  } else {
    await db.insert(collectionPostSaves).values({ postId, userId });
    return { isSaved: true };
  }
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

export async function adminCountFlagged(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rowsRaw: any = await db.execute(sql`SELECT COUNT(*) AS cnt FROM collectionPosts WHERE isFlagged = 1`);
  const rows = (Array.isArray(rowsRaw) ? rowsRaw[0] : rowsRaw) as any[];
  return Number(rows?.[0]?.cnt ?? 0);
}
