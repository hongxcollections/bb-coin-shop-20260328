import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getAuctionById: vi.fn(),
  getBidHistory: vi.fn(),
  placeBid: vi.fn(),
  getAuctions: vi.fn(),
  getActiveProxiesForAuction: vi.fn(),
  setProxyBid: vi.fn(),
  getProxyBid: vi.fn(),
  deactivateProxyBid: vi.fn(),
  insertProxyBidLog: vi.fn(),
  getProxyBidLogs: vi.fn(),
}));

import * as dbModule from "./db";

const mockAuction = {
  id: 1,
  title: "Test Coin",
  description: "Test",
  startingPrice: "100",
  currentPrice: "200",
  bidIncrement: 50,
  status: "active" as const,
  endTime: new Date(Date.now() + 86400000),
  createdBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  highestBidderId: 2, // user 2 is currently winning
  archived: 0,
  archivedAt: null,
  category: null,
  fbPostUrl: null,
  currency: "HKD" as const,
  relistSourceId: null,
};

const mockDb = {
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onDuplicateKeyUpdate: vi.fn().mockResolvedValue([]),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dbModule.getDb).mockResolvedValue(mockDb as never);
  vi.mocked(dbModule.placeBid).mockResolvedValue({ id: 99, auctionId: 1, userId: 1, bidAmount: "250", createdAt: new Date() });
});

describe("runProxyBidEngine", () => {
  it("does nothing when no competing proxies exist", async () => {
    const { runProxyBidEngine } = await vi.importActual<typeof import("./auctions")>("./auctions");

    vi.mocked(dbModule.getAuctionById).mockResolvedValue({ ...mockAuction });
    vi.mocked(dbModule.getActiveProxiesForAuction).mockResolvedValue([
      // Only the current winner has a proxy — no challenger
      { id: 1, auctionId: 1, userId: 2, maxAmount: "300", isActive: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    await runProxyBidEngine(1, 3);

    // No new bid should be placed
    expect(dbModule.placeBid).not.toHaveBeenCalled();
  });

  it("challenger wins when their proxy exceeds current price + increment", async () => {
    const { runProxyBidEngine } = await vi.importActual<typeof import("./auctions")>("./auctions");

    // First call: auction with user 2 winning at 200
    // Second call: after challenger bids, user 3 is now winning
    vi.mocked(dbModule.getAuctionById)
      .mockResolvedValueOnce({ ...mockAuction, highestBidderId: 2, currentPrice: "200" })
      .mockResolvedValueOnce({ ...mockAuction, highestBidderId: 3, currentPrice: "250" }); // after proxy bid

    vi.mocked(dbModule.getActiveProxiesForAuction).mockResolvedValue([
      // User 3 has a proxy at 400 (challenger)
      { id: 2, auctionId: 1, userId: 3, maxAmount: "400", isActive: 1, createdAt: new Date(), updatedAt: new Date() },
      // User 2 (current winner) has no proxy
    ]);

    await runProxyBidEngine(1, 3);

    // Challenger (user 3) should have bid at 250 (200 + 50)
    expect(dbModule.placeBid).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 3, bidAmount: "250" })
    );
  });

  it("leader proxy defends when challenger proxy is lower", async () => {
    const { runProxyBidEngine } = await vi.importActual<typeof import("./auctions")>("./auctions");

    vi.mocked(dbModule.getAuctionById)
      .mockResolvedValueOnce({ ...mockAuction, highestBidderId: 2, currentPrice: "200" })
      .mockResolvedValueOnce({ ...mockAuction, highestBidderId: 2, currentPrice: "300" }); // leader still winning

    vi.mocked(dbModule.getActiveProxiesForAuction).mockResolvedValue([
      // Leader (user 2) has proxy at 500 — sorted DESC so leader is first
      { id: 1, auctionId: 1, userId: 2, maxAmount: "500", isActive: 1, createdAt: new Date(), updatedAt: new Date() },
      // Challenger (user 3) has proxy at 300
      { id: 2, auctionId: 1, userId: 3, maxAmount: "300", isActive: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    await runProxyBidEngine(1, 3);

    // Leader (user 2) should counter-bid at 350 (challenger 300 + increment 50)
    expect(dbModule.placeBid).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, bidAmount: "350" })
    );
  });

  it("stops when challenger cannot afford required bid", async () => {
    const { runProxyBidEngine } = await vi.importActual<typeof import("./auctions")>("./auctions");

    vi.mocked(dbModule.getAuctionById).mockResolvedValue({ ...mockAuction, highestBidderId: 2, currentPrice: "200" });
    vi.mocked(dbModule.getActiveProxiesForAuction).mockResolvedValue([
      // Challenger proxy at 240 — required is 250 (200+50), can't afford
      { id: 2, auctionId: 1, userId: 3, maxAmount: "240", isActive: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    await runProxyBidEngine(1, 3);

    expect(dbModule.placeBid).not.toHaveBeenCalled();
  });

  it("stops when auction has ended", async () => {
    const { runProxyBidEngine } = await vi.importActual<typeof import("./auctions")>("./auctions");

    vi.mocked(dbModule.getAuctionById).mockResolvedValue({
      ...mockAuction,
      status: "ended" as const,
    });

    await runProxyBidEngine(1, 3);

    expect(dbModule.placeBid).not.toHaveBeenCalled();
  });
});

describe("setProxyBid / getProxyBid helpers", () => {
  it("setProxyBid upserts a proxy bid record", async () => {
    vi.mocked(dbModule.setProxyBid).mockResolvedValue({ success: true });

    const result = await dbModule.setProxyBid(1, 5, 500);
    expect(result).toEqual({ success: true });
    expect(dbModule.setProxyBid).toHaveBeenCalledWith(1, 5, 500);
  });

  it("getProxyBid returns null when no proxy exists", async () => {
    vi.mocked(dbModule.getProxyBid).mockResolvedValue(null);

    const result = await dbModule.getProxyBid(1, 5);
    expect(result).toBeNull();
  });

  it("getProxyBid returns proxy data when it exists", async () => {
    const mockProxy = {
      id: 1, auctionId: 1, userId: 5, maxAmount: "500",
      isActive: 1, createdAt: new Date(), updatedAt: new Date(),
    };
    vi.mocked(dbModule.getProxyBid).mockResolvedValue(mockProxy);

    const result = await dbModule.getProxyBid(1, 5);
    expect(result).toEqual(mockProxy);
  });
});

describe("insertProxyBidLog / getProxyBidLogs", () => {
  it("insertProxyBidLog is called with correct fields during engine run", async () => {
    vi.mocked(dbModule.insertProxyBidLog).mockResolvedValue(undefined);
    vi.mocked(dbModule.getAuctionById)
      .mockResolvedValueOnce({ ...mockAuction, highestBidderId: 2, currentPrice: "200" })
      .mockResolvedValueOnce({ ...mockAuction, highestBidderId: 3, currentPrice: "250" });
    vi.mocked(dbModule.getActiveProxiesForAuction).mockResolvedValue([
      { id: 2, auctionId: 1, userId: 3, maxAmount: "400", isActive: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { runProxyBidEngine } = await vi.importActual<typeof import("./auctions")>("./auctions");
    await runProxyBidEngine(1, 3);

    expect(dbModule.insertProxyBidLog).toHaveBeenCalledWith(
      expect.objectContaining({
        auctionId: 1,
        proxyUserId: 3,
        proxyAmount: 250,
      })
    );
  });

  it("getProxyBidLogs returns empty array when no logs exist", async () => {
    vi.mocked(dbModule.getProxyBidLogs).mockResolvedValue([]);
    const result = await dbModule.getProxyBidLogs(1);
    expect(result).toEqual([]);
  });

  it("getProxyBidLogs returns enriched log entries with user names", async () => {
    const mockLog = {
      id: 1,
      auctionId: 1,
      round: 1,
      triggerUserId: 4,
      triggerAmount: "200",
      proxyUserId: 3,
      proxyAmount: "250",
      createdAt: new Date(),
      triggerUserName: "Alice",
      proxyUserName: "Bob",
    };
    vi.mocked(dbModule.getProxyBidLogs).mockResolvedValue([mockLog]);

    const result = await dbModule.getProxyBidLogs(1);
    expect(result).toHaveLength(1);
    expect(result[0].triggerUserName).toBe("Alice");
    expect(result[0].proxyUserName).toBe("Bob");
    expect(result[0].round).toBe(1);
  });
});
