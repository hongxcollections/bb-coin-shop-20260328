import { eq, desc, asc, and, gte, lte, gt, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { InsertUser, users, auctions, InsertAuction, auctionImages, InsertAuctionImage, bids, InsertBid, Auction, proxyBids, proxyBidLogs, notificationSettings, NotificationSettings, favorites, siteSettings, sellerDeposits, depositTransactions, subscriptionPlans, userSubscriptions, merchantApplications, InsertMerchantApplication } from "../drizzle/schema";
import { ENV } from './_core/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const dbUrl = ENV.databaseUrl || process.env.DATABASE_URL || "";
  if (!_db && dbUrl) {
    try {
      // Parse database URL and add proper SSL config for TiDB Cloud / Railway MySQL
      const url = new URL(dbUrl);
      const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      const pool = createPool({
        host: url.hostname,
        port: parseInt(url.port || (isLocalhost ? "3306" : "4000")),
        user: url.username,
        password: url.password || undefined,
        database: url.pathname.slice(1),
        ssl: isLocalhost ? undefined : { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 20,
        queueLimit: 0,
        connectTimeout: 10000,
        idleTimeout: 60000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
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

export async function getAuctions(limit = 20, offset = 0, category?: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    const baseQuery = db
      .select({
        id: auctions.id,
        title: auctions.title,
        description: auctions.description,
        startingPrice: auctions.startingPrice,
        currentPrice: auctions.currentPrice,
        highestBidderId: auctions.highestBidderId,
        highestBidderName: users.name,
        sellerName: sql<string | null>`(SELECT name FROM users WHERE id = ${auctions.createdBy})`,
        endTime: auctions.endTime,
        status: auctions.status,
        fbPostUrl: auctions.fbPostUrl,
        bidIncrement: auctions.bidIncrement,
        currency: auctions.currency,
        category: auctions.category,
        createdBy: auctions.createdBy,
        createdAt: auctions.createdAt,
        updatedAt: auctions.updatedAt,
      })
      .from(auctions)
      .leftJoin(users, eq(auctions.highestBidderId, users.id));

    const conditions = [
      sql`${auctions.status} != 'draft'`,
      sql`${auctions.archived} = 0`,
    ];
    if (category && category !== 'all') {
      conditions.push(sql`${auctions.category} = ${category}`);
    }

    const result = await baseQuery
      .where(and(...conditions))
      .orderBy(
        sql`CASE WHEN ${auctions.status} = 'active' THEN 0 ELSE 1 END`,
        sql`CASE WHEN ${auctions.status} = 'active' THEN ${auctions.endTime} ELSE NULL END`,
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
      .select({
        id: auctions.id,
        title: auctions.title,
        description: auctions.description,
        startingPrice: auctions.startingPrice,
        currentPrice: auctions.currentPrice,
        highestBidderId: auctions.highestBidderId,
        sellerName: sql<string | null>`(SELECT name FROM users WHERE id = ${auctions.createdBy})`,
        endTime: auctions.endTime,
        status: auctions.status,
        fbPostUrl: auctions.fbPostUrl,
        bidIncrement: auctions.bidIncrement,
        currency: auctions.currency,
        category: auctions.category,
        createdBy: auctions.createdBy,
        createdAt: auctions.createdAt,
        updatedAt: auctions.updatedAt,
        antiSnipeEnabled: auctions.antiSnipeEnabled,
        antiSnipeMinutes: auctions.antiSnipeMinutes,
        extendMinutes: auctions.extendMinutes,
        antiSnipeMemberLevels: auctions.antiSnipeMemberLevels,
        archived: auctions.archived,
      })
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
        isAnonymous: bids.isAnonymous,
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

    // For each unique auctionId, find the highest bidder using a single batch query
    const auctionIds = Array.from(new Set<number>(rows.map((r: { auctionId: number | null }) => r.auctionId).filter((id: number | null): id is number => id !== null)));
    const winnerMap = new Map<number, number>(); // auctionId -> highest bidder userId
    if (auctionIds.length > 0) {
      // Single batch query: get highest bid per auction using GROUP BY
      const topBids = await db
        .select({
          auctionId: bids.auctionId,
          userId: bids.userId,
          maxBid: sql<string>`MAX(${bids.bidAmount})`,
        })
        .from(bids)
        .where(inArray(bids.auctionId, auctionIds))
        .groupBy(bids.auctionId, bids.userId);
      // For each auction, find the userId with the highest bid
      const auctionMaxBid = new Map<number, number>(); // auctionId -> maxBid
      for (const row of topBids) {
        if (row.auctionId === null) continue;
        const bid = parseFloat(row.maxBid);
        const existing = auctionMaxBid.get(row.auctionId);
        if (existing === undefined || bid > existing) {
          auctionMaxBid.set(row.auctionId, bid);
          winnerMap.set(row.auctionId, row.userId);
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

export async function getAnonymousBids(options?: { page?: number; pageSize?: number }) {
  const db = await getDb();
  if (!db) return { bids: [], total: 0 };

  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  try {
    const result = await db
      .select({
        id: bids.id,
        auctionId: bids.auctionId,
        auctionTitle: auctions.title,
        userId: bids.userId,
        username: users.name,
        userEmail: users.email,
        memberLevel: users.memberLevel,
        bidAmount: bids.bidAmount,
        createdAt: bids.createdAt,
        isAnonymous: bids.isAnonymous,
      })
      .from(bids)
      .leftJoin(users, eq(bids.userId, users.id))
      .leftJoin(auctions, eq(bids.auctionId, auctions.id))
      .where(eq(bids.isAnonymous, 1))
      .orderBy(desc(bids.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Count total
    const countResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(bids)
      .where(eq(bids.isAnonymous, 1));
    const total = Number((countResult[0] as { count: unknown })?.count ?? 0);

    return { bids: result, total };
  } catch (error) {
    console.error('[Database] Failed to get anonymous bids:', error);
    return { bids: [], total: 0 };
  }
}

/** Close expired auctions: set status='ended' for all active auctions past endTime.
 *  Returns the list of auction IDs that were just closed. */
export async function closeExpiredAuctions(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const now = new Date();
    // Find active auctions whose endTime has passed
    const expired = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(
        and(
          eq(auctions.status, 'active'),
          sql`${auctions.endTime} <= ${now}`
        )
      );
    if (expired.length === 0) return [];

    const ids = expired.map((a: { id: number }) => a.id);
    await db
      .update(auctions)
      .set({ status: 'ended', updatedAt: now })
      .where(inArray(auctions.id, ids));

    return ids;
  } catch (error) {
    console.error('[Database] Failed to close expired auctions:', error);
    return [];
  }
}

/** Dashboard statistics for admin panel */
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Active auctions count
    const activeResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(auctions)
      .where(and(eq(auctions.status, 'active'), sql`${auctions.endTime} > ${now}`));
    const activeCount = Number((activeResult[0] as { count: unknown })?.count ?? 0);

    // Total ended auctions
    const endedResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(auctions)
      .where(eq(auctions.status, 'ended'));
    const endedCount = Number((endedResult[0] as { count: unknown })?.count ?? 0);

    // Total bids count
    const bidCountResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(bids);
    const totalBids = Number((bidCountResult[0] as { count: unknown })?.count ?? 0);

    // Total users
    const userCountResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(users);
    const totalUsers = Number((userCountResult[0] as { count: unknown })?.count ?? 0);

    // Bids in last 7 days
    const recentBidsResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(bids)
      .where(sql`${bids.createdAt} >= ${sevenDaysAgo}`);
    const recentBids = Number((recentBidsResult[0] as { count: unknown })?.count ?? 0);

    // Total transaction value (sum of currentPrice for ended auctions)
    const totalValueResult = await db
      .select({ total: sql`COALESCE(SUM(${auctions.currentPrice}), 0)` })
      .from(auctions)
      .where(eq(auctions.status, 'ended'));
    const totalValue = Number((totalValueResult[0] as { total: unknown })?.total ?? 0);

    // Recent 7-day transaction value
    const recentValueResult = await db
      .select({ total: sql`COALESCE(SUM(${auctions.currentPrice}), 0)` })
      .from(auctions)
      .where(and(eq(auctions.status, 'ended'), sql`${auctions.updatedAt} >= ${sevenDaysAgo}`));
    const recentValue = Number((recentValueResult[0] as { total: unknown })?.total ?? 0);

    // Top 5 most-bid auctions
    const topAuctions = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        currentPrice: auctions.currentPrice,
        status: auctions.status,
        bidCount: sql`COUNT(${bids.id})`,
      })
      .from(auctions)
      .leftJoin(bids, eq(bids.auctionId, auctions.id))
      .groupBy(auctions.id)
      .orderBy(desc(sql`COUNT(${bids.id})`))
      .limit(5);

    // Bids per day for last 7 days
    const bidsPerDay = await db
      .select({
        day: sql`DATE(${bids.createdAt})`,
        count: sql`COUNT(*)`,
      })
      .from(bids)
      .where(sql`${bids.createdAt} >= ${sevenDaysAgo}`)
      .groupBy(sql`DATE(${bids.createdAt})`)
      .orderBy(sql`DATE(${bids.createdAt})`);

    return {
      activeCount,
      endedCount,
      totalBids,
      totalUsers,
      recentBids,
      totalValue,
      recentValue,
      topAuctions,
      bidsPerDay,
    };
  } catch (error) {
    console.error('[Database] Failed to get dashboard stats:', error);
    return null;
  }
}

// ── Favorites ──────────────────────────────────────────────────────────────

export async function toggleFavorite(userId: number, auctionId: number): Promise<{ isFavorited: boolean }> {
  const db = await getDb();
  if (!db) return { isFavorited: false };
  try {
    const existing = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.auctionId, auctionId)))
      .limit(1);
    if (existing.length > 0) {
      await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.auctionId, auctionId)));
      return { isFavorited: false };
    } else {
      await db.insert(favorites).values({ userId, auctionId });
      return { isFavorited: true };
    }
  } catch (error) {
    console.error('[Database] Failed to toggle favorite:', error);
    return { isFavorited: false };
  }
}

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        currentPrice: auctions.currentPrice,
        endTime: auctions.endTime,
        status: auctions.status,
        currency: auctions.currency,
        category: auctions.category,
        favoritedAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(auctions, eq(favorites.auctionId, auctions.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get user favorites:', error);
    return [];
  }
}

export async function getFavoriteIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({ auctionId: favorites.auctionId })
      .from(favorites)
      .where(eq(favorites.userId, userId));
    return result.map((r: { auctionId: number }) => r.auctionId);
  } catch (error) {
    console.error('[Database] Failed to get favorite ids:', error);
    return [];
  }
}

// 查詢用戶得標記錄（已結束且自己是最高出價者）
export async function getMyWonAuctions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        description: auctions.description,
        currentPrice: auctions.currentPrice,
        startingPrice: auctions.startingPrice,
        currency: auctions.currency,
        endTime: auctions.endTime,
        status: auctions.status,
        category: auctions.category,
        bidCount: sql<number>`(SELECT COUNT(*) FROM bids WHERE bids.auctionId = ${auctions.id})`,
        winningAmount: sql<string>`(SELECT bidAmount FROM bids WHERE bids.auctionId = ${auctions.id} ORDER BY bidAmount DESC, createdAt ASC LIMIT 1)`,
        paymentStatus: auctions.paymentStatus,
      })
      .from(auctions)
      .where(
        and(
          eq(auctions.status, 'ended'),
          sql`(SELECT userId FROM bids WHERE bids.auctionId = ${auctions.id} ORDER BY bidAmount DESC, createdAt ASC LIMIT 1) = ${userId}`
        )
      )
      .orderBy(desc(auctions.endTime));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get won auctions:', error);
    return [];
  }
}

// 匯出指定拍賣的所有出價記錄（管理員用）
export async function getAllBidsForExport(auctionId?: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        bidId: bids.id,
        auctionId: bids.auctionId,
        auctionTitle: auctions.title,
        userId: bids.userId,
        username: users.name,
        bidAmount: bids.bidAmount,
        currency: auctions.currency,
        isAnonymous: bids.isAnonymous,
        createdAt: bids.createdAt,
      })
      .from(bids)
      .innerJoin(auctions, eq(bids.auctionId, auctions.id))
      .innerJoin(users, eq(bids.userId, users.id))
      .where(auctionId ? eq(bids.auctionId, auctionId) : sql`1=1`)
      .orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to export bids:', error);
    return [];
  }
}

// ── Site Settings ──────────────────────────────────────────────────────────
export async function getSiteSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    return result.length > 0 ? result[0].value : null;
  } catch (error) {
    console.error('[Database] Failed to get site setting:', error);
    return null;
  }
}

export async function setSiteSetting(key: string, value: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(siteSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    return true;
  } catch (error) {
    console.error('[Database] Failed to set site setting:', error);
    return false;
  }
}

export async function getAllSiteSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db.select().from(siteSettings);
    return Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
  } catch (error) {
    console.error('[Database] Failed to get all site settings:', error);
    return {};
  }
}

// 商戶查看自己拍賣的得標訂單
export async function getWonOrdersByCreator(creatorId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        currentPrice: auctions.currentPrice,
        currency: auctions.currency,
        endTime: auctions.endTime,
        paymentStatus: auctions.paymentStatus,
        winnerName: sql<string>`(SELECT u.name FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
        winnerOpenId: sql<string>`(SELECT u.openId FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
        winnerPhone: sql<string>`(SELECT u.phone FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
        winningAmount: sql<string>`(SELECT b.bidAmount FROM bids b WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
      })
      .from(auctions)
      .where(and(eq(auctions.status, 'ended'), eq(auctions.createdBy, creatorId), eq(auctions.archived, 0)))
      .orderBy(desc(auctions.endTime));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get won orders by creator:', error);
    return [];
  }
}

// 管理員查看所有得標訂單
export async function getWonOrders() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: auctions.id,
        title: auctions.title,
        currentPrice: auctions.currentPrice,
        currency: auctions.currency,
        endTime: auctions.endTime,
        paymentStatus: auctions.paymentStatus,
        winnerName: sql<string>`(SELECT u.name FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
        winnerOpenId: sql<string>`(SELECT u.openId FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
        winningAmount: sql<string>`(SELECT b.bidAmount FROM bids b WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
      })
      .from(auctions)
      .where(eq(auctions.status, 'ended'))
      .orderBy(desc(auctions.endTime));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get won orders:', error);
    return [];
  }
}

// 更新付款狀態
export async function updatePaymentStatus(
  auctionId: number,
  status: 'pending_payment' | 'paid' | 'delivered',
  userId: number,
  isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database unavailable' };
  try {
    // 取得拍賣資料
    const [auction] = await db.select({
      id: auctions.id,
      status: auctions.status,
      paymentStatus: auctions.paymentStatus,
      highestBidderId: auctions.highestBidderId,
    }).from(auctions).where(eq(auctions.id, auctionId)).limit(1);

    if (!auction) return { success: false, error: '拍賣不存在' };
    if (auction.status !== 'ended') return { success: false, error: '拍賣尚未結束' };

    // 確認得標者
    const [topBid] = await db.select({ userId: bids.userId })
      .from(bids)
      .where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.bidAmount), asc(bids.createdAt))
      .limit(1);

    if (!topBid) return { success: false, error: '找不到得標記錄' };

    // 權限控制：買家只能標記 pending_payment → paid，管理員可設定任何狀態
    if (!isAdmin) {
      if (topBid.userId !== userId) return { success: false, error: '您不是此拍賣的得標者' };
      if (status !== 'paid') return { success: false, error: '買家只能標記「已付款」' };
      if (auction.paymentStatus === 'delivered') return { success: false, error: '訂單已完成，無法修改' };
    }

    await db.update(auctions).set({ paymentStatus: status }).where(eq(auctions.id, auctionId));
    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to update payment status:', error);
    return { success: false, error: '更新失敗，請稍後再試' };
  }
}

// ── Seller Deposits (保證金) ──────────────────────────────────────────────

/**
 * Auto-create tables for seller deposits if they don't exist.
 * Called once on first access.
 */
let _depositTablesChecked = false;
async function ensureDepositTables() {
  if (_depositTablesChecked) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seller_deposits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        requiredDeposit DECIMAL(12,2) NOT NULL DEFAULT 500.00,
        commissionRate DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
        isActive INT NOT NULL DEFAULT 1,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS deposit_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        depositId INT NOT NULL,
        userId INT NOT NULL,
        type ENUM('top_up','commission','refund','adjustment') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        balanceAfter DECIMAL(12,2) NOT NULL,
        description TEXT,
        relatedAuctionId INT,
        createdBy INT,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    _depositTablesChecked = true;
  } catch (error) {
    console.error('[Database] Failed to ensure deposit tables:', error);
  }
}

/**
 * Get or create a seller deposit record for a user.
 */
export async function getOrCreateSellerDeposit(userId: number) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return null;

  try {
    const existing = await db.select().from(sellerDeposits).where(eq(sellerDeposits.userId, userId)).limit(1);
    if (existing.length > 0) return existing[0];

    // Create new deposit record
    await db.insert(sellerDeposits).values({ userId, balance: "0.00", requiredDeposit: "500.00", commissionRate: "0.0500", isActive: 1 });
    const created = await db.select().from(sellerDeposits).where(eq(sellerDeposits.userId, userId)).limit(1);
    return created[0] ?? null;
  } catch (error) {
    console.error('[Database] Failed to get/create seller deposit:', error);
    return null;
  }
}

/**
 * Get all seller deposits (admin view).
 */
export async function getAllSellerDeposits() {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: sellerDeposits.id,
        userId: sellerDeposits.userId,
        userName: users.name,
        userEmail: users.email,
        balance: sellerDeposits.balance,
        requiredDeposit: sellerDeposits.requiredDeposit,
        commissionRate: sellerDeposits.commissionRate,
        isActive: sellerDeposits.isActive,
        createdAt: sellerDeposits.createdAt,
        updatedAt: sellerDeposits.updatedAt,
      })
      .from(sellerDeposits)
      .leftJoin(users, eq(sellerDeposits.userId, users.id))
      .orderBy(desc(sellerDeposits.updatedAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get all seller deposits:', error);
    return [];
  }
}

/**
 * Top up a seller's deposit balance.
 */
export async function topUpDeposit(userId: number, amount: number, description: string, adminId: number) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) throw new Error('Failed to get deposit record');

    const currentBalance = parseFloat(deposit.balance.toString());
    const newBalance = currentBalance + amount;

    await db.update(sellerDeposits).set({ balance: newBalance.toFixed(2) }).where(eq(sellerDeposits.userId, userId));

    await db.insert(depositTransactions).values({
      depositId: deposit.id,
      userId,
      type: 'top_up',
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: description || `充值 $${amount.toFixed(2)}`,
      createdBy: adminId,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('[Database] Failed to top up deposit:', error);
    throw error;
  }
}

/**
 * Deduct commission from a seller's deposit.
 */
export async function deductCommission(userId: number, amount: number, auctionId: number, description: string, adminId?: number) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) throw new Error('Failed to get deposit record');

    const currentBalance = parseFloat(deposit.balance.toString());
    const newBalance = currentBalance - amount;

    await db.update(sellerDeposits).set({ balance: newBalance.toFixed(2) }).where(eq(sellerDeposits.userId, userId));

    await db.insert(depositTransactions).values({
      depositId: deposit.id,
      userId,
      type: 'commission',
      amount: (-amount).toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: description || `佣金扣除 $${amount.toFixed(2)}`,
      relatedAuctionId: auctionId,
      createdBy: adminId ?? null,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('[Database] Failed to deduct commission:', error);
    throw error;
  }
}

/**
 * Refund commission to a seller's deposit.
 */
export async function refundCommission(userId: number, amount: number, auctionId: number, description: string, adminId: number) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) throw new Error('Failed to get deposit record');

    const currentBalance = parseFloat(deposit.balance.toString());
    const newBalance = currentBalance + amount;

    await db.update(sellerDeposits).set({ balance: newBalance.toFixed(2) }).where(eq(sellerDeposits.userId, userId));

    await db.insert(depositTransactions).values({
      depositId: deposit.id,
      userId,
      type: 'refund',
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: description || `佣金退還 $${amount.toFixed(2)}`,
      relatedAuctionId: auctionId,
      createdBy: adminId,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('[Database] Failed to refund commission:', error);
    throw error;
  }
}

/**
 * Update seller deposit settings (required deposit, commission rate, active status).
 */
export async function updateSellerDepositSettings(
  userId: number,
  settings: { requiredDeposit?: number; commissionRate?: number; isActive?: number }
) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return false;

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) return false;

    const updateData: Record<string, unknown> = {};
    if (settings.requiredDeposit !== undefined) updateData.requiredDeposit = settings.requiredDeposit.toFixed(2);
    if (settings.commissionRate !== undefined) updateData.commissionRate = settings.commissionRate.toFixed(4);
    if (settings.isActive !== undefined) updateData.isActive = settings.isActive;

    if (Object.keys(updateData).length > 0) {
      await db.update(sellerDeposits).set(updateData).where(eq(sellerDeposits.userId, userId));
    }
    return true;
  } catch (error) {
    console.error('[Database] Failed to update deposit settings:', error);
    return false;
  }
}

/**
 * Get deposit transactions for a specific user.
 */
export async function getDepositTransactions(userId: number, limit = 50, offset = 0) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: depositTransactions.id,
        type: depositTransactions.type,
        amount: depositTransactions.amount,
        balanceAfter: depositTransactions.balanceAfter,
        description: depositTransactions.description,
        relatedAuctionId: depositTransactions.relatedAuctionId,
        createdAt: depositTransactions.createdAt,
      })
      .from(depositTransactions)
      .where(eq(depositTransactions.userId, userId))
      .orderBy(desc(depositTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    return result;
  } catch (error) {
    console.error('[Database] Failed to get deposit transactions:', error);
    return [];
  }
}

/**
 * Get all deposit transactions (admin view).
 */
export async function getAllDepositTransactions(limit = 100, offset = 0) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: depositTransactions.id,
        userId: depositTransactions.userId,
        userName: users.name,
        type: depositTransactions.type,
        amount: depositTransactions.amount,
        balanceAfter: depositTransactions.balanceAfter,
        description: depositTransactions.description,
        relatedAuctionId: depositTransactions.relatedAuctionId,
        createdAt: depositTransactions.createdAt,
      })
      .from(depositTransactions)
      .leftJoin(users, eq(depositTransactions.userId, users.id))
      .orderBy(desc(depositTransactions.createdAt))
      .limit(limit)
      .offset(offset);
    return result;
  } catch (error) {
    console.error('[Database] Failed to get all deposit transactions:', error);
    return [];
  }
}

/**
 * Check if a seller can list (has sufficient deposit balance).
 */
export async function canSellerList(userId: number): Promise<{ canList: boolean; reason?: string; balance?: number; required?: number }> {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return { canList: false, reason: 'Database not available' };

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) return { canList: false, reason: '無法取得保證金記錄' };

    if (!deposit.isActive) {
      return { canList: false, reason: '賣家帳戶已被停用', balance: parseFloat(deposit.balance.toString()), required: parseFloat(deposit.requiredDeposit.toString()) };
    }

    const balance = parseFloat(deposit.balance.toString());
    const required = parseFloat(deposit.requiredDeposit.toString());

    if (balance < required) {
      return { canList: false, reason: `保證金不足（餘額 $${balance.toFixed(2)}，需要 $${required.toFixed(2)}）`, balance, required };
    }

    return { canList: true, balance, required };
  } catch (error) {
    console.error('[Database] Failed to check seller listing permission:', error);
    return { canList: false, reason: '檢查保證金時發生錯誤' };
  }
}

/**
 * Admin adjustment (manual balance correction).
 */
export async function adjustDeposit(userId: number, amount: number, description: string, adminId: number) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) throw new Error('Failed to get deposit record');

    const currentBalance = parseFloat(deposit.balance.toString());
    const newBalance = currentBalance + amount;

    await db.update(sellerDeposits).set({ balance: newBalance.toFixed(2) }).where(eq(sellerDeposits.userId, userId));

    await db.insert(depositTransactions).values({
      depositId: deposit.id,
      userId,
      type: 'adjustment',
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: description || `管理員調整 ${amount >= 0 ? '+' : ''}$${amount.toFixed(2)}`,
      createdBy: adminId,
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('[Database] Failed to adjust deposit:', error);
    throw error;
  }
}

// ── Subscription Plans & User Subscriptions (訂閱分級) ──────────────────────

let _subscriptionTablesChecked = false;
async function ensureSubscriptionTables() {
  if (_subscriptionTablesChecked) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        memberLevel ENUM('bronze','silver','gold','vip') NOT NULL,
        monthlyPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        yearlyPrice DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        maxListings INT NOT NULL DEFAULT 0,
        commissionDiscount DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
        description TEXT,
        benefits TEXT,
        sortOrder INT NOT NULL DEFAULT 0,
        isActive INT NOT NULL DEFAULT 1,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        planId INT NOT NULL,
        billingCycle ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
        status ENUM('pending','active','expired','cancelled','rejected') NOT NULL DEFAULT 'pending',
        startDate TIMESTAMP NULL,
        endDate TIMESTAMP NULL,
        paymentMethod VARCHAR(100),
        paymentReference VARCHAR(255),
        paymentProofUrl TEXT,
        adminNote TEXT,
        approvedBy INT,
        approvedAt TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    _subscriptionTablesChecked = true;
  } catch (error) {
    console.error('[Database] Failed to ensure subscription tables:', error);
  }
}

// ── Subscription Plans CRUD ──────────────────────────────────────────────

export async function getActiveSubscriptionPlans() {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, 1))
      .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.id));
  } catch (error) {
    console.error('[Database] Failed to get active subscription plans:', error);
    return [];
  }
}

export async function getAllSubscriptionPlans() {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(subscriptionPlans)
      .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.id));
  } catch (error) {
    console.error('[Database] Failed to get all subscription plans:', error);
    return [];
  }
}

export async function getSubscriptionPlanById(planId: number) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error('[Database] Failed to get subscription plan:', error);
    return null;
  }
}

export async function createSubscriptionPlan(data: {
  name: string;
  memberLevel: 'bronze' | 'silver' | 'gold' | 'vip';
  monthlyPrice: number;
  yearlyPrice: number;
  maxListings: number;
  commissionDiscount: number;
  description?: string;
  benefits?: string;
  sortOrder?: number;
}) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    await db.insert(subscriptionPlans).values({
      name: data.name,
      memberLevel: data.memberLevel,
      monthlyPrice: data.monthlyPrice.toFixed(2),
      yearlyPrice: data.yearlyPrice.toFixed(2),
      maxListings: data.maxListings,
      commissionDiscount: data.commissionDiscount.toFixed(4),
      description: data.description ?? null,
      benefits: data.benefits ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: 1,
    });
    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to create subscription plan:', error);
    throw error;
  }
}

export async function updateSubscriptionPlan(planId: number, data: {
  name?: string;
  memberLevel?: 'bronze' | 'silver' | 'gold' | 'vip';
  monthlyPrice?: number;
  yearlyPrice?: number;
  maxListings?: number;
  commissionDiscount?: number;
  description?: string;
  benefits?: string;
  sortOrder?: number;
  isActive?: number;
}) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.memberLevel !== undefined) updateData.memberLevel = data.memberLevel;
    if (data.monthlyPrice !== undefined) updateData.monthlyPrice = data.monthlyPrice.toFixed(2);
    if (data.yearlyPrice !== undefined) updateData.yearlyPrice = data.yearlyPrice.toFixed(2);
    if (data.maxListings !== undefined) updateData.maxListings = data.maxListings;
    if (data.commissionDiscount !== undefined) updateData.commissionDiscount = data.commissionDiscount.toFixed(4);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.benefits !== undefined) updateData.benefits = data.benefits;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (Object.keys(updateData).length > 0) {
      await db.update(subscriptionPlans).set(updateData).where(eq(subscriptionPlans.id, planId));
    }
    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to update subscription plan:', error);
    throw error;
  }
}

export async function deleteSubscriptionPlan(planId: number) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to delete subscription plan:', error);
    throw error;
  }
}

// ── User Subscriptions ──────────────────────────────────────────────────

export async function createUserSubscription(data: {
  userId: number;
  planId: number;
  billingCycle: 'monthly' | 'yearly';
  paymentMethod?: string;
  paymentReference?: string;
  paymentProofUrl?: string;
}) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    await db.insert(userSubscriptions).values({
      userId: data.userId,
      planId: data.planId,
      billingCycle: data.billingCycle,
      status: 'pending',
      paymentMethod: data.paymentMethod ?? null,
      paymentReference: data.paymentReference ?? null,
      paymentProofUrl: data.paymentProofUrl ?? null,
    });
    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to create user subscription:', error);
    throw error;
  }
}

export async function getUserActiveSubscription(userId: number) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db
      .select({
        id: userSubscriptions.id,
        userId: userSubscriptions.userId,
        planId: userSubscriptions.planId,
        planName: subscriptionPlans.name,
        memberLevel: subscriptionPlans.memberLevel,
        billingCycle: userSubscriptions.billingCycle,
        status: userSubscriptions.status,
        startDate: userSubscriptions.startDate,
        endDate: userSubscriptions.endDate,
        paymentMethod: userSubscriptions.paymentMethod,
      })
      .from(userSubscriptions)
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, 'active')
      ))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error('[Database] Failed to get user active subscription:', error);
    return null;
  }
}

export async function getUserSubscriptions(userId: number) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: userSubscriptions.id,
        planId: userSubscriptions.planId,
        planName: subscriptionPlans.name,
        memberLevel: subscriptionPlans.memberLevel,
        billingCycle: userSubscriptions.billingCycle,
        status: userSubscriptions.status,
        startDate: userSubscriptions.startDate,
        endDate: userSubscriptions.endDate,
        paymentMethod: userSubscriptions.paymentMethod,
        paymentReference: userSubscriptions.paymentReference,
        createdAt: userSubscriptions.createdAt,
      })
      .from(userSubscriptions)
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, userId))
      .orderBy(desc(userSubscriptions.createdAt));
  } catch (error) {
    console.error('[Database] Failed to get user subscriptions:', error);
    return [];
  }
}

export async function getAllUserSubscriptions(statusFilter?: string) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions = statusFilter
      ? [eq(userSubscriptions.status, statusFilter as any)]
      : [];

    return await db
      .select({
        id: userSubscriptions.id,
        userId: userSubscriptions.userId,
        userName: users.name,
        userEmail: users.email,
        planId: userSubscriptions.planId,
        planName: subscriptionPlans.name,
        memberLevel: subscriptionPlans.memberLevel,
        billingCycle: userSubscriptions.billingCycle,
        status: userSubscriptions.status,
        startDate: userSubscriptions.startDate,
        endDate: userSubscriptions.endDate,
        paymentMethod: userSubscriptions.paymentMethod,
        paymentReference: userSubscriptions.paymentReference,
        paymentProofUrl: userSubscriptions.paymentProofUrl,
        adminNote: userSubscriptions.adminNote,
        createdAt: userSubscriptions.createdAt,
      })
      .from(userSubscriptions)
      .leftJoin(users, eq(userSubscriptions.userId, users.id))
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(userSubscriptions.createdAt));
  } catch (error) {
    console.error('[Database] Failed to get all user subscriptions:', error);
    return [];
  }
}

export async function approveSubscription(subscriptionId: number, adminId: number, adminNote?: string) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    // Get the subscription
    const subs = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, subscriptionId)).limit(1);
    if (!subs[0]) throw new Error('找不到訂閱記錄');
    const sub = subs[0];
    if (sub.status !== 'pending') throw new Error('此訂閱不在待審核狀態');

    // Get the plan
    const plans = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, sub.planId)).limit(1);
    if (!plans[0]) throw new Error('找不到訂閱計劃');
    const plan = plans[0];

    // Calculate dates
    const now = new Date();
    const endDate = new Date(now);
    if (sub.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Update subscription
    await db.update(userSubscriptions).set({
      status: 'active',
      startDate: now,
      endDate: endDate,
      approvedBy: adminId,
      approvedAt: now,
      adminNote: adminNote ?? null,
    }).where(eq(userSubscriptions.id, subscriptionId));

    // Update user's member level
    await db.update(users).set({
      memberLevel: plan.memberLevel,
    }).where(eq(users.id, sub.userId));

    return { success: true, memberLevel: plan.memberLevel };
  } catch (error) {
    console.error('[Database] Failed to approve subscription:', error);
    throw error;
  }
}

export async function rejectSubscription(subscriptionId: number, adminId: number, adminNote?: string) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    const subs = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, subscriptionId)).limit(1);
    if (!subs[0]) throw new Error('找不到訂閱記錄');
    if (subs[0].status !== 'pending') throw new Error('此訂閱不在待審核狀態');

    await db.update(userSubscriptions).set({
      status: 'rejected',
      adminNote: adminNote ?? null,
      approvedBy: adminId,
      approvedAt: new Date(),
    }).where(eq(userSubscriptions.id, subscriptionId));

    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to reject subscription:', error);
    throw error;
  }
}

export async function cancelSubscription(subscriptionId: number, adminId: number, adminNote?: string) {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    const subs = await db.select().from(userSubscriptions).where(eq(userSubscriptions.id, subscriptionId)).limit(1);
    if (!subs[0]) throw new Error('找不到訂閱記錄');

    await db.update(userSubscriptions).set({
      status: 'cancelled',
      adminNote: adminNote ?? null,
    }).where(eq(userSubscriptions.id, subscriptionId));

    // Downgrade user back to bronze
    await db.update(users).set({
      memberLevel: 'bronze',
    }).where(eq(users.id, subs[0].userId));

    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to cancel subscription:', error);
    throw error;
  }
}

export async function getSubscriptionStats() {
  await ensureSubscriptionTables();
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, active: 0, expired: 0 };
  try {
    const all = await db.select({ status: userSubscriptions.status }).from(userSubscriptions);
    const total = all.length;
    const pending = all.filter((s: { status: string }) => s.status === 'pending').length;
    const active = all.filter((s: { status: string }) => s.status === 'active').length;
    const expired = all.filter((s: { status: string }) => s.status === 'expired').length;
    return { total, pending, active, expired };
  } catch (error) {
    console.error('[Database] Failed to get subscription stats:', error);
    return { total: 0, pending: 0, active: 0, expired: 0 };
  }
}

// ─────────────────────────────────────────────
// Admin User Management
// ─────────────────────────────────────────────

/**
 * Get all users with extended info: phone, loginMethod, merchant (sellerDeposit) info
 */
export async function getAllUsersExtended() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        loginMethod: users.loginMethod,
        role: users.role,
        memberLevel: users.memberLevel,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
        depositId: sellerDeposits.id,
        depositBalance: sellerDeposits.balance,
        requiredDeposit: sellerDeposits.requiredDeposit,
        commissionRate: sellerDeposits.commissionRate,
        depositIsActive: sellerDeposits.isActive,
        wonCount: sql<number>`(SELECT COUNT(*) FROM auctions WHERE highestBidderId = ${users.id} AND status = 'ended')`,
      })
      .from(users)
      .leftJoin(sellerDeposits, eq(sellerDeposits.userId, users.id))
      .orderBy(desc(users.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get all users extended:', error);
    return [];
  }
}

/**
 * Get won auctions (ended + highestBidder) for a specific user — admin use
 */
export async function getWonAuctionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select({
        id: auctions.id,
        title: auctions.title,
        currentPrice: auctions.currentPrice,
        currency: auctions.currency,
        endTime: auctions.endTime,
        paymentStatus: auctions.paymentStatus,
      })
      .from(auctions)
      .where(and(eq(auctions.highestBidderId, userId), eq(auctions.status, 'ended')))
      .orderBy(desc(auctions.endTime));
  } catch (error) {
    console.error('[Database] Failed to get won auctions by user:', error);
    return [];
  }
}

/**
 * Admin update any user's profile (name, email, phone)
 */
export async function adminUpdateUser(
  userId: number,
  data: { name?: string; email?: string; phone?: string }
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (Object.keys(updateData).length === 0) return true;
    await db.update(users).set(updateData).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error('[Database] Failed to admin update user:', error);
    return false;
  }
}

/**
 * Delete user and ALL related data (bids, favorites, proxy bids, subscriptions, deposits)
 */
export async function deleteUserAndData(userId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  try {
    // Nullify highest bidder on any live auctions
    await db.update(auctions)
      .set({ highestBidderId: null } as Record<string, unknown>)
      .where(eq(auctions.highestBidderId, userId));

    // Delete proxy bid logs
    await db.delete(proxyBidLogs).where(eq(proxyBidLogs.proxyUserId, userId));
    await db.delete(proxyBidLogs).where(eq(proxyBidLogs.triggerUserId, userId));

    // Delete proxy bids
    await db.delete(proxyBids).where(eq(proxyBids.userId, userId));

    // Delete bids
    await db.delete(bids).where(eq(bids.userId, userId));

    // Delete favorites
    await db.delete(favorites).where(eq(favorites.userId, userId));

    // Delete subscriptions
    try {
      await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
    } catch {}

    // Delete deposit transactions and deposit
    try {
      await db.delete(depositTransactions).where(eq(depositTransactions.userId, userId));
      await db.delete(sellerDeposits).where(eq(sellerDeposits.userId, userId));
    } catch {}

    // Finally delete the user
    await db.delete(users).where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to delete user and data:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ─── Merchant Applications ────────────────────────────────────────────────────

export async function createMerchantApplication(data: InsertMerchantApplication) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const [result] = await db.insert(merchantApplications).values(data);
  return result;
}

export async function getMerchantApplicationByUser(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(merchantApplications)
    .where(eq(merchantApplications.userId, userId))
    .orderBy(desc(merchantApplications.createdAt))
    .limit(1);
  return result[0];
}

export async function getAllMerchantApplications() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: merchantApplications.id,
    userId: merchantApplications.userId,
    contactName: merchantApplications.contactName,
    merchantName: merchantApplications.merchantName,
    selfIntro: merchantApplications.selfIntro,
    whatsapp: merchantApplications.whatsapp,
    yearsExperience: merchantApplications.yearsExperience,
    merchantIcon: merchantApplications.merchantIcon,
    categories: merchantApplications.categories,
    samplePhotos: merchantApplications.samplePhotos,
    status: merchantApplications.status,
    adminNote: merchantApplications.adminNote,
    createdAt: merchantApplications.createdAt,
    updatedAt: merchantApplications.updatedAt,
    applicantName: sql<string | null>`(SELECT name FROM users WHERE id = ${merchantApplications.userId})`,
    applicantEmail: sql<string | null>`(SELECT email FROM users WHERE id = ${merchantApplications.userId})`,
    applicantPhone: sql<string | null>`(SELECT phone FROM users WHERE id = ${merchantApplications.userId})`,
  })
  .from(merchantApplications)
  .orderBy(desc(merchantApplications.createdAt));
}

// ── Merchant Settings ─────────────────────────────────────────────────────────

let _merchantSettingsTableChecked = false;
async function ensureMerchantSettingsTable() {
  if (_merchantSettingsTableChecked) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS merchant_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        defaultEndDayOffset INT NOT NULL DEFAULT 7,
        defaultEndTime VARCHAR(5) NOT NULL DEFAULT '23:00',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    _merchantSettingsTableChecked = true;
  } catch (error) {
    console.error('[Database] Failed to ensure merchant_settings table:', error);
  }
}

export async function getMerchantSettings(userId: number): Promise<{ defaultEndDayOffset: number; defaultEndTime: string }> {
  await ensureMerchantSettingsTable();
  const db = await getDb();
  if (!db) return { defaultEndDayOffset: 7, defaultEndTime: '23:00' };
  try {
    const rows = await db.execute(sql`SELECT defaultEndDayOffset, defaultEndTime FROM merchant_settings WHERE userId = ${userId} LIMIT 1`);
    const data = (rows as unknown as { rows?: unknown[] }).rows ?? rows;
    const row = Array.isArray(data) ? data[0] : null;
    if (row && typeof row === 'object') {
      const r = row as Record<string, unknown>;
      return {
        defaultEndDayOffset: Number(r.defaultEndDayOffset ?? 7),
        defaultEndTime: String(r.defaultEndTime ?? '23:00'),
      };
    }
    return { defaultEndDayOffset: 7, defaultEndTime: '23:00' };
  } catch (error) {
    console.error('[Database] getMerchantSettings error:', error);
    return { defaultEndDayOffset: 7, defaultEndTime: '23:00' };
  }
}

export async function upsertMerchantSettings(userId: number, defaultEndDayOffset: number, defaultEndTime: string): Promise<void> {
  await ensureMerchantSettingsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    INSERT INTO merchant_settings (userId, defaultEndDayOffset, defaultEndTime)
    VALUES (${userId}, ${defaultEndDayOffset}, ${defaultEndTime})
    ON DUPLICATE KEY UPDATE
      defaultEndDayOffset = ${defaultEndDayOffset},
      defaultEndTime = ${defaultEndTime},
      updatedAt = CURRENT_TIMESTAMP
  `);
}

export async function reviewMerchantApplication(
  id: number,
  status: 'approved' | 'rejected',
  adminNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  // Get the application to find the userId
  const [app] = await db.select({ userId: merchantApplications.userId })
    .from(merchantApplications)
    .where(eq(merchantApplications.id, id))
    .limit(1);

  await db.update(merchantApplications)
    .set({ status, adminNote: adminNote ?? null })
    .where(eq(merchantApplications.id, id));

  // When approved, auto-create seller_deposits record so user appears in merchant list
  if (status === 'approved' && app?.userId) {
    await getOrCreateSellerDeposit(app.userId);
  }
}
