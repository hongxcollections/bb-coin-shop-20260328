import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock storagePut
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "auctions/1/test.jpg", url: "https://cdn.example.com/auctions/1/test.jpg" }),
}));

// Mock db functions
vi.mock("./db", () => ({
  getAuctions: vi.fn().mockResolvedValue([]),
  getAuctionById: vi.fn().mockResolvedValue({ id: 1, title: "Test", status: "active", startingPrice: "100", currentPrice: "100", endTime: new Date(), createdBy: 1, description: "" }),
  getAuctionImages: vi.fn().mockResolvedValue([]),
  getBidHistory: vi.fn().mockResolvedValue([]),
  createAuction: vi.fn().mockResolvedValue({ id: 1 }),
  addAuctionImage: vi.fn().mockResolvedValue(undefined),
  placeBid: vi.fn().mockResolvedValue(undefined),
  getUserBids: vi.fn().mockResolvedValue([]),
  updateAuction: vi.fn().mockResolvedValue(undefined),
  deleteAuction: vi.fn().mockResolvedValue(undefined),
  deleteAuctionImage: vi.fn().mockResolvedValue(undefined),
  getAuctionsByCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("./auctions", () => ({
  validateBid: vi.fn(),
  placeBid: vi.fn().mockResolvedValue(undefined),
  getAuctionDetails: vi.fn(),
  isEndingSoon: vi.fn().mockReturnValue(false),
}));

function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserCtx(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-open-id",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// Create a 1x1 pixel JPEG in base64 (valid small image)
const TINY_JPEG_BASE64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

describe("auctions.uploadImage", () => {
  it("allows admin to upload a valid JPEG image", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auctions.uploadImage({
      auctionId: 1,
      imageData: TINY_JPEG_BASE64,
      fileName: "test.jpg",
      displayOrder: 0,
      mimeType: "image/jpeg",
    });

    expect(result.success).toBe(true);
    expect(result.url).toContain("https://");
  });

  it("rejects non-admin user from uploading images", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auctions.uploadImage({
        auctionId: 1,
        imageData: TINY_JPEG_BASE64,
        fileName: "test.jpg",
        displayOrder: 0,
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow("Only admins can upload images");
  });

  it("rejects invalid MIME type", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auctions.uploadImage({
        auctionId: 1,
        imageData: TINY_JPEG_BASE64,
        fileName: "test.pdf",
        displayOrder: 0,
        mimeType: "application/pdf",
      })
    ).rejects.toThrow("Invalid image format");
  });

  it("allows admin to delete an image", async () => {
    const ctx = createAdminCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auctions.deleteImage({ imageId: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects non-admin from deleting images", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auctions.deleteImage({ imageId: 1 })
    ).rejects.toThrow("Only admins can delete images");
  });
});
