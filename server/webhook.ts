import type { Express } from "express";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { createAuction, addAuctionImage, getUserByOpenId } from "./db";

/**
 * Parse a Groups Watcher / Make.com / Zapier webhook payload
 * and extract auction-relevant fields using AI.
 */
async function parsePostWithAI(payload: GroupsWatcherPayload): Promise<ParsedAuction> {
  const postText = [
    payload.post_text ?? payload.message ?? payload.content ?? "",
    payload.description ?? "",
  ].join("\n").trim();

  const imageUrls: string[] = [];
  if (payload.image_url) imageUrls.push(payload.image_url);
  if (Array.isArray(payload.images)) {
    payload.images.forEach((img: string | { url?: string }) => {
      if (typeof img === "string") imageUrls.push(img);
      else if (img?.url) imageUrls.push(img.url);
    });
  }

  const prompt = `你是一個拍賣商品資料提取助手。請從以下 Facebook 群組貼文中提取拍賣資訊，並以 JSON 格式回傳。

貼文內容：
${postText}

請提取以下資訊：
- title: 商品名稱（簡潔，最多 80 字）
- description: 商品描述（保留原文重要細節）
- startingPrice: 起拍價（數字，如找不到則設為 0）
- currency: 貨幣（HKD/USD/CNY/GBP/EUR/JPY，預設 HKD）
- bidIncrement: 每口加幅（數字，如找不到則設為 30）

注意：只提取明確提及的資訊，不要猜測或捏造。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "你是一個專業的拍賣資料提取助手，只輸出 JSON。" },
        { role: "user", content: prompt },
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
              bidIncrement: { type: "number" },
            },
            required: ["title", "description", "startingPrice", "currency", "bidIncrement"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    return {
      title: parsed.title || "（未命名商品）",
      description: parsed.description || postText,
      startingPrice: Math.max(0, Number(parsed.startingPrice) || 0),
      currency: (["HKD", "USD", "CNY", "GBP", "EUR", "JPY"].includes(parsed.currency) ? parsed.currency : "HKD") as Currency,
      bidIncrement: Math.min(5000, Math.max(30, Number(parsed.bidIncrement) || 30)),
      imageUrls,
      fbPostUrl: payload.post_url ?? payload.url ?? payload.link ?? null,
    };
  } catch (err) {
    console.error("[Webhook] AI parsing failed:", err);
    // Fallback: use raw text as title/description
    return {
      title: postText.split("\n")[0]?.slice(0, 80) || "（未命名商品）",
      description: postText,
      startingPrice: 0,
      currency: "HKD",
      bidIncrement: 30,
      imageUrls,
      fbPostUrl: payload.post_url ?? payload.url ?? payload.link ?? null,
    };
  }
}

type Currency = "HKD" | "USD" | "CNY" | "GBP" | "EUR" | "JPY";

interface GroupsWatcherPayload {
  post_text?: string;
  message?: string;
  content?: string;
  description?: string;
  image_url?: string;
  images?: Array<string | { url?: string }>;
  post_url?: string;
  url?: string;
  link?: string;
  secret?: string;
  [key: string]: unknown;
}

interface ParsedAuction {
  title: string;
  description: string;
  startingPrice: number;
  currency: Currency;
  bidIncrement: number;
  imageUrls: string[];
  fbPostUrl: string | null;
}

export function registerWebhookRoutes(app: Express) {
  /**
   * POST /api/webhook/facebook
   * Receives Groups Watcher / Make.com / Zapier payloads and creates draft auctions.
   *
   * Security: optionally validate X-Webhook-Secret header or ?secret= query param.
   */
  app.post("/api/webhook/facebook", async (req, res) => {
    try {
      // ── Security check ──────────────────────────────────────────────────────
      const expectedSecret = ENV.webhookSecret;
      if (expectedSecret) {
        const incoming =
          (req.headers["x-webhook-secret"] as string) ||
          (req.query.secret as string) ||
          (req.body?.secret as string);
        if (incoming !== expectedSecret) {
          console.warn("[Webhook] Rejected: invalid secret");
          return res.status(401).json({ error: "Unauthorized" });
        }
      }

      const payload: GroupsWatcherPayload = req.body ?? {};
      console.log("[Webhook] Received Facebook post payload:", JSON.stringify(payload).slice(0, 300));

      // ── AI parsing ──────────────────────────────────────────────────────────
      const parsed = await parsePostWithAI(payload);

      if (!parsed.title || parsed.title === "（未命名商品）" && !parsed.description) {
        return res.status(400).json({ error: "Could not extract meaningful content from post" });
      }

      // ── Find owner user to assign as creator ─────────────────────────────
      const ownerUser = await getUserByOpenId(ENV.ownerOpenId);
      if (!ownerUser) {
        console.error("[Webhook] Owner user not found, cannot create draft");
        return res.status(500).json({ error: "Owner user not configured" });
      }

      // ── Create draft auction (endTime set to 7 days from now as placeholder) ─
      const endTime = new Date();
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
        fbPostUrl: parsed.fbPostUrl,
      });

      // ── Save images if any ───────────────────────────────────────────────
      for (let i = 0; i < parsed.imageUrls.length; i++) {
        try {
          await addAuctionImage({
            auctionId: auction.id,
            imageUrl: parsed.imageUrls[i],
            displayOrder: i,
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
        status: "draft",
      });
    } catch (err) {
      console.error("[Webhook] Unexpected error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check for webhook endpoint
  app.get("/api/webhook/facebook", (req, res) => {
    res.json({ status: "ok", message: "Facebook webhook endpoint is active" });
  });
}
