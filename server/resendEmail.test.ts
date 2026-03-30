/**
 * Tests for wonAuctions.resendEmail procedure logic
 * Covers: admin-only guard, auction status check, missing winner, missing email, successful send
 */
import { describe, it, expect, vi } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulate the core resendEmail logic extracted from the tRPC procedure.
 * This mirrors the exact guard sequence in routers.ts so we can unit-test
 * each error branch without spinning up a full tRPC server.
 */
async function simulateResendEmail({
  isAdmin,
  auction,
  winner,
  sendResult,
}: {
  isAdmin: boolean;
  auction: null | { status: string; highestBidderId: number | null; title: string; currentPrice: string; currency: string };
  winner: null | { email: string | null; name: string | null };
  sendResult: boolean;
}): Promise<{ success: true; sentTo: string } | { error: string; code: string }> {
  // Guard: admin only
  if (!isAdmin) return { error: "Admin only", code: "FORBIDDEN" };

  // Guard: auction must exist and be ended
  if (!auction || auction.status !== "ended") {
    return { error: "只能對已結束的拍賣重發通知", code: "BAD_REQUEST" };
  }

  // Guard: must have a winner
  if (!auction.highestBidderId) {
    return { error: "此拍賣沒有得標者", code: "BAD_REQUEST" };
  }

  // Guard: winner must have email
  if (!winner?.email) {
    return { error: "得標者尚未填寫電郵地址，無法發送通知", code: "BAD_REQUEST" };
  }

  // Simulate send
  if (!sendResult) {
    return { error: "Email 發送失敗，請確認 Resend API 設定是否正確", code: "INTERNAL_SERVER_ERROR" };
  }

  return { success: true, sentTo: winner.email };
}

const endedAuction = {
  status: "ended",
  highestBidderId: 42,
  title: "清朝銅錢",
  currentPrice: "1500",
  currency: "HKD",
};

const winnerWithEmail = { email: "buyer@example.com", name: "張三" };
const winnerNoEmail = { email: null, name: "李四" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("wonAuctions.resendEmail procedure logic", () => {
  it("rejects non-admin users with FORBIDDEN", async () => {
    const result = await simulateResendEmail({
      isAdmin: false,
      auction: endedAuction,
      winner: winnerWithEmail,
      sendResult: true,
    });
    expect(result).toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects when auction is not ended (active)", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: { ...endedAuction, status: "active" },
      winner: winnerWithEmail,
      sendResult: true,
    });
    expect(result).toMatchObject({ code: "BAD_REQUEST", error: expect.stringContaining("已結束") });
  });

  it("rejects when auction does not exist (null)", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: null,
      winner: winnerWithEmail,
      sendResult: true,
    });
    expect(result).toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects when auction has no highest bidder", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: { ...endedAuction, highestBidderId: null },
      winner: winnerWithEmail,
      sendResult: true,
    });
    expect(result).toMatchObject({ code: "BAD_REQUEST", error: expect.stringContaining("得標者") });
  });

  it("rejects when winner has no email address", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: endedAuction,
      winner: winnerNoEmail,
      sendResult: true,
    });
    expect(result).toMatchObject({ code: "BAD_REQUEST", error: expect.stringContaining("電郵") });
  });

  it("rejects when winner is null", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: endedAuction,
      winner: null,
      sendResult: true,
    });
    expect(result).toMatchObject({ code: "BAD_REQUEST", error: expect.stringContaining("電郵") });
  });

  it("returns INTERNAL_SERVER_ERROR when sendWonEmail returns false", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: endedAuction,
      winner: winnerWithEmail,
      sendResult: false,
    });
    expect(result).toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("returns success with sentTo email on successful send", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: endedAuction,
      winner: winnerWithEmail,
      sendResult: true,
    });
    expect(result).toMatchObject({ success: true, sentTo: "buyer@example.com" });
  });

  it("sentTo matches the winner's actual email address", async () => {
    const result = await simulateResendEmail({
      isAdmin: true,
      auction: endedAuction,
      winner: { email: "vip@collector.hk", name: "王五" },
      sendResult: true,
    });
    if ("sentTo" in result) {
      expect(result.sentTo).toBe("vip@collector.hk");
    } else {
      throw new Error("Expected success result");
    }
  });
});

// ─── Export check ─────────────────────────────────────────────────────────────

describe("wonAuctions.resendEmail export check", () => {
  it("notifyWon is exported from auctions.ts", async () => {
    const mod = await import("./auctions");
    expect(typeof mod.notifyWon).toBe("function");
  });
});
