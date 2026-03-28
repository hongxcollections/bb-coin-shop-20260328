import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module to avoid real DB calls
vi.mock("./db", () => ({
  getAuctions: vi.fn().mockResolvedValue([]),
  getAuctionById: vi.fn(),
  getAuctionImages: vi.fn().mockResolvedValue([]),
  getBidHistory: vi.fn().mockResolvedValue([]),
  createAuction: vi.fn(),
  addAuctionImage: vi.fn(),
  placeBid: vi.fn(),
  getUserBids: vi.fn().mockResolvedValue([]),
  updateAuction: vi.fn(),
  deleteAuction: vi.fn(),
  deleteAuctionImage: vi.fn(),
  getAuctionsByCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("./auctions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auctions")>();
  return {
    ...actual,
    validateBid: vi.fn(),
    placeBid: vi.fn(),
    getAuctionDetails: vi.fn(),
    isEndingSoon: vi.fn(),
  };
});

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import * as dbModule from "./db";
import * as auctionsModule from "./auctions";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("bidIncrement feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auctions.create with bidIncrement", () => {
    it("creates auction with default bidIncrement of 50", async () => {
      const mockAuction = {
        id: 1,
        title: "Test Coin",
        description: "Test",
        startingPrice: "100",
        currentPrice: "100",
        bidIncrement: 50,
        status: "active",
        endTime: new Date(Date.now() + 86400000),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        highestBidderId: null,
      };
      vi.mocked(dbModule.createAuction).mockResolvedValue(mockAuction);

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auctions.create({
        title: "Test Coin",
        description: "Test",
        startingPrice: 100,
        endTime: new Date(Date.now() + 86400000),
        // bidIncrement defaults to 50
      });

      expect(dbModule.createAuction).toHaveBeenCalledWith(
        expect.objectContaining({ bidIncrement: 50 })
      );
      expect(result).toEqual(mockAuction);
    });

    it("creates auction with custom bidIncrement", async () => {
      const mockAuction = {
        id: 2,
        title: "Rare Coin",
        description: "Rare",
        startingPrice: "500",
        currentPrice: "500",
        bidIncrement: 200,
        status: "active",
        endTime: new Date(Date.now() + 86400000),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        highestBidderId: null,
      };
      vi.mocked(dbModule.createAuction).mockResolvedValue(mockAuction);

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auctions.create({
        title: "Rare Coin",
        description: "Rare",
        startingPrice: 500,
        endTime: new Date(Date.now() + 86400000),
        bidIncrement: 200,
      });

      expect(dbModule.createAuction).toHaveBeenCalledWith(
        expect.objectContaining({ bidIncrement: 200 })
      );
      expect(result).toEqual(mockAuction);
    });

    it("rejects bidIncrement below 30", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auctions.create({
          title: "Test",
          description: "",
          startingPrice: 100,
          endTime: new Date(Date.now() + 86400000),
          bidIncrement: 20, // below minimum
        })
      ).rejects.toThrow();
    });

    it("rejects bidIncrement above 5000", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auctions.create({
          title: "Test",
          description: "",
          startingPrice: 100,
          endTime: new Date(Date.now() + 86400000),
          bidIncrement: 6000, // above maximum
        })
      ).rejects.toThrow();
    });
  });

  describe("auctions.update with bidIncrement", () => {
    it("updates auction bidIncrement", async () => {
      const mockAuction = {
        id: 1,
        title: "Test Coin",
        description: "Test",
        startingPrice: "100",
        currentPrice: "100",
        bidIncrement: 50,
        status: "active",
        endTime: new Date(Date.now() + 86400000),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        highestBidderId: null,
      };
      vi.mocked(dbModule.getAuctionById).mockResolvedValue(mockAuction);
      vi.mocked(dbModule.updateAuction).mockResolvedValue({});

      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auctions.update({
        id: 1,
        bidIncrement: 300,
      });

      expect(dbModule.updateAuction).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ bidIncrement: 300 })
      );
      expect(result).toEqual({ success: true });
    });

    it("rejects update with bidIncrement below 30", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auctions.update({
          id: 1,
          bidIncrement: 10,
        })
      ).rejects.toThrow();
    });
  });

  describe("validateBid with bidIncrement", () => {
    it("rejects bid below currentPrice + bidIncrement", async () => {
      const { validateBid } = await import("./auctions");
      // Restore original implementation for this test
      vi.mocked(validateBid).mockRestore?.();

      // Use the actual validateBid logic by re-importing
      const { validateBid: realValidateBid } = await vi.importActual<typeof import("./auctions")>("./auctions");

      // Mock getAuctionById to return auction with bidIncrement
      vi.mocked(dbModule.getAuctionById).mockResolvedValue({
        id: 1,
        title: "Test",
        description: "Test",
        startingPrice: "100",
        currentPrice: "500",
        bidIncrement: 100,
        status: "active",
        endTime: new Date(Date.now() + 86400000),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        highestBidderId: null,
      });

      // Bid of 550 should fail (needs >= 500 + 100 = 600)
      const result = await realValidateBid(1, 550);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("600");
    });

    it("accepts bid equal to currentPrice + bidIncrement", async () => {
      const { validateBid: realValidateBid } = await vi.importActual<typeof import("./auctions")>("./auctions");

      vi.mocked(dbModule.getAuctionById).mockResolvedValue({
        id: 1,
        title: "Test",
        description: "Test",
        startingPrice: "100",
        currentPrice: "500",
        bidIncrement: 100,
        status: "active",
        endTime: new Date(Date.now() + 86400000),
        createdBy: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        highestBidderId: null,
      });

      // Bid of exactly 600 should pass (500 + 100 = 600)
      const result = await realValidateBid(1, 600);
      expect(result.valid).toBe(true);
    });
  });
});
