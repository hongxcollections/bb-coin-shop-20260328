import { eq, desc, asc, and, or, gte, lte, gt, sql, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { InsertUser, users, auctions, InsertAuction, auctionImages, InsertAuctionImage, bids, InsertBid, Auction, proxyBids, proxyBidLogs, notificationSettings, NotificationSettings, favorites, siteSettings, sellerDeposits, depositTransactions, subscriptionPlans, userSubscriptions, merchantApplications, InsertMerchantApplication, commissionRefundRequests, depositTopUpRequests, depositTierPresets, merchantProducts, MerchantProduct, featuredListings, FeaturedListing } from "../drizzle/schema";
import { ENV } from './_core/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _pool: any = null;

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
      _pool = pool;
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** 取得底層 mysql2 pool（用於 raw SQL 查詢） */
export async function getRawPool() {
  await getDb();
  return _pool;
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
        highestBidderIsAnonymous: sql<number>`COALESCE((SELECT isAnonymous FROM bids WHERE auctionId = ${auctions.id} AND userId = ${auctions.highestBidderId} ORDER BY id DESC LIMIT 1), 0)`,
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
      sql`(${auctions.archived} = 0 OR ${auctions.archived} IS NULL)`,
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

/** Return any one existing auction image URL from the DB (used for seeding test listings) */
export async function getAnyExistingImageUrl(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select({ imageUrl: auctionImages.imageUrl })
      .from(auctionImages)
      .limit(1);
    return rows[0]?.imageUrl ?? null;
  } catch {
    return null;
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
        highestBidderIsAnonymous: sql<number>`COALESCE((SELECT isAnonymous FROM bids WHERE auctionId = ${auctions.id} AND userId = ${auctions.highestBidderId} ORDER BY id DESC LIMIT 1), 0)`,
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
      .where(and(eq(auctions.createdBy, userId), or(eq(auctions.archived, 0), isNull(auctions.archived))))
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
  highestBidderIsAnonymous: sql<number>`COALESCE((SELECT isAnonymous FROM bids WHERE auctionId = ${auctions.id} AND userId = ${auctions.highestBidderId} ORDER BY id DESC LIMIT 1), 0)`,
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
      .values({ id: 1, senderName: "hongxcollections", senderEmail: "ywkyee@gmail.com", ...data })
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

/**
 * 自動 VIP 升級檢查：當商戶同時符合以下三個條件，自動升級為 VIP：
 * 1. 商戶申請已批准（merchantApplication.status = 'approved'）
 * 2. 保證金有餘額（sellerDeposit.balance > 0）
 * 3. 有有效訂閱（userSubscription.status = 'active'）
 */
export async function checkAndUpgradeToVip(userId: number): Promise<boolean> {
  try {
    // 條件 1：商戶申請已批准
    const app = await getMerchantApplicationByUser(userId);
    if (!app || app.status !== 'approved') return false;

    // 條件 2：保證金餘額 > 0
    const deposit = await getOrCreateSellerDeposit(userId);
    const balance = deposit ? parseFloat(String(deposit.balance)) : 0;
    if (balance <= 0) return false;

    // 條件 3：有有效訂閱
    const sub = await getUserActiveSubscription(userId);
    if (!sub) return false;

    // 三個條件全部符合 → 升 VIP
    await setUserMemberLevel(userId, 'vip');
    console.log(`[VIP] 用戶 ${userId} 已自動升級為 VIP（三個條件全部達成）`);
    return true;
  } catch (err) {
    console.error('[VIP] checkAndUpgradeToVip 發生錯誤:', err);
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
        sellerName: sql<string | null>`(SELECT name FROM users WHERE id = ${auctions.createdBy})`,
        sellerWhatsapp: sql<string | null>`(SELECT whatsapp FROM merchantApplications WHERE userId = ${auctions.createdBy} AND status = 'approved' LIMIT 1)`,
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
    const result = await db.execute(sql`
      SELECT
        a.id,
        a.title,
        a.currentPrice,
        a.currency,
        a.endTime,
        a.paymentStatus,
        (SELECT u.name FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = a.id ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1) AS winnerName,
        (SELECT u.openId FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = a.id ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1) AS winnerOpenId,
        (SELECT u.phone FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = a.id ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1) AS winnerPhone,
        (SELECT b.bidAmount FROM bids b WHERE b.auctionId = a.id ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1) AS winningAmount
      FROM auctions a
      WHERE a.status = 'ended'
        AND a.createdBy = ${creatorId}
        AND (a.archived = 0 OR a.archived IS NULL)
      ORDER BY a.endTime DESC
    `);
    const rawRows = result as unknown as [Array<Record<string, unknown>>, unknown];
    const rows = Array.isArray(rawRows[0]) ? rawRows[0] : (rawRows as unknown as Array<Record<string, unknown>>);
    console.log(`[myOrders] creatorId=${creatorId} → ${rows.length} orders found`);
    return rows.map(r => ({
      id: Number(r.id),
      title: String(r.title ?? ''),
      currentPrice: String(r.currentPrice ?? '0'),
      currency: String(r.currency ?? 'HKD'),
      endTime: r.endTime,
      paymentStatus: r.paymentStatus != null ? String(r.paymentStatus) : null,
      winnerName: r.winnerName != null ? String(r.winnerName) : null,
      winnerOpenId: r.winnerOpenId != null ? String(r.winnerOpenId) : null,
      winnerPhone: r.winnerPhone != null ? String(r.winnerPhone) : null,
      winningAmount: r.winningAmount != null ? String(r.winningAmount) : null,
    }));
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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS depositTierPresets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        maintenancePct DECIMAL(5,2) NOT NULL DEFAULT 80.00,
        warningPct DECIMAL(5,2) NOT NULL DEFAULT 60.00,
        commissionRate DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
        description TEXT,
        isActive INT NOT NULL DEFAULT 1,
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Safely add new columns to existing tables (ignore duplicate column errors)
    try { await db.execute(sql`ALTER TABLE depositTierPresets ADD COLUMN commissionRate DECIMAL(5,4) NOT NULL DEFAULT 0.0500`); } catch {}
    try { await db.execute(sql`ALTER TABLE depositTierPresets ADD COLUMN productCommissionRate DECIMAL(5,4) NOT NULL DEFAULT 0.0500`); } catch {}
    try { await db.execute(sql`ALTER TABLE seller_deposits ADD COLUMN productCommissionRate DECIMAL(5,4) NOT NULL DEFAULT 0.0500`); } catch {}
    try { await db.execute(sql`ALTER TABLE depositTopUpRequests ADD COLUMN tierId INT`); } catch {}
    try { await db.execute(sql`ALTER TABLE merchantApplications ADD COLUMN facebook VARCHAR(500)`); } catch {}
    // proxyBids: 加 unique constraint 防止 setProxyBid 重複插入（onDuplicateKeyUpdate 需要 unique key 才能 upsert）
    try { await db.execute(sql`ALTER TABLE proxyBids ADD UNIQUE KEY uniq_proxy_auction_user (auctionId, userId)`); } catch {}
    // Web Push 訂閱表
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pushSubscriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          endpoint VARCHAR(500) NOT NULL UNIQUE,
          p256dh VARCHAR(255) NOT NULL,
          auth VARCHAR(100) NOT NULL,
          userAgent VARCHAR(255),
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_pushsub_user (userId)
        )
      `);
    } catch {}
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

    // Create new deposit record (warningDeposit = requiredDeposit × 2 by default)
    await db.insert(sellerDeposits).values({ userId, balance: "0.00", requiredDeposit: "500.00", warningDeposit: "1000.00", commissionRate: "0.0500", isActive: 1 });
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
        warningDeposit: sellerDeposits.warningDeposit,
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
  settings: { requiredDeposit?: number; warningDeposit?: number; commissionRate?: number; productCommissionRate?: number; isActive?: number }
) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return false;

  try {
    const deposit = await getOrCreateSellerDeposit(userId);
    if (!deposit) return false;

    const updateData: Record<string, unknown> = {};
    if (settings.requiredDeposit !== undefined) updateData.requiredDeposit = settings.requiredDeposit.toFixed(2);
    if (settings.warningDeposit !== undefined) updateData.warningDeposit = settings.warningDeposit.toFixed(2);
    if (settings.commissionRate !== undefined) updateData.commissionRate = settings.commissionRate.toFixed(4);
    if (settings.productCommissionRate !== undefined) updateData.productCommissionRate = settings.productCommissionRate.toFixed(4);
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
export async function getDepositTransactions(
  userId: number,
  limit = 50,
  offset = 0,
  fromDate?: Date,
  toDate?: Date,
) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return [];

  try {
    const conditions = [eq(depositTransactions.userId, userId)];
    if (fromDate) conditions.push(gte(depositTransactions.createdAt, fromDate));
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(depositTransactions.createdAt, end));
    }

    const result = await db
      .select({
        id: depositTransactions.id,
        type: depositTransactions.type,
        amount: depositTransactions.amount,
        balanceAfter: depositTransactions.balanceAfter,
        description: depositTransactions.description,
        relatedAuctionId: depositTransactions.relatedAuctionId,
        createdAt: depositTransactions.createdAt,
        auctionTitle: auctions.title,
        auctionCurrentPrice: sql<string>`(SELECT b.bidAmount FROM bids b WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
        auctionWinnerName: sql<string>`(SELECT u.name FROM users u INNER JOIN bids b ON b.userId = u.id WHERE b.auctionId = ${auctions.id} ORDER BY b.bidAmount DESC, b.createdAt ASC LIMIT 1)`,
      })
      .from(depositTransactions)
      .leftJoin(auctions, eq(depositTransactions.relatedAuctionId, auctions.id))
      .where(and(...conditions))
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
      return { canList: false, reason: '商戶帳戶已被停用', balance: parseFloat(deposit.balance.toString()), required: parseFloat(deposit.requiredDeposit.toString()) };
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
        maxListings: subscriptionPlans.maxListings,
        remainingQuota: userSubscriptions.remainingQuota,
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

    // Update subscription — also initialise remainingQuota from plan.maxListings
    await db.update(userSubscriptions).set({
      status: 'active',
      startDate: now,
      endDate: endDate,
      approvedBy: adminId,
      approvedAt: now,
      adminNote: adminNote ?? null,
      remainingQuota: plan.maxListings,  // 0 = unlimited; >0 = limited
    }).where(eq(userSubscriptions.id, subscriptionId));

    // Update user's member level (subscription plan level)
    await db.update(users).set({
      memberLevel: plan.memberLevel,
    }).where(eq(users.id, sub.userId));

    // 訂閱批准後，額外檢查是否符合 VIP 三個條件（商戶 + 保證金 + 訂閱）
    const upgradedToVip = await checkAndUpgradeToVip(sub.userId).catch(() => false);

    return { success: true, memberLevel: upgradedToVip ? 'vip' : plan.memberLevel };
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
        mustChangePassword: users.mustChangePassword,
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
 * Admin: 設定用戶密碼（已 hash），並標記 mustChangePassword = 1
 * 密碼 hash 由呼叫方（routers.ts）負責
 */
export async function adminSetUserPassword(
  userId: number,
  hashedPassword: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.update(users)
      .set({ password: hashedPassword, mustChangePassword: 1 })
      .where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error('[Database] Failed to admin set user password:', error);
    return false;
  }
}

/**
 * 清除 mustChangePassword 旗標（會員成功完成強制更改後呼叫）
 */
export async function clearMustChangePassword(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.update(users).set({ mustChangePassword: 0 }).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error('[Database] Failed to clear mustChangePassword:', error);
    return false;
  }
}

/**
 * 一次性清除孤兒資料：刪除所有在商戶相關表格中、但對應 userId 已不存在於 users 表的記錄。
 * 適用於舊有「拆除」功能未完整清理的殘留資料。
 */
export async function cleanOrphanMerchantData(): Promise<{
  success: boolean;
  deletedMerchantApplications: number;
  deletedMerchantProducts: number;
  deletedAuctions: number;
  deletedDepositTopUpRequests: number;
  deletedMerchantSettings: number;
  deletedSellerDeposits: number;
  deletedUserSubscriptions: number;
  error?: string;
}> {
  const zero = {
    success: false, deletedMerchantApplications: 0, deletedMerchantProducts: 0,
    deletedAuctions: 0, deletedDepositTopUpRequests: 0,
    deletedMerchantSettings: 0, deletedSellerDeposits: 0, deletedUserSubscriptions: 0,
  };
  const db = await getDb();
  if (!db) return { ...zero, error: 'Database not available' };

  try {
    let deletedMerchantApplications = 0, deletedMerchantProducts = 0, deletedAuctions = 0;
    let deletedDepositTopUpRequests = 0, deletedMerchantSettings = 0;
    let deletedSellerDeposits = 0, deletedUserSubscriptions = 0;

    const ORPHAN = sql`NOT IN (SELECT id FROM users)`;

    // ── 1. 孤兒拍賣及所有子資料 ──────────────────────────────────────────────
    try {
      await db.execute(sql`DELETE FROM proxyBidLogs WHERE auctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] proxyBidLogs:', e); }
    try {
      await db.execute(sql`DELETE FROM proxyBids WHERE auctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] proxyBids:', e); }
    try {
      await db.execute(sql`DELETE FROM bids WHERE auctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] bids:', e); }
    try {
      await db.execute(sql`DELETE FROM auctionImages WHERE auctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] auctionImages:', e); }
    try {
      await db.execute(sql`DELETE FROM favorites WHERE auctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] favorites:', e); }
    try {
      await db.execute(sql`DELETE FROM deposit_transactions WHERE relatedAuctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] deposit_transactions:', e); }
    try {
      await db.execute(sql`DELETE FROM commissionRefundRequests WHERE auctionId IN (SELECT id FROM auctions WHERE createdBy ${ORPHAN})`);
    } catch (e) { console.error('[cleanOrphan] commissionRefundRequests:', e); }
    try {
      const [ar] = await db.execute(sql`DELETE FROM auctions WHERE createdBy ${ORPHAN}`);
      deletedAuctions = (ar as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] auctions:', e); }

    // ── 2. 商戶申請記錄（最重要：從市集移除） ────────────────────────────────
    try {
      const [ma] = await db.execute(sql`DELETE FROM merchantApplications WHERE userId ${ORPHAN}`);
      deletedMerchantApplications = (ma as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] merchantApplications:', e); }

    // ── 3. 商戶市集商品 ───────────────────────────────────────────────────────
    try {
      const [mp] = await db.execute(sql`DELETE FROM merchantProducts WHERE merchantId ${ORPHAN}`);
      deletedMerchantProducts = (mp as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] merchantProducts:', e); }

    // ── 4. 保證金充值申請 ─────────────────────────────────────────────────────
    try {
      const [dtu] = await db.execute(sql`DELETE FROM depositTopUpRequests WHERE userId ${ORPHAN}`);
      deletedDepositTopUpRequests = (dtu as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] depositTopUpRequests:', e); }

    // ── 5. 商戶版面設定 ───────────────────────────────────────────────────────
    try {
      await ensureMerchantSettingsTable();
      const [ms] = await db.execute(sql`DELETE FROM merchant_settings WHERE userId ${ORPHAN}`);
      deletedMerchantSettings = (ms as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] merchant_settings:', e); }

    // ── 6. 保證金帳戶 ─────────────────────────────────────────────────────────
    try {
      const [sd] = await db.execute(sql`DELETE FROM seller_deposits WHERE userId ${ORPHAN}`);
      deletedSellerDeposits = (sd as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] seller_deposits:', e); }

    // ── 7. 訂閱記錄 ───────────────────────────────────────────────────────────
    try {
      const [us] = await db.execute(sql`DELETE FROM user_subscriptions WHERE userId ${ORPHAN}`);
      deletedUserSubscriptions = (us as { affectedRows?: number })?.affectedRows ?? 0;
    } catch (e) { console.error('[cleanOrphan] user_subscriptions:', e); }

    console.log(`[Database] cleanOrphanMerchantData: auctions=${deletedAuctions}, apps=${deletedMerchantApplications}, products=${deletedMerchantProducts}`);
    return {
      success: true, deletedMerchantApplications, deletedMerchantProducts, deletedAuctions,
      deletedDepositTopUpRequests, deletedMerchantSettings,
      deletedSellerDeposits, deletedUserSubscriptions,
    };
  } catch (error) {
    console.error('[Database] cleanOrphanMerchantData failed:', error);
    return { ...zero, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Purge all auction-related data for a merchant:
 * 1. All auctions created by them + every child record (bids, images, proxy bids/logs, favorites, deposit txns, refund requests)
 * 2. All bids placed BY this user on other auctions, and reset those auctions' highestBidderId where needed
 */
export async function purgeMerchantAuctionData(merchantUserId: number): Promise<{
  success: boolean;
  deletedAuctions: number;
  deletedBids: number;
  deletedImages: number;
  deletedProxyBids: number;
  deletedFavorites: number;
  deletedDepositTxns: number;
  deletedRefundRequests: number;
  deletedExternalBids: number;
  error?: string;
}> {
  const db = await getDb();
  const zero = { success: false, deletedAuctions: 0, deletedBids: 0, deletedImages: 0, deletedProxyBids: 0, deletedFavorites: 0, deletedDepositTxns: 0, deletedRefundRequests: 0, deletedExternalBids: 0 };
  if (!db) return { ...zero, error: 'Database not available' };

  try {
    // ── 1. Get all auction IDs created by this merchant ──────────────────────
    const ownAuctions = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(eq(auctions.createdBy, merchantUserId));
    const ownAuctionIds = ownAuctions.map(a => a.id);

    let deletedBids = 0, deletedImages = 0, deletedProxyBids = 0, deletedFavorites = 0;
    let deletedDepositTxns = 0, deletedRefundRequests = 0;

    if (ownAuctionIds.length > 0) {
      // Delete in dependency order (children first)
      const [plr] = await db.delete(proxyBidLogs).where(inArray(proxyBidLogs.auctionId, ownAuctionIds));
      const [pbr] = await db.delete(proxyBids).where(inArray(proxyBids.auctionId, ownAuctionIds));
      const [br] = await db.delete(bids).where(inArray(bids.auctionId, ownAuctionIds));
      const [ir] = await db.delete(auctionImages).where(inArray(auctionImages.auctionId, ownAuctionIds));
      const [fr] = await db.delete(favorites).where(inArray(favorites.auctionId, ownAuctionIds));
      const [dtr] = await db.delete(depositTransactions).where(inArray(depositTransactions.relatedAuctionId, ownAuctionIds));
      const [crr] = await db.delete(commissionRefundRequests).where(inArray(commissionRefundRequests.auctionId, ownAuctionIds));

      deletedBids = (br as { affectedRows?: number })?.affectedRows ?? 0;
      deletedImages = (ir as { affectedRows?: number })?.affectedRows ?? 0;
      deletedProxyBids = ((plr as { affectedRows?: number })?.affectedRows ?? 0) + ((pbr as { affectedRows?: number })?.affectedRows ?? 0);
      deletedFavorites = (fr as { affectedRows?: number })?.affectedRows ?? 0;
      deletedDepositTxns = (dtr as { affectedRows?: number })?.affectedRows ?? 0;
      deletedRefundRequests = (crr as { affectedRows?: number })?.affectedRows ?? 0;
    }

    // ── 2. Bids placed BY this user on OTHER auctions ────────────────────────
    // Reset highestBidderId on any auction (not created by this user) where this user was the winner
    await db.update(auctions)
      .set({ highestBidderId: null, paymentStatus: null } as Record<string, unknown>)
      .where(eq(auctions.highestBidderId, merchantUserId));

    // Delete remaining bids placed BY this user (on other auctions)
    const [ebr] = await db.delete(bids).where(eq(bids.userId, merchantUserId));
    const deletedExternalBids = (ebr as { affectedRows?: number })?.affectedRows ?? 0;

    // Delete remaining proxy bids/logs by this user on other auctions
    await db.delete(proxyBids).where(eq(proxyBids.userId, merchantUserId));
    await db.delete(proxyBidLogs).where(eq(proxyBidLogs.proxyUserId, merchantUserId));
    await db.delete(proxyBidLogs).where(eq(proxyBidLogs.triggerUserId, merchantUserId));

    // ── 3. Delete the auctions themselves ────────────────────────────────────
    const deletedAuctions = ownAuctionIds.length;
    if (ownAuctionIds.length > 0) {
      await db.delete(auctions).where(inArray(auctions.id, ownAuctionIds));
    }

    console.log(`[PurgeMerchant] userId=${merchantUserId}: auctions=${deletedAuctions}, bids=${deletedBids}, images=${deletedImages}, extBids=${deletedExternalBids}`);

    return { success: true, deletedAuctions, deletedBids, deletedImages, deletedProxyBids, deletedFavorites, deletedDepositTxns, deletedRefundRequests, deletedExternalBids };
  } catch (error) {
    console.error('[Database] purgeMerchantAuctionData failed:', error);
    return { ...zero, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteUserAndData(userId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  try {
    // ── 1. 清除商戶拍賣相關資料（含拍賣本身、出價、競拍記錄、圖片等） ──
    try { await purgeMerchantAuctionData(userId); } catch {}

    // ── 2. 商戶市集出售商品 ──
    try { await db.delete(merchantProducts).where(eq(merchantProducts.merchantId, userId)); } catch {}

    // ── 3. 商戶申請記錄（含 approved 記錄，確保不再出現在商戶市集） ──
    try { await db.delete(merchantApplications).where(eq(merchantApplications.userId, userId)); } catch {}

    // ── 4. 保證金充值申請 ──
    try { await db.delete(depositTopUpRequests).where(eq(depositTopUpRequests.userId, userId)); } catch {}

    // ── 6. 商戶版面設定（raw SQL，無 Drizzle ORM 表） ──
    try { await db.execute(sql`DELETE FROM merchant_settings WHERE userId = ${userId}`); } catch {}

    // ── 7. 其他競拍活動（作為買家） ──
    // Nullify highest bidder on any live auctions
    await db.update(auctions)
      .set({ highestBidderId: null } as Record<string, unknown>)
      .where(eq(auctions.highestBidderId, userId));

    // Delete proxy bid logs (as buyer)
    try {
      await db.delete(proxyBidLogs).where(eq(proxyBidLogs.proxyUserId, userId));
      await db.delete(proxyBidLogs).where(eq(proxyBidLogs.triggerUserId, userId));
    } catch {}

    // Delete proxy bids (as buyer)
    try { await db.delete(proxyBids).where(eq(proxyBids.userId, userId)); } catch {}

    // Delete bids (as buyer)
    try { await db.delete(bids).where(eq(bids.userId, userId)); } catch {}

    // Delete favorites (as buyer)
    try { await db.delete(favorites).where(eq(favorites.userId, userId)); } catch {}

    // ── 8. 訂閱 ──
    try { await db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId)); } catch {}

    // ── 9. 保證金交易記錄及保證金帳戶 ──
    try {
      await db.delete(depositTransactions).where(eq(depositTransactions.userId, userId));
      await db.delete(sellerDeposits).where(eq(sellerDeposits.userId, userId));
    } catch {}

    // ── 10. 最後刪除用戶本身 ──
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

export async function updateMerchantProfile(
  userId: number,
  data: { merchantName: string; selfIntro: string; whatsapp: string; facebook?: string | null; merchantIcon?: string | null }
) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.update(merchantApplications)
    .set({
      merchantName: data.merchantName,
      selfIntro: data.selfIntro,
      whatsapp: data.whatsapp,
      ...(data.facebook !== undefined ? { facebook: data.facebook } : {}),
      ...(data.merchantIcon !== undefined ? { merchantIcon: data.merchantIcon } : {}),
    })
    .where(and(eq(merchantApplications.userId, userId), eq(merchantApplications.status, 'approved')));
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
        defaultStartingPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
        defaultBidIncrement INT NOT NULL DEFAULT 30,
        defaultAntiSnipeEnabled INT NOT NULL DEFAULT 1,
        defaultAntiSnipeMinutes INT NOT NULL DEFAULT 3,
        defaultExtendMinutes INT NOT NULL DEFAULT 3,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Add defaultStartingPrice column if missing (migration for existing tables)
    const colCheck = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'merchant_settings'
        AND COLUMN_NAME = 'defaultStartingPrice'
    `);
    const colRows = colCheck as unknown as [Array<Record<string, unknown>>, unknown];
    const colRow = Array.isArray(colRows[0]) ? colRows[0][0] : (colRows as unknown as Array<Record<string, unknown>>)[0];
    if (colRow && Number(colRow.cnt) === 0) {
      await db.execute(sql`
        ALTER TABLE merchant_settings
          ADD COLUMN defaultStartingPrice DECIMAL(10,2) NOT NULL DEFAULT 0
      `);
    }
    // Add defaultBidIncrement column if missing
    const bidColCheck = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'merchant_settings'
        AND COLUMN_NAME = 'defaultBidIncrement'
    `);
    const bidColRows = bidColCheck as unknown as [Array<Record<string, unknown>>, unknown];
    const bidColRow = Array.isArray(bidColRows[0]) ? bidColRows[0][0] : (bidColRows as unknown as Array<Record<string, unknown>>)[0];
    if (bidColRow && Number(bidColRow.cnt) === 0) {
      await db.execute(sql`
        ALTER TABLE merchant_settings
          ADD COLUMN defaultBidIncrement INT NOT NULL DEFAULT 30
      `);
    }
    // Add antiSnipe default columns if missing
    for (const [colName, colDef] of [
      ['defaultAntiSnipeEnabled', 'INT NOT NULL DEFAULT 1'],
      ['defaultAntiSnipeMinutes', 'INT NOT NULL DEFAULT 3'],
      ['defaultExtendMinutes', 'INT NOT NULL DEFAULT 3'],
    ] as [string, string][]) {
      const chk = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'merchant_settings'
          AND COLUMN_NAME = ${colName}
      `);
      const chkRows = chk as unknown as [Array<Record<string, unknown>>, unknown];
      const chkRow = Array.isArray(chkRows[0]) ? chkRows[0][0] : (chkRows as unknown as Array<Record<string, unknown>>)[0];
      if (chkRow && Number(chkRow.cnt) === 0) {
        await db.execute(sql.raw(`ALTER TABLE merchant_settings ADD COLUMN ${colName} ${colDef}`));
      }
    }
    // Add listingLayout column if missing
    const layoutColCheck = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'merchant_settings'
        AND COLUMN_NAME = 'listingLayout'
    `);
    const layoutColRows = layoutColCheck as unknown as [Array<Record<string, unknown>>, unknown];
    const layoutColRow = Array.isArray(layoutColRows[0]) ? layoutColRows[0][0] : (layoutColRows as unknown as Array<Record<string, unknown>>)[0];
    if (layoutColRow && Number(layoutColRow.cnt) === 0) {
      await db.execute(sql`ALTER TABLE merchant_settings ADD COLUMN listingLayout VARCHAR(10) NOT NULL DEFAULT 'grid2'`);
    }
    // Add paymentInstructions and deliveryInfo columns if missing
    for (const [colName, colDef] of [
      ['paymentInstructions', 'TEXT NULL'],
      ['deliveryInfo', 'TEXT NULL'],
    ] as [string, string][]) {
      const chk = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'merchant_settings'
          AND COLUMN_NAME = ${colName}
      `);
      const chkRows = chk as unknown as [Array<Record<string, unknown>>, unknown];
      const chkRow = Array.isArray(chkRows[0]) ? chkRows[0][0] : (chkRows as unknown as Array<Record<string, unknown>>)[0];
      if (chkRow && Number(chkRow.cnt) === 0) {
        await db.execute(sql.raw(`ALTER TABLE merchant_settings ADD COLUMN ${colName} ${colDef}`));
      }
    }
    // Add watermark columns if missing
    for (const [colName, colDef] of [
      ['watermarkEnabled', 'INT NOT NULL DEFAULT 1'],
      ['watermarkText', 'VARCHAR(100) NULL'],
      ['watermarkOpacity', 'INT NOT NULL DEFAULT 45'],
      ['watermarkShadow', 'INT NOT NULL DEFAULT 1'],
      ['watermarkPosition', "VARCHAR(30) NOT NULL DEFAULT 'center-diagonal'"],
      ['watermarkSize', 'INT NOT NULL DEFAULT 12'],
    ] as [string, string][]) {
      const chk = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'merchant_settings'
          AND COLUMN_NAME = ${colName}
      `);
      const chkRows = chk as unknown as [Array<Record<string, unknown>>, unknown];
      const chkRow = Array.isArray(chkRows[0]) ? chkRows[0][0] : (chkRows as unknown as Array<Record<string, unknown>>)[0];
      if (chkRow && Number(chkRow.cnt) === 0) {
        await db.execute(sql.raw(`ALTER TABLE merchant_settings ADD COLUMN ${colName} ${colDef}`));
      }
    }
    _merchantSettingsTableChecked = true;
  } catch (error) {
    console.error('[Database] Failed to ensure merchant_settings table:', error);
  }
}

const MERCHANT_SETTINGS_DEFAULTS = {
  defaultEndDayOffset: 7,
  defaultEndTime: '23:00',
  defaultStartingPrice: 0,
  defaultBidIncrement: 30,
  defaultAntiSnipeEnabled: 1,
  defaultAntiSnipeMinutes: 3,
  defaultExtendMinutes: 3,
  listingLayout: 'grid2',
  paymentInstructions: null as string | null,
  deliveryInfo: null as string | null,
  watermarkEnabled: 1,
  watermarkText: null as string | null,
  watermarkOpacity: 45,
  watermarkShadow: 1,
  watermarkPosition: 'center-diagonal',
  watermarkSize: 12,
};
export async function getMerchantSettings(userId: number): Promise<typeof MERCHANT_SETTINGS_DEFAULTS> {
  await ensureMerchantSettingsTable();
  const db = await getDb();
  if (!db) return { ...MERCHANT_SETTINGS_DEFAULTS };
  try {
    const result = await db.execute(sql`SELECT defaultEndDayOffset, defaultEndTime, defaultStartingPrice, defaultBidIncrement, defaultAntiSnipeEnabled, defaultAntiSnipeMinutes, defaultExtendMinutes, listingLayout, paymentInstructions, deliveryInfo, watermarkEnabled, watermarkText, watermarkOpacity, watermarkShadow, watermarkPosition, watermarkSize FROM merchant_settings WHERE userId = ${userId} LIMIT 1`);
    const rawRows = result as unknown as [Array<Record<string, unknown>>, unknown];
    let row: Record<string, unknown> | null = null;
    if (Array.isArray(rawRows[0])) {
      row = rawRows[0][0] ?? null;
    } else if (Array.isArray(rawRows)) {
      row = (rawRows as unknown as Array<Record<string, unknown>>)[0] ?? null;
    }
    if (row && typeof row === 'object') {
      return {
        defaultEndDayOffset: Number(row.defaultEndDayOffset ?? 7),
        defaultEndTime: String(row.defaultEndTime ?? '23:00'),
        defaultStartingPrice: Number(row.defaultStartingPrice ?? 0),
        defaultBidIncrement: Number(row.defaultBidIncrement ?? 30),
        defaultAntiSnipeEnabled: Number(row.defaultAntiSnipeEnabled ?? 1),
        defaultAntiSnipeMinutes: Number(row.defaultAntiSnipeMinutes ?? 3),
        defaultExtendMinutes: Number(row.defaultExtendMinutes ?? 3),
        listingLayout: String(row.listingLayout ?? 'grid2'),
        paymentInstructions: row.paymentInstructions != null ? String(row.paymentInstructions) : null,
        deliveryInfo: row.deliveryInfo != null ? String(row.deliveryInfo) : null,
        watermarkEnabled: Number(row.watermarkEnabled ?? 1),
        watermarkText: row.watermarkText != null ? String(row.watermarkText) : null,
        watermarkOpacity: Number(row.watermarkOpacity ?? 45),
        watermarkShadow: Number(row.watermarkShadow ?? 1),
        watermarkPosition: String(row.watermarkPosition ?? 'center-diagonal'),
        watermarkSize: Number(row.watermarkSize ?? 12),
      };
    }
    return { ...MERCHANT_SETTINGS_DEFAULTS };
  } catch (error) {
    console.error('[Database] getMerchantSettings error:', error);
    return { ...MERCHANT_SETTINGS_DEFAULTS };
  }
}

export async function upsertWatermarkSettings(userId: number, enabled: number, text: string | null, opacity: number, shadow: number, position: string, size: number): Promise<void> {
  await ensureMerchantSettingsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    INSERT INTO merchant_settings (userId, watermarkEnabled, watermarkText, watermarkOpacity, watermarkShadow, watermarkPosition, watermarkSize)
    VALUES (${userId}, ${enabled}, ${text}, ${opacity}, ${shadow}, ${position}, ${size})
    ON DUPLICATE KEY UPDATE
      watermarkEnabled = ${enabled},
      watermarkText = ${text},
      watermarkOpacity = ${opacity},
      watermarkShadow = ${shadow},
      watermarkPosition = ${position},
      watermarkSize = ${size},
      updatedAt = CURRENT_TIMESTAMP
  `);
}

export async function setMerchantListingLayout(userId: number, listingLayout: string): Promise<void> {
  await ensureMerchantSettingsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    INSERT INTO merchant_settings (userId, listingLayout)
    VALUES (${userId}, ${listingLayout})
    ON DUPLICATE KEY UPDATE listingLayout = ${listingLayout}, updatedAt = CURRENT_TIMESTAMP
  `);
}

export async function upsertMerchantSettings(userId: number, defaultEndDayOffset: number, defaultEndTime: string, defaultStartingPrice: number, defaultBidIncrement: number, defaultAntiSnipeEnabled: number, defaultAntiSnipeMinutes: number, defaultExtendMinutes: number, paymentInstructions?: string | null, deliveryInfo?: string | null): Promise<void> {
  await ensureMerchantSettingsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const pi = paymentInstructions ?? null;
  const di = deliveryInfo ?? null;
  await db.execute(sql`
    INSERT INTO merchant_settings (userId, defaultEndDayOffset, defaultEndTime, defaultStartingPrice, defaultBidIncrement, defaultAntiSnipeEnabled, defaultAntiSnipeMinutes, defaultExtendMinutes, paymentInstructions, deliveryInfo)
    VALUES (${userId}, ${defaultEndDayOffset}, ${defaultEndTime}, ${defaultStartingPrice}, ${defaultBidIncrement}, ${defaultAntiSnipeEnabled}, ${defaultAntiSnipeMinutes}, ${defaultExtendMinutes}, ${pi}, ${di})
    ON DUPLICATE KEY UPDATE
      defaultEndDayOffset = ${defaultEndDayOffset},
      defaultEndTime = ${defaultEndTime},
      defaultStartingPrice = ${defaultStartingPrice},
      defaultBidIncrement = ${defaultBidIncrement},
      defaultAntiSnipeEnabled = ${defaultAntiSnipeEnabled},
      defaultAntiSnipeMinutes = ${defaultAntiSnipeMinutes},
      defaultExtendMinutes = ${defaultExtendMinutes},
      paymentInstructions = ${pi},
      deliveryInfo = ${di},
      updatedAt = CURRENT_TIMESTAMP
  `);
}

/** 撤銷商戶資格：把申請狀態改為 rejected + 刪除市集商品（保留用戶帳號及保證金帳戶） */
export async function revokeMerchantStatus(userId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'DB unavailable' };
  try {
    // 1. 找出該用戶的商戶申請記錄
    const app = await getMerchantApplicationByUser(userId);
    if (!app) return { success: false, error: '找不到商戶申請記錄' };
    // 2. 把申請狀態改為 rejected（從市集消失）
    await db.update(merchantApplications)
      .set({ status: 'rejected', adminNote: '管理員撤銷商戶資格' })
      .where(eq(merchantApplications.id, app.id));
    // 3. 刪除市集出售商品
    await db.delete(merchantProducts).where(eq(merchantProducts.merchantId, userId));
    return { success: true };
  } catch (error) {
    console.error('[Database] revokeMerchantStatus failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
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
    // 檢查是否符合 VIP 三個條件
    await checkAndUpgradeToVip(app.userId).catch(() => {});
  }
}

// ─── Commission Auto-Deduction ────────────────────────────────────────────────

/**
 * Idempotent: deduct commission from the auction creator's deposit when auction ends.
 * Safe to call multiple times — skips if already deducted for this auction.
 */
export async function autoDeductCommissionOnAuctionEnd(auctionId: number): Promise<{ deducted: boolean; amount?: number; newBalance?: number; belowWarning?: boolean }> {
  const db = await getDb();
  if (!db) return { deducted: false };

  // Check if commission already deducted for this auction
  const existing = await db.select({ id: depositTransactions.id })
    .from(depositTransactions)
    .where(and(eq(depositTransactions.relatedAuctionId, auctionId), eq(depositTransactions.type, 'commission')))
    .limit(1);
  if (existing.length > 0) return { deducted: false }; // already done

  // Get auction details
  const [auction] = await db.select({
    id: auctions.id,
    createdBy: auctions.createdBy,
    currentPrice: auctions.currentPrice,
    highestBidderId: auctions.highestBidderId,
    status: auctions.status,
  }).from(auctions).where(eq(auctions.id, auctionId)).limit(1);

  if (!auction || !auction.highestBidderId || !auction.currentPrice) return { deducted: false };
  if (auction.status !== 'ended') return { deducted: false };

  const finalPrice = parseFloat(String(auction.currentPrice));
  if (finalPrice <= 0) return { deducted: false };

  const deposit = await getOrCreateSellerDeposit(auction.createdBy);
  if (!deposit) return { deducted: false };

  const rate = parseFloat(deposit.commissionRate.toString());
  const commission = parseFloat((finalPrice * rate).toFixed(2));
  if (commission <= 0) return { deducted: false };

  const currentBalance = parseFloat(deposit.balance.toString());
  const newBalance = parseFloat((currentBalance - commission).toFixed(2));

  await db.update(sellerDeposits).set({ balance: newBalance.toFixed(2) }).where(eq(sellerDeposits.userId, auction.createdBy));
  await db.insert(depositTransactions).values({
    depositId: deposit.id,
    userId: auction.createdBy,
    type: 'commission',
    amount: (-commission).toFixed(2),
    balanceAfter: newBalance.toFixed(2),
    description: `拍賣 #${auctionId} 成交傭金 (成交價 $${finalPrice.toFixed(0)} × ${(rate * 100).toFixed(1)}%)`,
    relatedAuctionId: auctionId,
    createdBy: null,
  });

  const warningDeposit = parseFloat(deposit.warningDeposit?.toString() ?? '1000');
  const belowWarning = newBalance < warningDeposit;

  // If balance drops below requiredDeposit, disable listing
  const required = parseFloat(deposit.requiredDeposit.toString());
  if (newBalance < required) {
    await db.update(sellerDeposits).set({ isActive: 0 }).where(eq(sellerDeposits.userId, auction.createdBy));
    console.log(`[Deposit] Merchant ${auction.createdBy} balance $${newBalance} below required $${required} — listing disabled`);
  }

  console.log(`[Commission] Auction #${auctionId}: deducted $${commission} from merchant ${auction.createdBy}, balance $${currentBalance} → $${newBalance}${belowWarning ? ' ⚠️ below warning' : ''}`);
  return { deducted: true, amount: commission, newBalance, belowWarning };
}

// ─── Listing Quota ────────────────────────────────────────────────────────────

/**
 * Get the active subscription's quota info for a merchant.
 * Returns null if no active quota-based subscription.
 */
export async function getListingQuotaInfo(userId: number): Promise<{
  subscriptionId: number;
  planName: string;
  maxListings: number;
  remainingQuota: number;
  unlimited: boolean;
  endDate: Date | null;
} | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.select({
      id: userSubscriptions.id,
      planName: subscriptionPlans.name,
      maxListings: subscriptionPlans.maxListings,
      remainingQuota: userSubscriptions.remainingQuota,
      endDate: userSubscriptions.endDate,
    })
      .from(userSubscriptions)
      .leftJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active')))
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);
    if (!row) return null;
    const max = row.maxListings ?? 0;
    // If remainingQuota is null (legacy records before fix), treat as full quota
    const remaining = row.remainingQuota !== null && row.remainingQuota !== undefined
      ? row.remainingQuota
      : max;
    return {
      subscriptionId: row.id,
      planName: row.planName ?? '',
      maxListings: max,
      remainingQuota: remaining,
      unlimited: max === 0,
      endDate: row.endDate ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Deduct 1 listing quota from the merchant's active subscription.
 * Returns false if no quota available (subscription expired or quota exhausted).
 */
export async function deductListingQuota(userId: number): Promise<{ success: boolean; remaining?: number; unlimited?: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { success: false, reason: '資料庫不可用' };
  const info = await getListingQuotaInfo(userId);
  if (!info) return { success: false, reason: '您尚未訂閱月費計劃，請先訂閱後才可發佈拍賣' };
  if (info.unlimited) return { success: true, unlimited: true }; // maxListings = 0 = unlimited

  if (info.remainingQuota <= 0) {
    return { success: false, reason: `發佈次數已用盡（訂閱方案：${info.planName}）` };
  }
  const newRemaining = info.remainingQuota - 1;
  await db.update(userSubscriptions)
    .set({ remainingQuota: newRemaining })
    .where(eq(userSubscriptions.id, info.subscriptionId));
  return { success: true, remaining: newRemaining };
}

/**
 * Atomically deduct N listing quotas in a single SQL UPDATE (avoids race condition in batch publish).
 * Uses remainingQuota = remainingQuota - count at the DB level so parallel calls don't clobber each other.
 */
export async function deductListingQuotaBulk(userId: number, count: number): Promise<{ success: boolean; remaining?: number; unlimited?: boolean; reason?: string }> {
  if (count <= 0) return { success: true, remaining: undefined };
  const db = await getDb();
  if (!db) return { success: false, reason: '資料庫不可用' };
  const info = await getListingQuotaInfo(userId);
  if (!info) return { success: false, reason: '您尚未訂閱月費計劃' };
  if (info.unlimited) return { success: true, unlimited: true };
  if (info.remainingQuota < count) {
    return { success: false, reason: `發佈次數不足（剩餘 ${info.remainingQuota}，需要 ${count}）` };
  }
  // Single atomic UPDATE using Drizzle ORM (handles table/column naming automatically)
  // remainingQuota = remainingQuota - count, only if remainingQuota >= count
  await db.update(userSubscriptions)
    .set({ remainingQuota: sql`${userSubscriptions.remainingQuota} - ${count}` })
    .where(and(eq(userSubscriptions.id, info.subscriptionId), gte(userSubscriptions.remainingQuota, count)));
  const newRemaining = info.remainingQuota - count;
  return { success: true, remaining: newRemaining };
}

export async function adminSetSubscriptionQuota(subscriptionId: number, remainingQuota: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(userSubscriptions)
    .set({ remainingQuota })
    .where(eq(userSubscriptions.id, subscriptionId));
  return { success: true };
}

// ─── Commission Refund Requests ───────────────────────────────────────────────

export async function createRefundRequest(data: {
  auctionId: number;
  userId: number;
  commissionAmount: number;
  reason: 'buyer_missing' | 'buyer_refused' | 'mutual_cancel' | 'other';
  reasonDetail?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  // Check: only one pending/approved request per auction per user
  const existing = await db.select({ id: commissionRefundRequests.id })
    .from(commissionRefundRequests)
    .where(and(eq(commissionRefundRequests.auctionId, data.auctionId), eq(commissionRefundRequests.userId, data.userId)))
    .limit(1);
  if (existing.length > 0) throw new Error('此拍賣已提交過退傭申請');

  const [result] = await db.insert(commissionRefundRequests).values({
    auctionId: data.auctionId,
    userId: data.userId,
    commissionAmount: data.commissionAmount.toFixed(2),
    reason: data.reason,
    reasonDetail: data.reasonDetail ?? null,
    status: 'pending',
  });
  return result;
}

export async function getMyRefundRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: commissionRefundRequests.id,
    auctionId: commissionRefundRequests.auctionId,
    commissionAmount: commissionRefundRequests.commissionAmount,
    reason: commissionRefundRequests.reason,
    reasonDetail: commissionRefundRequests.reasonDetail,
    status: commissionRefundRequests.status,
    adminNote: commissionRefundRequests.adminNote,
    reviewedAt: commissionRefundRequests.reviewedAt,
    createdAt: commissionRefundRequests.createdAt,
    auctionTitle: sql<string | null>`(SELECT title FROM auctions WHERE id = ${commissionRefundRequests.auctionId})`,
  })
    .from(commissionRefundRequests)
    .where(eq(commissionRefundRequests.userId, userId))
    .orderBy(desc(commissionRefundRequests.createdAt));
}

export async function getAllRefundRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: commissionRefundRequests.id,
    auctionId: commissionRefundRequests.auctionId,
    userId: commissionRefundRequests.userId,
    commissionAmount: commissionRefundRequests.commissionAmount,
    reason: commissionRefundRequests.reason,
    reasonDetail: commissionRefundRequests.reasonDetail,
    status: commissionRefundRequests.status,
    adminNote: commissionRefundRequests.adminNote,
    reviewedAt: commissionRefundRequests.reviewedAt,
    createdAt: commissionRefundRequests.createdAt,
    merchantName: sql<string | null>`(SELECT name FROM users WHERE id = ${commissionRefundRequests.userId})`,
    auctionTitle: sql<string | null>`(SELECT title FROM auctions WHERE id = ${commissionRefundRequests.auctionId})`,
  })
    .from(commissionRefundRequests)
    .orderBy(desc(commissionRefundRequests.createdAt));
}

export async function reviewRefundRequest(
  id: number,
  status: 'approved' | 'rejected',
  adminNote: string | undefined,
  adminId: number
) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  const [req] = await db.select().from(commissionRefundRequests)
    .where(eq(commissionRefundRequests.id, id)).limit(1);
  if (!req) throw new Error('找不到申請');
  if (req.status !== 'pending') throw new Error('此申請已審核');

  await db.update(commissionRefundRequests).set({
    status,
    adminNote: adminNote ?? null,
    reviewedBy: adminId,
    reviewedAt: new Date(),
  }).where(eq(commissionRefundRequests.id, id));

  // If approved: refund the commission back to merchant's deposit
  if (status === 'approved') {
    const amount = parseFloat(req.commissionAmount.toString());
    await refundCommission(req.userId, amount, req.auctionId, `退傭申請 #${id} 已批准`, adminId);
  }
}

// ─── Deposit Top-Up Requests ──────────────────────────────────────────────────

export async function createDepositTopUpRequest(data: {
  userId: number;
  tierId?: number;
  amount: number;
  referenceNo?: string;
  bank?: string;
  note?: string;
  receiptUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const [result] = await db.insert(depositTopUpRequests).values({
    userId: data.userId,
    tierId: data.tierId ?? null,
    amount: data.amount.toFixed(2),
    referenceNo: data.referenceNo?.trim() || '',
    bank: data.bank?.trim() || null,
    note: data.note?.trim() || null,
    receiptUrl: data.receiptUrl?.trim() || null,
    status: 'pending',
  });
  return { id: (result as { insertId?: number })?.insertId ?? 0 };
}

export async function getMyDepositTopUpRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(depositTopUpRequests)
    .where(eq(depositTopUpRequests.userId, userId))
    .orderBy(desc(depositTopUpRequests.createdAt))
    .limit(20);
}

export async function getAllDepositTopUpRequests() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: depositTopUpRequests.id,
      userId: depositTopUpRequests.userId,
      amount: depositTopUpRequests.amount,
      referenceNo: depositTopUpRequests.referenceNo,
      bank: depositTopUpRequests.bank,
      note: depositTopUpRequests.note,
      receiptUrl: depositTopUpRequests.receiptUrl,
      status: depositTopUpRequests.status,
      adminNote: depositTopUpRequests.adminNote,
      reviewedBy: depositTopUpRequests.reviewedBy,
      reviewedAt: depositTopUpRequests.reviewedAt,
      createdAt: depositTopUpRequests.createdAt,
      userName: users.name,
      userPhone: users.phone,
    })
    .from(depositTopUpRequests)
    .leftJoin(users, eq(depositTopUpRequests.userId, users.id))
    .orderBy(desc(depositTopUpRequests.createdAt))
    .limit(200);
  return rows;
}

export async function reviewDepositTopUpRequest(
  id: number,
  status: 'approved' | 'rejected',
  adminNote: string | undefined,
  adminId: number
) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  const [req] = await db.select().from(depositTopUpRequests)
    .where(eq(depositTopUpRequests.id, id)).limit(1);
  if (!req) throw new Error('找不到申請');
  if (req.status !== 'pending') throw new Error('此申請已審核');

  await db.update(depositTopUpRequests).set({
    status,
    adminNote: adminNote ?? null,
    reviewedBy: adminId,
    reviewedAt: new Date(),
  }).where(eq(depositTopUpRequests.id, id));

  // If approved: top up the merchant's deposit and apply tier commission rate
  if (status === 'approved') {
    const amount = parseFloat(req.amount.toString());
    await topUpDeposit(req.userId, amount, `商戶自助申請充值 (參考號: ${req.referenceNo})`, adminId);

    // Auto-apply tier commission rate if the request was linked to a tier
    if (req.tierId) {
      try {
        const [tier] = await db.select().from(depositTierPresets)
          .where(eq(depositTierPresets.id, req.tierId)).limit(1);
        if (tier && tier.commissionRate) {
          const commissionRate = parseFloat(tier.commissionRate.toString());
          await updateSellerDepositSettings(req.userId, { commissionRate });
          console.log(`[Deposit] Auto-applied tier "${tier.name}" commission rate ${(commissionRate * 100).toFixed(2)}% to user ${req.userId}`);
        }
      } catch (err) {
        console.error('[Deposit] Failed to apply tier commission rate:', err);
      }
    }

    // 保證金充值批准後，額外檢查是否符合 VIP 三個條件
    await checkAndUpgradeToVip(req.userId).catch(() => {});
  }
}

// ─── Deposit Tier Presets ─────────────────────────────────────────────────────

export async function listDepositTierPresets(onlyActive = false) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(depositTierPresets)
      .where(onlyActive ? eq(depositTierPresets.isActive, 1) : undefined)
      .orderBy(asc(depositTierPresets.sortOrder), asc(depositTierPresets.id));
    return rows;
  } catch (error) {
    console.error('[Database] Failed to list deposit tier presets:', error);
    return [];
  }
}

export async function upsertDepositTierPreset(data: {
  id?: number;
  name: string;
  amount: number;
  maintenancePct: number;
  warningPct: number;
  commissionRate?: number;
  productCommissionRate?: number;
  description?: string | null;
  isActive?: number;
  sortOrder?: number;
}) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const payload = {
    name: data.name,
    amount: data.amount.toFixed(2),
    maintenancePct: data.maintenancePct.toFixed(2),
    warningPct: data.warningPct.toFixed(2),
    commissionRate: (data.commissionRate ?? 0.05).toFixed(4),
    productCommissionRate: (data.productCommissionRate ?? data.commissionRate ?? 0.05).toFixed(4),
    description: data.description ?? null,
    isActive: data.isActive ?? 1,
    sortOrder: data.sortOrder ?? 0,
  };
  if (data.id) {
    await db.update(depositTierPresets).set(payload).where(eq(depositTierPresets.id, data.id));
    return data.id;
  } else {
    const [result] = await db.insert(depositTierPresets).values(payload);
    return (result as any).insertId as number;
  }
}

export async function deleteDepositTierPreset(id: number) {
  await ensureDepositTables();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.delete(depositTierPresets).where(eq(depositTierPresets.id, id));
}

// ─── Merchant Products ────────────────────────────────────────────────────────

let _merchantProductsTableChecked = false;
async function ensureMerchantProductsTable() {
  if (_merchantProductsTableChecked) return;
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS merchantProducts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      merchantId INT NOT NULL,
      merchantName VARCHAR(100) NOT NULL,
      merchantIcon VARCHAR(500),
      whatsapp VARCHAR(30),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'HKD',
      category VARCHAR(50),
      images TEXT,
      stock INT NOT NULL DEFAULT 1,
      status ENUM('active','sold','hidden') NOT NULL DEFAULT 'active',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  _merchantProductsTableChecked = true;
}

export async function listMerchantProducts(opts: { merchantId?: number; category?: string; status?: string } = {}): Promise<MerchantProduct[]> {
  await ensureMerchantProductsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const conditions: any[] = [];
  if (opts.merchantId) conditions.push(eq(merchantProducts.merchantId, opts.merchantId));
  if (opts.category) conditions.push(eq(merchantProducts.category, opts.category));
  if (opts.status === 'active_and_sold') {
    conditions.push(or(eq(merchantProducts.status, 'active'), eq(merchantProducts.status, 'sold'))!);
  } else if (opts.status && opts.status !== 'all') {
    conditions.push(eq(merchantProducts.status, opts.status as any));
  } else if (!opts.status) {
    conditions.push(eq(merchantProducts.status, 'active'));
  }
  const rows = await db.select().from(merchantProducts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(merchantProducts.createdAt));
  return rows as MerchantProduct[];
}

export async function getMerchantProduct(id: number): Promise<MerchantProduct | null> {
  await ensureMerchantProductsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const rows = await db.select().from(merchantProducts).where(eq(merchantProducts.id, id));
  return (rows[0] as MerchantProduct) ?? null;
}

export async function createMerchantProduct(data: {
  merchantId: number; merchantName: string; merchantIcon?: string; whatsapp?: string;
  title: string; description?: string; price: number; currency?: string;
  category?: string; images?: string; stock?: number;
}): Promise<number> {
  await ensureMerchantProductsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const [result] = await db.insert(merchantProducts).values({
    merchantId: data.merchantId,
    merchantName: data.merchantName,
    merchantIcon: data.merchantIcon ?? null,
    whatsapp: data.whatsapp ?? null,
    title: data.title,
    description: data.description ?? null,
    price: data.price.toFixed(2) as any,
    currency: data.currency ?? 'HKD',
    category: data.category ?? null,
    images: data.images ?? null,
    stock: data.stock ?? 1,
    status: 'active',
  });
  return (result as any).insertId as number;
}

export async function updateMerchantProduct(id: number, merchantId: number, data: Partial<{
  title: string; description: string; price: number; currency: string;
  category: string; images: string; stock: number; status: string;
}>): Promise<void> {
  await ensureMerchantProductsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const payload: any = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.price !== undefined) payload.price = data.price.toFixed(2);
  if (data.currency !== undefined) payload.currency = data.currency;
  if (data.category !== undefined) payload.category = data.category;
  if (data.images !== undefined) payload.images = data.images;
  if (data.stock !== undefined) payload.stock = data.stock;
  if (data.status !== undefined) payload.status = data.status;
  await db.update(merchantProducts).set(payload)
    .where(and(eq(merchantProducts.id, id), eq(merchantProducts.merchantId, merchantId)));
}

export async function deleteMerchantProduct(id: number, merchantId: number): Promise<void> {
  await ensureMerchantProductsTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.delete(merchantProducts)
    .where(and(eq(merchantProducts.id, id), eq(merchantProducts.merchantId, merchantId)));
}

export async function listApprovedMerchants(): Promise<Array<{
  userId: number; merchantName: string; selfIntro: string; merchantIcon: string | null; whatsapp: string; facebook: string | null; categories: string | null; listingLayout: string;
}>> {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  // Step 1: fetch approved merchants reliably via Drizzle
  const merchants = await db.select({
    userId: merchantApplications.userId,
    merchantName: merchantApplications.merchantName,
    selfIntro: merchantApplications.selfIntro,
    merchantIcon: merchantApplications.merchantIcon,
    whatsapp: merchantApplications.whatsapp,
    facebook: merchantApplications.facebook,
    categories: merchantApplications.categories,
  }).from(merchantApplications).where(eq(merchantApplications.status, 'approved'))
    .orderBy(asc(merchantApplications.merchantName));

  // Step 2: try to fetch listingLayout per merchant separately (safe try/catch)
  const layoutMap: Record<number, string> = {};
  try {
    await ensureMerchantSettingsTable();
    const lResult = await db.execute(sql`SELECT userId, listingLayout FROM merchant_settings`);
    const lRaw = lResult as unknown as [Array<Record<string, unknown>>, unknown];
    const lRows: Array<Record<string, unknown>> = Array.isArray(lRaw[0])
      ? (lRaw[0] as Array<Record<string, unknown>>)
      : (lRaw as unknown as Array<Record<string, unknown>>);
    if (Array.isArray(lRows)) {
      for (const r of lRows) {
        if (r.userId != null && r.listingLayout) {
          layoutMap[Number(r.userId)] = String(r.listingLayout);
        }
      }
    }
  } catch (err) {
    console.error('[Database] listApprovedMerchants: could not load layouts:', err);
  }

  // Step 3: fetch sorting data (all with try/catch so failure just means sort by 0)
  const depositMap: Record<number, number> = {};   // userId -> requiredDeposit
  const subPriceMap: Record<number, number> = {};  // userId -> active plan monthlyPrice
  const auctionCountMap: Record<number, number> = {};
  const productCountMap: Record<number, number> = {};

  try {
    // 保證金套餐 (requiredDeposit)
    const dRes = await db.execute(sql`SELECT userId, requiredDeposit FROM seller_deposits`);
    const dRaw = dRes as unknown as [Array<Record<string, unknown>>, unknown];
    const dRows = Array.isArray(dRaw[0]) ? dRaw[0] : (dRaw as unknown as Array<Record<string, unknown>>);
    if (Array.isArray(dRows)) {
      for (const r of dRows) {
        if (r.userId != null) depositMap[Number(r.userId)] = parseFloat(String(r.requiredDeposit ?? '0'));
      }
    }
  } catch (err) { console.error('[Database] listApprovedMerchants: deposit sort failed:', err); }

  try {
    // 有效月費套餐 (active subscription monthlyPrice)
    const sRes = await db.execute(sql`
      SELECT us.userId, sp.monthlyPrice
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.planId
      WHERE us.status = 'active'
    `);
    const sRaw = sRes as unknown as [Array<Record<string, unknown>>, unknown];
    const sRows = Array.isArray(sRaw[0]) ? sRaw[0] : (sRaw as unknown as Array<Record<string, unknown>>);
    if (Array.isArray(sRows)) {
      for (const r of sRows) {
        if (r.userId != null) {
          const price = parseFloat(String(r.monthlyPrice ?? '0'));
          if ((subPriceMap[Number(r.userId)] ?? 0) < price) subPriceMap[Number(r.userId)] = price;
        }
      }
    }
  } catch (err) { console.error('[Database] listApprovedMerchants: subscription sort failed:', err); }

  try {
    // 拍賣商品數量
    const aRes = await db.execute(sql`SELECT createdBy as userId, COUNT(*) as cnt FROM auctions GROUP BY createdBy`);
    const aRaw = aRes as unknown as [Array<Record<string, unknown>>, unknown];
    const aRows = Array.isArray(aRaw[0]) ? aRaw[0] : (aRaw as unknown as Array<Record<string, unknown>>);
    if (Array.isArray(aRows)) {
      for (const r of aRows) {
        if (r.userId != null) auctionCountMap[Number(r.userId)] = Number(r.cnt ?? 0);
      }
    }
  } catch (err) { console.error('[Database] listApprovedMerchants: auction count sort failed:', err); }

  try {
    // 出售商品上架數量
    const pRes = await db.execute(sql`SELECT merchantId as userId, COUNT(*) as cnt FROM merchantProducts GROUP BY merchantId`);
    const pRaw = pRes as unknown as [Array<Record<string, unknown>>, unknown];
    const pRows = Array.isArray(pRaw[0]) ? pRaw[0] : (pRaw as unknown as Array<Record<string, unknown>>);
    if (Array.isArray(pRows)) {
      for (const r of pRows) {
        if (r.userId != null) productCountMap[Number(r.userId)] = Number(r.cnt ?? 0);
      }
    }
  } catch (err) { console.error('[Database] listApprovedMerchants: product count sort failed:', err); }

  const base = (merchants as any[]).map(r => ({
    userId: Number(r.userId),
    merchantName: String(r.merchantName ?? ''),
    selfIntro: String(r.selfIntro ?? ''),
    merchantIcon: r.merchantIcon ? String(r.merchantIcon) : null,
    whatsapp: String(r.whatsapp ?? ''),
    facebook: r.facebook ? String(r.facebook) : null,
    categories: r.categories ? String(r.categories) : null,
    listingLayout: layoutMap[Number(r.userId)] ?? 'grid2',
  }));

  // Sort: 1) requiredDeposit DESC, 2) monthlyPrice DESC, 3) auctionCount DESC, 4) productCount DESC
  base.sort((a, b) => {
    const d = (depositMap[b.userId] ?? 0) - (depositMap[a.userId] ?? 0);
    if (d !== 0) return d;
    const s = (subPriceMap[b.userId] ?? 0) - (subPriceMap[a.userId] ?? 0);
    if (s !== 0) return s;
    const ac = (auctionCountMap[b.userId] ?? 0) - (auctionCountMap[a.userId] ?? 0);
    if (ac !== 0) return ac;
    return (productCountMap[b.userId] ?? 0) - (productCountMap[a.userId] ?? 0);
  });

  return base;
}

// ─── 套餐資料匯出 / 匯入 ─────────────────────────────────────────────────────

export async function exportPackagesData() {
  const db = await getDb();
  const [tiers, plans] = await Promise.all([
    db.select().from(depositTierPresets).orderBy(asc(depositTierPresets.sortOrder), asc(depositTierPresets.id)),
    db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.id)),
  ]);
  return { depositTiers: tiers, subscriptionPlans: plans, exportedAt: new Date().toISOString() };
}

export async function importPackagesData(data: {
  depositTiers: { id: number; name: string; amount: string; maintenancePct: string; warningPct: string; commissionRate: string; description: string | null; isActive: number; sortOrder: number }[];
  subscriptionPlans: { id: number; name: string; memberLevel: string; monthlyPrice: string; yearlyPrice: string; maxListings: number; commissionDiscount: string; description: string | null; benefits: string | null; sortOrder: number; isActive: number }[];
}): Promise<{ success: boolean; tiersImported: number; plansImported: number; error?: string }> {
  try {
    const db = await getDb();

    // depositTierPresets
    await db.delete(depositTierPresets);
    if (data.depositTiers.length > 0) {
      for (const t of data.depositTiers) {
        await db.execute(sql`
          INSERT INTO depositTierPresets (id, name, amount, maintenancePct, warningPct, commissionRate, description, isActive, sortOrder)
          VALUES (${t.id}, ${t.name}, ${t.amount}, ${t.maintenancePct}, ${t.warningPct}, ${t.commissionRate}, ${t.description ?? null}, ${t.isActive}, ${t.sortOrder})
        `);
      }
      const maxTierId = Math.max(...data.depositTiers.map(t => t.id));
      await db.execute(sql`ALTER TABLE depositTierPresets AUTO_INCREMENT = ${maxTierId + 1}`);
    }

    // subscriptionPlans
    await db.delete(subscriptionPlans);
    if (data.subscriptionPlans.length > 0) {
      for (const p of data.subscriptionPlans) {
        await db.execute(sql`
          INSERT INTO subscription_plans (id, name, memberLevel, monthlyPrice, yearlyPrice, maxListings, commissionDiscount, description, benefits, sortOrder, isActive)
          VALUES (${p.id}, ${p.name}, ${p.memberLevel}, ${p.monthlyPrice}, ${p.yearlyPrice}, ${p.maxListings}, ${p.commissionDiscount}, ${p.description ?? null}, ${p.benefits ?? null}, ${p.sortOrder}, ${p.isActive})
        `);
      }
      const maxPlanId = Math.max(...data.subscriptionPlans.map(p => p.id));
      await db.execute(sql`ALTER TABLE subscription_plans AUTO_INCREMENT = ${maxPlanId + 1}`);
    }

    return { success: true, tiersImported: data.depositTiers.length, plansImported: data.subscriptionPlans.length };
  } catch (err: any) {
    console.error('[importPackagesData]', err);
    return { success: false, tiersImported: 0, plansImported: 0, error: String(err?.message ?? err) };
  }
}

// ─────────────────────────────────────────────
// 商品訂單（Product Orders）
// ─────────────────────────────────────────────

let _ordersTableEnsured = false;
async function ensureProductOrdersTable() {
  if (_ordersTableEnsured) return;
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS productOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      buyerId INT NOT NULL,
      merchantId INT NOT NULL,
      title VARCHAR(500) NOT NULL,
      price DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'HKD',
      quantity INT NOT NULL DEFAULT 1,
      commissionRate DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
      commissionAmount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
      buyerName VARCHAR(200),
      buyerPhone VARCHAR(50),
      buyerNote TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmedAt DATETIME,
      cancelledAt DATETIME,
      cancelReason VARCHAR(500)
    )
  `);
  // 欄位遷移（一次性）
  try { await db.execute(sql`ALTER TABLE productOrders ADD COLUMN finalPrice DECIMAL(12,2)`); } catch {}
  _ordersTableEnsured = true;
}

export interface ProductOrder {
  id: number;
  productId: number;
  buyerId: number;
  merchantId: number;
  title: string;
  price: string;
  currency: string;
  quantity: number;
  commissionRate: string;
  commissionAmount: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  buyerName: string | null;
  buyerPhone: string | null;
  buyerNote: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
}

export async function createProductOrder(data: {
  productId: number; buyerId: number; merchantId: number;
  title: string; price: number; currency: string; quantity: number;
  commissionRate: number; buyerName?: string; buyerPhone?: string; buyerNote?: string;
}): Promise<number> {
  await ensureProductOrdersTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const commissionAmount = (data.price * data.quantity * data.commissionRate).toFixed(2);
  const [result] = await db.execute(sql`
    INSERT INTO productOrders
      (productId, buyerId, merchantId, title, price, currency, quantity, commissionRate, commissionAmount, status, buyerName, buyerPhone, buyerNote)
    VALUES
      (${data.productId}, ${data.buyerId}, ${data.merchantId}, ${data.title},
       ${data.price.toFixed(2)}, ${data.currency}, ${data.quantity},
       ${data.commissionRate.toFixed(4)}, ${commissionAmount}, 'pending',
       ${data.buyerName ?? null}, ${data.buyerPhone ?? null}, ${data.buyerNote ?? null})
  `);
  return (result as any).insertId as number;
}

export async function getProductOrdersByMerchant(merchantId: number, status?: string): Promise<any[]> {
  await ensureProductOrdersTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  let rows: any;
  if (status && status !== 'all') {
    rows = await db.execute(sql`
      SELECT o.*, u.name as buyerDisplayName, u.phone as buyerPhoneFromUser,
             mp.images as productImages
      FROM productOrders o
      LEFT JOIN users u ON u.id = o.buyerId
      LEFT JOIN merchantProducts mp ON mp.id = o.productId
      WHERE o.merchantId = ${merchantId} AND o.status = ${status}
      ORDER BY o.createdAt DESC
    `);
  } else {
    rows = await db.execute(sql`
      SELECT o.*, u.name as buyerDisplayName, u.phone as buyerPhoneFromUser,
             mp.images as productImages
      FROM productOrders o
      LEFT JOIN users u ON u.id = o.buyerId
      LEFT JOIN merchantProducts mp ON mp.id = o.productId
      WHERE o.merchantId = ${merchantId}
      ORDER BY o.createdAt DESC
    `);
  }
  return (rows[0] as any[]) ?? [];
}

export async function getProductOrdersByBuyer(buyerId: number): Promise<any[]> {
  await ensureProductOrdersTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const rows = await db.execute(sql`
    SELECT o.*, ma.merchantName
    FROM productOrders o
    LEFT JOIN merchantApplications ma ON ma.userId = o.merchantId AND ma.status = 'approved'
    WHERE o.buyerId = ${buyerId}
    ORDER BY o.createdAt DESC
  `);
  return (rows[0] as any[]) ?? [];
}

export async function getAllProductOrders(): Promise<any[]> {
  await ensureProductOrdersTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const rows = await db.execute(sql`
    SELECT o.*, u.name as buyerDisplayName,
           ma.merchantName
    FROM productOrders o
    LEFT JOIN users u ON u.id = o.buyerId
    LEFT JOIN merchantApplications ma ON ma.userId = o.merchantId AND ma.status = 'approved'
    ORDER BY o.createdAt DESC
    LIMIT 500
  `);
  return (rows[0] as any[]) ?? [];
}

export async function confirmProductOrder(orderId: number, merchantId: number, finalPrice?: number): Promise<{ ok: boolean; error?: string }> {
  await ensureProductOrdersTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  const rows = await db.execute(sql`SELECT * FROM productOrders WHERE id = ${orderId} AND merchantId = ${merchantId} LIMIT 1`);
  const order = ((rows[0] as any[])[0]) as any;
  if (!order) return { ok: false, error: '找不到此訂單' };
  if (order.status !== 'pending') return { ok: false, error: '訂單狀態不可確認' };

  const listedPrice = parseFloat(String(order.price));
  const qty = parseInt(String(order.quantity));
  const commissionRate = parseFloat(String(order.commissionRate));

  // 以實際成交價計算傭金（若商戶未填則用原價）
  const actualUnitPrice = (finalPrice != null && finalPrice > 0) ? finalPrice : listedPrice;
  const commissionAmount = actualUnitPrice * qty * commissionRate;
  const fp = actualUnitPrice !== listedPrice ? actualUnitPrice : null;

  await db.execute(sql`
    UPDATE productOrders
    SET status = 'confirmed', confirmedAt = NOW(),
        commissionAmount = ${commissionAmount.toFixed(2)},
        finalPrice = ${fp}
    WHERE id = ${orderId}
  `);

  await db.execute(sql`
    UPDATE merchantProducts SET stock = GREATEST(stock - ${qty}, 0) WHERE id = ${order.productId}
  `);
  await db.execute(sql`
    UPDATE merchantProducts SET status = 'sold' WHERE id = ${order.productId} AND stock = 0
  `);

  try {
    await deductCommission(merchantId, commissionAmount, 0, `商品訂單 #${orderId}：${order.title}（實際成交 ${order.currency ?? 'HKD'} $${actualUnitPrice.toFixed(2)} × ${qty}）`);
  } catch (e) {
    console.error('[confirmProductOrder] deductCommission failed', e);
  }

  return { ok: true };
}

export async function cancelProductOrder(orderId: number, byUserId: number, isAdmin: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  await ensureProductOrdersTable();
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');

  const rows = await db.execute(sql`SELECT * FROM productOrders WHERE id = ${orderId} LIMIT 1`);
  const order = ((rows[0] as any[])[0]) as any;
  if (!order) return { ok: false, error: '找不到此訂單' };
  if (!isAdmin && order.buyerId !== byUserId && order.merchantId !== byUserId) return { ok: false, error: '無權操作' };
  if (order.status !== 'pending') return { ok: false, error: '只有待確認的訂單可以取消' };

  await db.execute(sql`
    UPDATE productOrders SET status = 'cancelled', cancelledAt = NOW(), cancelReason = ${reason ?? null}
    WHERE id = ${orderId}
  `);
  return { ok: true };
}

// ── 主打商品付費刊登 (featuredListings) ────────────────────────────────────

// 各時段預設收費（HKD）
export const FEATURED_TIER_PRICES: Record<string, number> = {
  day1: 30,  // 24 小時
  day3: 70,  // 3 天
  day7: 120, // 7 天
};

export const FEATURED_TIER_HOURS: Record<string, number> = {
  day1: 24,
  day3: 72,
  day7: 168,
};

export const FEATURED_TIER_LABELS: Record<string, string> = {
  day1: "24 小時（HK$30）",
  day3: "3 天（HK$70）",
  day7: "7 天（HK$120）",
};

/** 最多同時主打位數（可在此調整） */
export const MAX_FEATURED_SLOTS = 10;

let _featuredTableChecked = false;
async function ensureFeaturedListingsTable() {
  if (_featuredTableChecked) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS featuredListings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        merchantId INT NOT NULL,
        productId INT NOT NULL,
        productTitle VARCHAR(200) NOT NULL,
        merchantName VARCHAR(100) NOT NULL,
        tier ENUM('day1','day3','day7') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('active','queued','expired','cancelled') NOT NULL DEFAULT 'active',
        startAt TIMESTAMP NULL,
        endAt TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 遷移：舊版 startAt/endAt 可能為 NOT NULL，此處容錯處理
    try { await db.execute(sql`ALTER TABLE featuredListings MODIFY startAt TIMESTAMP NULL`); } catch {}
    try { await db.execute(sql`ALTER TABLE featuredListings MODIFY endAt TIMESTAMP NULL`); } catch {}
    try { await db.execute(sql`ALTER TABLE featuredListings MODIFY status ENUM('active','queued','expired','cancelled') NOT NULL DEFAULT 'active'`); } catch {}
    _featuredTableChecked = true;
  } catch (e) {
    console.error('[featuredListings] ensureTable error:', e);
  }
}

/** 內部：將排隊中的記錄依序升為 active（填滿空出的位子） */
async function promoteFeaturedQueue(db: any): Promise<void> {
  try {
    // 計算現在 active 數
    const activeRes = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM featuredListings WHERE status = 'active' AND endAt > NOW()
    `);
    const activeCount = parseInt(String(((activeRes[0] as any[])[0] as any)?.cnt ?? 0));
    const freeSlots = MAX_FEATURED_SLOTS - activeCount;
    if (freeSlots <= 0) return;

    // 取最早排隊的若干筆（先到先得）
    const queuedRes = await db.execute(sql`
      SELECT * FROM featuredListings WHERE status = 'queued' ORDER BY createdAt ASC LIMIT ${freeSlots}
    `);
    const queued = (queuedRes[0] as any[]) ?? [];

    for (const q of queued) {
      const hours = FEATURED_TIER_HOURS[q.tier as string] ?? 24;
      const endAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      await db.execute(sql`
        UPDATE featuredListings SET status = 'active', startAt = NOW(), endAt = ${endAt}
        WHERE id = ${q.id}
      `);
    }
  } catch (e) {
    console.error('[promoteFeaturedQueue] error:', e);
  }
}

/** 商戶申請主打：扣保證金 + 建記錄（有位即啟動，滿則排隊）*/
export async function createFeaturedListing(
  merchantId: number,
  productId: number,
  productTitle: string,
  merchantName: string,
  tier: 'day1' | 'day3' | 'day7',
): Promise<{ ok: boolean; error?: string; queued?: boolean; queuePosition?: number; listing?: any }> {
  await ensureFeaturedListingsTable();
  const db = await getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };

  const amount = FEATURED_TIER_PRICES[tier];
  const hours = FEATURED_TIER_HOURS[tier];

  // 檢查保證金是否足夠
  const deposit = await getOrCreateSellerDeposit(merchantId);
  if (!deposit) return { ok: false, error: '無法讀取保證金記錄' };
  const balance = parseFloat(deposit.balance.toString());
  if (balance < amount) return { ok: false, error: `保證金不足，需要 HK$${amount}，目前餘額 HK$${balance.toFixed(2)}` };

  // 先過期到期的 active，再升級排隊中的
  await db.execute(sql`UPDATE featuredListings SET status = 'expired' WHERE status = 'active' AND endAt <= NOW()`);
  await promoteFeaturedQueue(db);

  // 檢查此商品是否已有進行中或排隊的主打
  const existing = await db.execute(sql`
    SELECT id FROM featuredListings
    WHERE productId = ${productId} AND status IN ('active','queued')
    LIMIT 1
  `);
  if ((existing[0] as any[]).length > 0) return { ok: false, error: '此商品已有進行中或排隊中的主打刊登' };

  // 檢查 active 是否已達上限
  const activeRes = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM featuredListings WHERE status = 'active' AND endAt > NOW()
  `);
  const activeCount = parseInt(String(((activeRes[0] as any[])[0] as any)?.cnt ?? 0));
  const hasSlot = activeCount < MAX_FEATURED_SLOTS;

  // 扣保證金（無論排隊還是立即啟動，都先扣費）
  await deductCommission(merchantId, amount, 0,
    hasSlot
      ? `主打商品刊登費（${FEATURED_TIER_LABELS[tier]}）：${productTitle}`
      : `主打商品排隊費（${FEATURED_TIER_LABELS[tier]}，排隊中）：${productTitle}`
  );

  if (hasSlot) {
    // 有空位：立即啟動
    const endAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await db.execute(sql`
      INSERT INTO featuredListings (merchantId, productId, productTitle, merchantName, tier, amount, status, startAt, endAt)
      VALUES (${merchantId}, ${productId}, ${productTitle}, ${merchantName}, ${tier}, ${amount}, 'active', NOW(), ${endAt})
    `);
    const newRows = await db.execute(sql`SELECT * FROM featuredListings WHERE merchantId = ${merchantId} ORDER BY id DESC LIMIT 1`);
    const listing = ((newRows[0] as any[])[0]) ?? null;
    return { ok: true, queued: false, listing };
  } else {
    // 已滿：加入排隊（startAt/endAt 留空，等候升級）
    await db.execute(sql`
      INSERT INTO featuredListings (merchantId, productId, productTitle, merchantName, tier, amount, status, startAt, endAt)
      VALUES (${merchantId}, ${productId}, ${productTitle}, ${merchantName}, ${tier}, ${amount}, 'queued', NULL, NULL)
    `);
    // 計算排隊位置
    const posRes = await db.execute(sql`
      SELECT COUNT(*) AS pos FROM featuredListings WHERE status = 'queued' ORDER BY createdAt ASC
    `);
    const queuePosition = parseInt(String(((posRes[0] as any[])[0] as any)?.pos ?? 1));
    const newRows = await db.execute(sql`SELECT * FROM featuredListings WHERE merchantId = ${merchantId} ORDER BY id DESC LIMIT 1`);
    const listing = ((newRows[0] as any[])[0]) ?? null;
    return { ok: true, queued: true, queuePosition, listing };
  }
}

/** 首頁用：取得所有進行中的主打（含商品詳情），按 endAt 升序 */
export async function getActiveFeaturedListings(): Promise<any[]> {
  await ensureFeaturedListingsTable();
  const db = await getDb();
  if (!db) return [];
  try {
    // 先過期舊記錄，再升級排隊
    await db.execute(sql`UPDATE featuredListings SET status = 'expired' WHERE status = 'active' AND endAt <= NOW()`);
    await promoteFeaturedQueue(db);

    const rows = await db.execute(sql`
      SELECT fl.*, mp.price, mp.currency, mp.images, mp.whatsapp, mp.stock, mp.status AS productStatus
      FROM featuredListings fl
      JOIN merchantProducts mp ON fl.productId = mp.id
      WHERE fl.status = 'active' AND fl.endAt > NOW() AND mp.status = 'active' AND mp.stock > 0
      ORDER BY fl.endAt ASC
    `);
    return (rows[0] as any[]) ?? [];
  } catch (e) {
    console.error('[getActiveFeaturedListings] error:', e);
    return [];
  }
}

/** 取得目前主打位狀態（公開） */
export async function getFeaturedSlotStatus(): Promise<{ active: number; queued: number; maxSlots: number }> {
  await ensureFeaturedListingsTable();
  const db = await getDb();
  if (!db) return { active: 0, queued: 0, maxSlots: MAX_FEATURED_SLOTS };
  try {
    await db.execute(sql`UPDATE featuredListings SET status = 'expired' WHERE status = 'active' AND endAt <= NOW()`);
    await promoteFeaturedQueue(db);
    const res = await db.execute(sql`
      SELECT
        SUM(status = 'active') AS active,
        SUM(status = 'queued') AS queued
      FROM featuredListings
    `);
    const row = ((res[0] as any[])[0]) as any;
    return {
      active: parseInt(String(row?.active ?? 0)),
      queued: parseInt(String(row?.queued ?? 0)),
      maxSlots: MAX_FEATURED_SLOTS,
    };
  } catch { return { active: 0, queued: 0, maxSlots: MAX_FEATURED_SLOTS }; }
}

/** 商戶自己的主打記錄（含排隊位置） */
export async function getMerchantFeaturedListings(merchantId: number): Promise<any[]> {
  await ensureFeaturedListingsTable();
  const db = await getDb();
  if (!db) return [];
  try {
    await db.execute(sql`UPDATE featuredListings SET status = 'expired' WHERE status = 'active' AND endAt <= NOW()`);
    await promoteFeaturedQueue(db);
    const rows = await db.execute(sql`
      SELECT * FROM featuredListings WHERE merchantId = ${merchantId} ORDER BY createdAt DESC LIMIT 50
    `);
    const items = (rows[0] as any[]) ?? [];

    // 為每個 queued 記錄附加排隊位置
    const allQueued = await db.execute(sql`
      SELECT id FROM featuredListings WHERE status = 'queued' ORDER BY createdAt ASC
    `);
    const queuedIds: number[] = ((allQueued[0] as any[]) ?? []).map((r: any) => r.id);
    return items.map((item: any) => ({
      ...item,
      queuePosition: item.status === 'queued' ? queuedIds.indexOf(item.id) + 1 : null,
    }));
  } catch { return []; }
}

/** 管理員：所有主打記錄（含排隊） */
export async function getAllFeaturedListings(limit = 100): Promise<any[]> {
  await ensureFeaturedListingsTable();
  const db = await getDb();
  if (!db) return [];
  try {
    await db.execute(sql`UPDATE featuredListings SET status = 'expired' WHERE status = 'active' AND endAt <= NOW()`);
    await promoteFeaturedQueue(db);
    const rows = await db.execute(sql`
      SELECT * FROM featuredListings ORDER BY
        FIELD(status,'active','queued','expired','cancelled'),
        CASE WHEN status = 'queued' THEN createdAt END ASC,
        CASE WHEN status != 'queued' THEN createdAt END DESC
      LIMIT ${limit}
    `);
    return (rows[0] as any[]) ?? [];
  } catch { return []; }
}

/** 管理員/商戶：取消主打 */
export async function cancelFeaturedListing(
  id: number,
  adminId: number,
  allowMerchantCancel = false,
  requesterId?: number,
): Promise<{ ok: boolean; error?: string }> {
  await ensureFeaturedListingsTable();
  const db = await getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };

  const rows = await db.execute(sql`SELECT * FROM featuredListings WHERE id = ${id} LIMIT 1`);
  const listing = ((rows[0] as any[])[0]) as any;
  if (!listing) return { ok: false, error: '記錄不存在' };
  if (!['active', 'queued'].includes(listing.status)) return { ok: false, error: '此主打已結束，無法取消' };

  // 商戶只能取消自己的
  if (allowMerchantCancel && requesterId && listing.merchantId !== requesterId) {
    return { ok: false, error: '只能取消自己的主打' };
  }

  await db.execute(sql`UPDATE featuredListings SET status = 'cancelled' WHERE id = ${id}`);

  // 計算退費
  let refundAmount = 0;
  if (listing.status === 'queued') {
    // 排隊中：全額退費
    refundAmount = parseFloat(listing.amount);
  } else {
    // 進行中：按剩餘時間比例退費
    const now = Date.now();
    const endAt = new Date(listing.endAt).getTime();
    const startAt = new Date(listing.startAt).getTime();
    const totalMs = endAt - startAt;
    const remainMs = Math.max(0, endAt - now);
    const refundRatio = totalMs > 0 ? remainMs / totalMs : 0;
    refundAmount = parseFloat((parseFloat(listing.amount) * refundRatio).toFixed(2));
  }

  if (refundAmount > 0) {
    const desc = listing.status === 'queued'
      ? `主打排隊取消全額退費：${listing.productTitle}`
      : `主打商品取消退費（剩餘 ${Math.round((new Date(listing.endAt).getTime() - Date.now()) / 3600000)}h）：${listing.productTitle}`;
    await adjustDeposit(listing.merchantId, refundAmount, desc, adminId);
  }

  // 空出位子後嘗試升級排隊
  if (listing.status === 'active') {
    await promoteFeaturedQueue(db);
  }

  return { ok: true };
}
