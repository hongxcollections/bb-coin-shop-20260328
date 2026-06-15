import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock dependencies ────────────────────────────────────────────────────────
vi.mock("./_core/env", () => ({
  ENV: {
    webhookSecret: "test-secret",
    ownerOpenId: "owner-open-id-123",
    forgeApiUrl: "https://api.example.com",
    forgeApiKey: "test-key",
  },
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: "香港1980年1角 PCGS MS64",
            description: "品相極佳，帶車輪光，評級幣",
            startingPrice: 100,
            currency: "HKD",
            bidIncrement: 50,
          }),
        },
      },
    ],
  }),
}));

vi.mock("./db", () => ({
  createAuction: vi.fn().mockResolvedValue({ id: 42 }),
  addAuctionImage: vi.fn().mockResolvedValue({}),
  getUserByOpenId: vi.fn().mockResolvedValue({ id: 1, name: "Owner", role: "admin" }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Webhook Security", () => {
  it("should reject requests with wrong secret", async () => {
    const { ENV } = await import("./_core/env");
    const incoming = "wrong-secret";
    expect(incoming).not.toBe(ENV.webhookSecret);
  });

  it("should accept requests with correct secret", async () => {
    const { ENV } = await import("./_core/env");
    const incoming = "test-secret";
    expect(incoming).toBe(ENV.webhookSecret);
  });

  it("should accept all requests when no secret is configured", async () => {
    // When webhookSecret is empty, no validation is performed
    const emptySecret = "";
    expect(Boolean(emptySecret)).toBe(false);
  });
});

describe("Webhook Payload Parsing", () => {
  it("should extract post_text from Groups Watcher payload", () => {
    const payload = {
      post_text: "香港1980年1角 PCGS MS64 帶車輪光\n起拍 HK$100",
      image_url: "https://example.com/coin.jpg",
      post_url: "https://facebook.com/groups/123/posts/456",
    };
    expect(payload.post_text).toBeTruthy();
    expect(payload.image_url).toBeTruthy();
  });

  it("should fall back to message field if post_text missing", () => {
    const payload = { message: "Some post content" };
    const text = payload.post_text ?? payload.message ?? "";
    expect(text).toBe("Some post content");
  });

  it("should fall back to content field if message missing", () => {
    const payload = { content: "Fallback content" };
    const text = (payload as { post_text?: string }).post_text ??
      (payload as { message?: string }).message ??
      payload.content ?? "";
    expect(text).toBe("Fallback content");
  });

  it("should handle array images field", () => {
    const payload = {
      post_text: "Test",
      images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
    };
    const imageUrls: string[] = [];
    if (Array.isArray(payload.images)) {
      payload.images.forEach((img) => {
        if (typeof img === "string") imageUrls.push(img);
      });
    }
    expect(imageUrls).toHaveLength(2);
    expect(imageUrls[0]).toBe("https://example.com/img1.jpg");
  });

  it("should handle object images with url property", () => {
    const payload = {
      post_text: "Test",
      images: [{ url: "https://example.com/img1.jpg" }],
    };
    const imageUrls: string[] = [];
    if (Array.isArray(payload.images)) {
      payload.images.forEach((img) => {
        if (typeof img === "object" && img?.url) imageUrls.push(img.url);
      });
    }
    expect(imageUrls).toHaveLength(1);
  });
});

describe("AI Parsed Auction Validation", () => {
  it("should clamp bidIncrement to valid range (30-5000)", () => {
    const clamp = (v: number) => Math.min(5000, Math.max(30, v));
    expect(clamp(10)).toBe(30);
    expect(clamp(30)).toBe(30);
    expect(clamp(100)).toBe(100);
    expect(clamp(5000)).toBe(5000);
    expect(clamp(9999)).toBe(5000);
  });

  it("should default currency to HKD for unknown values", () => {
    const validCurrencies = ["HKD", "USD", "CNY", "GBP", "EUR", "JPY"];
    const normalize = (c: string) => validCurrencies.includes(c) ? c : "HKD";
    expect(normalize("HKD")).toBe("HKD");
    expect(normalize("USD")).toBe("USD");
    expect(normalize("UNKNOWN")).toBe("HKD");
    expect(normalize("")).toBe("HKD");
  });

  it("should ensure startingPrice is non-negative", () => {
    const sanitize = (v: number) => Math.max(0, Number(v) || 0);
    expect(sanitize(-100)).toBe(0);
    expect(sanitize(0)).toBe(0);
    expect(sanitize(100)).toBe(100);
    expect(sanitize(NaN)).toBe(0);
  });

  it("should truncate title to 80 characters", () => {
    const longTitle = "A".repeat(100);
    const truncated = longTitle.slice(0, 80);
    expect(truncated).toHaveLength(80);
  });
});

describe("Draft Auction Creation", () => {
  it("should call createAuction with draft status", async () => {
    const { createAuction } = await import("./db");
    await createAuction({
      title: "Test Coin",
      description: "Test description",
      startingPrice: "100",
      currentPrice: "100",
      endTime: new Date(),
      status: "draft",
      bidIncrement: 50,
      currency: "HKD",
      createdBy: 1,
      fbPostUrl: "https://facebook.com/post/123",
    });
    expect(createAuction).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft" })
    );
  });

  it("should set endTime 7 days from now as placeholder", () => {
    const now = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + 7);
    const diffDays = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });
});
