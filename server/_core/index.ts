import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import path from "path";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerAuthRoutes, updateIpOtpConfig } from "./authRoutes";
import { updateOtpConfig } from "./otpStore";
import { registerDevLoginRoutes } from "./devLogin";
import { registerWebhookRoutes } from "../webhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { notifyEndingSoon } from "../auctions";
import { getActiveAuctionsEndingSoon, getNotificationSettings } from "../db";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function bootstrapMissingColumns() {
  const dbUrl = process.env.BB_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!dbUrl) return;

  let pool: any;
  try {
    const url = new URL(dbUrl);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    pool = createPool({
      host: url.hostname,
      port: parseInt(url.port || (isLocalhost ? '3306' : '4000')),
      user: url.username,
      password: url.password || undefined,
      database: url.pathname.slice(1),
      ssl: isLocalhost ? undefined : { rejectUnauthorized: false },
    });
  } catch (error) {
    console.warn('[Bootstrap] Could not create pool:', (error as Error).message);
    return;
  }

  const check = async (table: string, column: string): Promise<boolean> => {
    try {
      const [rows]: any = await pool.execute(
        `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows[0].cnt > 0;
    } catch {
      return false;
    }
  };

  const alter = async (sql: string, label: string) => {
    try {
      await pool.execute(sql);
      console.log(`[Bootstrap] ${label}`);
    } catch (error) {
      console.warn(`[Bootstrap] Skipped (${label}):`, (error as Error).message);
    }
  };

  // deposit_transactions: 新增團拍場次關聯欄
  if (!(await check('deposit_transactions', 'relatedGroupAuctionRoundId'))) {
    await alter(
      'ALTER TABLE `deposit_transactions` ADD COLUMN `relatedGroupAuctionRoundId` int NULL',
      'Added relatedGroupAuctionRoundId to deposit_transactions'
    );
  }

  // seller_deposits
  if (!(await check('seller_deposits', 'warningDeposit'))) {
    await alter(
      'ALTER TABLE `seller_deposits` ADD COLUMN `warningDeposit` decimal(12,2) NOT NULL DEFAULT 1000.00',
      'Added warningDeposit to seller_deposits'
    );
  }

  // user_subscriptions
  if (!(await check('user_subscriptions', 'remainingQuota'))) {
    await alter(
      'ALTER TABLE `user_subscriptions` ADD COLUMN `remainingQuota` int NOT NULL DEFAULT 0',
      'Added remainingQuota to user_subscriptions'
    );
  }

  // merchantApplications: ensure table + all columns exist (production may be behind UAT)
  await alter(`CREATE TABLE IF NOT EXISTS \`merchantApplications\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`contactName\` varchar(100) NULL,
    \`merchantName\` varchar(100) NOT NULL,
    \`selfIntro\` text NOT NULL,
    \`whatsapp\` varchar(30) NOT NULL,
    \`yearsExperience\` varchar(20) NULL,
    \`merchantIcon\` varchar(500) NULL,
    \`categories\` text NULL,
    \`samplePhotos\` text NULL,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`adminNote\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`merchantApplications_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured merchantApplications table');

  if (!(await check('merchantApplications', 'contactName'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `contactName` varchar(100) NULL',
      'Added contactName to merchantApplications'
    );
  }
  if (!(await check('merchantApplications', 'merchantIcon'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `merchantIcon` varchar(500) NULL',
      'Added merchantIcon to merchantApplications'
    );
  }

  // ── 3-in-1 onboarding columns（T1: 商戶申請可一次過揀 plan + tier + 上載收據）──
  if (!(await check('merchantApplications', 'chosenPlanId'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `chosenPlanId` int NULL',
      'Added chosenPlanId to merchantApplications'
    );
  }
  if (!(await check('merchantApplications', 'chosenPeriod'))) {
    await alter(
      "ALTER TABLE `merchantApplications` ADD COLUMN `chosenPeriod` varchar(20) NULL",
      'Added chosenPeriod to merchantApplications'
    );
  }
  if (!(await check('merchantApplications', 'chosenDepositTierId'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `chosenDepositTierId` int NULL',
      'Added chosenDepositTierId to merchantApplications'
    );
  }
  if (!(await check('merchantApplications', 'totalAmount'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `totalAmount` decimal(12,2) NULL',
      'Added totalAmount to merchantApplications'
    );
  }
  if (!(await check('merchantApplications', 'paymentReference'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `paymentReference` varchar(255) NULL',
      'Added paymentReference to merchantApplications'
    );
  }
  if (!(await check('merchantApplications', 'paymentProofUrl'))) {
    await alter(
      'ALTER TABLE `merchantApplications` ADD COLUMN `paymentProofUrl` varchar(500) NULL',
      'Added paymentProofUrl to merchantApplications'
    );
  }

  // One-time repair: initialise remainingQuota for active subscriptions
  await alter(`
    UPDATE user_subscriptions us
    JOIN subscription_plans sp ON us.planId = sp.id
    SET us.remainingQuota = sp.maxListings
    WHERE us.status = 'active'
      AND sp.maxListings > 0
      AND us.remainingQuota = 0
  `, 'Repaired remainingQuota for active subscriptions');

  // ── Legacy migration：將舊嘅 future-start renewal row 合併為 carry-over 即時生效形態
  // 場景：之前批核嘅續期 row 仲 active 但 startDate > NOW()，同時 parent 仲 active —
  // 將 parent.remainingQuota 加入 renewal.remainingQuota，將 renewal.startDate = NOW()，
  // parent 即時 mark 'expired'，同時 set periodMaxListings = 合併後嘅 remainingQuota。
  await alter(`
    UPDATE user_subscriptions r
    JOIN user_subscriptions p ON p.id = r.parentSubscriptionId
    SET r.remainingQuota = COALESCE(r.remainingQuota, 0) + COALESCE(p.remainingQuota, 0),
        r.periodMaxListings = COALESCE(r.remainingQuota, 0) + COALESCE(p.remainingQuota, 0),
        r.startDate = NOW(),
        p.remainingQuota = 0,
        p.status = 'expired'
    WHERE r.isRenewal = 1
      AND r.status = 'active'
      AND r.startDate > NOW()
      AND p.status = 'active'
  `, 'Merged legacy future-start renewal subscriptions into carry-over form');

  // ── Backfill periodMaxListings for active subscriptions where it's not yet set
  // 對於現存 active sub（包括上面 merge 完嘅），如果 periodMaxListings = 0 而 plan.maxListings > 0，
  // 設為 max(remainingQuota, plan.maxListings) — 即至少係 plan 嘅基礎額度，但若已有更多剩餘（carry-over）就用嗰個數。
  await alter(`
    UPDATE user_subscriptions us
    JOIN subscription_plans sp ON us.planId = sp.id
    SET us.periodMaxListings = GREATEST(COALESCE(us.remainingQuota, 0), sp.maxListings)
    WHERE us.status = 'active'
      AND sp.maxListings > 0
      AND (us.periodMaxListings IS NULL OR us.periodMaxListings = 0)
  `, 'Backfilled periodMaxListings for active subscriptions');

  // commissionRefundRequests table
  await alter(`CREATE TABLE IF NOT EXISTS \`commissionRefundRequests\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`auctionId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`commissionAmount\` decimal(12,2) NOT NULL,
    \`reason\` enum('buyer_missing','buyer_refused','mutual_cancel','other') NOT NULL,
    \`reasonDetail\` text,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`adminNote\` text,
    \`reviewedBy\` int,
    \`reviewedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`commissionRefundRequests_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured commissionRefundRequests table');

  // depositTopUpRequests table
  await alter(`CREATE TABLE IF NOT EXISTS \`depositTopUpRequests\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`amount\` decimal(12,2) NOT NULL,
    \`referenceNo\` varchar(100) NOT NULL,
    \`bank\` varchar(100) NULL,
    \`note\` text NULL,
    \`receiptUrl\` varchar(500) NULL,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`adminNote\` text NULL,
    \`reviewedBy\` int NULL,
    \`reviewedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`depositTopUpRequests_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured depositTopUpRequests table');

  // pushSubscriptions table (Web Push)
  await alter(`CREATE TABLE IF NOT EXISTS \`pushSubscriptions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`endpoint\` varchar(500) NOT NULL,
    \`p256dh\` varchar(255) NOT NULL,
    \`auth\` varchar(100) NOT NULL,
    \`userAgent\` varchar(255) NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`pushSubscriptions_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`pushSubscriptions_endpoint_unique\` UNIQUE(\`endpoint\`),
    INDEX \`idx_pushsub_user\` (\`userId\`)
  )`, 'Ensured pushSubscriptions table');

  // ── 拍賣私密聊天室 (1:1 between bidder + merchant) ─────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`auctionChatRooms\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`auctionId\` int NOT NULL,
    \`bidderId\` int NOT NULL,
    \`merchantId\` int NOT NULL,
    \`bidderUnreadCount\` int NOT NULL DEFAULT 0,
    \`merchantUnreadCount\` int NOT NULL DEFAULT 0,
    \`lastMessagePreview\` varchar(200) NULL,
    \`lastMessageAt\` timestamp NOT NULL DEFAULT (now()),
    \`isArchived\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`auctionChatRooms_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uq_chatroom_unique\` UNIQUE(\`auctionId\`, \`bidderId\`),
    INDEX \`idx_chatroom_bidder\` (\`bidderId\`),
    INDEX \`idx_chatroom_merchant\` (\`merchantId\`),
    INDEX \`idx_chatroom_auction\` (\`auctionId\`),
    INDEX \`idx_chatroom_lastmsg\` (\`lastMessageAt\`)
  )`, 'Ensured auctionChatRooms table');
  await alter(`ALTER TABLE \`auctionChatRooms\` ADD COLUMN \`bidderDeleted\` int NOT NULL DEFAULT 0`, 'Ensured auctionChatRooms.bidderDeleted column');
  await alter(`ALTER TABLE \`auctionChatRooms\` ADD COLUMN \`merchantDeleted\` int NOT NULL DEFAULT 0`, 'Ensured auctionChatRooms.merchantDeleted column');
  await alter(`ALTER TABLE \`merchant_settings\` ADD COLUMN \`winnerAutoReplyMessage\` TEXT NULL`, 'Ensured merchant_settings.winnerAutoReplyMessage column');
  await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`winnerAutoReplySentAt\` DATETIME NULL`, 'Ensured auctions.winnerAutoReplySentAt column');

  await alter(`CREATE TABLE IF NOT EXISTS \`auctionChatMessages\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`roomId\` int NOT NULL,
    \`senderId\` int NOT NULL,
    \`senderRole\` enum('bidder','merchant','system') NOT NULL,
    \`messageType\` enum('text','image','broadcast') NOT NULL DEFAULT 'text',
    \`content\` text NULL,
    \`imageUrl\` varchar(1000) NULL,
    \`isRead\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`auctionChatMessages_id\` PRIMARY KEY(\`id\`),
    INDEX \`idx_chatmsg_room\` (\`roomId\`, \`createdAt\`),
    INDEX \`idx_chatmsg_sender\` (\`senderId\`)
  )`, 'Ensured auctionChatMessages table');

  // ── 排價 (price offer) 表 ────────────────────────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`productOffers\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`productId\` int NOT NULL,
    \`buyerId\` int NOT NULL,
    \`merchantId\` int NOT NULL,
    \`amount\` decimal(10,2) NOT NULL,
    \`currency\` varchar(10) NOT NULL DEFAULT 'HKD',
    \`buyerNote\` text NULL,
    \`status\` varchar(20) NOT NULL DEFAULT 'pending',
    \`merchantResponse\` text NULL,
    \`expiresAt\` timestamp NULL,
    \`orderId\` int NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`productOffers_id\` PRIMARY KEY(\`id\`),
    INDEX \`idx_offer_product\` (\`productId\`),
    INDEX \`idx_offer_buyer\` (\`buyerId\`, \`status\`),
    INDEX \`idx_offer_merchant\` (\`merchantId\`, \`status\`),
    INDEX \`idx_offer_status_expires\` (\`status\`, \`expiresAt\`)
  )`, 'Ensured productOffers table');

  // 加 productOffers.hiddenForBuyer（買家可隱藏已拒絕／已取消／已過期紀錄）
  if (!(await check('productOffers', 'hiddenForBuyer'))) {
    await alter(
      `ALTER TABLE \`productOffers\` ADD COLUMN \`hiddenForBuyer\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added hiddenForBuyer to productOffers'
    );
  }

  // 加 productOffers.hiddenForMerchant（商戶可隱藏已拒絕紀錄）
  if (!(await check('productOffers', 'hiddenForMerchant'))) {
    await alter(
      `ALTER TABLE \`productOffers\` ADD COLUMN \`hiddenForMerchant\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added hiddenForMerchant to productOffers'
    );
  }

  // 買家申請取消訂單（方案 B：申請制，商戶必須批准）
  if (!(await check('productOrders', 'cancelRequestStatus'))) {
    await alter(
      `ALTER TABLE \`productOrders\` ADD COLUMN \`cancelRequestStatus\` varchar(20) NULL`,
      'Added cancelRequestStatus to productOrders'
    );
  }
  if (!(await check('productOrders', 'cancelRequestReason'))) {
    await alter(
      `ALTER TABLE \`productOrders\` ADD COLUMN \`cancelRequestReason\` text NULL`,
      'Added cancelRequestReason to productOrders'
    );
  }
  if (!(await check('productOrders', 'cancelRequestedAt'))) {
    await alter(
      `ALTER TABLE \`productOrders\` ADD COLUMN \`cancelRequestedAt\` timestamp NULL`,
      'Added cancelRequestedAt to productOrders'
    );
  }
  if (!(await check('productOrders', 'cancelRequestRespondedAt'))) {
    await alter(
      `ALTER TABLE \`productOrders\` ADD COLUMN \`cancelRequestRespondedAt\` timestamp NULL`,
      'Added cancelRequestRespondedAt to productOrders'
    );
  }
  if (!(await check('productOrders', 'cancelRequestRejectReason'))) {
    await alter(
      `ALTER TABLE \`productOrders\` ADD COLUMN \`cancelRequestRejectReason\` text NULL`,
      'Added cancelRequestRejectReason to productOrders'
    );
  }

  // 買家失約標記（商戶 cancel 時可標記）→ 失約累積到門檻會被該商戶封鎖
  if (!(await check('productOrders', 'markedAsBuyerFailure'))) {
    await alter(
      `ALTER TABLE \`productOrders\` ADD COLUMN \`markedAsBuyerFailure\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added markedAsBuyerFailure to productOrders'
    );
  }
  if (!(await check('merchant_settings', 'failureLockThreshold'))) {
    await alter(
      `ALTER TABLE \`merchant_settings\` ADD COLUMN \`failureLockThreshold\` int NOT NULL DEFAULT 3`,
      'Added failureLockThreshold to merchant_settings'
    );
  }
  if (!(await check('merchant_settings', 'failureLockDays'))) {
    await alter(
      `ALTER TABLE \`merchant_settings\` ADD COLUMN \`failureLockDays\` int NOT NULL DEFAULT 3`,
      'Added failureLockDays to merchant_settings'
    );
  }
  if (!(await check('merchant_settings', 'failureLockEnabled'))) {
    await alter(
      `ALTER TABLE \`merchant_settings\` ADD COLUMN \`failureLockEnabled\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added failureLockEnabled to merchant_settings (default OFF)'
    );
  }

  // 加 merchantProducts.allowOffers
  if (!(await check('merchantProducts', 'allowOffers'))) {
    await alter(
      `ALTER TABLE \`merchantProducts\` ADD COLUMN \`allowOffers\` tinyint(1) NOT NULL DEFAULT 1`,
      'Added allowOffers to merchantProducts'
    );
  }
  // 加 merchantProducts.privateNote
  if (!(await check('merchantProducts', 'privateNote'))) {
    await alter(
      `ALTER TABLE \`merchantProducts\` ADD COLUMN \`privateNote\` text NULL`,
      'Added privateNote to merchantProducts'
    );
  }

  // 訊息表情 reaction
  await alter(`CREATE TABLE IF NOT EXISTS \`auctionChatMessageReactions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`messageId\` int NOT NULL,
    \`roomId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`emoji\` varchar(16) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`auctionChatMessageReactions_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uq_chat_reaction_unique\` UNIQUE(\`messageId\`, \`userId\`, \`emoji\`),
    INDEX \`idx_chatreact_message\` (\`messageId\`),
    INDEX \`idx_chatreact_room\` (\`roomId\`)
  )`, 'Ensured auctionChatMessageReactions table');

  // 新增 users.memberLevelExpiresAt 欄位（Loyalty 試用到期）
  await alter(
    `ALTER TABLE \`users\` ADD COLUMN \`memberLevelExpiresAt\` timestamp NULL`,
    'Ensured users.memberLevelExpiresAt column'
  );

  // 新增 users.photoUrl 欄位（Google 頭像或自訂上傳）
  if (!(await check('users', 'photoUrl'))) {
    await alter(
      `ALTER TABLE \`users\` ADD COLUMN \`photoUrl\` varchar(1000) NULL`,
      'Added photoUrl to users'
    );
  }

  // 新增 users.mustChangePassword 欄位（管理員重設密碼後，首次登入強制更改）
  if (!(await check('users', 'mustChangePassword'))) {
    await alter(
      `ALTER TABLE \`users\` ADD COLUMN \`mustChangePassword\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added mustChangePassword to users'
    );
  }

  // 新增 users.isBanned 欄位（停權：禁止一切出價/上拍/出售功能）
  if (!(await check('users', 'isBanned'))) {
    await alter(
      `ALTER TABLE \`users\` ADD COLUMN \`isBanned\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added isBanned to users'
    );
  }

  // 新增 users.monthlyVideoQuota 欄位（商戶每月可上傳影片條數）
  if (!(await check('users', 'monthlyVideoQuota'))) {
    await alter(
      `ALTER TABLE \`users\` ADD COLUMN \`monthlyVideoQuota\` int NOT NULL DEFAULT 5`,
      'Added monthlyVideoQuota to users'
    );
  }

  // 新增 users.maxVideoSeconds 欄位（單條影片最長秒數上限，預設 60）
  if (!(await check('users', 'maxVideoSeconds'))) {
    await alter(
      `ALTER TABLE \`users\` ADD COLUMN \`maxVideoSeconds\` int NOT NULL DEFAULT 60`,
      'Added maxVideoSeconds to users'
    );
  }

  // dailyEarlyBird table (每日早鳥會員名額)
  await alter(`CREATE TABLE IF NOT EXISTS \`dailyEarlyBird\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`claimDate\` varchar(10) NOT NULL,
    \`trialLevel\` varchar(20) NOT NULL,
    \`trialExpiresAt\` timestamp NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`dailyEarlyBird_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`dailyEarlyBird_user_unique\` UNIQUE(\`userId\`),
    INDEX \`idx_earlybird_date\` (\`claimDate\`)
  )`, 'Ensured dailyEarlyBird table');

  await alter(`CREATE TABLE IF NOT EXISTS \`userAutoBidQuota\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`monthKey\` varchar(7) NOT NULL,
    \`used\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`userAutoBidQuota_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uniq_user_month\` (\`userId\`, \`monthKey\`)
  )`, 'Ensured userAutoBidQuota table');

  // ── Merchant Auction Sessions (專場拍賣) ─────────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`merchantAuctionSessions\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`merchantUserId\` int NOT NULL,
    \`slug\` varchar(80) NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`description\` text NULL,
    \`coverImage\` varchar(500) NULL,
    \`endAt\` timestamp NOT NULL,
    \`status\` enum('draft','published','ended') NOT NULL DEFAULT 'draft',
    \`visibility\` enum('public','unlisted') NOT NULL DEFAULT 'public',
    \`itemCount\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`merchantAuctionSessions_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uniq_merchant_slug\` (\`merchantUserId\`, \`slug\`),
    INDEX \`idx_merchant_status\` (\`merchantUserId\`, \`status\`),
    INDEX \`idx_endAt\` (\`endAt\`)
  )`, 'Ensured merchantAuctionSessions table');

  await alter(`CREATE TABLE IF NOT EXISTS \`merchantAuctionSessionItems\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`sessionId\` int NOT NULL,
    \`auctionId\` int NOT NULL,
    \`displayOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`merchantAuctionSessionItems_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uniq_session_auction\` (\`sessionId\`, \`auctionId\`),
    INDEX \`idx_session\` (\`sessionId\`),
    INDEX \`idx_auction\` (\`auctionId\`)
  )`, 'Ensured merchantAuctionSessionItems table');

  // 加 visibility column 對舊 deploy（保險）
  if (!(await check('merchantAuctionSessions', 'visibility'))) {
    await alter(
      "ALTER TABLE `merchantAuctionSessions` ADD COLUMN `visibility` enum('public','unlisted') NOT NULL DEFAULT 'public'",
      'Added visibility to merchantAuctionSessions'
    );
  }
  if (!(await check('merchantAuctionSessions', 'addItemsCutoffMinutes'))) {
    await alter(
      "ALTER TABLE `merchantAuctionSessions` ADD COLUMN `addItemsCutoffMinutes` int NOT NULL DEFAULT 30",
      'Added addItemsCutoffMinutes to merchantAuctionSessions'
    );
  }
  if (!(await check('merchantAuctionSessions', 'combinedWonEmailSentAt'))) {
    await alter(
      "ALTER TABLE `merchantAuctionSessions` ADD COLUMN `combinedWonEmailSentAt` DATETIME NULL",
      'Added combinedWonEmailSentAt to merchantAuctionSessions'
    );
  }

  // Seed loyalty config 預設值（只喺 key 未設定先寫入，唔 overwrite admin 改動）
  const LOYALTY_DEFAULTS: Record<string, string> = {
    'loyalty.earlyBirdEnabled': 'true',
    'loyalty.earlyBirdDailyQuota': '10',
    'loyalty.earlyBirdTrialLevel': 'silver',
    'loyalty.earlyBirdTrialDays': '7',
    'loyalty.silverBidCount': '20',
    'loyalty.silverWinCount': '3',
    'loyalty.silver90DaySpend': '3000',
    'loyalty.goldWinCount': '20',
    'loyalty.gold90DaySpend': '30000',
    'loyalty.inactivityDaysForDowngrade': '90',
    'loyalty.silverCashbackRate': '0.01',
    'loyalty.goldCashbackRate': '0.02',
    'loyalty.vipCashbackRate': '0.03',
    'loyalty.silverPreviewHours': '24',
    'loyalty.goldPreviewHours': '48',
    // ── 自理出價（autoBid / proxyBid）+ 匿名出價限制 ──
    'loyalty.bronzeAutoBidQuota': '3',          // 銅牌每月可用次數
    'loyalty.silverAutoBidMaxAmount': '5000',   // 銀牌單次代理出價上限金額（HKD），0 = 無限制
    'loyalty.silverCanAnonymous': 'true',       // 銀牌可否匿名出價
    'loyalty.goldDefaultAnonymous': 'true',     // 金牌出價時匿名選項是否預設打開
  };
  try {
    const { drizzle: drizzleMysql2 } = await import('drizzle-orm/mysql2');
    const db = drizzleMysql2(pool);
    const { siteSettings } = await import('../../drizzle/schema');
    const existing = await db.select({ key: siteSettings.key }).from(siteSettings);
    const existingKeys = new Set(existing.map(r => r.key));
    let seeded = 0;
    for (const [key, value] of Object.entries(LOYALTY_DEFAULTS)) {
      if (!existingKeys.has(key)) {
        await db.insert(siteSettings).values({ key, value });
        seeded++;
      }
    }
    if (seeded > 0) console.log(`[Bootstrap] Seeded ${seeded} loyalty default settings`);
  } catch (err) {
    console.warn('[Bootstrap] Loyalty defaults seed warning:', err instanceof Error ? err.message : err);
  }

  // auctionRecords: 拍賣成交紀錄（截圖 AI 提取）
  await alter(`CREATE TABLE IF NOT EXISTS \`auctionRecords\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`lotNumber\` varchar(50) NULL,
    \`title\` varchar(500) NOT NULL,
    \`description\` text NULL,
    \`estimateLow\` decimal(12,2) NULL,
    \`estimateHigh\` decimal(12,2) NULL,
    \`soldPrice\` decimal(12,2) NULL,
    \`currency\` varchar(10) NOT NULL DEFAULT 'HKD',
    \`auctionHouse\` varchar(100) NULL,
    \`auctionDate\` varchar(20) NULL,
    \`saleStatus\` varchar(20) NOT NULL DEFAULT 'sold',
    \`sourceNote\` varchar(500) NULL,
    \`importStatus\` varchar(20) NOT NULL DEFAULT 'pending',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`auctionRecords_id\` PRIMARY KEY(\`id\`),
    INDEX \`idx_ar_status\` (\`importStatus\`),
    INDEX \`idx_ar_house\` (\`auctionHouse\`)
  )`, 'Ensured auctionRecords table');
  if (!(await check('auctionRecords', 'imageUrl'))) {
    await alter(`ALTER TABLE \`auctionRecords\` ADD COLUMN \`imageUrl\` VARCHAR(1000) NULL AFTER \`sourceNote\``, 'Added imageUrl column to auctionRecords');
  }
  if (!(await check('auctionRecords', 'batchId'))) {
    await alter(`ALTER TABLE \`auctionRecords\` ADD COLUMN \`batchId\` VARCHAR(30) NULL AFTER \`imageUrl\``, 'Added batchId column to auctionRecords');
  }
  if (!(await check('auctionRecords', 'imagesJson'))) {
    await alter(`ALTER TABLE \`auctionRecords\` ADD COLUMN \`imagesJson\` TEXT NULL AFTER \`imageUrl\``, 'Added imagesJson column to auctionRecords');
  }

  // 拍賣訂單欄位（拍賣結束後商戶要 confirm/cancel 交收）
  if (!(await check('auctions', 'auctionOrderStatus'))) {
    await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`auctionOrderStatus\` ENUM('pending','confirmed','cancelled') NULL`,
      'Added auctionOrderStatus to auctions');
  }
  if (!(await check('auctions', 'auctionOrderConfirmedAt'))) {
    await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`auctionOrderConfirmedAt\` DATETIME NULL`,
      'Added auctionOrderConfirmedAt to auctions');
  }
  if (!(await check('auctions', 'auctionOrderCancelledAt'))) {
    await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`auctionOrderCancelledAt\` DATETIME NULL`,
      'Added auctionOrderCancelledAt to auctions');
  }
  if (!(await check('auctions', 'auctionOrderCancelReason'))) {
    await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`auctionOrderCancelReason\` VARCHAR(500) NULL`,
      'Added auctionOrderCancelReason to auctions');
  }
  if (!(await check('auctions', 'auctionOrderFinalPrice'))) {
    await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`auctionOrderFinalPrice\` DECIMAL(12,2) NULL`,
      'Added auctionOrderFinalPrice to auctions');
  }
  if (!(await check('auctions', 'privateNote'))) {
    await alter(`ALTER TABLE \`auctions\` ADD COLUMN \`privateNote\` TEXT NULL`,
      'Added privateNote to auctions');
  }
  // 🔴 Backfill：之前 cron 只 end 咗 session 而冇 end 場內個別 auction，導致商戶後台拍賣訂單見唔到記錄
  // 修復：所有屬於 ended session 嘅 active auction 連帶 mark 'ended'
  try {
    const [fixSession]: any = await pool.execute(
      `UPDATE auctions a
         JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id
         JOIN merchantAuctionSessions s ON s.id=sit.sessionId
       SET a.status='ended', a.endTime=COALESCE(s.endAt, NOW())
       WHERE s.status='ended' AND a.status='active'`
    );
    if (fixSession?.affectedRows) console.log(`[Bootstrap] Fixed ${fixSession.affectedRows} auction(s) stuck active under ended session`);
  } catch (e: any) {
    console.warn('[Bootstrap] Backfill session-ended auctions skipped:', e?.message ?? e);
  }
  // Backfill：所有 status='ended' AND highestBidderId IS NOT NULL AND auctionOrderStatus IS NULL → 'pending'
  try {
    const [bres]: any = await pool.execute(
      "UPDATE `auctions` SET `auctionOrderStatus` = 'pending' WHERE `status` = 'ended' AND `highestBidderId` IS NOT NULL AND `auctionOrderStatus` IS NULL"
    );
    if (bres?.affectedRows) console.log(`[Bootstrap] Backfilled auctionOrderStatus='pending' on ${bres.affectedRows} ended auctions`);
  } catch (e: any) {
    console.warn('[Bootstrap] Backfill auctionOrderStatus skipped:', e?.message ?? e);
  }
  // Backfill：所有 status='ended' AND highestBidderId IS NOT NULL AND paymentStatus IS NULL → 'pending_payment'
  try {
    const [pres]: any = await pool.execute(
      "UPDATE `auctions` SET `paymentStatus` = 'pending_payment' WHERE `status` = 'ended' AND `highestBidderId` IS NOT NULL AND `paymentStatus` IS NULL"
    );
    if (pres?.affectedRows) console.log(`[Bootstrap] Backfilled paymentStatus='pending_payment' on ${pres.affectedRows} ended auctions`);
  } catch (e: any) {
    console.warn('[Bootstrap] Backfill paymentStatus skipped:', e?.message ?? e);
  }

  // 修正 auctions.category 從 ENUM 改為 VARCHAR（支援自定義分類）
  try {
    await pool.execute("ALTER TABLE `auctions` MODIFY COLUMN `category` VARCHAR(100) NULL DEFAULT '其它'");
    console.log("[Bootstrap] Changed auctions.category to VARCHAR(100)");
  } catch (e: any) {
    if (!e?.message?.includes('No operation needed')) {
      console.warn("[Bootstrap] auctions.category modify skipped:", e?.message ?? e);
    }
  }

  // 修正通知設定：senderName 若為舊名稱 → 改為 hongxcollections
  try {
    await pool.execute(
      "UPDATE `notificationSettings` SET senderName = 'hongxcollections' WHERE senderName = '大BB錢幣店'"
    );
  } catch (e) { /* 表不存在或無需修改，忽略 */ }

  // 修正舊紀錄：saleStatus='sold' 但無金額 → 改為 'unsold'（流拍）
  try {
    const [fixRes]: any = await pool.execute(
      "UPDATE `auctionRecords` SET saleStatus = 'unsold' WHERE saleStatus = 'sold' AND (soldPrice IS NULL OR soldPrice = 0)"
    );
    if (fixRes.affectedRows > 0) {
      console.log(`[Bootstrap] Fixed ${fixRes.affectedRows} records: saleStatus sold→unsold (no price)`);
    }
  } catch (e) { console.warn('[Bootstrap] saleStatus fix skipped:', e); }

  // ── 補充缺失的 Index（提升查詢效能）──────────────────────────────────────
  // 用 try/catch 模式：MySQL 8.0+ 支援 IF NOT EXISTS，舊版則 skip duplicate key error
  const addIndex = async (name: string, sql: string) => {
    try { await pool.execute(sql); console.log(`[Bootstrap] Created index: ${name}`); }
    catch (e: any) {
      // 忽略已存在的 index 錯誤（Duplicate key name）
      if (!e?.message?.includes('Duplicate key name') && !e?.message?.includes('already exists')) {
        console.warn(`[Bootstrap] Index ${name} skipped:`, e?.message ?? e);
      }
    }
  };

  // bids: 最常查 auctionId（出價歷史）、userId（我的出價）
  await addIndex('idx_bids_auctionId', 'CREATE INDEX `idx_bids_auctionId` ON `bids` (`auctionId`)');
  await addIndex('idx_bids_userId',    'CREATE INDEX `idx_bids_userId`    ON `bids` (`userId`)');

  // auctions: 依 status 篩選（首頁列表）、依 createdBy 找商戶拍賣
  await addIndex('idx_auctions_status',    'CREATE INDEX `idx_auctions_status`    ON `auctions` (`status`)');
  await addIndex('idx_auctions_createdBy', 'CREATE INDEX `idx_auctions_createdBy` ON `auctions` (`createdBy`)');
  await addIndex('idx_auctions_endTime',   'CREATE INDEX `idx_auctions_endTime`   ON `auctions` (`endTime`)');

  // auctionImages: 每個拍賣頁都要 JOIN
  await addIndex('idx_auctionImages_auctionId', 'CREATE INDEX `idx_auctionImages_auctionId` ON `auctionImages` (`auctionId`)');

  // merchantProducts: 商戶商品列表、狀態篩選
  await addIndex('idx_merchantProducts_merchantId', 'CREATE INDEX `idx_merchantProducts_merchantId` ON `merchantProducts` (`merchantId`)');
  await addIndex('idx_merchantProducts_status',     'CREATE INDEX `idx_merchantProducts_status`     ON `merchantProducts` (`status`)');

  // depositTransactions: 交易記錄按用戶查詢
  await addIndex('idx_depositTx_userId', 'CREATE INDEX `idx_depositTx_userId` ON `deposit_transactions` (`userId`)');

  // userSubscriptions: 按用戶查訂閱
  await addIndex('idx_userSubs_userId', 'CREATE INDEX `idx_userSubs_userId` ON `user_subscriptions` (`userId`)');
  await addIndex('idx_userSubs_status', 'CREATE INDEX `idx_userSubs_status` ON `user_subscriptions` (`status`)');

  // merchantApplications: 按 userId 找商戶申請
  await addIndex('idx_merchantApp_userId', 'CREATE INDEX `idx_merchantApp_userId` ON `merchantApplications` (`userId`)');
  await addIndex('idx_merchantApp_status', 'CREATE INDEX `idx_merchantApp_status` ON `merchantApplications` (`status`)');

  // featuredListings: 首頁取 active 主打
  await addIndex('idx_featuredListings_status', 'CREATE INDEX `idx_featuredListings_status` ON `featuredListings` (`status`)');
  await addIndex('idx_featuredListings_merchantId', 'CREATE INDEX `idx_featuredListings_merchantId` ON `featuredListings` (`merchantId`)');

  // proxyBids: 代理出價按 auctionId 查（uniq_proxy_auction_user 已建，但單欄 index 更高效）
  await addIndex('idx_proxyBids_auctionId', 'CREATE INDEX `idx_proxyBids_auctionId` ON `proxyBids` (`auctionId`)');

  // favorites: 我的收藏
  await addIndex('idx_favorites_userId', 'CREATE INDEX `idx_favorites_userId` ON `favorites` (`userId`)');

  // ── 收藏品分享社區（藏品社區）— Phase 1 表 ──────────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`collectionPosts\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`body\` text,
    \`intent\` enum('display','seek_value','for_sale') NOT NULL DEFAULT 'display',
    \`tagsJson\` text,
    \`isHidden\` int NOT NULL DEFAULT 0,
    \`isFlagged\` int NOT NULL DEFAULT 0,
    \`flagReason\` varchar(500) NULL,
    \`likeCount\` int NOT NULL DEFAULT 0,
    \`commentCount\` int NOT NULL DEFAULT 0,
    \`viewCount\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`collectionPosts_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured collectionPosts table');

  await alter(`CREATE TABLE IF NOT EXISTS \`collectionPostImages\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`postId\` int NOT NULL,
    \`imageUrl\` text NOT NULL,
    \`displayOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`collectionPostImages_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured collectionPostImages table');

  await alter(`CREATE TABLE IF NOT EXISTS \`collectionPostLikes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`postId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`collectionPostLikes_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uniq_post_user_like\` (\`postId\`, \`userId\`)
  )`, 'Ensured collectionPostLikes table');

  await alter(`CREATE TABLE IF NOT EXISTS \`collectionPostComments\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`postId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`content\` text NOT NULL,
    \`isHidden\` int NOT NULL DEFAULT 0,
    \`isFlagged\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`collectionPostComments_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured collectionPostComments table');

  await alter(`CREATE TABLE IF NOT EXISTS \`collectionPostSaves\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`postId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`collectionPostSaves_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uniq_post_user_save\` (\`postId\`, \`userId\`)
  )`, 'Ensured collectionPostSaves table');

  await addIndex('idx_collectionPosts_intent', 'CREATE INDEX `idx_collectionPosts_intent` ON `collectionPosts` (`intent`)');
  await addIndex('idx_collectionPosts_userId', 'CREATE INDEX `idx_collectionPosts_userId` ON `collectionPosts` (`userId`)');
  await addIndex('idx_collectionPosts_hidden', 'CREATE INDEX `idx_collectionPosts_hidden` ON `collectionPosts` (`isHidden`)');

  // 方案 B：商戶上架帖文 — 加 columns + index
  await alter('ALTER TABLE `collectionPosts` ADD COLUMN `isMerchantPost` int NOT NULL DEFAULT 0', 'Ensured collectionPosts.isMerchantPost column');
  await alter('ALTER TABLE `collectionPosts` ADD COLUMN `merchantProductId` int NULL', 'Ensured collectionPosts.merchantProductId column');
  if (!(await check('collectionPosts', 'displayAuthor'))) {
    await alter('ALTER TABLE `collectionPosts` ADD COLUMN `displayAuthor` varchar(80) NULL', 'Added displayAuthor to collectionPosts');
  }
  await addIndex('idx_collectionPosts_merchant', 'CREATE INDEX `idx_collectionPosts_merchant` ON `collectionPosts` (`isMerchantPost`)');
  await addIndex('idx_collectionPostComments_postId', 'CREATE INDEX `idx_collectionPostComments_postId` ON `collectionPostComments` (`postId`)');
  await addIndex('idx_collectionPostImages_postId', 'CREATE INDEX `idx_collectionPostImages_postId` ON `collectionPostImages` (`postId`)');
  // 本週熱門分享者：likes.createdAt range scan + JOIN postId
  await addIndex('idx_collectionPostLikes_createdAt_postId', 'CREATE INDEX `idx_collectionPostLikes_createdAt_postId` ON `collectionPostLikes` (`createdAt`, `postId`)');
  await addIndex('idx_collectionPostSaves_postId', 'CREATE INDEX `idx_collectionPostSaves_postId` ON `collectionPostSaves` (`postId`)');

  // ── 藏品社區 AI 助手 — admin 揀題材生成 draft ──────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`communitySeederDrafts\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`themeId\` varchar(60) NOT NULL,
    \`themeLabel\` varchar(120) NOT NULL,
    \`batchId\` varchar(40) NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`body\` text NOT NULL,
    \`tagsJson\` text,
    \`imagesJson\` text,
    \`authorUserId\` int NULL,
    \`status\` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
    \`publishedPostId\` int NULL,
    \`generatedBy\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`communitySeederDrafts_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured communitySeederDrafts table');
  await addIndex('idx_communitySeederDrafts_status', 'CREATE INDEX `idx_communitySeederDrafts_status` ON `communitySeederDrafts` (`status`)');
  await addIndex('idx_communitySeederDrafts_batchId', 'CREATE INDEX `idx_communitySeederDrafts_batchId` ON `communitySeederDrafts` (`batchId`)');
  if (!(await check('communitySeederDrafts', 'displayAuthor'))) {
    await alter('ALTER TABLE `communitySeederDrafts` ADD COLUMN `displayAuthor` varchar(80) NULL', 'Added displayAuthor to communitySeederDrafts');
  }
  if (!(await check('communitySeederDrafts', 'sourceUrl'))) {
    await alter('ALTER TABLE `communitySeederDrafts` ADD COLUMN `sourceUrl` varchar(500) NULL', 'Added sourceUrl to communitySeederDrafts');
  }

  // ── 藏品社區 AI 助手題材表（admin 可改）───────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`communitySeederThemes\` (
    \`id\` varchar(60) NOT NULL,
    \`label\` varchar(120) NOT NULL,
    \`hint\` text NOT NULL,
    \`sortOrder\` int NOT NULL DEFAULT 0,
    \`isSystem\` boolean NOT NULL DEFAULT false,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`communitySeederThemes_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured communitySeederThemes table');
  // INSERT IGNORE 預設 9 個題材（admin 改完之後唔會再覆蓋，因為主鍵 conflict 會 ignore）
  const seedThemes: Array<[string, string, string, number, number]> = [
    ['hk-banknote', '香港鈔票', '殖民地時期、回歸後紀念鈔、各銀行版本、塑膠鈔', 10, 0],
    ['cn-commemorative-note', '中國紀念鈔', '建國 50 週年、奧運、航天、人民幣 70 週年', 20, 0],
    ['cn-precious-metal-coin', '中國金銀幣', '熊貓金幣、生肖金銀、紀念章、發行量', 30, 0],
    ['hk-coin', '港幣硬幣', '英女皇、洋紫荊、新版、稀有年份', 40, 0],
    ['world-banknote', '世界錢幣', '東南亞、歐洲、非洲特色鈔票', 50, 0],
    ['ancient-coin', '古錢幣', '清朝、民國、銅錢、銀元', 60, 0],
    ['collecting-tips', '收藏入門', '新手點開始、保存、評級、入手渠道', 70, 0],
    ['authentication', '鑑定真偽', '常見假鈔／偽幣特徵、真假對比、UV 燈、水印', 80, 0],
    ['url-import', '網絡轉載', '從外部連結抓取文章 + 圖片自動生成草稿', 999, 1],
  ];
  for (const [id, label, hint, sortOrder, isSystem] of seedThemes) {
    await alter(
      `INSERT IGNORE INTO \`communitySeederThemes\` (id,label,hint,sortOrder,isSystem) VALUES ('${id}', '${label.replace(/'/g, "''")}', '${hint.replace(/'/g, "''")}', ${sortOrder}, ${isSystem})`,
      `Seeded theme ${id}`,
    );
  }

  // ── 每日一幣挑戰 — Phase 1 表 ──────────────────────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`dailyChallenges\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`imageUrl\` text NOT NULL,
    \`publishDate\` varchar(10) NOT NULL,
    \`answerCountry\` varchar(80) NOT NULL,
    \`answerYear\` int NOT NULL,
    \`yearTolerance\` int NOT NULL DEFAULT 5,
    \`answerCategory\` varchar(40) NOT NULL,
    \`hint\` text,
    \`description\` text,
    \`status\` enum('draft','published','closed') NOT NULL DEFAULT 'draft',
    \`createdBy\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`dailyChallenges_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured dailyChallenges table');

  await alter(`CREATE TABLE IF NOT EXISTS \`dailyChallengeAnswers\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`challengeId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`answerCountry\` varchar(80) NOT NULL,
    \`answerYear\` int NOT NULL,
    \`answerCategory\` varchar(40) NOT NULL,
    \`isCorrect\` int NOT NULL DEFAULT 0,
    \`answerRank\` int NULL,
    \`pointsAwarded\` int NOT NULL DEFAULT 0,
    \`submittedAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`dailyChallengeAnswers_id\` PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uniq_challenge_user\` (\`challengeId\`, \`userId\`)
  )`, 'Ensured dailyChallengeAnswers table');

  // dailyChallenges 馬賽克欄位（後加，bootstrap 補上）
  await alter("ALTER TABLE `dailyChallenges` ADD COLUMN `imageRegions` text NULL", "Ensured dailyChallenges.imageRegions column");
  await alter("ALTER TABLE `dailyChallenges` ADD COLUMN `imageUrlCensored` varchar(500) NULL", "Ensured dailyChallenges.imageUrlCensored column");

  await addIndex('idx_dailyChallenges_publishDate', 'CREATE INDEX `idx_dailyChallenges_publishDate` ON `dailyChallenges` (`publishDate`)');
  await addIndex('idx_dailyChallenges_status', 'CREATE INDEX `idx_dailyChallenges_status` ON `dailyChallenges` (`status`)');
  await addIndex('idx_dailyChallengeAnswers_userId', 'CREATE INDEX `idx_dailyChallengeAnswers_userId` ON `dailyChallengeAnswers` (`userId`)');
  await addIndex('idx_dailyChallengeAnswers_challengeId', 'CREATE INDEX `idx_dailyChallengeAnswers_challengeId` ON `dailyChallengeAnswers` (`challengeId`)');

  // ── 商戶日誌功能 ─────────────────────────────────────────────────────────────
  if (!(await check('merchantApplications', 'journalEnabled'))) {
    await alter('ALTER TABLE `merchantApplications` ADD COLUMN `journalEnabled` int NOT NULL DEFAULT 0', 'Ensured merchantApplications.journalEnabled column');
  }
  await alter(`CREATE TABLE IF NOT EXISTS \`merchantJournals\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`merchantUserId\` int NOT NULL,
    \`content\` text NOT NULL,
    \`tags\` varchar(255) NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`merchantJournals_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured merchantJournals table');
  await alter(`CREATE TABLE IF NOT EXISTS \`merchantJournalImages\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`journalId\` int NOT NULL,
    \`imageUrl\` varchar(800) NOT NULL,
    \`displayOrder\` int NOT NULL DEFAULT 0,
    CONSTRAINT \`merchantJournalImages_id\` PRIMARY KEY(\`id\`)
  )`, 'Ensured merchantJournalImages table');
  await addIndex('idx_merchantJournals_merchantUserId', 'CREATE INDEX `idx_merchantJournals_merchantUserId` ON `merchantJournals` (`merchantUserId`, `createdAt`)');
  await addIndex('idx_merchantJournalImages_journalId', 'CREATE INDEX `idx_merchantJournalImages_journalId` ON `merchantJournalImages` (`journalId`)');
  await alter("ALTER TABLE `merchantJournals` ADD COLUMN `entryAt` datetime NULL", "Ensured merchantJournals.entryAt column");
  await alter("ALTER TABLE `merchantJournals` ADD COLUMN `contacts` varchar(500) NULL", "Ensured merchantJournals.contacts column");
  await alter(`CREATE TABLE IF NOT EXISTS \`merchantJournalContacts\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`merchantUserId\` int NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY \`uq_mjc_merchant_name\` (\`merchantUserId\`, \`name\`),
    PRIMARY KEY (\`id\`)
  )`, 'Ensured merchantJournalContacts table');

  // ── One-time data fix: archive 重複嘅原件 ──────────────────────────────────
  // relistAuction 舊邏輯冇 archive 原件，造成 eligible list 重複出現同款商品。
  // 凡有 relist 版本存在（relistSourceId = original.id）且 relist 本身未 archive，
  // 則將原件設 archived=1，令佢唔再出現喺 eligible list。
  try {
    const [dup]: any = await pool.execute(
      `UPDATE auctions orig
       SET orig.archived = 1, orig.archivedAt = NOW()
       WHERE orig.status = 'ended'
         AND orig.highestBidderId IS NULL
         AND (orig.archived = 0 OR orig.archived IS NULL)
         AND EXISTS (
           SELECT 1 FROM (SELECT id, relistSourceId, archived FROM auctions) relist
           WHERE relist.relistSourceId = orig.id
             AND (relist.archived = 0 OR relist.archived IS NULL)
         )`
    );
    const affected = dup?.affectedRows ?? 0;
    if (affected > 0) {
      console.log(`[Bootstrap] Archived ${affected} duplicate original auction(s) that had been relisted`);
    }
  } catch (e) {
    console.warn('[Bootstrap] Relist dedup cleanup failed (non-fatal):', (e as Error).message);
  }

  await alter(`CREATE TABLE IF NOT EXISTS \`auctionComments\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`auctionId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`content\` text NOT NULL,
    \`replyToBidId\` int DEFAULT NULL,
    \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    INDEX \`idx_auctionComments_auction\` (\`auctionId\`),
    INDEX \`idx_auctionComments_replyToBid\` (\`replyToBidId\`)
  )`, 'Ensured auctionComments table');

  if (!(await check('auctions', 'displayMode'))) {
    await alter(
      `ALTER TABLE \`auctions\` ADD COLUMN \`displayMode\` varchar(20) NOT NULL DEFAULT 'default'`,
      'Added displayMode to auctions'
    );
  }

  if (!(await check('merchant_settings', 'showEndedOnMainPage'))) {
    await alter(
      `ALTER TABLE \`merchant_settings\` ADD COLUMN \`showEndedOnMainPage\` tinyint(1) NOT NULL DEFAULT 1`,
      'Added showEndedOnMainPage to merchant_settings'
    );
  }

  if (!(await check('merchant_settings', 'mainPageEndedDays'))) {
    await alter(
      `ALTER TABLE \`merchant_settings\` ADD COLUMN \`mainPageEndedDays\` int NOT NULL DEFAULT 3`,
      'Added mainPageEndedDays to merchant_settings'
    );
  }

  if (!(await check('merchant_settings', 'showUnsoldEnded'))) {
    await alter(
      `ALTER TABLE \`merchant_settings\` ADD COLUMN \`showUnsoldEnded\` tinyint(1) NOT NULL DEFAULT 0`,
      'Added showUnsoldEnded to merchant_settings'
    );
  }

  // ─── 團購拍賣（Group Auction）──────────────────────────────────────────────
  await alter(`CREATE TABLE IF NOT EXISTS \`groupAuctionRounds\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`merchantUserId\` int NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`periodNumber\` varchar(40) NULL,
    \`description\` text NULL,
    \`coverImage\` varchar(500) NULL,
    \`startAt\` timestamp NULL,
    \`endAt\` timestamp NULL,
    \`antiSnipeMinutes\` int NOT NULL DEFAULT 5,
    \`antiSnipeExtendMinutes\` int NOT NULL DEFAULT 5,
    \`antiSnipeMode\` enum('none','per_item','whole_round') NOT NULL DEFAULT 'per_item',
    \`defaultBidIncrement\` int NOT NULL DEFAULT 50,
    \`buyerCommissionRate\` decimal(5,4) NOT NULL DEFAULT 0,
    \`status\` enum('draft','published','ended') NOT NULL DEFAULT 'draft',
    \`columnTemplateId\` int NULL,
    \`columnsJson\` text NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    INDEX \`idx_gar_merchant\` (\`merchantUserId\`),
    INDEX \`idx_gar_status\` (\`status\`),
    INDEX \`idx_gar_endAt\` (\`endAt\`)
  )`, 'Ensured groupAuctionRounds table');

  if (!(await check('groupAuctionRounds', 'displayCurrencies'))) {
    await alter(
      `ALTER TABLE \`groupAuctionRounds\` ADD COLUMN \`displayCurrencies\` varchar(100) NOT NULL DEFAULT 'HKD,CNY'`,
      'Added displayCurrencies to groupAuctionRounds'
    );
  }
  if (!(await check('groupAuctionRounds', 'minDurationMinutes'))) {
    await alter(
      `ALTER TABLE \`groupAuctionRounds\` ADD COLUMN \`minDurationMinutes\` int NOT NULL DEFAULT 60`,
      'Added minDurationMinutes to groupAuctionRounds'
    );
  }
  if (!(await check('groupAuctionRounds', 'promoImagesJson'))) {
    await alter(
      `ALTER TABLE \`groupAuctionRounds\` ADD COLUMN \`promoImagesJson\` text NULL`,
      'Added promoImagesJson to groupAuctionRounds'
    );
  }
  if (!(await check('groupAuctionRounds', 'isArchived'))) {
    await alter(
      `ALTER TABLE \`groupAuctionRounds\` ADD COLUMN \`isArchived\` int NOT NULL DEFAULT 0`,
      'Added isArchived to groupAuctionRounds'
    );
  }
  if (!(await check('groupAuctionRounds', 'colorRulesJson'))) {
    await alter(
      `ALTER TABLE \`groupAuctionRounds\` ADD COLUMN \`colorRulesJson\` text NULL`,
      'Added colorRulesJson to groupAuctionRounds'
    );
  }

  await alter(`CREATE TABLE IF NOT EXISTS \`groupAuctionColumnTemplates\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`merchantUserId\` int NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`columnsJson\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    INDEX \`idx_gact_merchant\` (\`merchantUserId\`)
  )`, 'Ensured groupAuctionColumnTemplates table');

  await alter(`CREATE TABLE IF NOT EXISTS \`groupAuctionImages\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`roundId\` int NOT NULL,
    \`s3Key\` varchar(500) NOT NULL,
    \`url\` varchar(500) NOT NULL,
    \`displayOrder\` int NOT NULL DEFAULT 0,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    INDEX \`idx_gai_round\` (\`roundId\`)
  )`, 'Ensured groupAuctionImages table');

  await alter(`CREATE TABLE IF NOT EXISTS \`groupAuctionItems\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`roundId\` int NOT NULL,
    \`displayOrder\` int NOT NULL DEFAULT 0,
    \`dataJson\` text NOT NULL,
    \`imageIdsJson\` text NULL,
    \`startPrice\` int NOT NULL,
    \`bidIncrement\` int NOT NULL DEFAULT 0,
    \`buyNowPrice\` int NULL,
    \`status\` enum('active','sold','unsold') NOT NULL DEFAULT 'active',
    \`finalPrice\` int NULL,
    \`winnerId\` int NULL,
    \`endAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    INDEX \`idx_gait_round\` (\`roundId\`),
    INDEX \`idx_gait_status\` (\`status\`),
    INDEX \`idx_gait_winner\` (\`winnerId\`)
  )`, 'Ensured groupAuctionItems table');

  await alter(`CREATE TABLE IF NOT EXISTS \`groupAuctionBids\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`itemId\` int NOT NULL,
    \`roundId\` int NOT NULL,
    \`userId\` int NOT NULL,
    \`amount\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    INDEX \`idx_gab_item\` (\`itemId\`),
    INDEX \`idx_gab_round\` (\`roundId\`),
    INDEX \`idx_gab_user\` (\`userId\`)
  )`, 'Ensured groupAuctionBids table');

  console.log('[Bootstrap] Schema bootstrap completed');
  try { await pool.end(); } catch {}
}

async function runMigrations() {
  const dbUrl = process.env.BB_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!dbUrl) return;
  try {
    const url = new URL(dbUrl);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const pool = createPool({
      host: url.hostname,
      port: parseInt(url.port || (isLocalhost ? '3306' : '4000')),
      user: url.username,
      password: url.password || undefined,
      database: url.pathname.slice(1),
      ssl: isLocalhost ? undefined : { rejectUnauthorized: false },
      multipleStatements: true,
    });
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
    console.log('[Migration] Running migrations from:', migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log('[Migration] Migrations completed successfully');
    await pool.end();
  } catch (error) {
    console.warn('[Migration] Migration warning (continuing):', (error as Error).message);
  }
}

async function startServer() {
  const app = express();
  // Railway/proxy: trust X-Forwarded-* so req.ip reflects real client IP for rate limiting
  app.set('trust proxy', true);
  const server = createServer(app);

  // ── 拍賣聊天 WebSocket ─────────────────────────────────────────────────────
  try {
    const { attachChatWebSocket } = await import('./chatWebSocket');
    attachChatWebSocket(server);
  } catch (e) {
    console.error('[startServer] Failed to attach chat WebSocket:', e);
  }

  // ── 健康檢查端點必須最優先登記 ──────────────────────────────────────────────
  // 原因：Railway 在容器啟動後馬上開始輪詢 /health，
  // 但 bootstrapMissingColumns + runMigrations 需要 10-60 秒。
  // 若讓 bootstrap 先跑再監聽，Railway healthcheckTimeout 30s 必然超時，
  // 導致部署被標為失敗、持續重啟、網站不通。
  // 解法：先開始監聽 + 登記 /health，讓 Railway 確認服務存活，
  // 再在背景完成 bootstrap / migration，之後才登記其他路由。
  let bootstrapDone = false;
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      ready: bootstrapDone,
      uptime: Math.floor(process.uptime()),
      ts: Date.now(),
    });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.keepAliveTimeout = 65_000;
  server.headersTimeout   = 66_000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // ── 現在才跑 bootstrap / migration（伺服器已在監聽，/health 回應正常）──
  await bootstrapMissingColumns();
  await runMigrations();
  // 廣告橫幅表
  try {
    const { ensureAdBannersTable } = await import('../db');
    await ensureAdBannersTable();
    console.log('[Bootstrap] Ensured adBanners table');
  } catch (e) {
    console.warn('[Bootstrap] adBanners table skipped:', (e as Error).message);
  }
  bootstrapDone = true;

  // Gzip 壓縮 — 減少回應體積 60-80%
  app.use(compression());
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // share.hongxcollections.com 唔經 CF zone（DNS-only CNAME 直指 Railway）。
  // 用嚟畀 FB / Twitter / WhatsApp / Threads scraper bypass CF edge block。
  // 真人 browser 訪問 → 302 redirect 返主站（保持靚 URL + 原 session cookie）。
  // Bot UA → fall through，正常出 og inject HTML（og:url 自動係 share.* host）。
  app.use((req, res, next) => {
    const host = (req.get("host") || "").toLowerCase();
    if (host === "share.hongxcollections.com") {
      const ua = String(req.headers["user-agent"] ?? "");
      const isBot = /facebookexternalhit|meta-externalagent|facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Pinterest|Threads|googlebot|bingbot|applebot|yandex|baidu|duckduck|crawler|spider|preview/i.test(ua);
      if (!isBot) {
        return res.redirect(302, `https://hongxcollections.com${req.originalUrl}`);
      }
    }
    next();
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Email/phone + password auth routes
  registerAuthRoutes(app);

  // 從 DB 讀取 OTP 速率限制設定（套用到記憶體 config）
  try {
    const { getAllSiteSettings } = await import("../db");
    const s = await getAllSiteSettings();
    const cooldownSecs = parseInt(s.otpCooldownSecs ?? "60", 10);
    const maxPerHour = parseInt(s.otpMaxPerHour ?? "3", 10);
    const ipMaxPerWindow = parseInt(s.otpIpMaxPerWindow ?? "10", 10);
    const ipWindowMins = parseInt(s.otpIpWindowMins ?? "15", 10);
    if (!isNaN(cooldownSecs) && cooldownSecs > 0)
      updateOtpConfig({ cooldownMs: cooldownSecs * 1000 });
    if (!isNaN(maxPerHour) && maxPerHour > 0)
      updateOtpConfig({ maxSendsPerHour: maxPerHour });
    if (!isNaN(ipMaxPerWindow) && ipMaxPerWindow > 0)
      updateIpOtpConfig({ maxRequests: ipMaxPerWindow });
    if (!isNaN(ipWindowMins) && ipWindowMins > 0)
      updateIpOtpConfig({ windowMs: ipWindowMins * 60 * 1000 });
    console.log(`[OTP] Rate config: cooldown=${cooldownSecs}s, maxPerHour=${maxPerHour}, ipMax=${ipMaxPerWindow}/${ipWindowMins}min`);
  } catch (err) {
    console.warn('[OTP] Could not load rate config from DB, using defaults:', err instanceof Error ? err.message : err);
  }

  // Healthcheck — Railway 用來確認服務已就緒
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString(), nodeEnv: process.env.NODE_ENV });
  });

  // Dev/Sandbox mock login (non-production only)
  registerDevLoginRoutes(app);

  // ── UAT AI 診斷端點（非 Production domain 限定）────────────────────────────
  if (!process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT !== "production") {
    app.get("/api/diag-ai", async (_req, res) => {
      const { ENV: e } = await import("./env");
      const envReport = {
        GEMINI_API_KEY: e.geminiApiKey ? `${e.geminiApiKey.length}chars` : "MISSING",
        GEMINI_API_KEY_2: e.geminiApiKey2 ? `${e.geminiApiKey2.length}chars` : "MISSING",
        OPENROUTER_API_KEY: e.openRouterApiKey ? `${e.openRouterApiKey.length}chars` : "MISSING",
      };

      // 抓一張真實小圖並轉成 base64（Gemini 只接受 base64 inline data URL）
      let testB64 = "";
      let testMime = "image/jpeg";
      try {
        const imgResp = await fetch("https://picsum.photos/id/10/80/60");
        const buf = await imgResp.arrayBuffer();
        testB64 = Buffer.from(buf).toString("base64");
        testMime = imgResp.headers.get("content-type") || "image/jpeg";
      } catch { testB64 = ""; }

      const testDataUrl = testB64 ? `data:${testMime};base64,${testB64}` : null;
      // OpenRouter 支援外部 URL（不需 base64）
      const testPublicUrl = "https://picsum.photos/id/10/80/60";

      const results: Array<{ model: string; url: string; status: string; error?: string; snippet?: string }> = [];

      const GG = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      const OR = "https://openrouter.ai/api/v1/chat/completions";

      type TestItem = { url: string; key: string; model: string; useUrl?: boolean };
      const toTry: TestItem[] = [];
      if (e.geminiApiKey)  toTry.push({ url: GG, key: e.geminiApiKey,  model: "gemini-2.0-flash" });
      if (e.geminiApiKey2) toTry.push({ url: GG, key: e.geminiApiKey2, model: "gemini-2.0-flash" });
      if (e.geminiApiKey)  toTry.push({ url: GG, key: e.geminiApiKey,  model: "gemini-2.5-flash" });
      if (e.openRouterApiKey) toTry.push(
        { url: OR, key: e.openRouterApiKey, model: "google/gemma-4-31b-it:free",                        useUrl: true },
        { url: OR, key: e.openRouterApiKey, model: "google/gemma-3-27b-it:free",                        useUrl: true },
        { url: OR, key: e.openRouterApiKey, model: "nvidia/nemotron-nano-12b-v2-vl:free",               useUrl: false },
        { url: OR, key: e.openRouterApiKey, model: "google/gemma-3-12b-it:free",                        useUrl: true },
        { url: OR, key: e.openRouterApiKey, model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", useUrl: false },
      );

      for (const api of toTry) {
        const imageContent = api.useUrl
          ? { type: "image_url", image_url: { url: testPublicUrl } }
          : testDataUrl
            ? { type: "image_url", image_url: { url: testDataUrl } }
            : null;
        if (!imageContent) {
          results.push({ model: api.model, url: api.url, status: "SKIP", error: "Failed to fetch test image" });
          continue;
        }
        try {
          const resp = await fetch(api.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${api.key}` },
            body: JSON.stringify({
              model: api.model,
              max_tokens: 50,
              messages: [{
                role: "user",
                content: [
                  imageContent,
                  { type: "text", text: "Reply with one word: OK" },
                ],
              }],
            }),
          });
          const json: any = await resp.json();
          if (!resp.ok) {
            results.push({ model: api.model, url: api.url, status: `HTTP ${resp.status}`, error: JSON.stringify(json).slice(0, 300) });
          } else {
            const text = json?.choices?.[0]?.message?.content ?? null;
            const fullResp = JSON.stringify(json).slice(0, 500);
            results.push({ model: api.model, url: api.url, status: "OK", snippet: text ? String(text).slice(0, 200) : `(null content) raw:${fullResp}` });
          }
        } catch (err: any) {
          results.push({ model: api.model, url: api.url, status: "EXCEPTION", error: String(err?.message).slice(0, 200) });
        }
      }

      res.json({ env: envReport, results });
    });
  }

  // Facebook Groups Watcher webhook
  registerWebhookRoutes(app);
  // AI 截圖分析端點：POST /api/auction-records/extract-screenshot
  app.post('/api/auction-records/extract-screenshot', async (req, res) => {
    try {
      // 驗證管理員身份（通過 session cookie）
      const { createContext: makeCtx } = await import('./context');
      const ctx = await makeCtx({ req, res } as any);
      if (!ctx.user || ctx.user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const { imageBase64, mimeType = 'image/jpeg', auctionHouse, auctionDate, sourceNote } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: 'imageBase64 is required' });
        return;
      }

      const { ENV: llmEnv } = await import('./env');

      const PROMPT_TEXT = `You are an expert numismatic auction data extractor.
Extract ALL auction lot information visible in this screenshot.

Return ONLY a valid JSON object in this exact format (no markdown, no extra text):
{"lots":[{"lotNumber":"2001","title":"China, Shang Dynasty, Zhong Qian Genuine","description":null,"estimateLow":1000,"estimateHigh":1500,"soldPrice":1000,"currency":"HKD","saleStatus":"sold"}]}

Rules:
- Extract every lot visible, including partially visible ones
- lotNumber: the batch/lot number (批號), string or null
- title: coin name in English, required
- description: extra details or null
- estimateLow/estimateHigh: numeric only (e.g. 1000, not "HK$1,000"), null if not shown
- soldPrice: numeric only if sold, null if unsold/流拍/已結束 without price
- currency: "HKD" unless another currency clearly shown
- saleStatus: "sold" if "已售出" or "已為...售出", "unsold" if "已結束" without price

Chinese/Cantonese reference:
- 批號 = lot number
- 估計 = estimate
- 已為 HK$X 售出 = sold for HK$X (soldPrice=X, saleStatus="sold")
- 已結束 = ended/unsold (saleStatus="unsold", soldPrice=null)

Output ONLY the JSON, nothing else.`;

      const imageMsg = {
        role: 'user' as const,
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: PROMPT_TEXT }
        ]
      };

      // 多模型備用：OpenRouter 免費視覺模型依次嘗試
      const openRouterModels = [
        'google/gemma-4-31b-it:free',
        'google/gemma-3-27b-it:free',
        'nvidia/nemotron-nano-12b-v2-vl:free',
        'google/gemma-4-26b-a4b-it:free',
      ];

      let rawText = '';
      let lastError = '';

      if (llmEnv.openRouterApiKey) {
        for (const model of openRouterModels) {
          try {
            console.log(`[ExtractScreenshot] Trying OpenRouter model: ${model}`);
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${llmEnv.openRouterApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ model, messages: [imageMsg], max_tokens: 4096 }),
            });
            if (resp.status === 429) {
              const errBody = await resp.json().catch(() => ({}));
              lastError = `${model} rate limited: ${JSON.stringify(errBody).slice(0, 200)}`;
              console.warn(`[ExtractScreenshot] ${lastError}`);
              continue; // try next model
            }
            if (!resp.ok) {
              const errBody = await resp.json().catch(() => ({}));
              lastError = `${model} error ${resp.status}: ${JSON.stringify(errBody).slice(0, 200)}`;
              console.warn(`[ExtractScreenshot] ${lastError}`);
              continue;
            }
            const data = await resp.json();
            const content = data.choices?.[0]?.message?.content ?? '';
            rawText = typeof content === 'string' ? content : JSON.stringify(content);
            console.log(`[ExtractScreenshot] Success with model: ${model}`);
            break;
          } catch (e: any) {
            lastError = `${model} fetch error: ${e.message}`;
            console.warn(`[ExtractScreenshot] ${lastError}`);
          }
        }
        if (!rawText && lastError) {
          throw new Error(`All OpenRouter models failed. Last error: ${lastError}`);
        }
      } else {
        // Fallback to invokeLLM (Forge / Gemini / OpenAI)
        const { invokeLLM } = await import('./llm');
        const result = await invokeLLM({ messages: [imageMsg], responseFormat: { type: 'json_object' } });
        const content = result.choices[0]?.message?.content;
        rawText = typeof content === 'string' ? content
          : Array.isArray(content) ? ((content.find((p: any) => p.type === 'text') as any)?.text ?? '') : '';
      }

      let lots: any[] = [];
      const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        lots = parsed.lots || parsed || [];
        if (!Array.isArray(lots)) lots = [];
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          try { lots = JSON.parse(match[0]).lots || []; } catch {}
        }
      }

      // 加上 auctionHouse / auctionDate / sourceNote 到每條紀錄
      const enriched = lots.map((lot: any) => ({
        ...lot,
        auctionHouse: auctionHouse || null,
        auctionDate: auctionDate || null,
        sourceNote: sourceNote || null,
        importStatus: 'pending'
      }));

      res.json({ success: true, lots: enriched });
    } catch (err) {
      console.error('[AuctionRecords] extract-screenshot error:', err);
      res.status(500).json({ error: (err as Error).message || 'Internal error' });
    }
  });

  // ── Bulk-import SSE stream ──────────────────────────────────────────────────
  app.get('/api/auction-records/bulk-import-stream', async (req, res) => {
    // Auth
    const { createContext: makeCtx } = await import('./context');
    const ctx = await makeCtx({ req, res } as any);
    if (!ctx.user || ctx.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const rawUrl   = (req.query.url    as string | undefined) ?? '';
    const maxLots  = Math.min(Math.max(1, parseInt(req.query.maxLots as string) || 300), 1000);

    if (!rawUrl || !rawUrl.includes('live.spink.com')) {
      res.status(400).json({ error: '無效 URL' });
      return;
    }

    // SSE headers
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');   // disable nginx buffering on Railway
    res.flushHeaders();

    const send = (obj: object) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    const CONCURRENCY = 12;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // Step 1: resolve auction page URL
      let auctionPageUrl = rawUrl;
      let auctionTitle: string | null = null;

      if (rawUrl.includes('/lots/view/')) {
        const lotRes  = await fetch(rawUrl, { headers: { 'User-Agent': UA } });
        const lotHtml = await lotRes.text();
        const aidM = lotHtml.match(/href="\/auctions\/(4-[A-Za-z0-9]+)"/);
        if (aidM) auctionPageUrl = `https://live.spink.com/auctions/${aidM[1]}`;
        const atM = lotHtml.match(/class="auction-title[^"]*"[^>]*>\s*([^\n<]+)/);
        auctionTitle = atM?.[1]?.trim() ?? null;
      }

      // Step 2: fetch auction page → initial lot IDs
      const auctionRes  = await fetch(auctionPageUrl, { headers: { 'User-Agent': UA } });
      const auctionHtml = await auctionRes.text();

      if (!auctionTitle) {
        const atM = auctionHtml.match(/class="auction-title[^"]*"[^>]*>\s*([^\n<]+)/);
        auctionTitle = atM?.[1]?.trim() ?? null;
      }
      if (auctionTitle) send({ type: 'title', auctionTitle });

      const initIds = [...new Set(
        [...auctionHtml.matchAll(/lots\/view\/(4-[A-Za-z0-9]+)/g)].map(m => m[1])
      )];
      if (initIds.length === 0) {
        send({ type: 'error', message: '無法找到拍品，請確認 URL 格式' });
        res.end(); return;
      }

      // Step 3: parseLot helper
      const parseLot = async (lotId: string) => {
        try {
          const url = `https://live.spink.com/lots/view/${lotId}`;
          const r   = await fetch(url, { headers: { 'User-Agent': UA } });
          if (!r.ok) return null;
          const html = await r.text();
          const nextM   = html.match(/class="next btn[^"]*"\s+href="\/lots\/view\/([A-Za-z0-9\-]+)"/);
          const titleM  = html.match(/<meta property="og:title" content="([^"]+)"/);
          const title   = titleM ? titleM[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'") : null;
          if (!title) return { nextLotId: nextM?.[1] ?? null, data: null };
          const lotNumM   = html.match(/class="lot-number ng-binding">(\w+)</);
          const estimateM = html.match(/HK\$([0-9,]+)\s*-\s*HK\$([0-9,]+)/);
          const descM     = html.match(/<meta name="description" content="([^"]+)"/);
          const availM    = html.match(/<meta property="product:availability" content="([^"]+)"/);
          const allImgMs    = [...html.matchAll(/href="(https:\/\/images4-cdn\.auctionmobility\.com\/is3\/[^"]+maxwidth=1600[^"]*)"/g)];
          const allImageUrls = [...new Set(allImgMs.map(m => m[1].replace(/&amp;/g,'&')))];
          const soldAmountM = html.match(/class="sold-amount[^"]*"[^>]*>\s*HK\$([0-9,]+)/);
          const soldTextM   = soldAmountM || html.match(/\bSOLD\s+HK\$([0-9,]+)/i);
          const isSoldMeta = availM?.[1] === 'Out of Stock';
          const saleStatus: 'sold'|'unsold' = (isSoldMeta || !!soldTextM) ? 'sold' : 'unsold';
          return {
            nextLotId: nextM?.[1] ?? null,
            data: {
              title,
              lotNumber:    lotNumM?.[1] ?? null,
              estimateLow:  estimateM ? parseFloat(estimateM[1].replace(/,/g,'')) : null,
              estimateHigh: estimateM ? parseFloat(estimateM[2].replace(/,/g,'')) : null,
              description:  descM ? descM[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim() : null,
              saleStatus,
              soldPrice:    soldTextM ? parseFloat(soldTextM[1].replace(/,/g,'')) : null,
              imageUrl:     allImageUrls[0] ?? null,
              imagesJson:   allImageUrls.length > 0 ? JSON.stringify(allImageUrls) : null,
            },
          };
        } catch { return null; }
      };

      // Step 4: existing URLs
      const { getRawPool } = await import('../db');
      const dbPool = await getRawPool();
      const [existingRows]: any = await dbPool.execute(
        "SELECT sourceNote FROM `auctionRecords` WHERE auctionHouse = 'Spink' AND sourceNote IS NOT NULL"
      );
      const existingUrls = new Set<string>((existingRows as any[]).map((r: any) => r.sourceNote as string));

      // Step 5: batchId
      const now     = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      const randStr = Math.random().toString(36).slice(2,7).toUpperCase();
      const batchId = `${dateStr}-${randStr}`;

      // Step 6: BFS queue
      const queue      = [...initIds];
      const discovered = new Set<string>(initIds);
      let imported = 0, skipped = 0, errors = 0, processed = 0;

      while (queue.length > 0 && processed < maxLots) {
        const batchSize = Math.min(CONCURRENCY, maxLots - processed, queue.length);
        const batch     = queue.splice(0, batchSize);
        const results   = await Promise.all(batch.map(id => parseLot(id)));

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const lotId  = batch[i];
          const lotUrl = `https://live.spink.com/lots/view/${lotId}`;
          const sourceNote = auctionTitle ? `${auctionTitle} | ${lotUrl}` : lotUrl;

          if (result?.nextLotId && !discovered.has(result.nextLotId)) {
            discovered.add(result.nextLotId);
            if (processed + queue.length < maxLots) queue.push(result.nextLotId);
          }

          processed++;

          if (!result?.data) {
            errors++;
            send({ type: 'lot', status: 'error', lotNumber: null, title: `批號 ${lotId.slice(-6)}（無法抓取）`, saleStatus: null });
            continue;
          }

          const alreadyExists = [...existingUrls].some(u => u.includes(lotId));
          if (alreadyExists) {
            skipped++;
            send({ type: 'lot', status: 'skipped', lotNumber: result.data.lotNumber, title: result.data.title, saleStatus: result.data.saleStatus });
            continue;
          }

          try {
            await dbPool.execute(
              `INSERT INTO \`auctionRecords\`
               (lotNumber, title, description, estimateLow, estimateHigh, soldPrice, currency,
                auctionHouse, auctionDate, saleStatus, sourceNote, imageUrl, imagesJson, batchId, importStatus)
               VALUES (?, ?, ?, ?, ?, ?, 'HKD', 'Spink', NULL, ?, ?, ?, ?, ?, 'pending')`,
              [
                result.data.lotNumber,
                result.data.title,
                result.data.description,
                result.data.estimateLow,
                result.data.estimateHigh,
                result.data.soldPrice ?? null,
                result.data.saleStatus,
                sourceNote,
                result.data.imageUrl,
                result.data.imagesJson,
                batchId,
              ]
            );
            existingUrls.add(sourceNote);
            imported++;
            send({ type: 'lot', status: 'imported', lotNumber: result.data.lotNumber, title: result.data.title, saleStatus: result.data.saleStatus, soldPrice: result.data.soldPrice });
          } catch {
            errors++;
            send({ type: 'lot', status: 'error', lotNumber: result.data.lotNumber, title: result.data.title, saleStatus: null });
          }
        }

        if (queue.length > 0) await sleep(80);
      }

      send({ type: 'complete', imported, skipped, errors, batchId, auctionTitle, discovered: discovered.size });
      res.end();
    } catch (err: any) {
      send({ type: 'error', message: err?.message ?? '未知錯誤' });
      res.end();
    }
  });


  // ── 共用 SSRF 防護：只 allow https + S3_ENDPOINT / S3_BUCKET host ──
  // 三個 og-image proxy（auction / product / community）共用呢個 fetch helper。
  async function fetchAllowlistedImage(rawUrl: string): Promise<
    | { ok: true; buf: Buffer; contentType: string }
    | { ok: false; status: number; reason: string }
  > {
    let target: URL;
    try { target = new URL(rawUrl); } catch { return { ok: false, status: 400, reason: 'Invalid URL' }; }
    if (target.protocol !== 'https:') return { ok: false, status: 400, reason: 'Invalid scheme' };
    const allowedHosts = new Set<string>();
    try {
      const ep = process.env.S3_ENDPOINT?.trim();
      if (ep) {
        const epUrl = new URL(ep.startsWith('http') ? ep : `https://${ep}`);
        allowedHosts.add(epUrl.hostname.toLowerCase());
        const bucket = process.env.S3_BUCKET?.trim();
        if (bucket) allowedHosts.add(`${bucket}.${epUrl.hostname}`.toLowerCase());
      }
    } catch { /* ignore */ }
    const host = target.hostname.toLowerCase();
    const allowed = Array.from(allowedHosts).some(h => host === h || host.endsWith(`.${h}`));
    if (!allowed) {
      console.warn(`[OG Image Proxy] Blocked non-allowlisted host: ${host}`);
      return { ok: false, status: 403, reason: 'Host not allowed' };
    }
    const r = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HongxCollections/1.0)' },
      redirect: 'error',
    });
    if (!r.ok) return { ok: false, status: r.status, reason: 'Image fetch failed' };
    const contentType = r.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return { ok: false, status: 415, reason: 'Not an image' };
    const buf = Buffer.from(await r.arrayBuffer());
    return { ok: true, buf, contentType };
  }

  async function cropToOgSize(buf: Buffer): Promise<Buffer> {
    try {
      const sharp = (await import('sharp')).default;
      return await sharp(buf)
        .resize(1200, 630, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      return buf;
    }
  }

  function sendImageResponse(res: any, contentType: string, buf: Buffer) {
    res.set({
      'Content-Type': contentType,
      'Content-Length': buf.length.toString(),
      'Cache-Control': 'public, max-age=3600',
    }).end(buf);
  }

  // ── OG 圖片代理（出售商品）：同上但對應 merchantProducts ──
  app.get('/api/og-image-product/:productId', async (req, res) => {
    try {
      const productId = parseInt(req.params.productId, 10);
      if (isNaN(productId) || productId <= 0) { res.status(400).send('Invalid product ID'); return; }
      const { getMerchantProduct } = await import('../db');
      const product = await getMerchantProduct(productId);
      // 私隱保護：hidden / sold 商品唔出 OG 圖
      if (!product || (product as { status?: string }).status !== 'active') {
        res.status(404).send('Not available'); return;
      }
      let firstImage = '';
      try {
        const imgs = (product as { images?: string | null } | null)?.images;
        if (imgs) {
          const arr = JSON.parse(imgs);
          if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') firstImage = arr[0];
        }
      } catch {}
      if (!firstImage) { res.status(404).send('No image'); return; }
      const result = await fetchAllowlistedImage(firstImage);
      if (!result.ok) { res.status(result.status).send(result.reason); return; }
      const cropped = await cropToOgSize(result.buf);
      sendImageResponse(res, 'image/jpeg', cropped);
    } catch (err) {
      console.error('[OG Image Product Proxy] Error:', err);
      res.status(500).send('Error');
    }
  });

  // ── OG 圖片代理（團拍場次）：對應 groupAuctionRounds.coverImage ──
  app.get('/api/og-image-group/:roundId', async (req, res) => {
    try {
      const roundId = parseInt(req.params.roundId, 10);
      if (isNaN(roundId) || roundId <= 0) { res.status(400).send('Invalid round ID'); return; }
      const { getGroupAuctionRoundForOg } = await import('../db');
      const round = await getGroupAuctionRoundForOg(roundId);
      if (!round || !round.coverImage || round.status === 'draft') {
        res.status(404).send('No image'); return;
      }
      const result = await fetchAllowlistedImage(round.coverImage);
      if (!result.ok) { res.status(result.status).send(result.reason); return; }
      const cropped = await cropToOgSize(result.buf);
      sendImageResponse(res, 'image/jpeg', cropped);
    } catch (err) {
      console.error('[OG Image Group Proxy] Error:', err);
      res.status(500).send('Error');
    }
  });

  // ── OG 圖片代理（商戶專場）：對應 merchantAuctionSessions.coverImage ──
  app.get('/api/og-image-session/:sessionId', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId, 10);
      if (isNaN(sessionId) || sessionId <= 0) { res.status(400).send('Invalid session ID'); return; }
      const { getSessionCoverImage } = await import('../db');
      const session = await getSessionCoverImage(sessionId);
      if (!session || !session.coverImage || session.status === 'draft') {
        res.status(404).send('No image'); return;
      }
      const result = await fetchAllowlistedImage(session.coverImage);
      if (!result.ok) { res.status(result.status).send(result.reason); return; }
      const cropped = await cropToOgSize(result.buf);
      sendImageResponse(res, 'image/jpeg', cropped);
    } catch (err) {
      console.error('[OG Image Session Proxy] Error:', err);
      res.status(500).send('Error');
    }
  });

  // ── OG 圖片代理（藏品社區）：對應 collectionPostImages ──
  app.get('/api/og-image-community/:postId', async (req, res) => {
    try {
      const postId = parseInt(req.params.postId, 10);
      if (isNaN(postId) || postId <= 0) { res.status(400).send('Invalid post ID'); return; }
      const { getCollectionPostForOg } = await import('../community');
      const post = await getCollectionPostForOg(postId);
      if (!post || !post.firstImageUrl) { res.status(404).send('No image'); return; }
      const result = await fetchAllowlistedImage(post.firstImageUrl);
      if (!result.ok) { res.status(result.status).send(result.reason); return; }
      const cropped = await cropToOgSize(result.buf);
      sendImageResponse(res, 'image/jpeg', cropped);
    } catch (err) {
      console.error('[OG Image Community Proxy] Error:', err);
      res.status(500).send('Error');
    }
  });

  // ── OG 圖片代理：讓 Facebook 爬蟲透過我們的伺服器拿圖片，繞過 S3 的 IP 限制 ──
  app.get('/api/og-image/:auctionId', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.auctionId, 10);
      if (isNaN(auctionId) || auctionId <= 0) { res.status(400).send('Invalid auction ID'); return; }
      const { getAuctionImages } = await import('../db');
      const images = await getAuctionImages(auctionId);
      if (!images || images.length === 0 || !images[0].imageUrl) { res.status(404).send('No image'); return; }
      const result = await fetchAllowlistedImage(images[0].imageUrl);
      if (!result.ok) { res.status(result.status).send(result.reason); return; }
      const cropped = await cropToOgSize(result.buf);
      sendImageResponse(res, 'image/jpeg', cropped);
    } catch (err) {
      console.error('[OG Image Proxy] Error:', err);
      res.status(500).send('Error');
    }
  });

  // Image proxy：server-side fetch 解決前端 canvas CORS 問題
  app.get('/api/img-proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url || !/^https?:\/\//.test(url)) { res.status(400).send('Bad url'); return; }
    try {
      const upstream = await fetch(url);
      const ct = upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch { res.status(502).send('Fetch failed'); }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ── 私隱政策 & 資料刪除（Facebook App 審核用，伺服器直接回傳 HTML）─────────
  // 必須用 Express 路由而非 React SPA，因 Facebook 機器人不執行 JavaScript
  app.get('/privacy', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>私隱政策 — 大BB錢幣店</title><style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#333;line-height:1.8}h1{color:#b45309}h2{color:#92400e;margin-top:2em}a{color:#b45309}</style></head><body>
<h1>私隱政策</h1>
<p>最後更新：2026年5月</p>
<p>大BB錢幣店（hongxcollections.com）尊重用戶私隱，本政策說明我們如何收集、使用及保護你的個人資料。</p>
<h2>收集的資料</h2>
<ul><li>帳戶資料：姓名、電郵地址、電話號碼、個人照片</li><li>登入方式：Google 或 Facebook 帳戶資料（僅限公開資料）</li><li>交易資料：出價紀錄、訂單、付款狀態</li><li>裝置資料：IP 地址、瀏覽器類型</li></ul>
<h2>使用目的</h2>
<ul><li>提供拍賣平台服務及處理交易</li><li>發送出價通知、得標通知及訂單確認</li><li>改善網站功能及用戶體驗</li></ul>
<h2>資料分享</h2>
<p>我們不會將你的個人資料出售予第三方。我們只會在法律要求或提供服務所需的情況下分享資料。</p>
<h2>資料保留</h2>
<p>我們保留帳戶資料，直至你要求刪除帳號為止。</p>
<h2>你的權利</h2>
<p>你可以隨時要求查閱、修改或刪除你的個人資料，請聯絡我們：<a href="mailto:ywkyee@gmail.com">ywkyee@gmail.com</a></p>
<h2>Facebook 登入</h2>
<p>如你使用 Facebook 登入，我們只會獲取你的公開資料（姓名及個人照片）。我們不會儲存你的 Facebook 密碼。你可以隨時於 Facebook 設定撤銷本平台的授權。</p>
<h2>聯絡我們</h2>
<p>如有任何私隱問題，請電郵至：<a href="mailto:ywkyee@gmail.com">ywkyee@gmail.com</a></p>
</body></html>`);
  });

  app.get('/data-deletion', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>資料刪除說明 — 大BB錢幣店</title><style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#333;line-height:1.8}h1{color:#b45309}h2{color:#92400e;margin-top:2em}.steps{background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:4px}</style></head><body>
<h1>用戶資料刪除說明</h1>
<p>大BB錢幣店（hongxcollections.com）遵守 Facebook 平台政策，為用戶提供資料刪除途徑。</p>
<h2>如何申請刪除你的資料</h2>
<div class="steps">
<p><strong>方法一：</strong>登入帳戶後，前往「個人資料」→「帳戶設定」，選擇「刪除帳號」。</p>
<p><strong>方法二：</strong>發送電郵至 <a href="mailto:ywkyee@gmail.com">ywkyee@gmail.com</a>，標題填寫「申請刪除資料」，並提供你的帳戶電郵或電話號碼。</p>
</div>
<h2>刪除範圍</h2>
<ul><li>你的帳戶資料（姓名、電郵、電話）</li><li>你的出價及交易紀錄</li><li>你的通知設定及偏好</li><li>你的 Facebook 登入關聯</li></ul>
<h2>處理時間</h2>
<p>我們將在收到申請後 30 日內完成資料刪除，並以電郵通知你。</p>
<h2>撤銷 Facebook 授權</h2>
<p>你可以隨時前往 <a href="https://www.facebook.com/settings?tab=applications" target="_blank">Facebook 設定 → 應用程式與網站</a>，移除「大BB錢幣店」的授權。移除後，你下次登入需要重新授權或使用其他方式登入。</p>
<h2>聯絡我們</h2>
<p>如有疑問，請電郵至：<a href="mailto:ywkyee@gmail.com">ywkyee@gmail.com</a></p>
</body></html>`);
  });

  // ── 動態 sitemap.xml ───────────────────────────────────────────────────────
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const { getDb } = await import('../db');
      const db = await getDb();
      const base = 'https://hongxcollections.com';
      const now = new Date().toISOString().split('T')[0];

      // Auctions (use correct camelCase column names as defined in schema)
      const auctionRows = await db!.execute(
        `SELECT id, updatedAt, createdAt FROM auctions
         WHERE status IN ('active','ended')
         ORDER BY updatedAt DESC LIMIT 2000`
      ) as [Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }>, unknown];
      const auctions = (Array.isArray(auctionRows[0]) ? auctionRows[0] : auctionRows) as Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }>;

      // Merchant products
      const productRows = await db!.execute(
        `SELECT id, updatedAt, createdAt FROM merchantProducts
         WHERE status = 'active'
         ORDER BY updatedAt DESC LIMIT 1000`
      ) as [Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }>, unknown];
      const products = (Array.isArray(productRows[0]) ? productRows[0] : productRows) as Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }>;

      // Collection square 帖文（藏品社區）
      let collectionPostsRows: Array<{ id: number; updatedAt: Date | null; createdAt: Date | null }> = [];
      try {
        const { listCollectionPostsForSitemap } = await import('../community');
        collectionPostsRows = await listCollectionPostsForSitemap();
      } catch (e) {
        console.error('[Sitemap] community list failed:', e);
      }

      const staticPages = [
        { loc: `${base}/`,                  changefreq: 'daily',   priority: '1.0', lastmod: now },
        { loc: `${base}/auctions`,          changefreq: 'hourly',  priority: '0.9', lastmod: now },
        { loc: `${base}/merchants`,         changefreq: 'daily',   priority: '0.7', lastmod: now },
        { loc: `${base}/plans`,             changefreq: 'monthly', priority: '0.5', lastmod: now },
        { loc: `${base}/collection-square`, changefreq: 'daily',   priority: '0.7', lastmod: now },
        { loc: `${base}/daily-challenge`,   changefreq: 'daily',   priority: '0.5', lastmod: now },
      ];

      const toEntry = (loc: string, lastmod: string, changefreq: string, priority: string) =>
        `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

      const staticEntries = staticPages.map(p => toEntry(p.loc, now, p.changefreq, p.priority));

      const auctionEntries = auctions.map((a) => {
        const lastmod = a.updatedAt
          ? new Date(a.updatedAt).toISOString().split('T')[0]
          : (a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : now);
        return toEntry(`${base}/auctions/${a.id}`, lastmod, 'hourly', '0.8');
      });

      const productEntries = products.map((p) => {
        const lastmod = p.updatedAt
          ? new Date(p.updatedAt).toISOString().split('T')[0]
          : (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : now);
        return toEntry(`${base}/merchant-products/${p.id}`, lastmod, 'weekly', '0.6');
      });

      const collectionEntries = collectionPostsRows.map((c) => {
        const lastmod = c.updatedAt
          ? new Date(c.updatedAt).toISOString().split('T')[0]
          : (c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : now);
        return toEntry(`${base}/collection-square/${c.id}`, lastmod, 'weekly', '0.6');
      });

      const allEntries = [...staticEntries, ...auctionEntries, ...productEntries, ...collectionEntries];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allEntries.join('\n')}\n</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(xml);
    } catch (err) {
      console.error('[Sitemap] Error generating sitemap:', err);
      res.status(500).send('Error generating sitemap');
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── 預熱：提前觸發 ensure*Table（避免首個用戶請求等待 DDL）──
  // （伺服器監聽 + 健康檢查已在 bootstrap 之前完成，見上方）
  setTimeout(async () => {
    try {
      const { listMerchantProducts, listApprovedMerchants, getActiveFeaturedListings, getAllProductOrders } = await import('../db');
      await Promise.allSettled([
        listMerchantProducts({ status: 'active' }),
        listApprovedMerchants(),
        getActiveFeaturedListings(),
        getAllProductOrders(), // triggers ensureProductOrdersTable (incl. finalPrice migration)
      ]);
      console.log('[Warmup] ensure*Table pre-run complete');
    } catch (err) {
      console.error('[Warmup] Pre-run error (non-fatal):', err);
    }
  }, 3_000); // 伺服器啟動 3 秒後執行

  // Ending-soon notification scheduler: poll every 5 minutes
  setInterval(async () => {
    try {
      const settings = await getNotificationSettings();
      if (!settings || !settings.enableEndingSoon) return;
      const auctions = await getActiveAuctionsEndingSoon(settings.endingSoonMinutes);
      const origin = ENV.siteUrl || '';
      for (const auction of auctions) {
        await notifyEndingSoon(auction.id, origin);
      }
    } catch (err) {
      console.error('[Scheduler] Ending-soon check error:', err);
    }
  }, 5 * 60 * 1000);

  // Loyalty 每日維護（試用到期 + 長期無活動降級）— 每 6 小時跑一次
  setInterval(async () => {
    try {
      const { runDailyLoyaltyMaintenance } = await import('../loyalty');
      await runDailyLoyaltyMaintenance();
    } catch (err) {
      console.error('[Scheduler] Loyalty maintenance error:', err);
    }
  }, 6 * 60 * 60 * 1000);

  // 排價過期 — 每 15 分鐘跑一次
  setInterval(async () => {
    try {
      const { expireStaleOffers } = await import('../db');
      await expireStaleOffers();
    } catch (err) {
      console.error('[Scheduler] expireStaleOffers error:', err);
    }
  }, 15 * 60 * 1000);

  // 商戶專場自動結束 — 每 5 分鐘 mark endAt 過咗嘅 published session 為 ended
  setInterval(async () => {
    try {
      const { getDb } = await import('../db');
      const { merchantAuctionSessions } = await import('../../drizzle/schema');
      const { and, eq, lte } = await import('drizzle-orm');
      const db = await getDb();
      // 先攞要結束嘅 session id list
      const toEnd = await db.select({ id: merchantAuctionSessions.id })
        .from(merchantAuctionSessions)
        .where(and(
          eq(merchantAuctionSessions.status, 'published'),
          lte(merchantAuctionSessions.endAt, new Date()),
        ));
      const result: any = await db.update(merchantAuctionSessions)
        .set({ status: 'ended' })
        .where(and(
          eq(merchantAuctionSessions.status, 'published'),
          lte(merchantAuctionSessions.endAt, new Date()),
        ));
      const affected = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
      if (affected > 0) console.log(`[Scheduler] Auto-ended ${affected} merchant auction session(s)`);
      if (toEnd.length > 0) {
        const { notifyCombinedSessionWon } = await import('../auctions');
        const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
        const { sql: sqlOp } = await import('drizzle-orm');
        // 🔴 同 manual end 對齊：每 ended session 都要連帶 end 場內所有 active auctions
        // 否則 auction.status='active' 一直停留，商戶後台拍賣訂單（filter status='ended'）會見唔到
        for (const s of toEnd) {
          try {
            await db.execute(sqlOp.raw(
              `UPDATE auctions a JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id ` +
              `SET a.status='ended', a.endTime=NOW() ` +
              `WHERE sit.sessionId=${s.id} AND a.status='active'`
            ));
            // 有 highestBidder 嘅 → 初始化 auctionOrderStatus + paymentStatus（兩個訂單系統都覆蓋）
            await db.execute(sqlOp.raw(
              `UPDATE auctions a JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id ` +
              `SET a.auctionOrderStatus='pending' ` +
              `WHERE sit.sessionId=${s.id} AND a.status='ended' AND a.highestBidderId IS NOT NULL AND a.auctionOrderStatus IS NULL`
            ));
            await db.execute(sqlOp.raw(
              `UPDATE auctions a JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id ` +
              `SET a.paymentStatus='pending_payment' ` +
              `WHERE sit.sessionId=${s.id} AND a.status='ended' AND a.highestBidderId IS NOT NULL AND a.paymentStatus IS NULL`
            ));
          } catch (e) {
            console.error(`[Scheduler] Failed to end session ${s.id} auctions:`, e);
          }
        }
        for (const s of toEnd) {
          // 原子聲明發信權：只有第一個成功 update combinedWonEmailSentAt 嘅 worker 先發信
          try {
            const claim: any = await db.execute(sqlOp.raw(
              `UPDATE merchantAuctionSessions SET combinedWonEmailSentAt=NOW() WHERE id=${s.id} AND combinedWonEmailSentAt IS NULL`
            ));
            const claimAffected = claim?.[0]?.affectedRows ?? claim?.affectedRows ?? 0;
            if (claimAffected > 0) {
              notifyCombinedSessionWon(s.id, origin).catch(err =>
                console.error(`[Scheduler] Combined invoice failed for session ${s.id}:`, err));
            }
          } catch (e) {
            console.error(`[Scheduler] Combined invoice claim failed for session ${s.id}:`, e);
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler] auto-end sessions error:', err);
    }
  }, 5 * 60 * 1000);

  // ── 團拍場次自動結拍（每 5 分鐘掃描 endAt < now 且 status='published'）───────
  setInterval(async () => {
    try {
      const db = await (await import('../db')).getDb();
      if (!db) return;
      const { groupAuctionRounds, groupAuctionItems } = await import('../../drizzle/schema');
      const { eq, and, lt, inArray } = await import('drizzle-orm');
      const { autoDeductGroupAuctionCommission } = await import('../db');

      const now = new Date();
      const toEnd = await db
        .select({ id: groupAuctionRounds.id })
        .from(groupAuctionRounds)
        .where(
          and(
            eq(groupAuctionRounds.status, 'published'),
            lt(groupAuctionRounds.endAt, now)
          )
        );

      if (toEnd.length === 0) return;

      const ids = toEnd.map(r => r.id);

      // 標記場次為 ended
      await db.update(groupAuctionRounds)
        .set({ status: 'ended' })
        .where(inArray(groupAuctionRounds.id, ids));

      // 每個場次：active 商品按有否出價標 sold / unsold
      for (const { id } of toEnd) {
        try {
          const items = await db
            .select({ id: groupAuctionItems.id, winnerId: groupAuctionItems.winnerId, status: groupAuctionItems.status })
            .from(groupAuctionItems)
            .where(and(eq(groupAuctionItems.roundId, id), eq(groupAuctionItems.status, 'active')));

          for (const item of items) {
            await db.update(groupAuctionItems)
              .set({ status: item.winnerId ? 'sold' : 'unsold' })
              .where(eq(groupAuctionItems.id, item.id));
          }

          // 扣傭金（冪等，重複跑安全）
          await autoDeductGroupAuctionCommission(id).catch(err =>
            console.error(`[Scheduler] GroupAuction commission deduction failed for round ${id}:`, err)
          );

          console.log(`[Scheduler] Auto-ended group auction round #${id}`);
        } catch (e) {
          console.error(`[Scheduler] Failed to process group auction round ${id}:`, e);
        }
      }
    } catch (err) {
      console.error('[Scheduler] auto-end group auction rounds error:', err);
    }
  }, 5 * 60 * 1000);


  // 啟動後 30 秒跑一次初始化
  setTimeout(async () => {
    try {
      const { runDailyLoyaltyMaintenance } = await import('../loyalty');
      await runDailyLoyaltyMaintenance();
    } catch (err) {
      console.error('[Scheduler] Initial loyalty maintenance error:', err);
    }
  }, 30 * 1000);

  // ── 資料庫定時備份（每日 HKT 02:00）──
  try {
    const { startBackupCron } = await import('../backup');
    startBackupCron();
  } catch (err) {
    console.error('[Scheduler] Failed to start backup cron:', err);
  }
}

// ── 全域崩潰防護：阻止未處理錯誤令整個進程死亡 ──────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception (server keeps running):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection (server keeps running):', reason);
});

// ── 優雅關機（Railway SIGTERM）────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[Process] SIGTERM received — shutting down gracefully');
  process.exit(0);
});

startServer().catch((err) => {
  console.error('[Process] Fatal startup error:', err);
  process.exit(1);
});
