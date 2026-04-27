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

  // One-time repair: initialise remainingQuota for active subscriptions
  await alter(`
    UPDATE user_subscriptions us
    JOIN subscription_plans sp ON us.planId = sp.id
    SET us.remainingQuota = sp.maxListings
    WHERE us.status = 'active'
      AND sp.maxListings > 0
      AND us.remainingQuota = 0
  `, 'Repaired remainingQuota for active subscriptions');

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

  // 新增 users.memberLevelExpiresAt 欄位（Loyalty 試用到期）
  await alter(
    `ALTER TABLE \`users\` ADD COLUMN \`memberLevelExpiresAt\` timestamp NULL`,
    'Ensured users.memberLevelExpiresAt column'
  );

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
  const server = createServer(app);

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
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Dev/Sandbox mock login (non-production only)
  registerDevLoginRoutes(app);
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


  // ── OG 圖片代理：讓 Facebook 爬蟲透過我們的伺服器拿圖片，繞過 S3 的 IP 限制 ──
  app.get('/api/og-image/:auctionId', async (req, res) => {
    try {
      const auctionId = parseInt(req.params.auctionId, 10);
      if (isNaN(auctionId) || auctionId <= 0) { res.status(400).send('Invalid auction ID'); return; }
      const { getAuctionImages } = await import('../db');
      const images = await getAuctionImages(auctionId);
      if (!images || images.length === 0 || !images[0].imageUrl) { res.status(404).send('No image'); return; }
      const s3Res = await fetch(images[0].imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HongxCollections/1.0)' },
      });
      if (!s3Res.ok) { res.status(s3Res.status).send('Image fetch failed'); return; }
      const buf = Buffer.from(await s3Res.arrayBuffer());
      const contentType = s3Res.headers.get('content-type') || 'image/jpeg';
      res.set({
        'Content-Type': contentType,
        'Content-Length': buf.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      }).end(buf);
    } catch (err) {
      console.error('[OG Image Proxy] Error:', err);
      res.status(500).send('Error');
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

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
