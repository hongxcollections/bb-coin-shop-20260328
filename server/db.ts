import { eq, desc, asc, and, gte, lte, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { InsertUser, users, auctions, InsertAuction, auctionImages, InsertAuctionImage, bids, InsertBid, Auction, proxyBids, proxyBidLogs, notificationSettings, NotificationSettings } from "../drizzle/schema";
import { ENV } from './_core/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Parse DATABASE_URL and add proper SSL config for TiDB Cloud
      const url = new URL(process.env.DATABASE_URL);
      const pool = createPool({
        host: url.hostname,
        port: parseInt(url.port || "4000"),
        user: url.username,
        password: url.password || undefined,
        database: url.pathname.slice(1),
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserNotificationPrefs(
  userId: number,
  prefs: { notifyOutbid?: number; notifyWon?: number; notifyEndingSoon?: number }
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.update(users).set(prefs).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error('[Database] Failed to update notification prefs:', error);
    return false;
  }
}

export async function getAuctions(limit = 20, offset = 0) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        description: auctions.description,
        startingPrice: auctions.startingPrice,
        currentPrice: auctions.currentPrice,
        highestBidderId: auctions.highestBidderId,
        highestBidderName: users.name,
        endTime: auctions.endTime,
        status: auctions.status,
        fbPostUrl: auctions.fbPostUrl,
        bidIncrement: auctions.bidIncrement,
        currency: auctions.currency,
        createdBy: auctions.createdBy,
        createdAt: auctions.createdAt,
        updatedAt: auctions.updatedAt,
      })
      .from(auctions)
      .leftJoin(users, eq(auctions.highestBidderId, users.id))
      .orderBy(
        // active auctions first (0), others last (1)
        sql`CASE WHEN ${auctions.status} = 'active' THEN 0 ELSE 1 END`,
        // among active: soonest ending first
        sql`CASE WHEN ${auctions.status} = 'active' THEN ${auctions.endTime} ELSE NULL END`,
        // among non-active: newest first
        desc(auctions.createdAt)
      )
      .limit(limit)
      .offset(offset);
    return result;
  } catch (error) {
    console.error('[Database] Failed to get auctions:', error);
    return [];
  }
}

export async function getAuctionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, id))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error('[Database] Failed to get auction:', error);
    return undefined;
  }
}

export async function getAuctionImages(auctionId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(auctionImages)
      .where(eq(auctionImages.auctionId, auctionId))
      .orderBy(auctionImages.displayOrder);
    return result;
  } catch (error) {
    console.error('[Database] Failed to get auction images:', error);
    return [];
  }
}

export async function getBidHistory(auctionId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: bids.id,
        auctionId: bids.auctionId,
        userId: bids.userId,
        bidAmount: bids.bidAmount,
        createdAt: bids.createdAt,
        username: users.name,
        memberLevel: users.memberLevel,
      })
      .from(bids)
      .leftJoin(users, eq(bids.userId, users.id))
      .where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get bid history:', error);
    return [];
  }
}

export async function getUserBids(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: bids.id,
        auctionId: bids.auctionId,
        bidAmount: bids.bidAmount,
        createdAt: bids.createdAt,
        auctionTitle: auctions.title,
      })
      .from(bids)
      .leftJoin(auctions, eq(bids.auctionId, auctions.id))
      .where(eq(bids.userId, userId))
      .orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get user bids:', error);
    return [];
  }
}

export async function getUserBidsGrouped(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get all bids with auction info, ordered newest first
    const rows = await db
      .select({
        id: bids.id,
        auctionId: bids.auctionId,
        bidAmount: bids.bidAmount,
        createdAt: bids.createdAt,
        auctionTitle: auctions.title,
        auctionStatus: auctions.status,
        auctionEndTime: auctions.endTime,
        auctionCurrency: auctions.currency,
      })
      .from(bids)
      .leftJoin(auctions, eq(bids.auctionId, auctions.id))
      .where(eq(bids.userId, userId))
      .orderBy(desc(bids.createdAt));

    // For each unique auctionId, find the highest bidder
    const auctionIds = Array.from(new Set<number>(rows.map((r: { auctionId: number | null }) => r.auctionId).filter((id: number | null): id is number => id !== null)));
    const winnerMap = new Map<number, number>(); // auctionId -> highest bidder userId
    if (auctionIds.length > 0) {
      for (const aId of auctionIds) {
        const topBid = await db
          .select({ userId: bids.userId, bidAmount: bids.bidAmount })
          .from(bids)
          .where(eq(bids.auctionId, aId))
          .orderBy(desc(bids.bidAmount), desc(bids.createdAt))
          .limit(1);
        if (topBid[0]?.userId !== null && topBid[0]?.userId !== undefined) {
          winnerMap.set(aId, topBid[0].userId);
        }
      }
    }

    // Group by auctionId, preserving insertion order (newest bid first per group)
    const groupMap = new Map<number, {
      auctionId: number;
      auctionTitle: string | null;
      auctionStatus: string | null;
      auctionEndTime: number | null;
      auctionCurrency: string | null;
      latestBid: number;
      latestBidAt: Date | null;
      totalBids: number;
      isWinner: boolean;
      bids: Array<{ id: number; bidAmount: number; createdAt: Date | null }>;
    }>();

    for (const row of rows) {
      const key = row.auctionId ?? 0;
      if (!groupMap.has(key)) {
        // isWinner: auction ended AND this user is the highest bidder
        const auctionEnded = (row.auctionStatus === 'ended') ||
          (row.auctionEndTime !== null && row.auctionEndTime < Date.now());
        const isWinner = auctionEnded && winnerMap.get(key) === userId;
        groupMap.set(key, {
          auctionId: key,
          auctionTitle: row.auctionTitle ?? null,
          auctionStatus: row.auctionStatus ?? null,
          auctionEndTime: row.auctionEndTime ?? null,
          auctionCurrency: row.auctionCurrency ?? null,
          latestBid: row.bidAmount ?? 0,
          latestBidAt: row.createdAt ?? null,
          totalBids: 0,
          isWinner,
          bids: [],
        });
      }
      const group = groupMap.get(key)!;
      group.totalBids++;
      group.bids.push({ id: row.id, bidAmount: row.bidAmount ?? 0, createdAt: row.createdAt ?? null });
    }

    // Return as array sorted by latestBidAt descending
    return Array.from(groupMap.values()).sort(
      (a, b) => (b.latestBidAt?.getTime() ?? 0) - (a.latestBidAt?.getTime() ?? 0)
    );
  } catch (error) {
    console.error('[Database] Failed to get grouped user bids:', error);
    return [];
  }
}

export async function createAuction(data: InsertAuction) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db.insert(auctions).values(data);
    const insertedAuction = await db.select().from(auctions).where(eq(auctions.title, data.title)).orderBy(desc(auctions.createdAt)).limit(1);
    if (!insertedAuction[0]) {
      throw new Error('Failed to retrieve created auction');
    }
    return insertedAuction[0];
  } catch (error) {
    console.error('[Database] Failed to create auction:', error);
    throw error;
  }
}

export async function updateAuction(id: number, data: Partial<InsertAuction>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db
      .update(auctions)
      .set(data)
      .where(eq(auctions.id, id));
    return result;
  } catch (error) {
    console.error('[Database] Failed to update auction:', error);
    throw error;
  }
}

export async function deleteAuction(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await db.delete(auctionImages).where(eq(auctionImages.auctionId, id));
    await db.delete(bids).where(eq(bids.auctionId, id));
    const result = await db.delete(auctions).where(eq(auctions.id, id));
    return result;
  } catch (error) {
    console.error('[Database] Failed to delete auction:', error);
    throw error;
  }
}

export async function addAuctionImage(data: InsertAuctionImage) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db.insert(auctionImages).values(data);
    return result;
  } catch (error) {
    console.error('[Database] Failed to add auction image:', error);
    throw error;
  }
}

export async function deleteAuctionImage(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db.delete(auctionImages).where(eq(auctionImages.id, imageId));
    return result;
  } catch (error) {
    console.error('[Database] Failed to delete auction image:', error);
    throw error;
  }
}

export async function placeBid(data: InsertBid) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db.insert(bids).values(data);
    return result;
  } catch (error) {
    console.error('[Database] Failed to place bid:', error);
    throw error;
  }
}

export async function getAuctionsByCreator(userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        description: auctions.description,
        startingPrice: auctions.startingPrice,
        currentPrice: auctions.currentPrice,
        highestBidderId: auctions.highestBidderId,
        highestBidderName: users.name,
        endTime: auctions.endTime,
        status: auctions.status,
        fbPostUrl: auctions.fbPostUrl,
        bidIncrement: auctions.bidIncrement,
        currency: auctions.currency,
        createdBy: auctions.createdBy,
        createdAt: auctions.createdAt,
        updatedAt: auctions.updatedAt,
        relistSourceId: auctions.relistSourceId,
      })
      .from(auctions)
      .leftJoin(users, eq(auctions.highestBidderId, users.id))
      .where(and(eq(auctions.createdBy, userId), eq(auctions.archived, 0)))
      .orderBy(
        sql`CASE WHEN ${auctions.status} = 'active' THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${auctions.status} = 'active' THEN ${auctions.endTime} ELSE NULL END`,
        desc(auctions.createdAt)
      );
    return result;
  } catch (error) {
    console.error('[Database] Failed to get auctions by creator:', error);
    return [];
  }
}

const ARCHIVED_SELECT = {
  id: auctions.id,
  title: auctions.title,
  description: auctions.description,
  startingPrice: auctions.startingPrice,
  currentPrice: auctions.currentPrice,
  highestBidderId: auctions.highestBidderId,
  highestBidderName: users.name,
  endTime: auctions.endTime,
  status: auctions.status,
  fbPostUrl: auctions.fbPostUrl,
  bidIncrement: auctions.bidIncrement,
  currency: auctions.currency,
  category: auctions.category,
  createdBy: auctions.createdBy,
  createdAt: auctions.createdAt,
  updatedAt: auctions.updatedAt,
  archivedAt: auctions.archivedAt,
  relistSourceId: auctions.relistSourceId,
  archived: auctions.archived,
} as const;

export async function getArchivedAuctions() {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select(ARCHIVED_SELECT)
      .from(auctions)
      .leftJoin(users, eq(auctions.highestBidderId, users.id))
      .where(eq(auctions.archived, 1))
      .orderBy(desc(auctions.archivedAt), desc(auctions.updatedAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get archived auctions:', error);
    return [];
  }
}

export type ArchivedFilter = {
  // Accept string so callers don't need to cast to the narrow enum type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  category?: any;
  dateFrom?: Date;
  dateTo?: Date;
};

export async function getArchivedAuctionsFiltered(filter: ArchivedFilter) {
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [eq(auctions.archived, 1)];
    if (filter.category) {
      conditions.push(sql`${auctions.category} = ${filter.category}`);
    }
    if (filter.dateFrom) {
      conditions.push(gte(auctions.archivedAt, filter.dateFrom));
    }
    if (filter.dateTo) {
      // include the whole day of dateTo
      const endOfDay = new Date(filter.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(auctions.archivedAt, endOfDay));
    }

    const result = await db
      .select(ARCHIVED_SELECT)
      .from(auctions)
      .leftJoin(users, eq(auctions.highestBidderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auctions.archivedAt), desc(auctions.updatedAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get filtered archived auctions:', error);
    return [];
  }
}

export async function getDraftAuctions() {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'draft'))
      .orderBy(desc(auctions.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get draft auctions:', error);
    return [];
  }
}

// ── Proxy Bids ──────────────────────────────────────────────────────────────

/**
 * Set or update a user's proxy bid for an auction.
 * Uses INSERT ... ON DUPLICATE KEY UPDATE to upsert.
 */
export async function setProxyBid(auctionId: number, userId: number, maxAmount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .insert(proxyBids)
      .values({ auctionId, userId, maxAmount: maxAmount.toString(), isActive: 1 })
      .onDuplicateKeyUpdate({ set: { maxAmount: maxAmount.toString(), isActive: 1, updatedAt: new Date() } });
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to set proxy bid:", error);
    throw error;
  }
}

/**
 * Get a user's active proxy bid for a specific auction.
 */
export async function getProxyBid(auctionId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(proxyBids)
      .where(and(eq(proxyBids.auctionId, auctionId), eq(proxyBids.userId, userId), eq(proxyBids.isActive, 1)))
      .limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("[Database] Failed to get proxy bid:", error);
    return null;
  }
}

/**
 * Get all active proxy bids for an auction, ordered by maxAmount descending.
 * Excludes the current highest bidder to find competing proxies.
 */
export async function getActiveProxiesForAuction(auctionId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(proxyBids)
      .where(and(eq(proxyBids.auctionId, auctionId), eq(proxyBids.isActive, 1)))
      .orderBy(desc(proxyBids.maxAmount));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get active proxies:", error);
    return [];
  }
}

/**
 * Deactivate a user's proxy bid (e.g. when auction ends or user cancels).
 */
export async function deactivateProxyBid(auctionId: number, userId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(proxyBids)
      .set({ isActive: 0 })
      .where(and(eq(proxyBids.auctionId, auctionId), eq(proxyBids.userId, userId)));
  } catch (error) {
    console.error("[Database] Failed to deactivate proxy bid:", error);
  }
}

// ── Proxy Bid Logs ──────────────────────────────────────────────────────────

/**
 * Insert a proxy bid log entry when the engine fires an automatic bid.
 */
export async function insertProxyBidLog(entry: {
  auctionId: number;
  round: number;
  triggerUserId: number;
  triggerAmount: number;
  proxyUserId: number;
  proxyAmount: number;
}) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(proxyBidLogs).values({
      auctionId: entry.auctionId,
      round: entry.round,
      triggerUserId: entry.triggerUserId,
      triggerAmount: entry.triggerAmount.toString(),
      proxyUserId: entry.proxyUserId,
      proxyAmount: entry.proxyAmount.toString(),
    });
  } catch (error) {
    console.error("[Database] Failed to insert proxy bid log:", error);
  }
}

/**
 * Get all proxy bid logs for an auction, joined with user names.
 */
export async function getProxyBidLogs(auctionId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const triggerUser = { id: users.id, name: users.name };
    // Use two separate queries and join in memory to avoid complex alias issues
    const logs = await db
      .select({
        id: proxyBidLogs.id,
        auctionId: proxyBidLogs.auctionId,
        round: proxyBidLogs.round,
        triggerUserId: proxyBidLogs.triggerUserId,
        triggerAmount: proxyBidLogs.triggerAmount,
        proxyUserId: proxyBidLogs.proxyUserId,
        proxyAmount: proxyBidLogs.proxyAmount,
        createdAt: proxyBidLogs.createdAt,
      })
      .from(proxyBidLogs)
      .where(eq(proxyBidLogs.auctionId, auctionId))
      .orderBy(desc(proxyBidLogs.createdAt));

    if (logs.length === 0) return [];

    // Collect unique user IDs and fetch names
    const allUserIds = logs.flatMap((l: { triggerUserId: number; proxyUserId: number }) => [l.triggerUserId, l.proxyUserId]);
    const userIds = Array.from(new Set(allUserIds));

    // Guard: avoid IN () which causes SQL error
    if (userIds.length === 0) return logs.map((log: { triggerUserId: number; proxyUserId: number; id: number; auctionId: number; round: number; triggerAmount: string; proxyAmount: string; createdAt: Date }) => ({
      ...log,
      triggerUserName: `用戶 ${log.triggerUserId}`,
      proxyUserName: `用戶 ${log.proxyUserId}`,
    }));
    const userRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);

    const userMap = new Map(userRows.map((u: { id: number; name: string | null }) => [u.id, u.name ?? `用戶 ${u.id}`]));

    return logs.map((log: { triggerUserId: number; proxyUserId: number; id: number; auctionId: number; round: number; triggerAmount: string; proxyAmount: string; createdAt: Date }) => ({
      ...log,
      triggerUserName: userMap.get(log.triggerUserId) ?? `用戶 ${log.triggerUserId}`,
      proxyUserName: userMap.get(log.proxyUserId) ?? `用戶 ${log.proxyUserId}`,
    }));
  } catch (error) {
    console.error("[Database] Failed to get proxy bid logs:", error);
    return [];
  }
}

// ─── Notification Settings ────────────────────────────────────────────────────

export async function getNotificationSettings(): Promise<NotificationSettings | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(notificationSettings).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error("[Database] Failed to get notification settings:", error);
    return null;
  }
}

export async function upsertNotificationSettings(data: Partial<Omit<NotificationSettings, "id" | "updatedAt">>): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    // Always operate on row id=1 (single-row config)
    await db
      .insert(notificationSettings)
      .values({ id: 1, senderName: "大BB錢幣店", senderEmail: "ywkyee@gmail.com", ...data })
      .onDuplicateKeyUpdate({ set: data });
    return true;
  } catch (error) {
    console.error("[Database] Failed to upsert notification settings:", error);
    return false;
  }
}

// ─── Bidders for auction (for ending-soon notifications) ─────────────────────

export async function getBiddersForAuction(auctionId: number): Promise<{ userId: number; email: string | null; name: string | null }[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .selectDistinct({ userId: bids.userId, email: users.email, name: users.name })
      .from(bids)
      .innerJoin(users, eq(bids.userId, users.id))
      .where(eq(bids.auctionId, auctionId));
    return rows;
  } catch (error) {
    console.error("[Database] Failed to get bidders for auction:", error);
    return [];
  }
}

export async function updateUserEmail(userId: number, email: string): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.update(users).set({ email }).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update user email:", error);
    return false;
  }
}

/**
 * Get all active auctions that are ending within the given number of minutes.
 * Used by the scheduler to trigger ending-soon notifications.
 */
export async function getActiveAuctionsEndingSoon(withinMinutes: number): Promise<{ id: number; title: string }[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const now = new Date();
    const threshold = new Date(now.getTime() + withinMinutes * 60 * 1000);
    const rows = await db
      .select({ id: auctions.id, title: auctions.title })
      .from(auctions)
      .where(
        and(
          eq(auctions.status, 'active'),
          eq(auctions.archived, 0),
          lte(auctions.endTime, threshold),
          gt(auctions.endTime, now)
        )
      );
    return rows;
  } catch (error) {
    console.error("[Database] Failed to get auctions ending soon:", error);
    return [];
  }
}

export async function getUserPublicStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get user basic info
    const userRows = await db
      .select({ id: users.id, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRows.length === 0) return null;
    const user = userRows[0];

    // Count distinct auctions the user has bid on
    const bidCountRows = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${bids.auctionId})` })
      .from(bids)
      .where(eq(bids.userId, userId));
    const auctionsParticipated = Number(bidCountRows[0]?.count ?? 0);

    // Count auctions won (ended auctions where user is highest bidder)
    const wonRows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auctions)
      .where(
        and(
          eq(auctions.highestBidderId, userId),
          eq(auctions.status, 'ended')
        )
      );
    const auctionsWon = Number(wonRows[0]?.count ?? 0);

    return {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      auctionsParticipated,
      auctionsWon,
    };
  } catch (error) {
    console.error('[Database] Failed to get user public stats:', error);
    return null;
  }
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        memberLevel: users.memberLevel,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get all users:', error);
    return [];
  }
}

export async function setUserMemberLevel(userId: number, memberLevel: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.update(users).set({ memberLevel } as Record<string, unknown>).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error('[Database] Failed to set member level:', error);
    return false;
  }
}
