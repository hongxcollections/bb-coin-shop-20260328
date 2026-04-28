import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { getAuctionById, getAuctionImages } from "../db";
import { getCurrencySymbol } from "./currency";

/**
 * Format auction end time for display in OG description.
 * Output example: "2026年4月16日 (三) 晚上11:00"
 */
function formatEndTime(endTime: Date): string {
  const d = new Date(endTime);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = weekdays[d.getDay()];
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");

  let period: string;
  let displayHour: number;
  if (hours < 6) {
    period = "凌晨";
    displayHour = hours;
  } else if (hours < 12) {
    period = "上午";
    displayHour = hours;
  } else if (hours === 12) {
    period = "中午";
    displayHour = 12;
  } else if (hours < 18) {
    period = "下午";
    displayHour = hours - 12;
  } else {
    period = "晚上";
    displayHour = hours - 12;
  }

  return `${year}年${month}月${day}日 (${weekday}) ${period}${displayHour}:${minutes}`;
}

/**
 * Inject Open Graph meta tags into HTML for auction detail pages.
 * This enables rich previews when sharing auction links on social media.
 *
 * Key decisions:
 * - og:site_name = "大BB錢幣店" so the shop name always appears
 * - og:title = auction title + price (concise)
 * - og:description includes end time and call-to-action
 * - og:url is included (required by Facebook for proper link preview)
 * - og:image includes width/height hints for high-quality rendering
 */
/**
 * Inject page-specific meta tags for static pages (auctions list, merchants, plans).
 * Returns modified HTML or null if not a known static page.
 */
function injectStaticPageMeta(html: string, reqPath: string, base: string): string | null {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const pages: Record<string, { title: string; description: string; canonical: string }> = {
    "/auctions": {
      title: "錢幣拍賣｜所有拍品 — hongxcollections",
      description: "瀏覽香港最齊全的錢幣拍賣列表，包括古幣、評級幣、紀念幣、舊紙幣等，免費登記即可出價競投。",
      canonical: `${base}/auctions`,
    },
    "/merchants": {
      title: "錢幣商戶市集 — hongxcollections",
      description: "香港錢幣商戶一覽，選購古幣、紀念幣、評級幣及各類收藏品，安全可靠，直接與商戶交易。",
      canonical: `${base}/merchants`,
    },
    "/plans": {
      title: "會員及商戶方案 — hongxcollections",
      description: "了解 hongxcollections 各級會員及商戶訂閱方案，享受更多競投優惠、優先預覽及商戶刊登功能。",
      canonical: `${base}/plans`,
    },
  };

  const page = pages[reqPath];
  if (!page) return null;

  const metaTags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${esc(page.canonical)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(page.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="hongxcollections" />`,
    `<meta property="og:locale" content="zh_HK" />`,
  ].join("\n    ");

  let result = html
    .replace(/<title>[^<]*<\/title>/gi, "")
    .replace(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*\/?>/gi, "")
    .replace(/<meta\s+(?:name|property)="description"[^>]*\/?>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*\/?>/gi, "")
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  result = result.replace("</head>", `    ${metaTags}\n  </head>`);
  return result;
}

async function injectOgMeta(html: string, reqPath: string, protocol: string, host: string): Promise<string | null> {
  const auctionMatch = reqPath.match(/^\/auctions\/(\d+)$/);
  if (!auctionMatch) return null;

  try {
    const auctionId = parseInt(auctionMatch[1], 10);
    const auction = await getAuctionById(auctionId);
    if (!auction) return null;

    const images = await getAuctionImages(auctionId);
    const hasImage = images.length > 0 && !!images[0].imageUrl;
    // Facebook 爬蟲 IP 被 S3 bucket policy 阻擋，直接用 S3 URL 會 403。
    // 改用伺服器代理拉圖再轉發，讓 Facebook 始終能取得圖片。
    const ogImageUrl = hasImage
      ? `${protocol}://${host}/api/og-image/${auctionId}`
      : "";
    const imgMime = "image/jpeg";

    const currSymbol = getCurrencySymbol((auction as { currency?: string }).currency ?? "HKD");
    const startPrice = Number(auction.startingPrice).toLocaleString();
    const currPrice = Number(auction.currentPrice).toLocaleString();
    const endTimeStr = formatEndTime(new Date(auction.endTime));

    // Facebook large-image preview ONLY shows og:title (not description/site_name).
    // So we pack all key info into og:title for maximum visibility.
    const ogTitle = `${auction.title} ｜ 起拍 ${currSymbol}${startPrice}｜結標：${endTimeStr}`;
    const ogDesc = `【大BB錢幣店】${auction.title}\n起拍價：${currSymbol}${startPrice}｜目前出價：${currSymbol}${currPrice}\n結標：${endTimeStr}\n快來競拍！`;
    const fullUrl = `${protocol}://${host}${reqPath}`;

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // JSON-LD structured data for the auction (AuctionEvent + Product)
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": auction.title,
      "description": ogDesc,
      "url": fullUrl,
      ...(ogImageUrl ? { "image": ogImageUrl } : {}),
      "offers": {
        "@type": "Offer",
        "priceCurrency": (auction as { currency?: string }).currency ?? "HKD",
        "price": Number(auction.currentPrice).toFixed(2),
        "availability": auction.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
        "url": fullUrl,
        "seller": {
          "@type": "Organization",
          "name": "hongxcollections 大BB錢幣店"
        }
      }
    });

    const ogMeta = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="大BB錢幣店" />`,
      `<meta property="og:title" content="${esc(ogTitle)}" />`,
      `<meta property="og:description" content="${esc(ogDesc)}" />`,
      `<meta property="og:url" content="${esc(fullUrl)}" />`,
      `<meta property="og:locale" content="zh_HK" />`,
      ogImageUrl ? `<meta property="og:image" content="${esc(ogImageUrl)}" />` : "",
      ogImageUrl ? `<meta property="og:image:secure_url" content="${esc(ogImageUrl)}" />` : "",
      ogImageUrl ? `<meta property="og:image:type" content="${imgMime}" />` : "",
      ogImageUrl ? `<meta property="og:image:width" content="1200" />` : "",
      ogImageUrl ? `<meta property="og:image:height" content="630" />` : "",
      `<meta name="twitter:card" content="${ogImageUrl ? "summary_large_image" : "summary"}" />`,
      `<meta name="twitter:title" content="${esc(ogTitle)}" />`,
      `<meta name="twitter:description" content="${esc(ogDesc)}" />`,
      ogImageUrl ? `<meta name="twitter:image" content="${esc(ogImageUrl)}" />` : "",
      `<link rel="canonical" href="${esc(fullUrl)}" />`,
      `<title>${esc(ogTitle)}</title>`,
      `<script type="application/ld+json">${jsonLd}</script>`,
    ].filter(Boolean).join("\n    ");

    // Strip ALL existing title, og:, twitter:, canonical, description, ld+json tags from index.html
    // before injecting auction-specific ones.
    let result = html
      .replace(/<title>[^<]*<\/title>/gi, "")
      .replace(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*\/?>/gi, "")
      .replace(/<meta\s+(?:name|property)="description"[^>]*\/?>/gi, "")
      .replace(/<link\s+rel="canonical"[^>]*\/?>/gi, "")
      .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
    result = result.replace("</head>", `    ${ogMeta}\n  </head>`);
    console.log(`[OG Meta] Injected for auction ${auctionId}: title="${ogTitle}" imageUrl="${ogImageUrl}"`);
    return result;
  } catch (err) {
    console.error("[OG Meta] Error generating OG tags:", err);
    return null;
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      // Inject OG meta for social media bots (dev mode)
      const forwardedProto = req.headers["x-forwarded-proto"];
      const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : req.protocol;
      const host = req.get("host") || "";
      const base = `${protocol}://${host}`;

      // Try auction-specific OG injection first, then static page meta
      const ogHtml = await injectOgMeta(template, req.path, protocol, host)
        ?? injectStaticPageMeta(template, req.path, base);
      if (ogHtml) {
        // For bots: serve injected HTML directly (skip Vite transform to preserve tags)
        const ua = req.headers["user-agent"] ?? "";
        const isBot = /facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Discordbot|TelegramBot|Slackbot|ia_archiver|msnbot|googlebot|bingbot/i.test(ua);
        if (isBot) {
          res.status(200).set({ "Content-Type": "text/html" }).end(ogHtml);
          return;
        }
      }

      const page = await vite.transformIndexHtml(url, ogHtml ?? template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In Railway, dist/index.js is the entry point.
  // The static files are in dist/public.
  // We try several common paths to ensure we find the public directory.
  const possiblePaths = [
    path.resolve(import.meta.dirname, "public"), // Relative to dist/index.js
    path.resolve(process.cwd(), "dist", "public"), // Relative to project root
    path.resolve(process.cwd(), "public"),
  ];

  let distPath = "";
  for (const p of possiblePaths) {
    console.log(`[Static] Checking path: ${p}`);
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      console.log(`[Static] Found valid public directory at: ${distPath}`);
      break;
    }
  }

  if (!distPath) {
    distPath = possiblePaths[0];
    console.error(
      `[Static] ERROR: Could not find a valid build directory with index.html. Defaulting to: ${distPath}`
    );
  }

  // Workaround for Facebook crawler 403 bug (known issue since Jan 2026).
  // Facebook's crawler expects robots.txt to support Range requests and return 206.
  // When robots.txt returns 200 instead of 206, Facebook incorrectly reports 403.
  // This handler explicitly serves robots.txt with Range request support.
  app.get("/robots.txt", (req, res) => {
    const robotsPath = path.resolve(distPath, "robots.txt");
    if (!fs.existsSync(robotsPath)) {
      // Serve a default permissive robots.txt if file doesn't exist
      const defaultRobots = "User-agent: *\nAllow: /\n";
      const buf = Buffer.from(defaultRobots, "utf-8");
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : buf.length - 1;
          const chunk = buf.subarray(start, end + 1);
          res.status(206).set({
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Range": `bytes ${start}-${end}/${buf.length}`,
            "Content-Length": chunk.length.toString(),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
            "Surrogate-Control": "no-store",
          }).end(chunk);
          return;
        }
      }
      res.status(200).set({
        "Content-Type": "text/plain; charset=utf-8",
        "Accept-Ranges": "bytes",
        "Content-Length": buf.length.toString(),
        "Cache-Control": "no-store",
        "Surrogate-Control": "no-store",
      }).end(buf);
      return;
    }

    const content = fs.readFileSync(robotsPath);
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : content.length - 1;
        const chunk = content.subarray(start, end + 1);
        res.status(206).set({
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Range": `bytes ${start}-${end}/${content.length}`,
          "Content-Length": chunk.length.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
          "Surrogate-Control": "no-store",
        }).end(chunk);
        return;
      }
    }
    res.status(200).set({
      "Content-Type": "text/plain; charset=utf-8",
      "Accept-Ranges": "bytes",
      "Content-Length": content.length.toString(),
      "Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
    }).end(content);
  });

  app.use(express.static(distPath));

  // For all non-API routes, serve index.html to support React Router client-side routing
  app.use(async (req, res, next) => {
    // Let API routes fall through to their handlers
    if (req.path.startsWith("/api")) {
      return next();
    }
    
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.error(`[Static] index.html not found at: ${indexPath}`);
      res.status(500).send("Server error: index.html not found");
      return;
    }

    // Try to inject OG meta for auction detail pages
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0].trim() : req.protocol;
    const host = req.get("host") || "";

    // Prevent Railway/Fastly CDN from caching HTML responses.
    // A cached 403 during deployment would otherwise be served to Facebook's crawler.
    const noCacheHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Surrogate-Control": "no-store",
      "Pragma": "no-cache",
    };

    const base = `${protocol}://${host}`;
    let html = await fs.promises.readFile(indexPath, "utf-8");
    const ogHtml = await injectOgMeta(html, req.path, protocol, host)
      ?? injectStaticPageMeta(html, req.path, base);
    if (ogHtml) {
      res.status(200).set({ "Content-Type": "text/html", ...noCacheHeaders }).end(ogHtml);
      return;
    }

    res.set(noCacheHeaders).sendFile(indexPath, (err) => {
      if (err && !res.headersSent) {
        console.error("[Static] sendFile error:", err);
        res.status(500).send("Server error");
      }
    });
  });
}
