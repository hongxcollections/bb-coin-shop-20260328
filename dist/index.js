var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auctionImages: () => auctionImages,
  auctionImagesRelations: () => auctionImagesRelations,
  auctions: () => auctions,
  auctionsRelations: () => auctionsRelations,
  bids: () => bids,
  bidsRelations: () => bidsRelations,
  favorites: () => favorites,
  favoritesRelations: () => favoritesRelations,
  notificationSettings: () => notificationSettings,
  proxyBidLogs: () => proxyBidLogs,
  proxyBids: () => proxyBids,
  proxyBidsRelations: () => proxyBidsRelations,
  siteSettings: () => siteSettings,
  users: () => users,
  usersRelations: () => usersRelations
});
import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
var users, auctions, auctionImages, bids, proxyBids, proxyBidLogs, notificationSettings, usersRelations, auctionsRelations, auctionImagesRelations, bidsRelations, proxyBidsRelations, favorites, favoritesRelations, siteSettings;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      notifyOutbid: int("notifyOutbid").default(1).notNull(),
      notifyWon: int("notifyWon").default(1).notNull(),
      notifyEndingSoon: int("notifyEndingSoon").default(1).notNull(),
      memberLevel: mysqlEnum("memberLevel", ["bronze", "silver", "gold", "vip"]).default("bronze").notNull(),
      defaultAnonymous: int("defaultAnonymous").default(0).notNull(),
      // 1 = always bid anonymously by default
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    auctions = mysqlTable("auctions", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 255 }).notNull(),
      description: text("description"),
      startingPrice: decimal("startingPrice", { precision: 10, scale: 2 }).notNull(),
      currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
      highestBidderId: int("highestBidderId"),
      endTime: timestamp("endTime").notNull(),
      status: mysqlEnum("status", ["active", "ended", "cancelled", "draft"]).default("active").notNull(),
      fbPostUrl: text("fbPostUrl"),
      bidIncrement: int("bidIncrement").default(30).notNull(),
      currency: mysqlEnum("currency", ["HKD", "USD", "CNY", "GBP", "EUR", "JPY"]).default("HKD").notNull(),
      createdBy: int("createdBy").notNull(),
      relistSourceId: int("relistSourceId"),
      archived: int("archived").default(0).notNull(),
      archivedAt: timestamp("archivedAt"),
      category: mysqlEnum("category", ["\u53E4\u5E63", "\u7D00\u5FF5\u5E63", "\u5916\u5E63", "\u9280\u5E63", "\u91D1\u5E63", "\u5176\u4ED6"]).default("\u5176\u4ED6"),
      antiSnipeEnabled: int("antiSnipeEnabled").default(1).notNull(),
      antiSnipeMinutes: int("antiSnipeMinutes").default(3).notNull(),
      extendMinutes: int("extendMinutes").default(3).notNull(),
      antiSnipeMemberLevels: text("antiSnipeMemberLevels"),
      paymentStatus: mysqlEnum("paymentStatus", ["pending_payment", "paid", "delivered"]),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    auctionImages = mysqlTable("auctionImages", {
      id: int("id").autoincrement().primaryKey(),
      auctionId: int("auctionId").notNull(),
      imageUrl: text("imageUrl").notNull(),
      displayOrder: int("displayOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    bids = mysqlTable("bids", {
      id: int("id").autoincrement().primaryKey(),
      auctionId: int("auctionId").notNull(),
      userId: int("userId").notNull(),
      bidAmount: decimal("bidAmount", { precision: 10, scale: 2 }).notNull(),
      isAnonymous: int("isAnonymous").default(0).notNull(),
      // 1 = anonymous bid
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    proxyBids = mysqlTable("proxyBids", {
      id: int("id").autoincrement().primaryKey(),
      auctionId: int("auctionId").notNull(),
      userId: int("userId").notNull(),
      maxAmount: decimal("maxAmount", { precision: 10, scale: 2 }).notNull(),
      isActive: int("isActive").default(1).notNull(),
      // 1 = active, 0 = cancelled/expired
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    proxyBidLogs = mysqlTable("proxyBidLogs", {
      id: int("id").autoincrement().primaryKey(),
      auctionId: int("auctionId").notNull(),
      round: int("round").default(1).notNull(),
      // engine iteration round
      triggerUserId: int("triggerUserId").notNull(),
      // the user whose bid triggered the engine
      triggerAmount: decimal("triggerAmount", { precision: 10, scale: 2 }).notNull(),
      // the triggering bid
      proxyUserId: int("proxyUserId").notNull(),
      // the user whose proxy responded
      proxyAmount: decimal("proxyAmount", { precision: 10, scale: 2 }).notNull(),
      // the auto-bid amount
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    notificationSettings = mysqlTable("notificationSettings", {
      id: int("id").autoincrement().primaryKey(),
      senderName: varchar("senderName", { length: 128 }).default("\u5927BB\u9322\u5E63\u5E97").notNull(),
      senderEmail: varchar("senderEmail", { length: 320 }).default("ywkyee@gmail.com").notNull(),
      enableOutbid: int("enableOutbid").default(1).notNull(),
      // 1 = enabled
      enableWon: int("enableWon").default(1).notNull(),
      enableEndingSoon: int("enableEndingSoon").default(1).notNull(),
      endingSoonMinutes: int("endingSoonMinutes").default(60).notNull(),
      enableAntiSnipe: int("enableAntiSnipe").default(1).notNull(),
      paymentInstructions: text("paymentInstructions"),
      deliveryInfo: text("deliveryInfo"),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    usersRelations = relations(users, ({ many }) => ({
      auctions: many(auctions),
      bids: many(bids)
    }));
    auctionsRelations = relations(auctions, ({ one, many }) => ({
      creator: one(users, {
        fields: [auctions.createdBy],
        references: [users.id]
      }),
      highestBidder: one(users, {
        fields: [auctions.highestBidderId],
        references: [users.id]
      }),
      images: many(auctionImages),
      bids: many(bids)
    }));
    auctionImagesRelations = relations(auctionImages, ({ one }) => ({
      auction: one(auctions, {
        fields: [auctionImages.auctionId],
        references: [auctions.id]
      })
    }));
    bidsRelations = relations(bids, ({ one }) => ({
      auction: one(auctions, {
        fields: [bids.auctionId],
        references: [auctions.id]
      }),
      user: one(users, {
        fields: [bids.userId],
        references: [users.id]
      })
    }));
    proxyBidsRelations = relations(proxyBids, ({ one }) => ({
      auction: one(auctions, {
        fields: [proxyBids.auctionId],
        references: [auctions.id]
      }),
      user: one(users, {
        fields: [proxyBids.userId],
        references: [users.id]
      })
    }));
    favorites = mysqlTable("favorites", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      auctionId: int("auctionId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    favoritesRelations = relations(favorites, ({ one }) => ({
      user: one(users, { fields: [favorites.userId], references: [users.id] }),
      auction: one(auctions, { fields: [favorites.auctionId], references: [auctions.id] })
    }));
    siteSettings = mysqlTable("site_settings", {
      key: varchar("key", { length: 100 }).primaryKey(),
      value: text("value").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production" && process.env.SANDBOX_MODE !== "true",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      webhookSecret: process.env.WEBHOOK_SECRET ?? "",
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addAuctionImage: () => addAuctionImage,
  closeExpiredAuctions: () => closeExpiredAuctions,
  createAuction: () => createAuction,
  deactivateProxyBid: () => deactivateProxyBid,
  deleteAuction: () => deleteAuction,
  deleteAuctionImage: () => deleteAuctionImage,
  getActiveAuctionsEndingSoon: () => getActiveAuctionsEndingSoon,
  getActiveProxiesForAuction: () => getActiveProxiesForAuction,
  getAllBidsForExport: () => getAllBidsForExport,
  getAllSiteSettings: () => getAllSiteSettings,
  getAllUsers: () => getAllUsers,
  getAnonymousBids: () => getAnonymousBids,
  getArchivedAuctions: () => getArchivedAuctions,
  getArchivedAuctionsFiltered: () => getArchivedAuctionsFiltered,
  getAuctionById: () => getAuctionById,
  getAuctionImages: () => getAuctionImages,
  getAuctions: () => getAuctions,
  getAuctionsByCreator: () => getAuctionsByCreator,
  getBidHistory: () => getBidHistory,
  getBiddersForAuction: () => getBiddersForAuction,
  getDashboardStats: () => getDashboardStats,
  getDb: () => getDb,
  getDraftAuctions: () => getDraftAuctions,
  getFavoriteIds: () => getFavoriteIds,
  getMyWonAuctions: () => getMyWonAuctions,
  getNotificationSettings: () => getNotificationSettings,
  getProxyBid: () => getProxyBid,
  getProxyBidLogs: () => getProxyBidLogs,
  getSiteSetting: () => getSiteSetting,
  getUserBids: () => getUserBids,
  getUserBidsGrouped: () => getUserBidsGrouped,
  getUserById: () => getUserById,
  getUserByOpenId: () => getUserByOpenId,
  getUserFavorites: () => getUserFavorites,
  getUserPublicStats: () => getUserPublicStats,
  getWonOrders: () => getWonOrders,
  insertProxyBidLog: () => insertProxyBidLog,
  placeBid: () => placeBid,
  setProxyBid: () => setProxyBid,
  setSiteSetting: () => setSiteSetting,
  setUserMemberLevel: () => setUserMemberLevel,
  toggleFavorite: () => toggleFavorite,
  updateAuction: () => updateAuction,
  updatePaymentStatus: () => updatePaymentStatus,
  updateUserEmail: () => updateUserEmail,
  updateUserNotificationPrefs: () => updateUserNotificationPrefs,
  upsertNotificationSettings: () => upsertNotificationSettings,
  upsertUser: () => upsertUser
});
import { eq, desc, asc, and, gte, lte, gt, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const pool = createPool({
        host: url.hostname,
        port: parseInt(url.port || (isLocalhost ? "3306" : "4000")),
        user: url.username,
        password: url.password || void 0,
        database: url.pathname.slice(1),
        ssl: isLocalhost ? void 0 : { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserById(userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateUserNotificationPrefs(userId, prefs) {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.update(users).set(prefs).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update notification prefs:", error);
    return false;
  }
}
async function getAuctions(limit = 20, offset = 0, category) {
  const db = await getDb();
  if (!db) return [];
  try {
    const baseQuery = db.select({
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
      updatedAt: auctions.updatedAt
    }).from(auctions).leftJoin(users, eq(auctions.highestBidderId, users.id));
    const conditions = [
      sql`${auctions.status} != 'draft'`,
      sql`${auctions.archived} = 0`
    ];
    if (category && category !== "all") {
      conditions.push(sql`${auctions.category} = ${category}`);
    }
    const result = await baseQuery.where(and(...conditions)).orderBy(
      sql`CASE WHEN ${auctions.status} = 'active' THEN 0 ELSE 1 END`,
      sql`CASE WHEN ${auctions.status} = 'active' THEN ${auctions.endTime} ELSE NULL END`,
      desc(auctions.createdAt)
    ).limit(limit).offset(offset);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get auctions:", error);
    return [];
  }
}
async function getAuctionById(id) {
  const db = await getDb();
  if (!db) return void 0;
  try {
    const result = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
    return result.length > 0 ? result[0] : void 0;
  } catch (error) {
    console.error("[Database] Failed to get auction:", error);
    return void 0;
  }
}
async function getAuctionImages(auctionId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select().from(auctionImages).where(eq(auctionImages.auctionId, auctionId)).orderBy(auctionImages.displayOrder);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get auction images:", error);
    return [];
  }
}
async function getBidHistory(auctionId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      id: bids.id,
      auctionId: bids.auctionId,
      userId: bids.userId,
      bidAmount: bids.bidAmount,
      isAnonymous: bids.isAnonymous,
      createdAt: bids.createdAt,
      username: users.name,
      memberLevel: users.memberLevel
    }).from(bids).leftJoin(users, eq(bids.userId, users.id)).where(eq(bids.auctionId, auctionId)).orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get bid history:", error);
    return [];
  }
}
async function getUserBids(userId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      id: bids.id,
      auctionId: bids.auctionId,
      bidAmount: bids.bidAmount,
      createdAt: bids.createdAt,
      auctionTitle: auctions.title
    }).from(bids).leftJoin(auctions, eq(bids.auctionId, auctions.id)).where(eq(bids.userId, userId)).orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get user bids:", error);
    return [];
  }
}
async function getUserBidsGrouped(userId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select({
      id: bids.id,
      auctionId: bids.auctionId,
      bidAmount: bids.bidAmount,
      createdAt: bids.createdAt,
      auctionTitle: auctions.title,
      auctionStatus: auctions.status,
      auctionEndTime: auctions.endTime,
      auctionCurrency: auctions.currency
    }).from(bids).leftJoin(auctions, eq(bids.auctionId, auctions.id)).where(eq(bids.userId, userId)).orderBy(desc(bids.createdAt));
    const auctionIds = Array.from(new Set(rows.map((r) => r.auctionId).filter((id) => id !== null)));
    const winnerMap = /* @__PURE__ */ new Map();
    if (auctionIds.length > 0) {
      for (const aId of auctionIds) {
        const topBid = await db.select({ userId: bids.userId, bidAmount: bids.bidAmount }).from(bids).where(eq(bids.auctionId, aId)).orderBy(desc(bids.bidAmount), desc(bids.createdAt)).limit(1);
        if (topBid[0]?.userId !== null && topBid[0]?.userId !== void 0) {
          winnerMap.set(aId, topBid[0].userId);
        }
      }
    }
    const groupMap = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = row.auctionId ?? 0;
      if (!groupMap.has(key)) {
        const auctionEnded = row.auctionStatus === "ended" || row.auctionEndTime !== null && row.auctionEndTime < Date.now();
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
          bids: []
        });
      }
      const group = groupMap.get(key);
      group.totalBids++;
      group.bids.push({ id: row.id, bidAmount: row.bidAmount ?? 0, createdAt: row.createdAt ?? null });
    }
    return Array.from(groupMap.values()).sort(
      (a, b) => (b.latestBidAt?.getTime() ?? 0) - (a.latestBidAt?.getTime() ?? 0)
    );
  } catch (error) {
    console.error("[Database] Failed to get grouped user bids:", error);
    return [];
  }
}
async function createAuction(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(auctions).values(data);
    const insertedAuction = await db.select().from(auctions).where(eq(auctions.title, data.title)).orderBy(desc(auctions.createdAt)).limit(1);
    if (!insertedAuction[0]) {
      throw new Error("Failed to retrieve created auction");
    }
    return insertedAuction[0];
  } catch (error) {
    console.error("[Database] Failed to create auction:", error);
    throw error;
  }
}
async function updateAuction(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.update(auctions).set(data).where(eq(auctions.id, id));
    return result;
  } catch (error) {
    console.error("[Database] Failed to update auction:", error);
    throw error;
  }
}
async function deleteAuction(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.delete(auctionImages).where(eq(auctionImages.auctionId, id));
    await db.delete(bids).where(eq(bids.auctionId, id));
    const result = await db.delete(auctions).where(eq(auctions.id, id));
    return result;
  } catch (error) {
    console.error("[Database] Failed to delete auction:", error);
    throw error;
  }
}
async function addAuctionImage(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.insert(auctionImages).values(data);
    return result;
  } catch (error) {
    console.error("[Database] Failed to add auction image:", error);
    throw error;
  }
}
async function deleteAuctionImage(imageId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.delete(auctionImages).where(eq(auctionImages.id, imageId));
    return result;
  } catch (error) {
    console.error("[Database] Failed to delete auction image:", error);
    throw error;
  }
}
async function placeBid(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const result = await db.insert(bids).values(data);
    return result;
  } catch (error) {
    console.error("[Database] Failed to place bid:", error);
    throw error;
  }
}
async function getAuctionsByCreator(userId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
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
      relistSourceId: auctions.relistSourceId
    }).from(auctions).leftJoin(users, eq(auctions.highestBidderId, users.id)).where(and(eq(auctions.createdBy, userId), eq(auctions.archived, 0))).orderBy(
      sql`CASE WHEN ${auctions.status} = 'active' THEN 0 ELSE 1 END`,
      sql`CASE WHEN ${auctions.status} = 'active' THEN ${auctions.endTime} ELSE NULL END`,
      desc(auctions.createdAt)
    );
    return result;
  } catch (error) {
    console.error("[Database] Failed to get auctions by creator:", error);
    return [];
  }
}
async function getArchivedAuctions() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select(ARCHIVED_SELECT).from(auctions).leftJoin(users, eq(auctions.highestBidderId, users.id)).where(eq(auctions.archived, 1)).orderBy(desc(auctions.archivedAt), desc(auctions.updatedAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get archived auctions:", error);
    return [];
  }
}
async function getArchivedAuctionsFiltered(filter) {
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
      const endOfDay = new Date(filter.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(auctions.archivedAt, endOfDay));
    }
    const result = await db.select(ARCHIVED_SELECT).from(auctions).leftJoin(users, eq(auctions.highestBidderId, users.id)).where(and(...conditions)).orderBy(desc(auctions.archivedAt), desc(auctions.updatedAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get filtered archived auctions:", error);
    return [];
  }
}
async function getDraftAuctions() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select().from(auctions).where(eq(auctions.status, "draft")).orderBy(desc(auctions.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get draft auctions:", error);
    return [];
  }
}
async function setProxyBid(auctionId, userId, maxAmount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    await db.insert(proxyBids).values({ auctionId, userId, maxAmount: maxAmount.toString(), isActive: 1 }).onDuplicateKeyUpdate({ set: { maxAmount: maxAmount.toString(), isActive: 1, updatedAt: /* @__PURE__ */ new Date() } });
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to set proxy bid:", error);
    throw error;
  }
}
async function getProxyBid(auctionId, userId) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(proxyBids).where(and(eq(proxyBids.auctionId, auctionId), eq(proxyBids.userId, userId), eq(proxyBids.isActive, 1))).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("[Database] Failed to get proxy bid:", error);
    return null;
  }
}
async function getActiveProxiesForAuction(auctionId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select().from(proxyBids).where(and(eq(proxyBids.auctionId, auctionId), eq(proxyBids.isActive, 1))).orderBy(desc(proxyBids.maxAmount));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get active proxies:", error);
    return [];
  }
}
async function deactivateProxyBid(auctionId, userId) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(proxyBids).set({ isActive: 0 }).where(and(eq(proxyBids.auctionId, auctionId), eq(proxyBids.userId, userId)));
  } catch (error) {
    console.error("[Database] Failed to deactivate proxy bid:", error);
  }
}
async function insertProxyBidLog(entry) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(proxyBidLogs).values({
      auctionId: entry.auctionId,
      round: entry.round,
      triggerUserId: entry.triggerUserId,
      triggerAmount: entry.triggerAmount.toString(),
      proxyUserId: entry.proxyUserId,
      proxyAmount: entry.proxyAmount.toString()
    });
  } catch (error) {
    console.error("[Database] Failed to insert proxy bid log:", error);
  }
}
async function getProxyBidLogs(auctionId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const triggerUser = { id: users.id, name: users.name };
    const logs = await db.select({
      id: proxyBidLogs.id,
      auctionId: proxyBidLogs.auctionId,
      round: proxyBidLogs.round,
      triggerUserId: proxyBidLogs.triggerUserId,
      triggerAmount: proxyBidLogs.triggerAmount,
      proxyUserId: proxyBidLogs.proxyUserId,
      proxyAmount: proxyBidLogs.proxyAmount,
      createdAt: proxyBidLogs.createdAt
    }).from(proxyBidLogs).where(eq(proxyBidLogs.auctionId, auctionId)).orderBy(desc(proxyBidLogs.createdAt));
    if (logs.length === 0) return [];
    const allUserIds = logs.flatMap((l) => [l.triggerUserId, l.proxyUserId]);
    const userIds = Array.from(new Set(allUserIds));
    if (userIds.length === 0) return logs.map((log) => ({
      ...log,
      triggerUserName: `\u7528\u6236 ${log.triggerUserId}`,
      proxyUserName: `\u7528\u6236 ${log.proxyUserId}`
    }));
    const userRows = await db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.id} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`);
    const userMap = new Map(userRows.map((u) => [u.id, u.name ?? `\u7528\u6236 ${u.id}`]));
    return logs.map((log) => ({
      ...log,
      triggerUserName: userMap.get(log.triggerUserId) ?? `\u7528\u6236 ${log.triggerUserId}`,
      proxyUserName: userMap.get(log.proxyUserId) ?? `\u7528\u6236 ${log.proxyUserId}`
    }));
  } catch (error) {
    console.error("[Database] Failed to get proxy bid logs:", error);
    return [];
  }
}
async function getNotificationSettings() {
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
async function upsertNotificationSettings(data) {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.insert(notificationSettings).values({ id: 1, senderName: "\u5927BB\u9322\u5E63\u5E97", senderEmail: "ywkyee@gmail.com", ...data }).onDuplicateKeyUpdate({ set: data });
    return true;
  } catch (error) {
    console.error("[Database] Failed to upsert notification settings:", error);
    return false;
  }
}
async function getBiddersForAuction(auctionId) {
  try {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.selectDistinct({ userId: bids.userId, email: users.email, name: users.name }).from(bids).innerJoin(users, eq(bids.userId, users.id)).where(eq(bids.auctionId, auctionId));
    return rows;
  } catch (error) {
    console.error("[Database] Failed to get bidders for auction:", error);
    return [];
  }
}
async function updateUserEmail(userId, email) {
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
async function getActiveAuctionsEndingSoon(withinMinutes) {
  try {
    const db = await getDb();
    if (!db) return [];
    const now = /* @__PURE__ */ new Date();
    const threshold = new Date(now.getTime() + withinMinutes * 60 * 1e3);
    const rows = await db.select({ id: auctions.id, title: auctions.title }).from(auctions).where(
      and(
        eq(auctions.status, "active"),
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
async function getUserPublicStats(userId) {
  const db = await getDb();
  if (!db) return null;
  try {
    const userRows = await db.select({ id: users.id, name: users.name, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) return null;
    const user = userRows[0];
    const bidCountRows = await db.select({ count: sql`COUNT(DISTINCT ${bids.auctionId})` }).from(bids).where(eq(bids.userId, userId));
    const auctionsParticipated = Number(bidCountRows[0]?.count ?? 0);
    const wonRows = await db.select({ count: sql`COUNT(*)` }).from(auctions).where(
      and(
        eq(auctions.highestBidderId, userId),
        eq(auctions.status, "ended")
      )
    );
    const auctionsWon = Number(wonRows[0]?.count ?? 0);
    return {
      id: user.id,
      name: user.name,
      createdAt: user.createdAt,
      auctionsParticipated,
      auctionsWon
    };
  } catch (error) {
    console.error("[Database] Failed to get user public stats:", error);
    return null;
  }
}
async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      memberLevel: users.memberLevel,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get all users:", error);
    return [];
  }
}
async function setUserMemberLevel(userId, memberLevel) {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.update(users).set({ memberLevel }).where(eq(users.id, userId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to set member level:", error);
    return false;
  }
}
async function getAnonymousBids(options) {
  const db = await getDb();
  if (!db) return { bids: [], total: 0 };
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;
  try {
    const result = await db.select({
      id: bids.id,
      auctionId: bids.auctionId,
      auctionTitle: auctions.title,
      userId: bids.userId,
      username: users.name,
      userEmail: users.email,
      memberLevel: users.memberLevel,
      bidAmount: bids.bidAmount,
      createdAt: bids.createdAt,
      isAnonymous: bids.isAnonymous
    }).from(bids).leftJoin(users, eq(bids.userId, users.id)).leftJoin(auctions, eq(bids.auctionId, auctions.id)).where(eq(bids.isAnonymous, 1)).orderBy(desc(bids.createdAt)).limit(pageSize).offset(offset);
    const countResult = await db.select({ count: sql`COUNT(*)` }).from(bids).where(eq(bids.isAnonymous, 1));
    const total = Number(countResult[0]?.count ?? 0);
    return { bids: result, total };
  } catch (error) {
    console.error("[Database] Failed to get anonymous bids:", error);
    return { bids: [], total: 0 };
  }
}
async function closeExpiredAuctions() {
  const db = await getDb();
  if (!db) return [];
  try {
    const now = /* @__PURE__ */ new Date();
    const expired = await db.select({ id: auctions.id }).from(auctions).where(
      and(
        eq(auctions.status, "active"),
        sql`${auctions.endTime} <= ${now}`
      )
    );
    if (expired.length === 0) return [];
    const ids = expired.map((a) => a.id);
    await db.update(auctions).set({ status: "ended", updatedAt: now }).where(inArray(auctions.id, ids));
    return ids;
  } catch (error) {
    console.error("[Database] Failed to close expired auctions:", error);
    return [];
  }
}
async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  try {
    const now = /* @__PURE__ */ new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    const activeResult = await db.select({ count: sql`COUNT(*)` }).from(auctions).where(and(eq(auctions.status, "active"), sql`${auctions.endTime} > ${now}`));
    const activeCount = Number(activeResult[0]?.count ?? 0);
    const endedResult = await db.select({ count: sql`COUNT(*)` }).from(auctions).where(eq(auctions.status, "ended"));
    const endedCount = Number(endedResult[0]?.count ?? 0);
    const bidCountResult = await db.select({ count: sql`COUNT(*)` }).from(bids);
    const totalBids = Number(bidCountResult[0]?.count ?? 0);
    const userCountResult = await db.select({ count: sql`COUNT(*)` }).from(users);
    const totalUsers = Number(userCountResult[0]?.count ?? 0);
    const recentBidsResult = await db.select({ count: sql`COUNT(*)` }).from(bids).where(sql`${bids.createdAt} >= ${sevenDaysAgo}`);
    const recentBids = Number(recentBidsResult[0]?.count ?? 0);
    const totalValueResult = await db.select({ total: sql`COALESCE(SUM(${auctions.currentPrice}), 0)` }).from(auctions).where(eq(auctions.status, "ended"));
    const totalValue = Number(totalValueResult[0]?.total ?? 0);
    const recentValueResult = await db.select({ total: sql`COALESCE(SUM(${auctions.currentPrice}), 0)` }).from(auctions).where(and(eq(auctions.status, "ended"), sql`${auctions.updatedAt} >= ${sevenDaysAgo}`));
    const recentValue = Number(recentValueResult[0]?.total ?? 0);
    const topAuctions = await db.select({
      id: auctions.id,
      title: auctions.title,
      currentPrice: auctions.currentPrice,
      status: auctions.status,
      bidCount: sql`COUNT(${bids.id})`
    }).from(auctions).leftJoin(bids, eq(bids.auctionId, auctions.id)).groupBy(auctions.id).orderBy(desc(sql`COUNT(${bids.id})`)).limit(5);
    const bidsPerDay = await db.select({
      day: sql`DATE(${bids.createdAt})`,
      count: sql`COUNT(*)`
    }).from(bids).where(sql`${bids.createdAt} >= ${sevenDaysAgo}`).groupBy(sql`DATE(${bids.createdAt})`).orderBy(sql`DATE(${bids.createdAt})`);
    return {
      activeCount,
      endedCount,
      totalBids,
      totalUsers,
      recentBids,
      totalValue,
      recentValue,
      topAuctions,
      bidsPerDay
    };
  } catch (error) {
    console.error("[Database] Failed to get dashboard stats:", error);
    return null;
  }
}
async function toggleFavorite(userId, auctionId) {
  const db = await getDb();
  if (!db) return { isFavorited: false };
  try {
    const existing = await db.select({ id: favorites.id }).from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.auctionId, auctionId))).limit(1);
    if (existing.length > 0) {
      await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.auctionId, auctionId)));
      return { isFavorited: false };
    } else {
      await db.insert(favorites).values({ userId, auctionId });
      return { isFavorited: true };
    }
  } catch (error) {
    console.error("[Database] Failed to toggle favorite:", error);
    return { isFavorited: false };
  }
}
async function getUserFavorites(userId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      id: auctions.id,
      title: auctions.title,
      currentPrice: auctions.currentPrice,
      endTime: auctions.endTime,
      status: auctions.status,
      currency: auctions.currency,
      category: auctions.category,
      favoritedAt: favorites.createdAt
    }).from(favorites).innerJoin(auctions, eq(favorites.auctionId, auctions.id)).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get user favorites:", error);
    return [];
  }
}
async function getFavoriteIds(userId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({ auctionId: favorites.auctionId }).from(favorites).where(eq(favorites.userId, userId));
    return result.map((r) => r.auctionId);
  } catch (error) {
    console.error("[Database] Failed to get favorite ids:", error);
    return [];
  }
}
async function getMyWonAuctions(userId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      id: auctions.id,
      title: auctions.title,
      description: auctions.description,
      currentPrice: auctions.currentPrice,
      startingPrice: auctions.startingPrice,
      currency: auctions.currency,
      endTime: auctions.endTime,
      status: auctions.status,
      category: auctions.category,
      bidCount: sql`(SELECT COUNT(*) FROM bids WHERE bids.auction_id = ${auctions.id})`,
      winningAmount: sql`(SELECT bid_amount FROM bids WHERE bids.auction_id = ${auctions.id} ORDER BY bid_amount DESC, created_at ASC LIMIT 1)`,
      paymentStatus: auctions.paymentStatus
    }).from(auctions).where(
      and(
        eq(auctions.status, "ended"),
        sql`(SELECT user_id FROM bids WHERE bids.auction_id = ${auctions.id} ORDER BY bid_amount DESC, created_at ASC LIMIT 1) = ${userId}`
      )
    ).orderBy(desc(auctions.endTime));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get won auctions:", error);
    return [];
  }
}
async function getAllBidsForExport(auctionId) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      bidId: bids.id,
      auctionId: bids.auctionId,
      auctionTitle: auctions.title,
      userId: bids.userId,
      username: users.name,
      bidAmount: bids.bidAmount,
      currency: auctions.currency,
      isAnonymous: bids.isAnonymous,
      createdAt: bids.createdAt
    }).from(bids).innerJoin(auctions, eq(bids.auctionId, auctions.id)).innerJoin(users, eq(bids.userId, users.id)).where(auctionId ? eq(bids.auctionId, auctionId) : sql`1=1`).orderBy(desc(bids.createdAt));
    return result;
  } catch (error) {
    console.error("[Database] Failed to export bids:", error);
    return [];
  }
}
async function getSiteSetting(key) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    return result.length > 0 ? result[0].value : null;
  } catch (error) {
    console.error("[Database] Failed to get site setting:", error);
    return null;
  }
}
async function setSiteSetting(key, value) {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(siteSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    return true;
  } catch (error) {
    console.error("[Database] Failed to set site setting:", error);
    return false;
  }
}
async function getAllSiteSettings() {
  const db = await getDb();
  if (!db) return {};
  try {
    const rows = await db.select().from(siteSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (error) {
    console.error("[Database] Failed to get all site settings:", error);
    return {};
  }
}
async function getWonOrders() {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select({
      id: auctions.id,
      title: auctions.title,
      currentPrice: auctions.currentPrice,
      currency: auctions.currency,
      endTime: auctions.endTime,
      paymentStatus: auctions.paymentStatus,
      winnerName: sql`(SELECT u.name FROM users u INNER JOIN bids b ON b.user_id = u.id WHERE b.auction_id = ${auctions.id} ORDER BY b.bid_amount DESC, b.created_at ASC LIMIT 1)`,
      winnerOpenId: sql`(SELECT u.open_id FROM users u INNER JOIN bids b ON b.user_id = u.id WHERE b.auction_id = ${auctions.id} ORDER BY b.bid_amount DESC, b.created_at ASC LIMIT 1)`,
      winningAmount: sql`(SELECT b.bid_amount FROM bids b WHERE b.auction_id = ${auctions.id} ORDER BY b.bid_amount DESC, b.created_at ASC LIMIT 1)`
    }).from(auctions).where(eq(auctions.status, "ended")).orderBy(desc(auctions.endTime));
    return result;
  } catch (error) {
    console.error("[Database] Failed to get won orders:", error);
    return [];
  }
}
async function updatePaymentStatus(auctionId, status, userId, isAdmin) {
  const db = await getDb();
  if (!db) return { success: false, error: "Database unavailable" };
  try {
    const [auction] = await db.select({
      id: auctions.id,
      status: auctions.status,
      paymentStatus: auctions.paymentStatus,
      highestBidderId: auctions.highestBidderId
    }).from(auctions).where(eq(auctions.id, auctionId)).limit(1);
    if (!auction) return { success: false, error: "\u62CD\u8CE3\u4E0D\u5B58\u5728" };
    if (auction.status !== "ended") return { success: false, error: "\u62CD\u8CE3\u5C1A\u672A\u7D50\u675F" };
    const [topBid] = await db.select({ userId: bids.userId }).from(bids).where(eq(bids.auctionId, auctionId)).orderBy(desc(bids.bidAmount), asc(bids.createdAt)).limit(1);
    if (!topBid) return { success: false, error: "\u627E\u4E0D\u5230\u5F97\u6A19\u8A18\u9304" };
    if (!isAdmin) {
      if (topBid.userId !== userId) return { success: false, error: "\u60A8\u4E0D\u662F\u6B64\u62CD\u8CE3\u7684\u5F97\u6A19\u8005" };
      if (status !== "paid") return { success: false, error: "\u8CB7\u5BB6\u53EA\u80FD\u6A19\u8A18\u300C\u5DF2\u4ED8\u6B3E\u300D" };
      if (auction.paymentStatus === "delivered") return { success: false, error: "\u8A02\u55AE\u5DF2\u5B8C\u6210\uFF0C\u7121\u6CD5\u4FEE\u6539" };
    }
    await db.update(auctions).set({ paymentStatus: status }).where(eq(auctions.id, auctionId));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to update payment status:", error);
    return { success: false, error: "\u66F4\u65B0\u5931\u6557\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66" };
  }
}
var _db, ARCHIVED_SELECT;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
    ARCHIVED_SELECT = {
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
      archived: auctions.archived
    };
  }
});

// server/email.ts
var email_exports = {};
__export(email_exports, {
  sendEndingSoonEmail: () => sendEndingSoonEmail,
  sendOutbidEmail: () => sendOutbidEmail,
  sendWonEmail: () => sendWonEmail
});
import { Resend } from "resend";
function getResend() {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(key);
  }
  return _resend;
}
function baseLayout(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#fdf8f0; font-family:'Helvetica Neue',Arial,sans-serif; color:#333; }
    .wrapper { max-width:560px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#d97706,#b45309); padding:28px 32px; text-align:center; }
    .header h1 { margin:0; color:#fff; font-size:22px; letter-spacing:.5px; }
    .header p { margin:4px 0 0; color:#fde68a; font-size:13px; }
    .body { padding:28px 32px; }
    .body h2 { margin:0 0 12px; font-size:18px; color:#92400e; }
    .body p { margin:0 0 12px; line-height:1.6; font-size:14px; }
    .highlight { background:#fef3c7; border-left:4px solid #d97706; border-radius:4px; padding:12px 16px; margin:16px 0; }
    .highlight .label { font-size:12px; color:#92400e; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
    .highlight .value { font-size:22px; font-weight:700; color:#b45309; margin-top:4px; }
    .btn { display:inline-block; margin-top:20px; padding:12px 28px; background:#d97706; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; }
    .footer { background:#fdf8f0; padding:16px 32px; text-align:center; font-size:12px; color:#9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>\u{1FA99} \u5927BB\u9322\u5E63\u5E97</h1>
      <p>\u5C08\u696D\u9322\u5E63\u62CD\u8CE3\u5E73\u53F0</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">\u6B64\u90F5\u4EF6\u7531\u7CFB\u7D71\u81EA\u52D5\u767C\u9001\uFF0C\u8ACB\u52FF\u76F4\u63A5\u56DE\u8986\u3002</div>
  </div>
</body>
</html>`;
}
async function sendOutbidEmail(params) {
  const { to, senderName, senderEmail, userName, auctionTitle, newHighestBid, currency, auctionUrl } = params;
  const body = `
    <h2>\u60A8\u7684\u51FA\u50F9\u5DF2\u88AB\u8D85\u8D8A</h2>
    <p>\u89AA\u611B\u7684 <strong>${userName}</strong>\uFF0C</p>
    <p>\u60A8\u5728\u4EE5\u4E0B\u62CD\u8CE3\u7684\u51FA\u50F9\u5DF2\u88AB\u5176\u4ED6\u8CB7\u5BB6\u8D85\u8D8A\uFF1A</p>
    <div class="highlight">
      <div class="label">\u62CD\u8CE3\u54C1</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">\u76EE\u524D\u6700\u9AD8\u51FA\u50F9</div>
      <div class="value">${currency} ${newHighestBid.toLocaleString()}</div>
    </div>
    <p>\u5982\u60A8\u4ECD\u6709\u610F\u7AF6\u6295\uFF0C\u8ACB\u7ACB\u5373\u524D\u5F80\u62CD\u8CE3\u9801\u9762\u91CD\u65B0\u51FA\u50F9\uFF01</p>
    <a href="${auctionUrl}" class="btn">\u7ACB\u5373\u51FA\u50F9 \u2192</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `\u3010\u51FA\u50F9\u88AB\u8D85\u8D8A\u3011${auctionTitle}`, html: baseLayout("\u51FA\u50F9\u88AB\u8D85\u8D8A\u901A\u77E5", body) });
}
function nl2br(text2) {
  return text2.replace(/\n/g, "<br />");
}
async function sendWonEmail(params) {
  const { to, senderName, senderEmail, userName, auctionTitle, finalPrice, currency, auctionUrl, paymentInstructions, deliveryInfo } = params;
  const defaultPayment = "\u63A5\u53D7\u4ED8\u6B3E\u65B9\u5F0F\uFF1AFPS\u3001\u516B\u9054\u901A\u3001\u5FAE\u4FE1\u652F\u4ED8\u3001\u652F\u4ED8\u5BF6\u3001BOCPay\u3001Visa\n\u8ACB\u806F\u7D61\u5927BB\u9322\u5E63\u5E97\u5B89\u6392\u4ED8\u6B3E\u3002";
  const defaultDelivery = "\u5EFA\u8B70\u9806\u8C50\u5230\u4ED8\uFF08\u8CB7\u5BB6\u627F\u64D4\u904B\u8CBB\uFF09\uFF0C\u6216\u6B61\u8FCE\u4F86\u5E97\u81EA\u53D6\uFF08\u8ACB\u63D0\u524D\u806F\u7D61\u9810\u7D04\uFF09\u3002";
  const paymentHtml = nl2br(paymentInstructions || defaultPayment);
  const deliveryHtml = nl2br(deliveryInfo || defaultDelivery);
  const body = `
    <h2>\u{1F389} \u606D\u559C\u60A8\u6210\u529F\u5F97\u6A19\uFF01</h2>
    <p>\u89AA\u611B\u7684 <strong>${userName}</strong>\uFF0C</p>
    <p>\u606D\u559C\u60A8\u5728\u4EE5\u4E0B\u62CD\u8CE3\u4E2D\u4EE5\u6700\u9AD8\u51FA\u50F9\u6210\u529F\u5F97\u6A19\uFF01</p>

    <div class="highlight">
      <div class="label">\u5F97\u6A19\u62CD\u8CE3\u54C1</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">\u6210\u4EA4\u50F9\u683C</div>
      <div class="value">${currency} ${finalPrice.toLocaleString()}</div>
    </div>

    <h2 style="margin-top:24px;font-size:16px;color:#92400e;">\u{1F4B3} \u4ED8\u6B3E\u65B9\u5F0F</h2>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;padding:12px 16px;margin:8px 0;font-size:14px;line-height:1.8;">
      ${paymentHtml}
    </div>

    <h2 style="margin-top:20px;font-size:16px;color:#92400e;">\u{1F4E6} \u4EA4\u6536\u5B89\u6392</h2>
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:12px 16px;margin:8px 0;font-size:14px;line-height:1.8;">
      ${deliveryHtml}
    </div>

    <p style="margin-top:20px;font-size:13px;color:#6b7280;">\u5982\u6709\u4EFB\u4F55\u67E5\u8A62\uFF0C\u8ACB\u806F\u7D61\u5927BB\u9322\u5E63\u5E97\u3002\u6211\u5011\u671F\u5F85\u8207\u60A8\u5B8C\u6210\u4EA4\u6613\uFF01</p>
    <a href="${auctionUrl}" class="btn">\u67E5\u770B\u62CD\u8CE3\u8A73\u60C5 \u2192</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `\u{1F389} \u3010\u606D\u559C\u5F97\u6A19\u3011${auctionTitle} \u2014 \u6210\u4EA4\u50F9 ${currency} ${finalPrice.toLocaleString()}`, html: baseLayout("\u5F97\u6A19\u901A\u77E5", body) });
}
async function sendEndingSoonEmail(params) {
  const { to, senderName, senderEmail, userName, auctionTitle, currentPrice, currency, minutesLeft, auctionUrl } = params;
  const timeLabel = minutesLeft >= 60 ? `${Math.round(minutesLeft / 60)} \u5C0F\u6642` : `${minutesLeft} \u5206\u9418`;
  const body = `
    <h2>\u23F0 \u62CD\u8CE3\u5373\u5C07\u7D50\u675F</h2>
    <p>\u89AA\u611B\u7684 <strong>${userName}</strong>\uFF0C</p>
    <p>\u60A8\u53C3\u8207\u7AF6\u6295\u7684\u62CD\u8CE3\u5C07\u65BC <strong>${timeLabel}</strong> \u5F8C\u7D50\u675F\uFF1A</p>
    <div class="highlight">
      <div class="label">\u62CD\u8CE3\u54C1</div>
      <div style="font-size:16px;font-weight:600;color:#333;margin-top:4px;">${auctionTitle}</div>
    </div>
    <div class="highlight">
      <div class="label">\u76EE\u524D\u6700\u9AD8\u51FA\u50F9</div>
      <div class="value">${currency} ${currentPrice.toLocaleString()}</div>
    </div>
    <p>\u628A\u63E1\u6700\u5F8C\u6A5F\u6703\uFF0C\u7ACB\u5373\u524D\u5F80\u51FA\u50F9\uFF01</p>
    <a href="${auctionUrl}" class="btn">\u7ACB\u5373\u51FA\u50F9 \u2192</a>
  `;
  return sendEmail({ to, senderName, senderEmail, subject: `\u3010\u5373\u5C07\u7D50\u675F\u3011${auctionTitle} \u2014 \u9084\u5269 ${timeLabel}`, html: baseLayout("\u62CD\u8CE3\u5373\u5C07\u7D50\u675F\u901A\u77E5", body) });
}
async function sendEmail(opts) {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${opts.senderName} <${opts.senderEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html
    });
    if (error) {
      console.error("[Email] Send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return false;
  }
}
var _resend;
var init_email = __esm({
  "server/email.ts"() {
    "use strict";
    _resend = null;
  }
});

// server/_core/index.ts
import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle as drizzle2 } from "drizzle-orm/mysql2";
import { createPool as createPool2 } from "mysql2/promise";
import path3 from "path";
import { fileURLToPath } from "url";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();
import axios2 from "axios";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId: appId || "",
        name: name || ""
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        await upsertUser({
          openId: sessionUserId,
          name: session.name || null,
          email: null,
          loginMethod: "google",
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(sessionUserId);
      } catch (dbError) {
        console.warn("[Auth] Failed to upsert user from session:", dbError);
      }
      if (!user) {
        console.warn("[Auth] Database unavailable, using session data directly for:", sessionUserId);
        const isOwner = ENV.ownerOpenId && sessionUserId === ENV.ownerOpenId;
        return {
          id: 0,
          openId: sessionUserId,
          name: session.name || null,
          email: null,
          loginMethod: "google",
          role: isOwner ? "admin" : "user",
          notifyOutbid: 1,
          notifyWon: 1,
          notifyEndingSoon: 1,
          memberLevel: "bronze",
          defaultAnonymous: 0,
          lastSignedIn: signedInAt,
          createdAt: signedInAt,
          updatedAt: signedInAt
        };
      }
    }
    try {
      await upsertUser({
        openId: user.openId,
        lastSignedIn: signedInAt
      });
    } catch (dbError) {
      console.warn("[Auth] Failed to update lastSignedIn:", dbError);
    }
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
init_env();
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
async function exchangeGoogleCode(code, redirectUri) {
  const params = new URLSearchParams({
    code,
    client_id: ENV.googleClientId,
    client_secret: ENV.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });
  const { data } = await axios2.post(
    "https://oauth2.googleapis.com/token",
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return data;
}
async function getGoogleUserInfo(accessToken) {
  const { data } = await axios2.get(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }
    try {
      if (ENV.googleClientId && ENV.googleClientSecret) {
        const forwardedProto = req.headers["x-forwarded-proto"];
        const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : req.protocol;
        const host = req.get("host");
        const redirectUri = `${protocol}://${host}/api/oauth/callback`;
        console.log(`[OAuth] Callback - protocol: ${protocol}, host: ${host}, redirectUri: ${redirectUri}`);
        const tokenResponse2 = await exchangeGoogleCode(code, redirectUri);
        const userInfo2 = await getGoogleUserInfo(tokenResponse2.access_token);
        const openId = `google_${userInfo2.sub}`;
        console.log(`[OAuth] User logged in - openId: ${openId}, email: ${userInfo2.email}, name: ${userInfo2.name}`);
        await upsertUser({
          openId,
          name: userInfo2.name || null,
          email: userInfo2.email ?? null,
          loginMethod: "google",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        const sessionToken2 = await sdk.createSessionToken(openId, {
          name: userInfo2.name || "",
          expiresInMs: ONE_YEAR_MS
        });
        const cookieOptions2 = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken2, { ...cookieOptions2, maxAge: ONE_YEAR_MS });
        res.redirect(302, "/");
        return;
      }
      if (!state) {
        res.status(400).json({ error: "state is required" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/devLogin.ts
init_db();
init_env();
function registerDevLoginRoutes(app) {
  if (ENV.isProduction) return;
  app.get("/api/dev/login-page", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u6C99\u76D2\u6E2C\u8A66\u767B\u5165 \u2014 \u5927BB\u9322\u5E63\u5E97</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.4);
    }
    .logo { text-align: center; margin-bottom: 8px; font-size: 40px; }
    h1 { text-align: center; font-size: 22px; color: #1a1a2e; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #888; font-size: 13px; margin-bottom: 28px; }
    .badge {
      display: inline-block;
      background: #fef3c7; color: #d97706;
      border: 1px solid #fde68a;
      border-radius: 20px; padding: 4px 12px;
      font-size: 12px; font-weight: 600; margin-bottom: 24px;
    }
    .badge-wrap { text-align: center; }
    label { display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input[type="text"] {
      width: 100%; padding: 12px 16px;
      border: 2px solid #e5e7eb; border-radius: 10px;
      font-size: 15px; outline: none; transition: border-color 0.2s; margin-bottom: 16px;
    }
    input[type="text"]:focus { border-color: #f59e0b; }
    .role-group { display: flex; gap: 10px; margin-bottom: 24px; }
    .role-btn {
      flex: 1; padding: 10px;
      border: 2px solid #e5e7eb; border-radius: 10px;
      background: white; cursor: pointer;
      font-size: 13px; font-weight: 600; color: #6b7280;
      transition: all 0.2s; text-align: center;
    }
    .role-btn.active { border-color: #f59e0b; background: #fffbeb; color: #d97706; }
    .role-btn:hover { border-color: #f59e0b; }
    .btn-login {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white; border: none; border-radius: 10px;
      font-size: 16px; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s; letter-spacing: 0.5px;
    }
    .btn-login:hover { opacity: 0.9; }
    .note {
      margin-top: 20px; padding: 12px 16px;
      background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 8px; font-size: 12px; color: #166534; line-height: 1.5;
    }
    .error { color: #dc2626; font-size: 13px; margin-top: -8px; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">\u{1F4B0}</div>
    <h1>\u5927BB\u9322\u5E63\u5E97</h1>
    <p class="subtitle">\u5C08\u696D\u9322\u5E63\u62CD\u8CE3\u5E73\u53F0</p>
    <div class="badge-wrap"><span class="badge">\u{1F9EA} \u6C99\u76D2\u6E2C\u8A66\u6A21\u5F0F</span></div>
    <form id="loginForm" onsubmit="doLogin(event)">
      <label for="username">\u7528\u6236\u540D\u7A31</label>
      <input type="text" id="username" placeholder="\u8F38\u5165\u4EFB\u610F\u540D\u7A31\uFF08\u4F8B\u5982\uFF1A\u6E2C\u8A66\u7528\u6236\uFF09" autocomplete="off" />
      <p class="error" id="errMsg">\u8ACB\u8F38\u5165\u7528\u6236\u540D\u7A31</p>
      <label>\u767B\u5165\u8EAB\u4EFD</label>
      <div class="role-group">
        <div class="role-btn active" id="roleUser" onclick="selectRole('user')">\u{1F464} \u4E00\u822C\u7528\u6236</div>
        <div class="role-btn" id="roleAdmin" onclick="selectRole('admin')">\u{1F511} \u7BA1\u7406\u54E1</div>
      </div>
      <button type="submit" class="btn-login">\u7ACB\u5373\u767B\u5165\u6E2C\u8A66</button>
    </form>
    <div class="note">
      \u26A0\uFE0F \u6B64\u70BA\u6C99\u76D2\u6E2C\u8A66\u74B0\u5883\uFF0C\u767B\u5165\u8CC7\u6599\u4E0D\u6703\u5F71\u97FF\u6B63\u5F0F\u7CFB\u7D71\u3002<br>
      \u9078\u64C7\u300C\u7BA1\u7406\u54E1\u300D\u53EF\u6E2C\u8A66\u5F8C\u53F0\u7BA1\u7406\u529F\u80FD\u3002
    </div>
  </div>
  <script>
    let selectedRole = 'user';
    function selectRole(role) {
      selectedRole = role;
      document.getElementById('roleUser').classList.toggle('active', role === 'user');
      document.getElementById('roleAdmin').classList.toggle('active', role === 'admin');
    }
    async function doLogin(e) {
      e.preventDefault();
      const name = document.getElementById('username').value.trim();
      const errMsg = document.getElementById('errMsg');
      if (!name) { errMsg.style.display = 'block'; return; }
      errMsg.style.display = 'none';
      try {
        const res = await fetch('/api/dev/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role: selectedRole }),
          credentials: 'include'
        });
        const data = await res.json();
        if (data.success) { window.location.href = '/'; }
        else { alert('\u767B\u5165\u5931\u6557\uFF1A' + (data.error || '\u672A\u77E5\u932F\u8AA4')); }
      } catch(err) { alert('\u7DB2\u8DEF\u932F\u8AA4\uFF0C\u8ACB\u91CD\u8A66'); }
    }
  </script>
</body>
</html>`);
  });
  app.post("/api/dev/login", async (req, res) => {
    try {
      const { name, role } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ success: false, error: "Name is required" });
        return;
      }
      const cleanName = name.trim().slice(0, 50);
      const isAdmin = role === "admin";
      const openId = isAdmin ? "dev-admin-sandbox" : `dev-user-${cleanName.replace(/\s+/g, "-").toLowerCase()}`;
      await upsertUser({
        openId,
        name: cleanName,
        email: null,
        loginMethod: "dev-sandbox",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      if (isAdmin) {
        const dbInstance = await getDb();
        if (dbInstance) {
          const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
          const { eq: eq3 } = await import("drizzle-orm");
          await dbInstance.update(users2).set({ role: "admin" }).where(eq3(users2.openId, openId));
        }
      }
      const sessionToken = await sdk.createSessionToken(openId, {
        name: cleanName,
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS
      });
      res.json({ success: true, name: cleanName, role: isAdmin ? "admin" : "user" });
    } catch (error) {
      console.error("[DevLogin] Error:", error);
      res.status(500).json({ success: false, error: "Login failed" });
    }
  });
  app.post("/api/dev/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });
  console.log("[DevLogin] Sandbox mock login enabled at /api/dev/login-page");
}

// server/webhook.ts
init_env();

// server/_core/llm.ts
init_env();
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/webhook.ts
init_db();
async function parsePostWithAI(payload) {
  const postText = [
    payload.post_text ?? payload.message ?? payload.content ?? "",
    payload.description ?? ""
  ].join("\n").trim();
  const imageUrls = [];
  if (payload.image_url) imageUrls.push(payload.image_url);
  if (Array.isArray(payload.images)) {
    payload.images.forEach((img) => {
      if (typeof img === "string") imageUrls.push(img);
      else if (img?.url) imageUrls.push(img.url);
    });
  }
  const prompt = `\u4F60\u662F\u4E00\u500B\u62CD\u8CE3\u5546\u54C1\u8CC7\u6599\u63D0\u53D6\u52A9\u624B\u3002\u8ACB\u5F9E\u4EE5\u4E0B Facebook \u7FA4\u7D44\u8CBC\u6587\u4E2D\u63D0\u53D6\u62CD\u8CE3\u8CC7\u8A0A\uFF0C\u4E26\u4EE5 JSON \u683C\u5F0F\u56DE\u50B3\u3002

\u8CBC\u6587\u5167\u5BB9\uFF1A
${postText}

\u8ACB\u63D0\u53D6\u4EE5\u4E0B\u8CC7\u8A0A\uFF1A
- title: \u5546\u54C1\u540D\u7A31\uFF08\u7C21\u6F54\uFF0C\u6700\u591A 80 \u5B57\uFF09
- description: \u5546\u54C1\u63CF\u8FF0\uFF08\u4FDD\u7559\u539F\u6587\u91CD\u8981\u7D30\u7BC0\uFF09
- startingPrice: \u8D77\u62CD\u50F9\uFF08\u6578\u5B57\uFF0C\u5982\u627E\u4E0D\u5230\u5247\u8A2D\u70BA 0\uFF09
- currency: \u8CA8\u5E63\uFF08HKD/USD/CNY/GBP/EUR/JPY\uFF0C\u9810\u8A2D HKD\uFF09
- bidIncrement: \u6BCF\u53E3\u52A0\u5E45\uFF08\u6578\u5B57\uFF0C\u5982\u627E\u4E0D\u5230\u5247\u8A2D\u70BA 30\uFF09

\u6CE8\u610F\uFF1A\u53EA\u63D0\u53D6\u660E\u78BA\u63D0\u53CA\u7684\u8CC7\u8A0A\uFF0C\u4E0D\u8981\u731C\u6E2C\u6216\u634F\u9020\u3002`;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "\u4F60\u662F\u4E00\u500B\u5C08\u696D\u7684\u62CD\u8CE3\u8CC7\u6599\u63D0\u53D6\u52A9\u624B\uFF0C\u53EA\u8F38\u51FA JSON\u3002" },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "auction_data",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              startingPrice: { type: "number" },
              currency: { type: "string", enum: ["HKD", "USD", "CNY", "GBP", "EUR", "JPY"] },
              bidIncrement: { type: "number" }
            },
            required: ["title", "description", "startingPrice", "currency", "bidIncrement"],
            additionalProperties: false
          }
        }
      }
    });
    const content = response?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return {
      title: parsed.title || "\uFF08\u672A\u547D\u540D\u5546\u54C1\uFF09",
      description: parsed.description || postText,
      startingPrice: Math.max(0, Number(parsed.startingPrice) || 0),
      currency: ["HKD", "USD", "CNY", "GBP", "EUR", "JPY"].includes(parsed.currency) ? parsed.currency : "HKD",
      bidIncrement: Math.min(5e3, Math.max(30, Number(parsed.bidIncrement) || 30)),
      imageUrls,
      fbPostUrl: payload.post_url ?? payload.url ?? payload.link ?? null
    };
  } catch (err) {
    console.error("[Webhook] AI parsing failed:", err);
    return {
      title: postText.split("\n")[0]?.slice(0, 80) || "\uFF08\u672A\u547D\u540D\u5546\u54C1\uFF09",
      description: postText,
      startingPrice: 0,
      currency: "HKD",
      bidIncrement: 30,
      imageUrls,
      fbPostUrl: payload.post_url ?? payload.url ?? payload.link ?? null
    };
  }
}
function registerWebhookRoutes(app) {
  app.post("/api/webhook/facebook", async (req, res) => {
    try {
      const expectedSecret = ENV.webhookSecret;
      if (expectedSecret) {
        const incoming = req.headers["x-webhook-secret"] || req.query.secret || req.body?.secret;
        if (incoming !== expectedSecret) {
          console.warn("[Webhook] Rejected: invalid secret");
          return res.status(401).json({ error: "Unauthorized" });
        }
      }
      const payload = req.body ?? {};
      console.log("[Webhook] Received Facebook post payload:", JSON.stringify(payload).slice(0, 300));
      const parsed = await parsePostWithAI(payload);
      if (!parsed.title || parsed.title === "\uFF08\u672A\u547D\u540D\u5546\u54C1\uFF09" && !parsed.description) {
        return res.status(400).json({ error: "Could not extract meaningful content from post" });
      }
      const ownerUser = await getUserByOpenId(ENV.ownerOpenId);
      if (!ownerUser) {
        console.error("[Webhook] Owner user not found, cannot create draft");
        return res.status(500).json({ error: "Owner user not configured" });
      }
      const endTime = /* @__PURE__ */ new Date();
      endTime.setDate(endTime.getDate() + 7);
      const auction = await createAuction({
        title: parsed.title,
        description: parsed.description,
        startingPrice: parsed.startingPrice.toString(),
        currentPrice: parsed.startingPrice.toString(),
        endTime,
        status: "draft",
        bidIncrement: parsed.bidIncrement,
        currency: parsed.currency,
        createdBy: ownerUser.id,
        fbPostUrl: parsed.fbPostUrl
      });
      for (let i = 0; i < parsed.imageUrls.length; i++) {
        try {
          await addAuctionImage({
            auctionId: auction.id,
            imageUrl: parsed.imageUrls[i],
            displayOrder: i
          });
        } catch (imgErr) {
          console.warn("[Webhook] Failed to save image:", imgErr);
        }
      }
      console.log(`[Webhook] Created draft auction #${auction.id}: ${parsed.title}`);
      return res.status(201).json({
        success: true,
        auctionId: auction.id,
        title: parsed.title,
        status: "draft"
      });
    } catch (err) {
      console.error("[Webhook] Unexpected error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/api/webhook/facebook", (req, res) => {
    res.json({ status: "ok", message: "Facebook webhook endpoint is active" });
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();
import { z as z2 } from "zod";

// server/auctions.ts
init_db();
init_schema();
init_email();
init_db();
import { eq as eq2 } from "drizzle-orm";
var endingSoonSent = /* @__PURE__ */ new Set();
async function validateBid(auctionId, bidAmount) {
  const auction = await getAuctionById(auctionId);
  if (!auction) {
    return { valid: false, error: "Auction not found" };
  }
  if (auction.status !== "active") {
    return { valid: false, error: "Auction is not active" };
  }
  if (/* @__PURE__ */ new Date() > auction.endTime) {
    return { valid: false, error: "Auction has ended" };
  }
  const currentPrice = parseFloat(auction.currentPrice.toString());
  const startingPrice = parseFloat(auction.startingPrice.toString());
  const bidIncrement = auction.bidIncrement ?? 50;
  const hasExistingBid = auction.highestBidderId !== null && auction.highestBidderId !== void 0;
  const minBid = hasExistingBid ? currentPrice + bidIncrement : startingPrice;
  if (bidAmount < minBid) {
    if (hasExistingBid) {
      return { valid: false, error: `\u51FA\u50F9\u91D1\u984D\u5FC5\u9808\u81F3\u5C11\u70BA HK$${minBid}\uFF08\u73FE\u50F9 HK$${currentPrice} + \u6BCF\u53E3\u52A0\u5E45 HK$${bidIncrement}\uFF09` };
    } else {
      return { valid: false, error: `\u7B2C\u4E00\u53E3\u51FA\u50F9\u91D1\u984D\u5FC5\u9808\u81F3\u5C11\u70BA\u8D77\u62CD\u50F9 HK$${startingPrice}` };
    }
  }
  return { valid: true };
}
async function recordBid(db, auctionId, userId, bidAmount, isAnonymous = 0) {
  await db.update(auctions).set({ currentPrice: bidAmount.toString(), highestBidderId: userId }).where(eq2(auctions.id, auctionId));
  await placeBid({ auctionId, userId, bidAmount: bidAmount.toString(), isAnonymous });
}
async function runProxyBidEngine(auctionId, triggeringUserId) {
  const db = await getDb();
  if (!db) return;
  const MAX_ROUNDS = 50;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const auction = await getAuctionById(auctionId);
    if (!auction || auction.status !== "active" || /* @__PURE__ */ new Date() > auction.endTime) break;
    const currentPrice = parseFloat(auction.currentPrice.toString());
    const bidIncrement = auction.bidIncrement ?? 50;
    const currentHighestBidderId = auction.highestBidderId;
    const proxies = await getActiveProxiesForAuction(auctionId);
    const topChallenger = proxies.find((p) => p.userId !== currentHighestBidderId);
    if (!topChallenger) break;
    const challengerMax = parseFloat(topChallenger.maxAmount.toString());
    const requiredBid = currentPrice + bidIncrement;
    if (challengerMax < requiredBid) break;
    const leaderProxy = currentHighestBidderId ? proxies.find((p) => p.userId === currentHighestBidderId) : null;
    let finalBidAmount;
    let finalBidderId;
    if (leaderProxy) {
      const leaderMax = parseFloat(leaderProxy.maxAmount.toString());
      if (leaderMax >= challengerMax + bidIncrement) {
        finalBidAmount = Math.min(leaderMax, challengerMax + bidIncrement);
        finalBidderId = leaderProxy.userId;
      } else if (challengerMax > leaderMax) {
        finalBidAmount = Math.min(challengerMax, leaderMax + bidIncrement);
        finalBidderId = topChallenger.userId;
      } else {
        break;
      }
    } else {
      finalBidAmount = requiredBid;
      finalBidderId = topChallenger.userId;
    }
    await recordBid(db, auctionId, finalBidderId, finalBidAmount);
    await insertProxyBidLog({
      auctionId,
      round: round + 1,
      triggerUserId: currentHighestBidderId ?? triggeringUserId,
      triggerAmount: currentPrice,
      proxyUserId: finalBidderId,
      proxyAmount: finalBidAmount
    });
    const updatedAuction = await getAuctionById(auctionId);
    if (!updatedAuction || updatedAuction.highestBidderId === currentHighestBidderId) break;
  }
}
async function notifyOutbid(auctionId, previousHighestBidderId, newBidAmount, origin) {
  if (!previousHighestBidderId) return;
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.enableOutbid) return;
    const db = await getDb();
    if (!db) return;
    const auction = await getAuctionById(auctionId);
    if (!auction) return;
    const userRows = await db.select({ email: users.email, name: users.name, notifyOutbid: users.notifyOutbid }).from(users).where(eq2(users.id, previousHighestBidderId));
    const prevUser = userRows[0];
    if (!prevUser?.email) return;
    if (!prevUser.notifyOutbid) return;
    await sendOutbidEmail({
      to: prevUser.email,
      senderName: settings.senderName,
      senderEmail: settings.senderEmail,
      userName: prevUser.name ?? `\u7528\u6236 #${previousHighestBidderId}`,
      auctionTitle: auction.title,
      auctionId,
      newHighestBid: newBidAmount,
      currency: auction.currency,
      auctionUrl: `${origin}/auctions/${auctionId}`
    });
  } catch (err) {
    console.error("[Email] Outbid notification error:", err);
  }
}
async function notifyWon(auctionId, origin) {
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.enableWon) return;
    const auction = await getAuctionById(auctionId);
    if (!auction || !auction.highestBidderId) return;
    const db = await getDb();
    if (!db) return;
    const userRows = await db.select({ email: users.email, name: users.name, notifyWon: users.notifyWon }).from(users).where(eq2(users.id, auction.highestBidderId));
    const winner = userRows[0];
    if (!winner?.email) return;
    if (!winner.notifyWon) return;
    await sendWonEmail({
      to: winner.email,
      senderName: settings.senderName,
      senderEmail: settings.senderEmail,
      userName: winner.name ?? `\u7528\u6236 #${auction.highestBidderId}`,
      auctionTitle: auction.title,
      auctionId,
      finalPrice: parseFloat(auction.currentPrice.toString()),
      currency: auction.currency,
      auctionUrl: `${origin}/auctions/${auctionId}`,
      paymentInstructions: settings.paymentInstructions ?? null,
      deliveryInfo: settings.deliveryInfo ?? null
    });
  } catch (err) {
    console.error("[Email] Won notification error:", err);
  }
}
async function notifyEndingSoon(auctionId, origin) {
  if (endingSoonSent.has(auctionId)) return;
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.enableEndingSoon) return;
    const auction = await getAuctionById(auctionId);
    if (!auction || auction.status !== "active") return;
    const bidders = await getBiddersForAuction(auctionId);
    if (bidders.length === 0) return;
    endingSoonSent.add(auctionId);
    for (const bidder of bidders) {
      if (!bidder.email) continue;
      const bidderUser = await getUserById(bidder.userId);
      if (!bidderUser?.notifyEndingSoon) continue;
      await sendEndingSoonEmail({
        to: bidder.email,
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        userName: bidder.name ?? `\u7528\u6236 #${bidder.userId}`,
        auctionTitle: auction.title,
        auctionId,
        currentPrice: parseFloat(auction.currentPrice.toString()),
        currency: auction.currency,
        minutesLeft: settings.endingSoonMinutes,
        auctionUrl: `${origin}/auctions/${auctionId}`
      });
    }
  } catch (err) {
    console.error("[Email] Ending-soon notification error:", err);
  }
}
async function placeBid2(auctionId, userId, bidAmount, origin = "", isAnonymous = 0) {
  const validation = await validateBid(auctionId, bidAmount);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const auctionBefore = await getAuctionById(auctionId);
  const previousHighestBidderId = auctionBefore?.highestBidderId ?? null;
  try {
    await recordBid(db, auctionId, userId, bidAmount, isAnonymous);
    let extended = false;
    let newEndTime;
    const auctionAfter = await getAuctionById(auctionId);
    const globalSettings = await getNotificationSettings();
    const antiSnipeGloballyEnabled = globalSettings ? (globalSettings.enableAntiSnipe ?? 1) === 1 : true;
    if (antiSnipeGloballyEnabled && auctionAfter && auctionAfter.status === "active") {
      const perAuctionEnabled = (auctionAfter.antiSnipeEnabled ?? 1) === 1 && (auctionAfter.antiSnipeMinutes ?? 3) > 0;
      const memberLevelsRaw = auctionAfter.antiSnipeMemberLevels ?? "all";
      let memberLevelAllowed = true;
      if (memberLevelsRaw && memberLevelsRaw !== "all") {
        try {
          const allowedLevels = JSON.parse(memberLevelsRaw);
          if (allowedLevels.length > 0) {
            const bidder = await getUserById(userId);
            const bidderLevel = bidder?.memberLevel ?? "bronze";
            memberLevelAllowed = allowedLevels.includes(bidderLevel);
          }
        } catch {
          memberLevelAllowed = true;
        }
      }
      if (perAuctionEnabled && memberLevelAllowed) {
        const antiSnipeMs = (auctionAfter.antiSnipeMinutes ?? 3) * 60 * 1e3;
        const extendMs = (auctionAfter.extendMinutes ?? 3) * 60 * 1e3;
        const now = Date.now();
        const endMs = new Date(auctionAfter.endTime).getTime();
        const timeLeft = endMs - now;
        if (timeLeft > 0 && timeLeft <= antiSnipeMs) {
          newEndTime = new Date(endMs + extendMs);
          await db.update(auctions).set({ endTime: newEndTime }).where(eq2(auctions.id, auctionId));
          extended = true;
          console.log(`[AntiSnipe] Auction #${auctionId} extended by ${auctionAfter.extendMinutes ?? 3} min. New endTime: ${newEndTime.toISOString()}`);
        }
      }
    }
    runProxyBidEngine(auctionId, userId).catch(
      (err) => console.error("[Auctions] Proxy engine error:", err)
    );
    if (previousHighestBidderId && previousHighestBidderId !== userId) {
      notifyOutbid(auctionId, previousHighestBidderId, bidAmount, origin).catch(
        (err) => console.error("[Auctions] Outbid notify error:", err)
      );
    }
    return { success: true, extended, newEndTime, extendMinutes: auctionAfter?.extendMinutes ?? 3 };
  } catch (error) {
    console.error("[Auctions] Failed to place bid:", error);
    throw error;
  }
}

// server/routers.ts
init_db();

// server/storage.ts
init_env();
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var bidDebounceMap = /* @__PURE__ */ new Map();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  auctions: router({
    list: publicProcedure.input(z2.object({
      limit: z2.number().default(20),
      offset: z2.number().default(0),
      category: z2.string().optional()
    })).query(async ({ input, ctx }) => {
      const closedIds = await closeExpiredAuctions();
      if (closedIds.length > 0) {
        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/[^/]*$/, "") || "";
        closedIds.forEach((id) => notifyWon(id, origin).catch(() => {
        }));
      }
      const auctionList = await getAuctions(input.limit, input.offset, input.category);
      const withImages = await Promise.all(
        auctionList.map(async (auction) => ({
          ...auction,
          images: await getAuctionImages(auction.id)
        }))
      );
      return withImages;
    }),
    detail: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input, ctx }) => {
      const closedIds = await closeExpiredAuctions();
      if (closedIds.length > 0) {
        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/[^/]*$/, "") || "";
        closedIds.forEach((id) => notifyWon(id, origin).catch(() => {
        }));
      }
      const auction = await getAuctionById(input.id);
      if (!auction) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "Auction not found" });
      }
      const images = await getAuctionImages(input.id);
      const bidHistory = await getBidHistory(input.id);
      return {
        ...auction,
        images,
        bidHistory
      };
    }),
    create: protectedProcedure.input(z2.object({
      title: z2.string().min(1),
      description: z2.string(),
      startingPrice: z2.number().min(0),
      endTime: z2.date(),
      bidIncrement: z2.number().int().min(30).max(5e3).default(30),
      currency: z2.enum(["HKD", "USD", "CNY", "GBP", "EUR", "JPY"]).default("HKD"),
      antiSnipeEnabled: z2.number().int().min(0).max(1).default(1),
      antiSnipeMinutes: z2.number().int().min(0).max(60).default(3),
      extendMinutes: z2.number().int().min(1).max(60).default(3),
      antiSnipeMemberLevels: z2.union([z2.literal("all"), z2.array(z2.enum(["bronze", "silver", "gold", "vip"])).transform((arr) => arr.length === 0 ? "all" : JSON.stringify(arr))]).optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can create auctions" });
      }
      const result = await createAuction({
        title: input.title,
        description: input.description,
        startingPrice: input.startingPrice.toString(),
        currentPrice: input.startingPrice.toString(),
        endTime: input.endTime,
        createdBy: ctx.user.id,
        status: "active",
        bidIncrement: input.bidIncrement,
        currency: input.currency,
        antiSnipeEnabled: input.antiSnipeEnabled,
        antiSnipeMinutes: input.antiSnipeMinutes,
        extendMinutes: input.extendMinutes,
        antiSnipeMemberLevels: input.antiSnipeMemberLevels ?? "all"
      });
      return result;
    }),
    uploadImage: protectedProcedure.input(z2.object({
      auctionId: z2.number(),
      imageData: z2.string(),
      fileName: z2.string(),
      displayOrder: z2.number().default(0),
      mimeType: z2.string().default("image/jpeg")
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can upload images" });
      }
      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedMimes.includes(input.mimeType)) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "Invalid image format" });
      }
      try {
        const buffer = Buffer.from(input.imageData, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "Image size exceeds 5MB limit" });
        }
        const fileKey = `auctions/${input.auctionId}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await addAuctionImage({
          auctionId: input.auctionId,
          imageUrl: url,
          displayOrder: input.displayOrder
        });
        return { success: true, url };
      } catch (error) {
        if (error instanceof TRPCError3) throw error;
        console.error("[Router] Failed to upload image:", error);
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload image" });
      }
    }),
    placeBid: protectedProcedure.input(z2.object({
      auctionId: z2.number(),
      bidAmount: z2.number().positive(),
      origin: z2.string().optional(),
      isAnonymous: z2.number().int().min(0).max(1).optional()
    })).mutation(async ({ input, ctx }) => {
      const debounceKey = `${ctx.user.id}:${input.auctionId}`;
      const lastBidTime = bidDebounceMap.get(debounceKey) ?? 0;
      const now = Date.now();
      if (now - lastBidTime < 3e3) {
        throw new TRPCError3({ code: "TOO_MANY_REQUESTS", message: "\u8ACB\u7A0D\u5019\u5E7E\u79D2\u518D\u8A66\uFF0C\u8ACB\u52FF\u91CD\u8907\u51FA\u50F9" });
      }
      bidDebounceMap.set(debounceKey, now);
      if (bidDebounceMap.size > 1e4) {
        const cutoff = now - 6e4;
        Array.from(bidDebounceMap.entries()).forEach(([k, t2]) => {
          if (t2 < cutoff) bidDebounceMap.delete(k);
        });
      }
      try {
        const result = await placeBid2(input.auctionId, ctx.user.id, input.bidAmount, input.origin ?? "", input.isAnonymous ?? 0);
        return { success: true, extended: result.extended ?? false, newEndTime: result.newEndTime, extendMinutes: result.extendMinutes };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to place bid";
        throw new TRPCError3({ code: "BAD_REQUEST", message });
      }
    }),
    myBids: protectedProcedure.query(async ({ ctx }) => {
      return getUserBidsGrouped(ctx.user.id);
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      title: z2.string().min(1).optional(),
      description: z2.string().optional(),
      startingPrice: z2.number().min(0).optional(),
      endTime: z2.date().optional(),
      bidIncrement: z2.number().int().min(30).max(5e3).optional(),
      currency: z2.enum(["HKD", "USD", "CNY", "GBP", "EUR", "JPY"]).optional(),
      antiSnipeEnabled: z2.number().int().min(0).max(1).optional(),
      antiSnipeMinutes: z2.number().int().min(0).max(60).optional(),
      extendMinutes: z2.number().int().min(1).max(60).optional(),
      antiSnipeMemberLevels: z2.union([z2.literal("all"), z2.array(z2.enum(["bronze", "silver", "gold", "vip"])).transform((arr) => arr.length === 0 ? "all" : JSON.stringify(arr))]).optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can update auctions" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "Auction not found" });
      }
      if (input.startingPrice !== void 0) {
        const bidHistory = await getBidHistory(input.id);
        if (bidHistory.length > 0) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u5DF2\u6709\u51FA\u50F9\u8A18\u9304\uFF0C\u4E0D\u80FD\u4FEE\u6539\u8D77\u62CD\u50F9" });
        }
      }
      const updateData = {};
      if (input.title !== void 0) updateData.title = input.title;
      if (input.description !== void 0) updateData.description = input.description;
      if (input.startingPrice !== void 0) {
        updateData.startingPrice = String(input.startingPrice);
        updateData.currentPrice = String(input.startingPrice);
      }
      if (input.endTime !== void 0) updateData.endTime = input.endTime;
      if (input.bidIncrement !== void 0) updateData.bidIncrement = input.bidIncrement;
      if (input.currency !== void 0) updateData.currency = input.currency;
      if (input.antiSnipeEnabled !== void 0) updateData.antiSnipeEnabled = input.antiSnipeEnabled;
      if (input.antiSnipeMinutes !== void 0) updateData.antiSnipeMinutes = input.antiSnipeMinutes;
      if (input.extendMinutes !== void 0) updateData.extendMinutes = input.extendMinutes;
      if (input.antiSnipeMemberLevels !== void 0) updateData.antiSnipeMemberLevels = input.antiSnipeMemberLevels;
      try {
        await updateAuction(input.id, updateData);
        return { success: true };
      } catch (error) {
        console.error("[Router] Failed to update auction:", error);
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update auction" });
      }
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can delete auctions" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) {
        throw new TRPCError3({ code: "NOT_FOUND", message: "Auction not found" });
      }
      try {
        await deleteAuction(input.id);
        return { success: true };
      } catch (error) {
        console.error("[Router] Failed to delete auction:", error);
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete auction" });
      }
    }),
    deleteImage: protectedProcedure.input(z2.object({ imageId: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can delete images" });
      }
      try {
        await deleteAuctionImage(input.imageId);
        return { success: true };
      } catch (error) {
        console.error("[Router] Failed to delete image:", error);
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete image" });
      }
    }),
    myAuctions: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can view their auctions" });
      }
      const auctionList = await getAuctionsByCreator(ctx.user.id);
      const now = /* @__PURE__ */ new Date();
      const expiredIds = auctionList.filter(
        (a) => a.status === "active" && new Date(a.endTime) <= now
      ).map((a) => a.id);
      if (expiredIds.length > 0) {
        await Promise.all(
          expiredIds.map((id) => updateAuction(id, { status: "ended" }))
        );
      }
      const updatedList = expiredIds.length > 0 ? await getAuctionsByCreator(ctx.user.id) : auctionList;
      const withImages = await Promise.all(
        updatedList.map(async (auction) => ({
          ...auction,
          images: await getAuctionImages(auction.id)
        }))
      );
      return withImages;
    }),
    drafts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can view drafts" });
      }
      const draftList = await getDraftAuctions();
      const withImages = await Promise.all(
        draftList.map(async (auction) => ({
          ...auction,
          images: await getAuctionImages(auction.id)
        }))
      );
      return withImages;
    }),
    publish: protectedProcedure.input(z2.object({
      id: z2.number(),
      title: z2.string().min(1).optional(),
      description: z2.string().optional(),
      startingPrice: z2.number().min(0).optional(),
      endTime: z2.date(),
      bidIncrement: z2.number().int().min(30).max(5e3).optional(),
      currency: z2.enum(["HKD", "USD", "CNY", "GBP", "EUR", "JPY"]).optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can publish drafts" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u8349\u7A3F" });
      if (auction.status !== "draft") throw new TRPCError3({ code: "BAD_REQUEST", message: "\u6B64\u62CD\u8CE3\u4E26\u975E\u8349\u7A3F\u72C0\u614B" });
      if (input.endTime <= /* @__PURE__ */ new Date()) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u7D50\u675F\u6642\u9593\u5FC5\u9808\u70BA\u672A\u4F86\u6642\u9593" });
      const updateData = { status: "active", endTime: input.endTime };
      if (input.title !== void 0) updateData.title = input.title;
      if (input.description !== void 0) updateData.description = input.description;
      if (input.startingPrice !== void 0) {
        updateData.startingPrice = input.startingPrice.toString();
        updateData.currentPrice = input.startingPrice.toString();
      }
      if (input.bidIncrement !== void 0) updateData.bidIncrement = input.bidIncrement;
      if (input.currency !== void 0) updateData.currency = input.currency;
      await updateAuction(input.id, updateData);
      return { success: true };
    }),
    batchPublish: protectedProcedure.input(z2.object({
      ids: z2.array(z2.number()).min(1).max(100),
      endTime: z2.date()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can batch publish drafts" });
      }
      if (input.endTime <= /* @__PURE__ */ new Date()) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u7D50\u675F\u6642\u9593\u5FC5\u9808\u70BA\u672A\u4F86\u6642\u9593" });
      }
      const results = await Promise.allSettled(
        input.ids.map(async (id) => {
          const auction = await getAuctionById(id);
          if (!auction || auction.status !== "draft") return { id, skipped: true };
          await updateAuction(id, { status: "active", endTime: input.endTime });
          return { id, success: true };
        })
      );
      const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
      const skipped = results.filter((r) => r.status === "fulfilled" && r.value.skipped).length;
      return { succeeded, skipped, total: input.ids.length };
    }),
    batchDelete: protectedProcedure.input(z2.object({
      ids: z2.array(z2.number()).min(1).max(100)
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can batch delete drafts" });
      }
      const results = await Promise.allSettled(
        input.ids.map(async (id) => {
          const auction = await getAuctionById(id);
          if (!auction || auction.status !== "draft") return { id, skipped: true };
          await deleteAuction(id);
          return { id, success: true };
        })
      );
      const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
      return { succeeded, total: input.ids.length };
    }),
    relist: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can relist auctions" });
      }
      const original = await getAuctionById(input.id);
      if (!original) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u62CD\u8CE3" });
      const newAuction = await createAuction({
        title: original.title,
        description: original.description ?? void 0,
        startingPrice: original.startingPrice,
        currentPrice: original.startingPrice,
        // reset to starting price
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
        // default 7 days
        status: "draft",
        bidIncrement: original.bidIncrement,
        currency: original.currency,
        createdBy: ctx.user.id,
        relistSourceId: input.id
        // track the original auction
      });
      const originalImages = await getAuctionImages(input.id);
      for (const img of originalImages) {
        await addAuctionImage({
          auctionId: newAuction.id,
          imageUrl: img.imageUrl,
          displayOrder: img.displayOrder
        });
      }
      return { success: true, newAuctionId: newAuction.id };
    }),
    updateStartingPrice: protectedProcedure.input(z2.object({
      id: z2.number(),
      startingPrice: z2.number().min(0, "\u8D77\u62CD\u50F9\u4E0D\u80FD\u70BA\u8CA0\u6578")
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can update starting price" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u62CD\u8CE3" });
      if (auction.status === "ended") throw new TRPCError3({ code: "BAD_REQUEST", message: "\u5DF2\u7D50\u675F\u7684\u62CD\u8CE3\u4E0D\u53EF\u4FEE\u6539" });
      const bidHistory = await getBidHistory(input.id);
      if (bidHistory.length > 0) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u5DF2\u6709\u51FA\u50F9\u8A18\u9304\uFF0C\u4E0D\u80FD\u4FEE\u6539\u8D77\u62CD\u50F9" });
      }
      await updateAuction(input.id, {
        startingPrice: String(input.startingPrice),
        currentPrice: String(input.startingPrice)
      });
      return { success: true };
    }),
    archive: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can archive auctions" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u62CD\u8CE3" });
      if (auction.status !== "ended") {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u53EA\u6709\u5DF2\u7D50\u675F\u7684\u62CD\u8CE3\u624D\u80FD\u5C01\u5B58" });
      }
      await updateAuction(input.id, { archived: 1, archivedAt: /* @__PURE__ */ new Date() });
      return { success: true };
    }),
    getArchived: protectedProcedure.input(z2.object({
      category: z2.enum(["\u53E4\u5E63", "\u7D00\u5FF5\u5E63", "\u5916\u5E63", "\u9280\u5E63", "\u91D1\u5E63", "\u5176\u4ED6"]).optional(),
      dateFrom: z2.date().optional(),
      dateTo: z2.date().optional()
    }).optional().refine(
      (val) => {
        if (!val || !val.dateFrom || !val.dateTo) return true;
        return val.dateFrom <= val.dateTo;
      },
      { message: "\u8D77\u59CB\u65E5\u671F\u4E0D\u80FD\u665A\u65BC\u7D50\u675F\u65E5\u671F" }
    )).query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can view archived auctions" });
      }
      const hasFilter = input && (input.category || input.dateFrom || input.dateTo);
      const archivedList = hasFilter ? await getArchivedAuctionsFiltered({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: input.category,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo
      }) : await getArchivedAuctions();
      const withImages = await Promise.all(
        archivedList.map(async (auction) => ({
          ...auction,
          images: await getAuctionImages(auction.id)
        }))
      );
      return withImages;
    }),
    permanentDelete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can permanently delete auctions" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u62CD\u8CE3" });
      if (!auction.archived) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u53EA\u6709\u5DF2\u5C01\u5B58\u7684\u62CD\u8CE3\u624D\u80FD\u6C38\u4E45\u522A\u9664" });
      }
      await deleteAuction(input.id);
      return { success: true };
    }),
    restore: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can restore auctions" });
      }
      const auction = await getAuctionById(input.id);
      if (!auction) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u62CD\u8CE3" });
      if (!auction.archived) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u6B64\u62CD\u8CE3\u4E26\u672A\u88AB\u5C01\u5B58" });
      }
      await updateAuction(input.id, { archived: 0 });
      return { success: true };
    }),
    batchRestore: protectedProcedure.input(z2.object({
      ids: z2.array(z2.number()).min(1).max(100)
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can batch restore auctions" });
      }
      const results = await Promise.allSettled(
        input.ids.map(async (id) => {
          const auction = await getAuctionById(id);
          if (!auction || !auction.archived) return { id, skipped: true };
          await updateAuction(id, { archived: 0 });
          return { id, success: true };
        })
      );
      const succeeded = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;
      const skipped = results.filter(
        (r) => r.status === "fulfilled" && r.value.skipped
      ).length;
      return { succeeded, skipped, total: input.ids.length };
    }),
    // ── Proxy Bidding ────────────────────────────────────────────────────────
    setProxyBid: protectedProcedure.input(z2.object({
      auctionId: z2.number(),
      maxAmount: z2.number().positive()
    })).mutation(async ({ input, ctx }) => {
      const auction = await getAuctionById(input.auctionId);
      if (!auction) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u62CD\u8CE3" });
      if (auction.status !== "active") throw new TRPCError3({ code: "BAD_REQUEST", message: "\u62CD\u8CE3\u5DF2\u7D50\u675F\uFF0C\u7121\u6CD5\u8A2D\u5B9A\u4EE3\u7406\u51FA\u50F9" });
      if (/* @__PURE__ */ new Date() > auction.endTime) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u62CD\u8CE3\u5DF2\u7D50\u675F\uFF0C\u7121\u6CD5\u8A2D\u5B9A\u4EE3\u7406\u51FA\u50F9" });
      const currentPrice = parseFloat(auction.currentPrice.toString());
      const startingPrice = parseFloat(auction.startingPrice.toString());
      const hasExistingBid = !!auction.highestBidderId;
      const minAllowed = hasExistingBid ? currentPrice + (auction.bidIncrement ?? 30) : startingPrice;
      if (input.maxAmount < minAllowed) {
        throw new TRPCError3({
          code: "BAD_REQUEST",
          message: `\u4EE3\u7406\u51FA\u50F9\u4E0A\u9650\u5FC5\u9808\u81F3\u5C11\u70BA HK$${minAllowed}`
        });
      }
      await setProxyBid(input.auctionId, ctx.user.id, input.maxAmount);
      return { success: true };
    }),
    getMyProxyBid: protectedProcedure.input(z2.object({ auctionId: z2.number() })).query(async ({ input, ctx }) => {
      const proxy = await getProxyBid(input.auctionId, ctx.user.id);
      if (!proxy) return null;
      return {
        maxAmount: parseFloat(proxy.maxAmount.toString()),
        isActive: proxy.isActive === 1,
        updatedAt: proxy.updatedAt
      };
    }),
    cancelProxyBid: protectedProcedure.input(z2.object({ auctionId: z2.number() })).mutation(async ({ input, ctx }) => {
      await deactivateProxyBid(input.auctionId, ctx.user.id);
      return { success: true };
    }),
    getProxyBidLogs: publicProcedure.input(z2.object({ auctionId: z2.number() })).query(async ({ input }) => {
      const logs = await getProxyBidLogs(input.auctionId);
      return logs.map((log) => ({
        id: log.id,
        round: log.round,
        triggerUserId: log.triggerUserId,
        triggerUserName: log.triggerUserName,
        triggerAmount: parseFloat(log.triggerAmount.toString()),
        proxyUserId: log.proxyUserId,
        proxyUserName: log.proxyUserName,
        proxyAmount: parseFloat(log.proxyAmount.toString()),
        createdAt: log.createdAt
      }));
    }),
    auctionBidHistory: publicProcedure.input(z2.object({ auctionId: z2.number() })).query(async ({ input, ctx }) => {
      const history = await getBidHistory(input.auctionId);
      const isAdmin = ctx.user?.role === "admin";
      return history.map((b) => ({
        id: b.id,
        userId: b.userId,
        // Admin sees real name with anonymous marker; public sees '匿名買家'
        username: b.isAnonymous === 1 ? isAdmin ? `${b.username ?? "\u672A\u77E5"} (\u533F\u540D)` : "\u{1F575}\uFE0F \u533F\u540D\u8CB7\u5BB6" : b.username ?? "\u533F\u540D",
        bidAmount: parseFloat(b.bidAmount.toString()),
        createdAt: b.createdAt,
        memberLevel: b.memberLevel ?? "bronze",
        isAnonymous: b.isAnonymous === 1
      }));
    })
  }),
  notificationSettings: router({
    get: protectedProcedure.query(async () => {
      const settings = await getNotificationSettings();
      return settings ?? {
        senderName: "\u5927BB\u9322\u5E63\u5E97",
        senderEmail: "ywkyee@gmail.com",
        enableOutbid: 1,
        enableWon: 1,
        enableEndingSoon: 1,
        endingSoonMinutes: 60,
        enableAntiSnipe: 1,
        paymentInstructions: null,
        deliveryInfo: null
      };
    }),
    update: protectedProcedure.input(z2.object({
      senderName: z2.string().min(1).max(128).optional(),
      senderEmail: z2.string().email().optional(),
      enableOutbid: z2.number().min(0).max(1).optional(),
      enableWon: z2.number().min(0).max(1).optional(),
      enableEndingSoon: z2.number().min(0).max(1).optional(),
      endingSoonMinutes: z2.number().min(5).max(1440).optional(),
      enableAntiSnipe: z2.number().min(0).max(1).optional(),
      paymentInstructions: z2.string().max(2e3).nullable().optional(),
      deliveryInfo: z2.string().max(2e3).nullable().optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const ok = await upsertNotificationSettings(input);
      if (!ok) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save settings" });
      return { success: true };
    }),
    testEndingSoon: protectedProcedure.input(z2.object({ auctionId: z2.number(), origin: z2.string().optional() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      await notifyEndingSoon(input.auctionId, input.origin ?? "");
      return { success: true };
    }),
    testWon: protectedProcedure.input(z2.object({ auctionId: z2.number(), origin: z2.string().optional() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      await notifyWon(input.auctionId, input.origin ?? "");
      return { success: true };
    })
  }),
  users: router({
    listAll: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      return getAllUsers();
    }),
    setMemberLevel: protectedProcedure.input(z2.object({ userId: z2.number().int().positive(), memberLevel: z2.enum(["bronze", "silver", "gold", "vip"]) })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN" });
      const ok = await setUserMemberLevel(input.userId, input.memberLevel);
      if (!ok) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set member level" });
      return { success: true };
    }),
    updateEmail: protectedProcedure.input(z2.object({ email: z2.string().email() })).mutation(async ({ input, ctx }) => {
      const ok = await updateUserEmail(ctx.user.id, input.email);
      if (!ok) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update email" });
      return { success: true };
    }),
    getNotificationPrefs: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError3({ code: "NOT_FOUND" });
      return {
        notifyOutbid: user.notifyOutbid ?? 1,
        notifyWon: user.notifyWon ?? 1,
        notifyEndingSoon: user.notifyEndingSoon ?? 1
      };
    }),
    updateNotificationPrefs: protectedProcedure.input(z2.object({
      notifyOutbid: z2.number().int().min(0).max(1),
      notifyWon: z2.number().int().min(0).max(1),
      notifyEndingSoon: z2.number().int().min(0).max(1)
    })).mutation(async ({ input, ctx }) => {
      const ok = await updateUserNotificationPrefs(ctx.user.id, input);
      if (!ok) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update notification preferences" });
      return { success: true };
    }),
    getDefaultAnonymous: protectedProcedure.query(async ({ ctx }) => {
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError3({ code: "NOT_FOUND" });
      return { defaultAnonymous: user.defaultAnonymous ?? 0 };
    }),
    setDefaultAnonymous: protectedProcedure.input(z2.object({ defaultAnonymous: z2.number().int().min(0).max(1) })).mutation(async ({ input, ctx }) => {
      const db = await (await Promise.resolve().then(() => (init_db(), db_exports))).getDb();
      if (!db) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR" });
      const { users: usersTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq3 } = await import("drizzle-orm");
      await db.update(usersTable).set({ defaultAnonymous: input.defaultAnonymous }).where(eq3(usersTable.id, ctx.user.id));
      return { success: true };
    }),
    publicProfile: publicProcedure.input(z2.object({ userId: z2.number().int().positive() })).query(async ({ input }) => {
      const stats = await getUserPublicStats(input.userId);
      if (!stats) throw new TRPCError3({ code: "NOT_FOUND", message: "\u627E\u4E0D\u5230\u8A72\u7528\u6236" });
      return stats;
    }),
    // Admin: get all anonymous bids with real user info
    getAnonymousBids: protectedProcedure.input(z2.object({ page: z2.number().int().min(1).optional(), pageSize: z2.number().int().min(1).max(100).optional() })).query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can view anonymous bids" });
      const result = await getAnonymousBids({ page: input.page, pageSize: input.pageSize });
      return result;
    }),
    getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can view dashboard stats" });
      const stats = await getDashboardStats();
      return stats;
    })
  }),
  favorites: router({
    toggle: protectedProcedure.input(z2.object({ auctionId: z2.number() })).mutation(async ({ input, ctx }) => {
      return toggleFavorite(ctx.user.id, input.auctionId);
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserFavorites(ctx.user.id);
    }),
    ids: protectedProcedure.query(async ({ ctx }) => {
      return getFavoriteIds(ctx.user.id);
    })
  }),
  wonAuctions: router({
    // 用戶得標記錄：已結束且自己是最高出價者
    myWon: protectedProcedure.query(async ({ ctx }) => {
      return getMyWonAuctions(ctx.user.id);
    }),
    // 更新付款狀態（買家標記已付款；管理員可設定任何狀態）
    updatePaymentStatus: protectedProcedure.input(z2.object({
      auctionId: z2.number().int().positive(),
      status: z2.enum(["pending_payment", "paid", "delivered"])
    })).mutation(async ({ input, ctx }) => {
      const isAdmin = ctx.user.role === "admin";
      const result = await updatePaymentStatus(input.auctionId, input.status, ctx.user.id, isAdmin);
      if (!result.success) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: result.error ?? "\u66F4\u65B0\u5931\u6557" });
      }
      return { success: true };
    }),
    // 管理員查看所有得標訂單
    allOrders: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Admin only" });
      return getWonOrders();
    }),
    // 管理員重發得標通知 Email
    resendEmail: protectedProcedure.input(z2.object({
      auctionId: z2.number().int().positive(),
      origin: z2.string().optional()
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Admin only" });
      const auction = await getAuctionById(input.auctionId);
      if (!auction || auction.status !== "ended") {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u53EA\u80FD\u5C0D\u5DF2\u7D50\u675F\u7684\u62CD\u8CE3\u91CD\u767C\u901A\u77E5" });
      }
      if (!auction.highestBidderId) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u6B64\u62CD\u8CE3\u6C92\u6709\u5F97\u6A19\u8005" });
      }
      const winner = await getUserById(auction.highestBidderId);
      if (!winner?.email) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u5F97\u6A19\u8005\u5C1A\u672A\u586B\u5BEB\u96FB\u90F5\u5730\u5740\uFF0C\u7121\u6CD5\u767C\u9001\u901A\u77E5" });
      }
      const settings = await getNotificationSettings();
      const origin = input.origin || ctx.req?.headers?.origin || ctx.req?.headers?.referer?.replace(/\/[^/]*$/, "") || "";
      if (!settings?.senderEmail) {
        console.warn("[Email] resendEmail: senderEmail not configured in notification settings");
      }
      const { sendWonEmail: sendWonEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
      const sent = await sendWonEmail2({
        to: winner.email,
        senderName: settings?.senderName ?? "\u5927BB\u9322\u5E63\u5E97",
        senderEmail: settings?.senderEmail ?? "noreply@example.com",
        userName: winner.name ?? `\u7528\u6236 #${auction.highestBidderId}`,
        auctionTitle: auction.title,
        auctionId: input.auctionId,
        finalPrice: parseFloat(auction.currentPrice.toString()),
        currency: auction.currency,
        auctionUrl: origin ? `${origin}/auctions/${input.auctionId}` : `https://bbcoinshop-5iu7x8hz.manus.space/auctions/${input.auctionId}`,
        paymentInstructions: settings?.paymentInstructions ?? null,
        deliveryInfo: settings?.deliveryInfo ?? null
      });
      if (!sent) {
        throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Email \u767C\u9001\u5931\u6557\uFF0C\u8ACB\u78BA\u8A8D Resend API \u8A2D\u5B9A\u662F\u5426\u6B63\u78BA" });
      }
      return { success: true, sentTo: winner.email };
    })
  }),
  export: router({
    // 管理員匯出出價記錄 CSV
    bids: protectedProcedure.input(z2.object({ auctionId: z2.number().int().positive().optional() })).query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can export bids" });
      return getAllBidsForExport(input.auctionId);
    })
  }),
  siteSettings: router({
    // 取得所有站點設定（公開，前端用）
    getAll: publicProcedure.query(async () => {
      return getAllSiteSettings();
    }),
    // 管理員設定值
    set: protectedProcedure.input(z2.object({ key: z2.string(), value: z2.string() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "Only admins can change settings" });
      return setSiteSetting(input.key, input.value);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
init_db();
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function runMigrations() {
  if (!process.env.DATABASE_URL) return;
  try {
    const url = new URL(process.env.DATABASE_URL);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const pool = createPool2({
      host: url.hostname,
      port: parseInt(url.port || (isLocalhost ? "3306" : "4000")),
      user: url.username,
      password: url.password || void 0,
      database: url.pathname.slice(1),
      ssl: isLocalhost ? void 0 : { rejectUnauthorized: false },
      multipleStatements: true
    });
    const db = drizzle2(pool);
    const __dirname = path3.dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = path3.resolve(__dirname, "../../drizzle");
    console.log("[Migration] Running migrations from:", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("[Migration] Migrations completed successfully");
    await pool.end();
  } catch (error) {
    console.warn("[Migration] Migration warning (continuing):", error.message);
  }
}
async function startServer() {
  await runMigrations();
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  registerDevLoginRoutes(app);
  registerWebhookRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  setInterval(async () => {
    try {
      const settings = await getNotificationSettings();
      if (!settings || !settings.enableEndingSoon) return;
      const auctions2 = await getActiveAuctionsEndingSoon(settings.endingSoonMinutes);
      const origin = process.env.VITE_OAUTH_PORTAL_URL ? new URL(process.env.VITE_OAUTH_PORTAL_URL).origin : "";
      for (const auction of auctions2) {
        await notifyEndingSoon(auction.id, origin);
      }
    } catch (err) {
      console.error("[Scheduler] Ending-soon check error:", err);
    }
  }, 5 * 60 * 1e3);
}
startServer().catch(console.error);
