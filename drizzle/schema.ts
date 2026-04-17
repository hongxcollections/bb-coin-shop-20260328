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
  phone: varchar("phone", { length: 20 }),
  password: varchar("password", { length: 255 }),
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
  paymentStatus: mysqlEnum("paymentStatus", ["pending_payment", "paid", "delivered"]),
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
  paymentInstructions: text("paymentInstructions"),
  deliveryInfo: text("deliveryInfo"),
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

// ── Site Settings ──────────────────────────────────────────────────────────
// Single-row key-value settings table for global configuration
// Key: "endingSoonMinutes" → value: "30" (minutes before end to show warning)
export const siteSettings = mysqlTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InsertSiteSetting = typeof siteSettings.$inferInsert;

// ── Seller Deposits (保證金) ──────────────────────────────────────────────
// Each seller has a single deposit balance row
export const sellerDeposits = mysqlTable("seller_deposits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  requiredDeposit: decimal("requiredDeposit", { precision: 12, scale: 2 }).default("500.00").notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).default("0.0500").notNull(), // 5%
  isActive: int("isActive").default(1).notNull(), // 1 = can list
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SellerDeposit = typeof sellerDeposits.$inferSelect;
export type InsertSellerDeposit = typeof sellerDeposits.$inferInsert;

// Transaction log for every deposit change (top-up, commission deduction, refund)
export const depositTransactions = mysqlTable("deposit_transactions", {
  id: int("id").autoincrement().primaryKey(),
  depositId: int("depositId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["top_up", "commission", "refund", "adjustment"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // positive = credit, negative = debit
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  relatedAuctionId: int("relatedAuctionId"),
  createdBy: int("createdBy"), // admin who performed the action
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DepositTransaction = typeof depositTransactions.$inferSelect;
export type InsertDepositTransaction = typeof depositTransactions.$inferInsert;

export const sellerDepositsRelations = relations(sellerDeposits, ({ one, many }) => ({
  user: one(users, { fields: [sellerDeposits.userId], references: [users.id] }),
  transactions: many(depositTransactions),
}));

export const depositTransactionsRelations = relations(depositTransactions, ({ one }) => ({
  deposit: one(sellerDeposits, { fields: [depositTransactions.depositId], references: [sellerDeposits.id] }),
  user: one(users, { fields: [depositTransactions.userId], references: [users.id] }),
  auction: one(auctions, { fields: [depositTransactions.relatedAuctionId], references: [auctions.id] }),
}));

// ── Subscription Plans (訂閱計劃) ─────────────────────────────────────────
// Admin-defined subscription tiers
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  memberLevel: mysqlEnum("memberLevel", ["bronze", "silver", "gold", "vip"]).notNull(),
  monthlyPrice: decimal("monthlyPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  yearlyPrice: decimal("yearlyPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  maxListings: int("maxListings").default(0).notNull(), // 0 = unlimited
  commissionDiscount: decimal("commissionDiscount", { precision: 5, scale: 4 }).default("0.0000").notNull(), // e.g. 0.01 = 1% discount
  description: text("description"),
  benefits: text("benefits"), // JSON string of benefit list
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

// ── User Subscriptions (用戶訂閱記錄) ────────────────────────────────────
// Tracks each user's subscription lifecycle
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly").notNull(),
  status: mysqlEnum("status", ["pending", "active", "expired", "cancelled", "rejected"]).default("pending").notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  paymentMethod: varchar("paymentMethod", { length: 100 }), // e.g. "bank_transfer", "payme", "fps"
  paymentReference: varchar("paymentReference", { length: 255 }), // user-provided payment ref
  paymentProofUrl: text("paymentProofUrl"), // screenshot of payment
  adminNote: text("adminNote"),
  approvedBy: int("approvedBy"), // admin who approved
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ─── Merchant Applications ────────────────────────────────────────────────────
export const merchantApplications = mysqlTable("merchantApplications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactName: varchar("contactName", { length: 100 }),
  merchantName: varchar("merchantName", { length: 100 }).notNull(),
  selfIntro: text("selfIntro").notNull(),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  yearsExperience: varchar("yearsExperience", { length: 20 }),
  merchantIcon: varchar("merchantIcon", { length: 500 }),
  categories: text("categories"),
  samplePhotos: text("samplePhotos"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantApplication = typeof merchantApplications.$inferSelect;
export type InsertMerchantApplication = typeof merchantApplications.$inferInsert;

// Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, { fields: [userSubscriptions.userId], references: [users.id] }),
  plan: one(subscriptionPlans, { fields: [userSubscriptions.planId], references: [subscriptionPlans.id] }),
  approver: one(users, { fields: [userSubscriptions.approvedBy], references: [users.id] }),
}));
