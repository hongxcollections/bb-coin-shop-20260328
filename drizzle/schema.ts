import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
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
  defaultAnonymous: int("defaultAnonymous").default(0).notNull(), // 1 = always bid anonymously by default
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Auctions table - stores coin auction listings
 */
export const auctions = mysqlTable("auctions", {
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
  category: mysqlEnum("category", ["古幣", "紀念幣", "外幣", "銀幣", "金幣", "其他"]).default("其他"),
  antiSnipeEnabled: int("antiSnipeEnabled").default(1).notNull(),
  antiSnipeMinutes: int("antiSnipeMinutes").default(3).notNull(),
  extendMinutes: int("extendMinutes").default(3).notNull(),
  antiSnipeMemberLevels: text("antiSnipeMemberLevels"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = typeof auctions.$inferInsert;

/**
 * Auction images table - stores multiple images per auction
 */
export const auctionImages = mysqlTable("auctionImages", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuctionImage = typeof auctionImages.$inferSelect;
export type InsertAuctionImage = typeof auctionImages.$inferInsert;

/**
 * Bids table - stores bidding history
 */
export const bids = mysqlTable("bids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  userId: int("userId").notNull(),
  bidAmount: decimal("bidAmount", { precision: 10, scale: 2 }).notNull(),
  isAnonymous: int("isAnonymous").default(0).notNull(), // 1 = anonymous bid
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bid = typeof bids.$inferSelect;
export type InsertBid = typeof bids.$inferInsert;

/**
 * Proxy bids table - stores each user's maximum proxy bid per auction
 */
export const proxyBids = mysqlTable("proxyBids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  userId: int("userId").notNull(),
  maxAmount: decimal("maxAmount", { precision: 10, scale: 2 }).notNull(),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = cancelled/expired
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProxyBid = typeof proxyBids.$inferSelect;
export type InsertProxyBid = typeof proxyBids.$inferInsert;

/**
 * Proxy bid logs - records each automatic bid triggered by the proxy engine
 */
export const proxyBidLogs = mysqlTable("proxyBidLogs", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  round: int("round").default(1).notNull(),          // engine iteration round
  triggerUserId: int("triggerUserId").notNull(),      // the user whose bid triggered the engine
  triggerAmount: decimal("triggerAmount", { precision: 10, scale: 2 }).notNull(), // the triggering bid
  proxyUserId: int("proxyUserId").notNull(),          // the user whose proxy responded
  proxyAmount: decimal("proxyAmount", { precision: 10, scale: 2 }).notNull(),     // the auto-bid amount
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProxyBidLog = typeof proxyBidLogs.$inferSelect;
export type InsertProxyBidLog = typeof proxyBidLogs.$inferInsert;

/**
 * Notification settings - global email notification configuration (single row)
 */
export const notificationSettings = mysqlTable("notificationSettings", {
  id: int("id").autoincrement().primaryKey(),
  senderName: varchar("senderName", { length: 128 }).default("大BB錢幣店").notNull(),
  senderEmail: varchar("senderEmail", { length: 320 }).default("ywkyee@gmail.com").notNull(),
  enableOutbid: int("enableOutbid").default(1).notNull(),      // 1 = enabled
  enableWon: int("enableWon").default(1).notNull(),
  enableEndingSoon: int("enableEndingSoon").default(1).notNull(),
  endingSoonMinutes: int("endingSoonMinutes").default(60).notNull(),
  enableAntiSnipe: int("enableAntiSnipe").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = typeof notificationSettings.$inferInsert;

/**
 * Relations
 */
export const usersRelations = relations(users, ({ many }) => ({
  auctions: many(auctions),
  bids: many(bids),
}));

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  creator: one(users, {
    fields: [auctions.createdBy],
    references: [users.id],
  }),
  highestBidder: one(users, {
    fields: [auctions.highestBidderId],
    references: [users.id],
  }),
  images: many(auctionImages),
  bids: many(bids),
}));

export const auctionImagesRelations = relations(auctionImages, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionImages.auctionId],
    references: [auctions.id],
  }),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, {
    fields: [bids.auctionId],
    references: [auctions.id],
  }),
  user: one(users, {
    fields: [bids.userId],
    references: [users.id],
  }),
}));

export const proxyBidsRelations = relations(proxyBids, ({ one }) => ({
  auction: one(auctions, {
    fields: [proxyBids.auctionId],
    references: [auctions.id],
  }),
  user: one(users, {
    fields: [proxyBids.userId],
    references: [users.id],
  }),
}));

// ── Favorites / Watchlist ──────────────────────────────────────────────────
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  auctionId: int("auctionId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InsertFavorite = typeof favorites.$inferInsert;

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  auction: one(auctions, { fields: [favorites.auctionId], references: [auctions.id] }),
}));
