import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import path from "path";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerAuthRoutes } from "./authRoutes";
import { registerDevLoginRoutes } from "./devLogin";
import { registerWebhookRoutes } from "../webhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { notifyEndingSoon } from "../auctions";
import { getActiveAuctionsEndingSoon, getNotificationSettings } from "../db";

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
    });

    const check = async (table: string, column: string): Promise<boolean> => {
      const [rows]: any = await pool.execute(
        `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows[0].cnt > 0;
    };

    if (!(await check('seller_deposits', 'warningDeposit'))) {
      await pool.execute(
        'ALTER TABLE `seller_deposits` ADD COLUMN `warningDeposit` decimal(12,2) NOT NULL DEFAULT 1000.00'
      );
      console.log('[Bootstrap] Added warningDeposit to seller_deposits');
    }

    if (!(await check('user_subscriptions', 'remainingQuota'))) {
      await pool.execute(
        'ALTER TABLE `user_subscriptions` ADD COLUMN `remainingQuota` int NOT NULL DEFAULT 0'
      );
      console.log('[Bootstrap] Added remainingQuota to user_subscriptions');
    }

    // merchantApplications: ensure all columns exist (production may be behind UAT)
    if (!(await check('merchantApplications', 'contactName'))) {
      await pool.execute(
        'ALTER TABLE `merchantApplications` ADD COLUMN `contactName` varchar(100) NULL AFTER `userId`'
      );
      console.log('[Bootstrap] Added contactName to merchantApplications');
    }
    if (!(await check('merchantApplications', 'merchantIcon'))) {
      await pool.execute(
        'ALTER TABLE `merchantApplications` ADD COLUMN `merchantIcon` varchar(500) NULL AFTER `yearsExperience`'
      );
      console.log('[Bootstrap] Added merchantIcon to merchantApplications');
    }

    // One-time repair: initialise remainingQuota for active subscriptions
    // that still have 0 because approveSubscription never set it.
    // Safe: no quota was ever properly deducted before this fix.
    await pool.execute(`
      UPDATE user_subscriptions us
      JOIN subscription_plans sp ON us.planId = sp.id
      SET us.remainingQuota = sp.maxListings
      WHERE us.status = 'active'
        AND sp.maxListings > 0
        AND us.remainingQuota = 0
    `);
    console.log('[Bootstrap] Repaired remainingQuota for active subscriptions');

    await pool.execute(`CREATE TABLE IF NOT EXISTS \`commissionRefundRequests\` (
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
    )`);
    console.log('[Bootstrap] Schema bootstrap completed');

    await pool.end();
  } catch (error) {
    console.warn('[Bootstrap] Bootstrap warning (continuing):', (error as Error).message);
  }
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
  await bootstrapMissingColumns();
  await runMigrations();
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Email/phone + password auth routes
  registerAuthRoutes(app);

  // Dev/Sandbox mock login (non-production only)
  registerDevLoginRoutes(app);
  // Facebook Groups Watcher webhook
  registerWebhookRoutes(app);
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Ending-soon notification scheduler: poll every 5 minutes
  setInterval(async () => {
    try {
      const settings = await getNotificationSettings();
      if (!settings || !settings.enableEndingSoon) return;
      const auctions = await getActiveAuctionsEndingSoon(settings.endingSoonMinutes);
      const origin = process.env.VITE_OAUTH_PORTAL_URL
        ? new URL(process.env.VITE_OAUTH_PORTAL_URL).origin
        : '';
      for (const auction of auctions) {
        await notifyEndingSoon(auction.id, origin);
      }
    } catch (err) {
      console.error('[Scheduler] Ending-soon check error:', err);
    }
  }, 5 * 60 * 1000);
}

startServer().catch(console.error);
