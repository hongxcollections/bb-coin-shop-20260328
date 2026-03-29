import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { InsertUser, users, auctions, InsertAuction, auctionImages, InsertAuctionImage, bids, InsertBid, Auction, proxyBids } from "../drizzle/schema";
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
      .orderBy(desc(auctions.createdAt))
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
      .select()
      .from(bids)
      .where(eq(bids.userId, userId))
      .orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error('[Database] Failed to get user bids:', error);
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
      .orderBy(desc(auctions.createdAt));
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
