import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
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
  monthlyVideoQuota: int("monthlyVideoQuota").default(10).notNull(), // 每月可上傳影片條數（商戶 soft 限制；管理員可改）
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
  privateNote: text("privateNote"),
  displayMode: varchar("displayMode", { length: 20 }).default("default").notNull(),
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
  currentTierId: int("currentTierId"), // 目前綁定保證金套餐 id（NULL = 未指定 / 自定義設定）
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
  periodMaxListings: int("periodMaxListings").default(0).notNull(), // 本期總限額（含 carry-over），0 = 沿用 plan.maxListings
  isRenewal: int("isRenewal").default(0).notNull(), // 1 if 此 subscription 是續期申請
  parentSubscriptionId: int("parentSubscriptionId"), // 對應嘅原本訂閱 id（續期時記錄）
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

// ─── Deposit Tier Change Requests (商戶轉保證金套餐) ──────────────────────────
// 商戶申請由 fromTier 轉至 toTier。只有需要補錢嘅 case (diffAmount > 0) 先要 admin 批准；
// diffAmount <= 0 嘅情況喺商戶端即時應用，不會建立 row。
export const depositTierChangeRequests = mysqlTable("depositTierChangeRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fromTierId: int("fromTierId"),
  toTierId: int("toTierId").notNull(),
  diffAmount: decimal("diffAmount", { precision: 12, scale: 2 }).notNull(), // 須補充金額（>0）
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  paymentReference: varchar("paymentReference", { length: 100 }),
  receiptUrl: varchar("receiptUrl", { length: 500 }),
  note: text("note"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminNote: text("adminNote"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DepositTierChangeRequest = typeof depositTierChangeRequests.$inferSelect;
export type InsertDepositTierChangeRequest = typeof depositTierChangeRequests.$inferInsert;

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
  // ── 3-in-1 onboarding（可選；舊 plain submit 唔會填）──
  chosenPlanId: int("chosenPlanId"),                       // 揀咗嘅訂閱 plan
  chosenPeriod: varchar("chosenPeriod", { length: 20 }),   // 'monthly' | 'yearly'
  chosenDepositTierId: int("chosenDepositTierId"),         // 揀咗嘅保證金 tier
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }), // 月費 + 保證金合計
  paymentReference: varchar("paymentReference", { length: 255 }),    // 用戶填嘅參考號
  paymentProofUrl: varchar("paymentProofUrl", { length: 500 }),      // 收據圖
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
  allowOffers: int("allowOffers").default(1).notNull(),
  privateNote: text("privateNote"),
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

// ── 拍賣私密聊天室（1:1，僅出價會員 + 該拍賣商戶可見） ───────────────────────
export const auctionChatRooms = mysqlTable("auctionChatRooms", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  bidderId: int("bidderId").notNull(),
  merchantId: int("merchantId").notNull(),
  bidderUnreadCount: int("bidderUnreadCount").default(0).notNull(),
  merchantUnreadCount: int("merchantUnreadCount").default(0).notNull(),
  lastMessagePreview: varchar("lastMessagePreview", { length: 200 }),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  isArchived: int("isArchived").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AuctionChatRoom = typeof auctionChatRooms.$inferSelect;

export const auctionChatMessages = mysqlTable("auctionChatMessages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  senderId: int("senderId").notNull(),
  senderRole: mysqlEnum("senderRole", ["bidder", "merchant", "system"]).notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "broadcast"]).default("text").notNull(),
  content: text("content"),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuctionChatMessage = typeof auctionChatMessages.$inferSelect;

// 訊息表情 reaction（每個 user 對同一 message 同 emoji 只可以有一個）
export const auctionChatMessageReactions = mysqlTable("auctionChatMessageReactions", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuctionChatMessageReaction = typeof auctionChatMessageReactions.$inferSelect;

/**
 * 收藏品分享社區（藏品社區）— Phase 1
 */
export const collectionPosts = mysqlTable("collectionPosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  intent: mysqlEnum("intent", ["display", "seek_value", "for_sale"]).default("display").notNull(),
  tagsJson: text("tagsJson"),
  isHidden: int("isHidden").default(0).notNull(),
  isFlagged: int("isFlagged").default(0).notNull(),
  flagReason: varchar("flagReason", { length: 500 }),
  likeCount: int("likeCount").default(0).notNull(),
  commentCount: int("commentCount").default(0).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  // 方案 B：商戶上架帖文標識 + 引用商戶商品
  isMerchantPost: int("isMerchantPost").default(0).notNull(),
  merchantProductId: int("merchantProductId"),
  // 從 URL 抓取轉載：原文章嘅作者名（覆蓋顯示，唔覆蓋 userId）
  displayAuthor: varchar("displayAuthor", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CollectionPost = typeof collectionPosts.$inferSelect;

export const collectionPostImages = mysqlTable("collectionPostImages", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const collectionPostLikes = mysqlTable("collectionPostLikes", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const collectionPostComments = mysqlTable("collectionPostComments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  isHidden: int("isHidden").default(0).notNull(),
  isFlagged: int("isFlagged").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const collectionPostSaves = mysqlTable("collectionPostSaves", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * 每日一幣挑戰（Daily Coin Challenge）— Phase 1
 * 每日一張錢幣／紙幣圖，用戶估國家 / 年代 / 種類，前 3 名得勳章 + 積分。
 */
export const dailyChallenges = mysqlTable("dailyChallenges", {
  id: int("id").autoincrement().primaryKey(),
  imageUrl: text("imageUrl").notNull(),
  publishDate: varchar("publishDate", { length: 10 }).notNull(), // YYYY-MM-DD (HK)
  answerCountry: varchar("answerCountry", { length: 80 }).notNull(),
  answerYear: int("answerYear").notNull(),
  yearTolerance: int("yearTolerance").default(5).notNull(),
  answerCategory: varchar("answerCategory", { length: 40 }).notNull(),
  hint: text("hint"),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "published", "closed"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(),
  // 馬賽克：admin 可指定要遮蓋嘅矩形（JSON: [{x,y,w,h}] 0-1 比例），server 用 sharp 生成 censored 版本
  imageRegions: text("imageRegions"),
  imageUrlCensored: varchar("imageUrlCensored", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DailyChallenge = typeof dailyChallenges.$inferSelect;

export const dailyChallengeAnswers = mysqlTable("dailyChallengeAnswers", {
  id: int("id").autoincrement().primaryKey(),
  challengeId: int("challengeId").notNull(),
  userId: int("userId").notNull(),
  answerCountry: varchar("answerCountry", { length: 80 }).notNull(),
  answerYear: int("answerYear").notNull(),
  answerCategory: varchar("answerCategory", { length: 40 }).notNull(),
  isCorrect: int("isCorrect").default(0).notNull(),
  answerRank: int("answerRank"),
  pointsAwarded: int("pointsAwarded").default(0).notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});
export type DailyChallengeAnswer = typeof dailyChallengeAnswers.$inferSelect;

/**
 * 商戶專場拍賣 (Merchant Auction Sessions)
 * 商戶建立小型拍賣會（有名稱 + 結束日），將自己嘅 auction 分批集中展示。
 * 公開 URL `/s/:userId/:slug` 集中睇；auction 本身仍存在 `auctions` table，價錢同步。
 */
export const merchantAuctionSessions = mysqlTable("merchantAuctionSessions", {
  id: int("id").autoincrement().primaryKey(),
  merchantUserId: int("merchantUserId").notNull(),                              // = users.id of the merchant
  slug: varchar("slug", { length: 80 }).notNull(),                              // URL-safe, unique per merchant
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  coverImage: varchar("coverImage", { length: 500 }),
  endAt: timestamp("endAt").notNull(),
  status: mysqlEnum("status", ["draft", "published", "ended"]).default("draft").notNull(),
  visibility: mysqlEnum("visibility", ["public", "unlisted"]).default("public").notNull(), // V2 toggle
  itemCount: int("itemCount").default(0).notNull(),                             // cached count
  addItemsCutoffMinutes: int("addItemsCutoffMinutes").default(30).notNull(),    // 結束前 N 分鐘內凍結「加入拍賣品」
  combinedWonEmailSentAt: timestamp("combinedWonEmailSentAt"),                  // idempotency for combined invoice
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MerchantAuctionSession = typeof merchantAuctionSessions.$inferSelect;
export type InsertMerchantAuctionSession = typeof merchantAuctionSessions.$inferInsert;

export const merchantAuctionSessionItems = mysqlTable("merchantAuctionSessionItems", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  auctionId: int("auctionId").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MerchantAuctionSessionItem = typeof merchantAuctionSessionItems.$inferSelect;
export type InsertMerchantAuctionSessionItem = typeof merchantAuctionSessionItems.$inferInsert;

/**
 * 藏品社區 AI 助手 — admin 揀題材生成 3 個 draft，可編輯、刪除、發布去 collectionPosts
 */
export const communitySeederDrafts = mysqlTable("communitySeederDrafts", {
  id: int("id").autoincrement().primaryKey(),
  themeId: varchar("themeId", { length: 60 }).notNull(),
  themeLabel: varchar("themeLabel", { length: 120 }).notNull(),
  batchId: varchar("batchId", { length: 40 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  tagsJson: text("tagsJson"),
  imagesJson: text("imagesJson"),
  authorUserId: int("authorUserId"),
  // 從 URL 抓取轉載：原作者名（publish 時 sync 落 collectionPosts.displayAuthor）
  displayAuthor: varchar("displayAuthor", { length: 80 }),
  sourceUrl: varchar("sourceUrl", { length: 500 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedPostId: int("publishedPostId"),
  generatedBy: int("generatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CommunitySeederDraft = typeof communitySeederDrafts.$inferSelect;
export type InsertCommunitySeederDraft = typeof communitySeederDrafts.$inferInsert;

export const communitySeederThemes = mysqlTable("communitySeederThemes", {
  id: varchar("id", { length: 60 }).primaryKey(),
  label: varchar("label", { length: 120 }).notNull(),
  hint: text("hint").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isSystem: boolean("isSystem").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CommunitySeederTheme = typeof communitySeederThemes.$inferSelect;

export const auctionComments = mysqlTable("auctionComments", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  replyToBidId: int("replyToBidId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuctionComment = typeof auctionComments.$inferSelect;

// ─── 團購拍賣（Group Auction）────────────────────────────────────────────────

/**
 * 場次主表：一個商戶可建立多個團購拍賣場次
 */
export const groupAuctionRounds = mysqlTable("groupAuctionRounds", {
  id: int("id").autoincrement().primaryKey(),
  merchantUserId: int("merchantUserId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  periodNumber: varchar("periodNumber", { length: 40 }),
  description: text("description"),
  coverImage: varchar("coverImage", { length: 500 }),
  startAt: timestamp("startAt"),
  endAt: timestamp("endAt"),
  // 延時模式：結束前 X 分鐘有新出價，延長 Y 分鐘
  antiSnipeMinutes: int("antiSnipeMinutes").default(5).notNull(),
  antiSnipeExtendMinutes: int("antiSnipeExtendMinutes").default(5).notNull(),
  antiSnipeMode: mysqlEnum("antiSnipeMode", ["none", "per_item", "whole_round"]).default("per_item").notNull(),
  // 每口加價幅度（場次預設，可 per item 覆寫）
  defaultBidIncrement: int("defaultBidIncrement").default(50).notNull(),
  // 傭金設定
  buyerCommissionRate: decimal("buyerCommissionRate", { precision: 5, scale: 4 }).default("0").notNull(),
  // 場次狀態
  status: mysqlEnum("status", ["draft", "published", "ended"]).default("draft").notNull(),
  // 使用的欄位 template id（可 null，代表自訂）
  columnTemplateId: int("columnTemplateId"),
  // 欄位定義 JSON（每個場次獨立儲存一份，方便欄位與 import data 對應）
  columnsJson: text("columnsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GroupAuctionRound = typeof groupAuctionRounds.$inferSelect;
export type InsertGroupAuctionRound = typeof groupAuctionRounds.$inferInsert;

/**
 * 欄位 Template：商戶可儲存常用欄位設定供重用
 * columnsJson 格式：JSON array of { key, label, role, required, type, showOnBidPage }
 * role 枚舉：itemTitle | startPrice | buyNowPrice | bidIncrement | imageRef | customText
 */
export const groupAuctionColumnTemplates = mysqlTable("groupAuctionColumnTemplates", {
  id: int("id").autoincrement().primaryKey(),
  merchantUserId: int("merchantUserId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  columnsJson: text("columnsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GroupAuctionColumnTemplate = typeof groupAuctionColumnTemplates.$inferSelect;
export type InsertGroupAuctionColumnTemplate = typeof groupAuctionColumnTemplates.$inferInsert;

/**
 * 場次圖片集：商戶一次過上載多張圖片
 */
export const groupAuctionImages = mysqlTable("groupAuctionImages", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  s3Key: varchar("s3Key", { length: 500 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GroupAuctionImage = typeof groupAuctionImages.$inferSelect;
export type InsertGroupAuctionImage = typeof groupAuctionImages.$inferInsert;

/**
 * 場次商品：每一件拍賣品
 * dataJson 儲存商戶自定欄位的值，格式與 columnsJson 的 key 對應
 * imageIds: JSON array of groupAuctionImages.id
 */
export const groupAuctionItems = mysqlTable("groupAuctionItems", {
  id: int("id").autoincrement().primaryKey(),
  roundId: int("roundId").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  // 商品欄位資料（JSON object，key = columnsJson 的 key）
  dataJson: text("dataJson").notNull(),
  // 關聯圖片 ids（JSON array of groupAuctionImages.id）
  imageIdsJson: text("imageIdsJson"),
  // 快取：起拍價、每口加價（從 dataJson 提取，方便查詢）
  startPrice: int("startPrice").notNull(),
  bidIncrement: int("bidIncrement").default(0).notNull(),
  buyNowPrice: int("buyNowPrice"),
  // 狀態
  status: mysqlEnum("status", ["active", "sold", "unsold"]).default("active").notNull(),
  // 結拍後快取：成交價、買家
  finalPrice: int("finalPrice"),
  winnerId: int("winnerId"),
  endAt: timestamp("endAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GroupAuctionItem = typeof groupAuctionItems.$inferSelect;
export type InsertGroupAuctionItem = typeof groupAuctionItems.$inferInsert;

/**
 * 出價記錄
 */
export const groupAuctionBids = mysqlTable("groupAuctionBids", {
  id: int("id").autoincrement().primaryKey(),
  itemId: int("itemId").notNull(),
  roundId: int("roundId").notNull(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GroupAuctionBid = typeof groupAuctionBids.$inferSelect;
export type InsertGroupAuctionBid = typeof groupAuctionBids.$inferInsert;
export type InsertAuctionComment = typeof auctionComments.$inferInsert;
