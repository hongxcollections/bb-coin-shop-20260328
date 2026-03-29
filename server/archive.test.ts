import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getAuctionById: vi.fn(),
  updateAuction: vi.fn(),
  deleteAuction: vi.fn(),
  getArchivedAuctions: vi.fn(),
  getAuctionImages: vi.fn(),
  getAuctions: vi.fn(),
  getAuctionsByCreator: vi.fn(),
  getBidHistory: vi.fn(),
  createAuction: vi.fn(),
  addAuctionImage: vi.fn(),
  placeBid: vi.fn(),
  getUserBids: vi.fn(),
  deleteAuctionImage: vi.fn(),
  getDraftAuctions: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

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
    openId: "normal-user",
    email: "user@example.com",
    name: "Normal User",
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

const mockEndedAuction = {
  id: 10,
  title: "Test Coin",
  description: "A test coin",
  startingPrice: "100",
  currentPrice: "150",
  highestBidderId: 2,
  endTime: new Date(Date.now() - 1000 * 60 * 60),
  status: "ended" as const,
  bidIncrement: 30,
  currency: "HKD" as const,
  createdBy: 1,
  relistSourceId: null,
  archived: 0,
  fbPostUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("auctions.archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to archive an ended auction", async () => {
    vi.mocked(db.getAuctionById).mockResolvedValue(mockEndedAuction);
    vi.mocked(db.updateAuction).mockResolvedValue({} as never);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.auctions.archive({ id: 10 });

    expect(result).toEqual({ success: true });
    expect(db.updateAuction).toHaveBeenCalledWith(10, { archived: 1 });
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.auctions.archive({ id: 10 })).rejects.toThrow(TRPCError);
  });

  it("rejects archiving a non-ended auction", async () => {
    const activeAuction = { ...mockEndedAuction, status: "active" as const };
    vi.mocked(db.getAuctionById).mockResolvedValue(activeAuction);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.auctions.archive({ id: 10 })).rejects.toThrow(TRPCError);
  });

  it("rejects archiving a non-existent auction", async () => {
    vi.mocked(db.getAuctionById).mockResolvedValue(undefined);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.auctions.archive({ id: 999 })).rejects.toThrow(TRPCError);
  });
});

describe("auctions.permanentDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows admin to permanently delete an archived auction", async () => {
    const archivedAuction = { ...mockEndedAuction, archived: 1 };
    vi.mocked(db.getAuctionById).mockResolvedValue(archivedAuction);
    vi.mocked(db.deleteAuction).mockResolvedValue({} as never);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.auctions.permanentDelete({ id: 10 });

    expect(result).toEqual({ success: true });
    expect(db.deleteAuction).toHaveBeenCalledWith(10);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.auctions.permanentDelete({ id: 10 })).rejects.toThrow(TRPCError);
  });

  it("rejects deleting a non-archived auction", async () => {
    vi.mocked(db.getAuctionById).mockResolvedValue(mockEndedAuction); // archived: 0
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.auctions.permanentDelete({ id: 10 })).rejects.toThrow(TRPCError);
  });
});

describe("auctions.getArchived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns archived auctions with images for admin", async () => {
    const archivedAuction = { ...mockEndedAuction, archived: 1 };
    vi.mocked(db.getArchivedAuctions).mockResolvedValue([archivedAuction]);
    vi.mocked(db.getAuctionImages).mockResolvedValue([]);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.auctions.getArchived();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 10, archived: 1 });
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.auctions.getArchived()).rejects.toThrow(TRPCError);
  });
});
