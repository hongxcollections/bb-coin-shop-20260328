import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { getAuctionById, getAuctionImages, getMerchantProduct } from "../db";
import { getCollectionPostForOg } from "../community";
import { getCurrencySymbol } from "./currency";

/**
 * Format auction end time for display in OG description.
 * Output example: "2026年4月16日 (三) 晚上11:00"
 *
 * IMPORTANT: 必須強制用 Asia/Hong_Kong 時區。Railway/Linux server 預設用 UTC，
 * 直接用 d.getHours() 會將 23:00 HKT 顯示成 15:00 (下午3:00)。
 */
function formatEndTime(endTime: Date): string {
  const d = new Date(endTime);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  // 用 Intl.DateTimeFormat 攞返 HKT 嘅 parts
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  // 由 Intl 直接攞 HKT 嘅 weekday（en-US short：Sun/Mon/Tue/Wed/Thu/Fri/Sat）
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdays[wkMap[get("weekday")] ?? 0];
  let hours = parseInt(get("hour"), 10);
  if (hours === 24) hours = 0; // Intl 有時返 "24" 代表午夜
  const minutes = get("minute");

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
 * - og:site_name = "hongxcollections" so the site name always appears
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

  let page = pages[reqPath];
  // /merchants/:userId — 商戶店鋪頁（WeChat / 瀏覽器 tab title 用）
  if (!page && /^\/merchants\/\d+\/?$/.test(reqPath)) {
    page = {
      title: "hongxcollections｜錢幣 · 競投 · 即時成交",
      description: "香港錢幣商戶店鋪 — 古幣、紀念幣、評級幣、舊紙幣，即時競投，安全交收。",
      canonical: `${base}${reqPath.replace(/\/$/, "")}`,
    };
  }
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
  // 一定要 inject 喺 <meta name="viewport"> 之後 / <script>/<link> 之前。
  // Facebook OG parser 撞到 <script type="module"> 或 <link> 之後嘅 og 標籤會
  // 直接忽略（佢假設 metadata 一定喺 head 頂部）。原本 inject 喺 </head> 前
  // 會排喺所有 script/link 之後 → FB silently drop og:title / og:description。
  const viewportRe = /(<meta\s+name="viewport"[^>]*\/?>)/i;
  // 用 function replacement 避免 String.replace `$1` `$&` substitution
  // （metaTags 入面如有 `$10` 之類會被當 capture group reference 替換）
  result = viewportRe.test(result)
    ? result.replace(viewportRe, (m) => `${m}\n    ${metaTags}`)
    : result.replace("</head>", () => `    ${metaTags}\n  </head>`);
  return result;
}

async function injectSessionOgMeta(html: string, reqPath: string, protocol: string, host: string): Promise<string | null> {
  const m = reqPath.match(/^\/s\/(\d+)\/([A-Za-z0-9\-_\u4e00-\u9fa5]{1,80})$/);
  if (!m) return null;
  try {
    const merchantUserId = parseInt(m[1], 10);
    const slug = m[2];
    const { getDb } = await import("../db");
    const { merchantAuctionSessions } = await import("../../drizzle/schema");
    const { and, eq } = await import("drizzle-orm");
    const db = await getDb();
    const [session] = await db.select().from(merchantAuctionSessions)
      .where(and(eq(merchantAuctionSessions.merchantUserId, merchantUserId), eq(merchantAuctionSessions.slug, slug)))
      .limit(1);
    if (!session || session.status === "draft") return null;

    const stripHtml = (s: string) => s.replace(/<[^>]*>?/g, "").replace(/&lt;[^&]*?&gt;/gi, "");
    const rawTitle = stripHtml(session.title).replace(/\s+/g, " ").trim();
    const titleForOg = rawTitle.length > 55 ? rawTitle.slice(0, 55) + "…" : rawTitle;
    const ogTitle = `${titleForOg} | hongxcollections`;
    const endStr = formatEndTime(new Date(session.endAt));
    const ogDesc = `專場拍賣 | ${rawTitle} | ${session.itemCount} 件商品 | 結束 ${endStr} | 香港錢幣拍賣 hongxcollections`;
    const fullUrl = `${protocol}://${host}${reqPath}`;
    const ogImageUrl = (session.coverImage || "").trim();
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const ogMeta = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="hongxcollections" />`,
      `<meta property="og:title" content="${esc(ogTitle)}" />`,
      `<meta property="og:description" content="${esc(ogDesc)}" />`,
      `<meta property="og:url" content="${esc(fullUrl)}" />`,
      `<meta property="og:locale" content="zh_HK" />`,
      ogImageUrl ? `<meta property="og:image" content="${esc(ogImageUrl)}" />` : "",
      ogImageUrl ? `<meta property="og:image:secure_url" content="${esc(ogImageUrl)}" />` : "",
      `<meta name="twitter:card" content="${ogImageUrl ? "summary_large_image" : "summary"}" />`,
      `<meta name="twitter:title" content="${esc(ogTitle)}" />`,
      `<meta name="twitter:description" content="${esc(ogDesc)}" />`,
      ogImageUrl ? `<meta name="twitter:image" content="${esc(ogImageUrl)}" />` : "",
      `<link rel="canonical" href="${esc(fullUrl)}" />`,
      `<title>${esc(ogTitle)}</title>`,
    ].filter(Boolean).join("\n    ");

    let result = html
      .replace(/<title>[^<]*<\/title>/gi, "")
      .replace(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*\/?>/gi, "")
      .replace(/<meta\s+(?:name|property)="description"[^>]*\/?>/gi, "")
      .replace(/<link\s+rel="canonical"[^>]*\/?>/gi, "");
    const viewportRe = /(<meta\s+name="viewport"[^>]*\/?>)/i;
    // Use function callback to avoid `$1`/`$&` substitution if user's title contains $-tokens
    result = viewportRe.test(result)
      ? result.replace(viewportRe, (mm) => `${mm}\n    ${ogMeta}`)
      : result.replace("</head>", () => `    ${ogMeta}\n  </head>`);
    console.log(`[OG Meta] Injected for session /s/${merchantUserId}/${slug}: title="${ogTitle}"`);
    return result;
  } catch (err) {
    console.error("[OG Meta] Session inject error:", err);
    return null;
  }
}

async function injectOgMeta(html: string, reqPath: string, protocol: string, host: string): Promise<string | null> {
  // Merchant auction session 公開頁
  const sessionInjected = await injectSessionOgMeta(html, reqPath, protocol, host);
  if (sessionInjected) return sessionInjected;

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

    const stripHtmlA = (s: string) => s.replace(/<[^>]*>?/g, "").replace(/&lt;[^&]*?&gt;/gi, "");
    const rawTitle = stripHtmlA(auction.title).replace(/\s+/g, " ").trim();
    const titleForOg = rawTitle.length > 25 ? rawTitle.slice(0, 25) + "…" : rawTitle;
    const endDate = new Date(auction.endTime);
    const endMonthDay = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;
    const ogTitle = `${titleForOg} | 起拍${currSymbol}${startPrice} | 目前${currSymbol}${currPrice} | 結標${endMonthDay} | hongxcollections.com`;
    const ogDesc = `${rawTitle} | 起拍 ${currSymbol}${startPrice} | 目前出價 ${currSymbol}${currPrice} | 結標 ${endTimeStr} | 香港錢幣拍賣 hongxcollections`;
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
          "name": "hongxcollections"
        }
      }
    });

    const ogMeta = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="hongxcollections" />`,
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
    const viewportRe = /(<meta\s+name="viewport"[^>]*\/?>)/i;
    // 用 function replacement 避免 String.replace `$1` substitution（ogMeta 入面 `$10` 之類會被當 capture group reference）
    result = viewportRe.test(result)
      ? result.replace(viewportRe, (m) => `${m}\n    ${ogMeta}`)
      : result.replace("</head>", () => `    ${ogMeta}\n  </head>`);
    console.log(`[OG Meta] Injected for auction ${auctionId}: title="${ogTitle}" imageUrl="${ogImageUrl}"`);
    return result;
  } catch (err) {
    console.error("[OG Meta] Error generating OG tags:", err);
    return null;
  }
}

/**
 * Inject Open Graph meta tags into HTML for merchant product detail pages.
 * Mirrors injectOgMeta() above but for /merchant-products/:id URLs.
 * Independent function so existing auction OG / robots / bot code remains untouched.
 */
async function injectProductOgMeta(html: string, reqPath: string, protocol: string, host: string): Promise<string | null> {
  const productMatch = reqPath.match(/^\/merchant-products\/(\d+)$/);
  if (!productMatch) return null;

  try {
    const productId = parseInt(productMatch[1], 10);
    const product = await getMerchantProduct(productId);
    if (!product) return null;
    // 私隱保護：hidden / sold 商品唔出 product OG meta（fall back 到 default index.html meta）
    if ((product as { status?: string }).status !== 'active') return null;

    let firstImage = "";
    try {
      const imgs = (product as { images?: string | null }).images;
      if (imgs) {
        const arr = JSON.parse(imgs);
        if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") firstImage = arr[0];
      }
    } catch {}

    const ogImageUrl = firstImage
      ? `${protocol}://${host}/api/og-image-product/${productId}`
      : "";
    const imgMime = "image/jpeg";

    const currency = (product as { currency?: string }).currency ?? "HKD";
    const currSymbol = getCurrencySymbol(currency);
    const price = Number((product as { price: string | number }).price).toLocaleString();
    const merchantName = (product as { merchantName?: string }).merchantName ?? "";

    const stripHtml = (s: string) => s.replace(/<[^>]*>?/g, "").replace(/&lt;[^&]*?&gt;/gi, "");
    const rawTitle = stripHtml(product.title).replace(/\s+/g, " ").trim();
    const titleForOg = rawTitle.length > 25 ? rawTitle.slice(0, 25) + "…" : rawTitle;
    const ogTitle = `${titleForOg} | ${currSymbol}${price} | hongxcollections.com`;
    const rawDesc = stripHtml((product as { description?: string | null }).description?.toString() ?? "").replace(/\s+/g, " ").trim();
    const shortDesc = rawDesc.length > 100 ? rawDesc.slice(0, 100) + "…" : rawDesc;
    const ogDesc = `${rawTitle} | 出售價 ${currSymbol}${price}${merchantName ? ` | ${merchantName}` : ""}${shortDesc ? ` | ${shortDesc}` : " | 歡迎查詢"} | hongxcollections`;
    const fullUrl = `${protocol}://${host}${reqPath}`;

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.title,
      "description": ogDesc,
      "url": fullUrl,
      ...(ogImageUrl ? { "image": ogImageUrl } : {}),
      "offers": {
        "@type": "Offer",
        "priceCurrency": currency,
        "price": Number((product as { price: string | number }).price).toFixed(2),
        "availability": (product as { status?: string }).status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
        "url": fullUrl,
        "seller": {
          "@type": "Organization",
          "name": merchantName || "hongxcollections"
        }
      }
    });

    const ogMeta = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="hongxcollections" />`,
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

    let result = html
      .replace(/<title>[^<]*<\/title>/gi, "")
      .replace(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*\/?>/gi, "")
      .replace(/<meta\s+(?:name|property)="description"[^>]*\/?>/gi, "")
      .replace(/<link\s+rel="canonical"[^>]*\/?>/gi, "")
      .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
    const viewportRe = /(<meta\s+name="viewport"[^>]*\/?>)/i;
    // 用 function replacement 避免 String.replace `$1` substitution（ogMeta 入面 `$10` 之類會被當 capture group reference）
    result = viewportRe.test(result)
      ? result.replace(viewportRe, (m) => `${m}\n    ${ogMeta}`)
      : result.replace("</head>", () => `    ${ogMeta}\n  </head>`);
    console.log(`[OG Meta] Injected for product ${productId}: title="${ogTitle}" imageUrl="${ogImageUrl}"`);
    return result;
  } catch (err) {
    console.error("[OG Meta] Error generating product OG tags:", err);
    return null;
  }
}

/**
 * Inject Open Graph meta tags for collection square (藏品社區) post detail pages.
 * Mirrors injectProductOgMeta() pattern but for /collection-square/:id URLs.
 * Independent function so existing auction / product OG / robots / bot code remains untouched.
 */
async function injectCollectionPostOgMeta(html: string, reqPath: string, protocol: string, host: string): Promise<string | null> {
  const m = reqPath.match(/^\/collection-square\/(\d+)$/);
  if (!m) return null;

  try {
    const postId = parseInt(m[1], 10);
    const post = await getCollectionPostForOg(postId);
    if (!post) return null;

    const ogImageUrl = post.firstImageUrl
      ? `${protocol}://${host}/api/og-image-community/${postId}`
      : "";
    const imgMime = "image/jpeg";

    // 同 auction / product injectOgMeta() 一致：og:title 短 + 純標題（避 Facebook parser drop tag）。
    // 防護：用戶 paste HTML / og 標籤入 title / body 會令 og 標籤穿崩 leak 入 body。
    const stripHtmlC = (s: string) => s.replace(/<[^>]*>?/g, "").replace(/&lt;[^&]*?&gt;/gi, "");
    const intentLabel = post.intent === "seek_value" ? "求估價" : post.intent === "for_sale" ? "想出讓" : "藏品分享";
    const author = post.authorName ? ` | ${stripHtmlC(post.authorName)}` : "";
    const rawTitle = stripHtmlC(post.title).replace(/\s+/g, " ").trim();
    const titleForOg = rawTitle.length > 55 ? rawTitle.slice(0, 55) + "…" : rawTitle;
    const ogTitle = `${titleForOg} | 藏品社區`;
    const rawBody = stripHtmlC(post.body).replace(/\s+/g, " ").trim();
    const shortBody = rawBody.length > 120 ? rawBody.slice(0, 120) + "…" : rawBody;
    const tagPart = post.tags.length > 0 ? ` | #${post.tags.slice(0, 5).join(" #")}` : "";
    const ogDesc = `${rawTitle} | ${intentLabel}${author}${shortBody ? ` | ${shortBody}` : ""}${tagPart} | hongxcollections 藏品社區`;
    const fullUrl = `${protocol}://${host}${reqPath}`;

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": ogDesc,
      "url": fullUrl,
      ...(ogImageUrl ? { "image": ogImageUrl } : {}),
      ...(post.authorName ? { "author": { "@type": "Person", "name": post.authorName } } : {}),
      ...(post.createdAt ? { "datePublished": new Date(post.createdAt).toISOString() } : {}),
      ...(post.updatedAt ? { "dateModified": new Date(post.updatedAt).toISOString() } : {}),
      "publisher": {
        "@type": "Organization",
        "name": "hongxcollections"
      }
    });

    const ogMeta = [
      `<meta property="og:type" content="article" />`,
      `<meta property="og:site_name" content="hongxcollections" />`,
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
      `<meta name="description" content="${esc(ogDesc)}" />`,
      `<link rel="canonical" href="${esc(fullUrl)}" />`,
      `<title>${esc(ogTitle)}</title>`,
      `<script type="application/ld+json">${jsonLd}</script>`,
    ].filter(Boolean).join("\n    ");

    let result = html
      .replace(/<title>[^<]*<\/title>/gi, "")
      .replace(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"[^>]*\/?>/gi, "")
      .replace(/<meta\s+(?:name|property)="description"[^>]*\/?>/gi, "")
      .replace(/<link\s+rel="canonical"[^>]*\/?>/gi, "")
      .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
    const viewportRe = /(<meta\s+name="viewport"[^>]*\/?>)/i;
    // 用 function replacement 避免 String.replace `$1` substitution（ogMeta 入面 `$10` 之類會被當 capture group reference）
    result = viewportRe.test(result)
      ? result.replace(viewportRe, (m) => `${m}\n    ${ogMeta}`)
      : result.replace("</head>", () => `    ${ogMeta}\n  </head>`);
    console.log(`[OG Meta] Injected for collection post ${postId}: title="${ogTitle}" imageUrl="${ogImageUrl}"`);
    return result;
  } catch (err) {
    console.error("[OG Meta] Error generating collection-post OG tags:", err);
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
      const _cleanPath = req.path.split("?")[0].replace(/\/+$/, "") || "/";
      const ogHtml = await injectOgMeta(template, _cleanPath, protocol, host)
        ?? await injectProductOgMeta(template, _cleanPath, protocol, host)
        ?? await injectCollectionPostOgMeta(template, _cleanPath, protocol, host)
        ?? injectStaticPageMeta(template, _cleanPath, base);
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
    // 故意唔出 Content-Length，用 chunked transfer encoding。
    // Cloudflare 喺 robots.txt body inject Managed Content (~1.7KB AI bot
    // directives)，但唔會 update Content-Length header — 結果 declared length
    // 同 actual body bytes 唔啱，FB scraper strict parse 時會判 protocol
    // violation 然後對所有 URL 報 403。Chunked 之後 Cloudflare 加任何嘢都唔影響
    // header truth-value，FB 就唔會 mis-judge。
    res.status(200).set({
      "Content-Type": "text/plain; charset=utf-8",
      "Accept-Ranges": "bytes",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
    });
    res.write(content);
    res.end();
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

    // Cache headers strategy:
    // - Normal users: prevent Railway/Fastly CDN from caching HTML (avoid stale 403 / SPA asset hash mismatch)
    // - Social crawlers (Facebook/Threads/Twitter/LinkedIn/WhatsApp): allow short cache so Facebook
    //   can properly update its og_object cache. `no-store` was preventing FB Sharing Debugger from
    //   refreshing cached invalid og_objects even after server returned 200 + correct OG.
    const ua = String(req.headers["user-agent"] ?? "");
    const isSocialCrawler = /facebookexternalhit|meta-externalagent|facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Pinterest/i.test(ua);
    const noCacheHeaders = isSocialCrawler
      ? {
          "Cache-Control": "public, max-age=300, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Surrogate-Control": "no-store",
        }
      : {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          "Surrogate-Control": "no-store",
          "CDN-Cache-Control": "no-store",
          "Pragma": "no-cache",
          "Vary": "*",
        };

    const base = `${protocol}://${host}`;
    const cleanPath = req.path.split("?")[0].replace(/\/+$/, "") || "/";
    let html = await fs.promises.readFile(indexPath, "utf-8");
    const ogHtml = await injectOgMeta(html, cleanPath, protocol, host)
      ?? await injectProductOgMeta(html, cleanPath, protocol, host)
      ?? await injectCollectionPostOgMeta(html, cleanPath, protocol, host)
      ?? injectStaticPageMeta(html, cleanPath, base);
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
