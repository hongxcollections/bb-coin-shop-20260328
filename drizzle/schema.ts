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
  // Loyalty: 試用到期時間（NULL = 永久由升級規則決定，非 NULL = 到期回復自然等級）
  memberLevelExpiresAt: timestamp("memberLevelExpiresAt"),
  defaultAnonymous: int("defaultAnonymous").default(0).notNull(), // 1 = always bid anonymously by default
  mustChangePassword: int("mustChangePassword").default(0).notNull(), // 1 = 管理員設定密碼後，會員首次登入須強制更改
  isBanned: int("isBanned").default(0).notNull(), // 1 = 停權，禁止一切出價/上拍/出售功能
  monthlyVideoQuota: int("monthlyVideoQuota").default(5).notNull(), // 每月可上傳影片條數（商戶 soft 限制；管理員可改）
  maxVideoSeconds: int("maxVideoSeconds").default(60).notNull(), // 單條影片最長秒數上限（管理員可改）
  photoUrl: varchar("photoUrl", { length: 1000 }), // 頭像 URL（Google 頭像或自訂上傳）
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
  category: varchar("category", { length: 500 }),
  antiSnipeEnabled: int("antiSnipeEnabled").default(1).notNull(),
  antiSnipeMinutes: int("antiSnipeMinutes").default(3).notNull(),
  extendMinutes: int("extendMinutes").default(3).notNull(),
  antiSnipeMemberLevels: text("antiSnipeMemberLevels"),
  paymentStatus: mysqlEnum("paymentStatus", ["pending_payment", "paid", "delivered"]),
  videoUrl: varchar("videoUrl", { length: 500 }),
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
  warningDeposit: decimal("warningDeposit", { precision: 12, scale: 2 }).default("1000.00").notNull(), // warn when balance < this
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).default("0.0500").notNull(), // 拍賣傭金率 5%
  productCommissionRate: decimal("productCommissionRate", { precision: 5, scale: 4 }).default("0.0500").notNull(), // 貨品傭金率 5%
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
  remainingQuota: int("remainingQuota").default(0).notNull(), // remaining listing credits for this subscription period
  approvedBy: int("approvedBy"), // admin who approved
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ── Commission Refund Requests (傭金退款申請) ─────────────────────────────
export const commissionRefundRequests = mysqlTable("commissionRefundRequests", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  userId: int("userId").notNull(), // merchant
  commissionAmount: decimal("commissionAmount", { precision: 12, scale: 2 }).notNull(),
  reason: mysqlEnum("reason", ["buyer_missing", "buyer_refused", "mutual_cancel", "other"]).notNull(),
  reasonDetail: text("reasonDetail"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CommissionRefundRequest = typeof commissionRefundRequests.$inferSelect;
export type InsertCommissionRefundRequest = typeof commissionRefundRequests.$inferInsert;

// ─── Deposit Top-Up Requests (merchant self-service) ─────────────────────────
export const depositTopUpRequests = mysqlTable("depositTopUpRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tierId: int("tierId"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  referenceNo: varchar("referenceNo", { length: 100 }).notNull(),
  bank: varchar("bank", { length: 100 }),
  note: text("note"),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DepositTopUpRequest = typeof depositTopUpRequests.$inferSelect;
export type InsertDepositTopUpRequest = typeof depositTopUpRequests.$inferInsert;

// ─── Deposit Tier Presets (保證金套餐) ────────────────────────────────────────
// Admin-defined top-up tiers merchants can choose when submitting a top-up request
export const depositTierPresets = mysqlTable("depositTierPresets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // e.g. "基礎套餐"
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // top-up / required deposit amount
  maintenancePct: decimal("maintenancePct", { precision: 5, scale: 2 }).default("80.00").notNull(), // 維持水平 %
  warningPct: decimal("warningPct", { precision: 5, scale: 2 }).default("60.00").notNull(), // 預警 %
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).default("0.0500").notNull(), // 拍賣傭金率，預設 5%
  productCommissionRate: decimal("productCommissionRate", { precision: 5, scale: 4 }).default("0.0500").notNull(), // 貨品傭金率，預設 5%
  description: text("description"),
  isActive: int("isActive").default(1).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DepositTierPreset = typeof depositTierPresets.$inferSelect;
export type InsertDepositTierPreset = typeof depositTierPresets.$inferInsert;

// ─── Merchant Applications ────────────────────────────────────────────────────
export const merchantApplications = mysqlTable("merchantApplications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contactName: varchar("contactName", { length: 100 }),
  merchantName: varchar("merchantName", { length: 100 }).notNull(),
  selfIntro: text("selfIntro").notNull(),
  whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
  facebook: varchar("facebook", { length: 500 }),
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

// ─── Merchant Products (fixed-price store listings) ──────────────────────────
export const merchantProducts = mysqlTable("merchantProducts", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  merchantName: varchar("merchantName", { length: 100 }).notNull(),
  merchantIcon: varchar("merchantIcon", { length: 500 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("HKD").notNull(),
  category: varchar("category", { length: 500 }),
  images: text("images"),
  videoUrl: varchar("videoUrl", { length: 500 }),
  stock: int("stock").default(1).notNull(),
  status: mysqlEnum("status", ["active", "sold", "hidden"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MerchantProduct = typeof merchantProducts.$inferSelect;
export type InsertMerchantProduct = typeof merchantProducts.$inferInsert;

// Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, { fields: [userSubscriptions.userId], references: [users.id] }),
  plan: one(subscriptionPlans, { fields: [userSubscriptions.planId], references: [subscriptionPlans.id] }),
  approver: one(users, { fields: [userSubscriptions.approvedBy], references: [users.id] }),
}));

// 每日早鳥會員試用領取記錄
export const dailyEarlyBird = mysqlTable("dailyEarlyBird", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  claimDate: varchar("claimDate", { length: 10 }).notNull(), // YYYY-MM-DD (HK)
  trialLevel: varchar("trialLevel", { length: 20 }).notNull(), // silver / gold / vip
  trialExpiresAt: timestamp("trialExpiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 銅牌用戶代理出價月度配額追蹤（每用戶每月一行）
export const userAutoBidQuota = mysqlTable("userAutoBidQuota", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  monthKey: varchar("monthKey", { length: 7 }).notNull(), // YYYY-MM (HK)
  used: int("used").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().onUpdateNow(),
});

// Web Push 推播訂閱
export const pushSubscriptions = mysqlTable("pushSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 100 }).notNull(),
  userAgent: varchar("userAgent", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// 主打商品付費刊登
export const featuredListings = mysqlTable("featuredListings", {
  id: int("id").autoincrement().primaryKey(),
  merchantId: int("merchantId").notNull(),
  productId: int("productId").notNull(),
  productTitle: varchar("productTitle", { length: 200 }).notNull(),
  merchantName: varchar("merchantName", { length: 100 }).notNull(),
  tier: mysqlEnum("tier", ["day1", "day3", "day7"]).notNull(), // 24小時 / 3天 / 7天
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // 實際扣費金額
  status: mysqlEnum("status", ["active", "queued", "expired", "cancelled"]).default("active").notNull(),
  startAt: timestamp("startAt").defaultNow().notNull(),
  endAt: timestamp("endAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FeaturedListing = typeof featuredListings.$inferSelect;
export type InsertFeaturedListing = typeof featuredListings.$inferInsert;

// ── Ad Banners (彈出廣告) ───────────────────────────────────────────────────
// 三種用戶身份各三個版本：targetType = guest | member | merchant, slot = 1|2|3
export const adBanners = mysqlTable("ad_banners", {
  id: int("id").autoincrement().primaryKey(),
  targetType: mysqlEnum("targetType", ["guest", "member", "merchant"]).notNull(),
  slot: int("slot").notNull(),          // 1, 2, 3
  title: varchar("title", { length: 200 }),
  body: text("body"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AdBanner = typeof adBanners.$inferSelect;

export const coinAnalysisHistory = mysqlTable("coinAnalysisHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  coinName: varchar("coinName", { length: 255 }),
  coinType: varchar("coinType", { length: 64 }),
  coinCountry: varchar("coinCountry", { length: 128 }),
  analysisData: text("analysisData").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoinAnalysisHistory = typeof coinAnalysisHistory.$inferSelect;
