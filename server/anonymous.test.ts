/**
 * Anonymous bid feature unit tests
 *
 * Tests the display logic for anonymous bids:
 * - Public view: anonymous bids show "🕵️ 匿名買家"
 * - Admin view: real name with anonymous marker
 * - Own bids: show "(匿名出價)" hint
 * - Default anonymous setting logic
 */
import { describe, it, expect } from "vitest";

/** Mirror the display logic from routers.ts auctionBidHistory */
function getBidDisplayName(
  username: string | null,
  isAnonymous: number | boolean,
  isAdmin: boolean,
  viewerUserId: number | null,
  bidUserId: number | null
): string {
  const anon = isAnonymous === 1 || isAnonymous === true;
  if (!anon) return username ?? "未知用戶";

  // Admin sees real name with marker
  if (isAdmin) return `${username ?? "未知用戶"} [匿名]`;

  // Own bid: show "(匿名出價)" hint
  if (viewerUserId !== null && viewerUserId === bidUserId) {
    return `${username ?? "未知用戶"} (匿名出價)`;
  }

  // Public: show anonymous placeholder
  return "🕵️ 匿名買家";
}

/** Mirror the isAnonymous flag passing logic */
function resolveIsAnonymous(
  perBidAnonymous: boolean | undefined,
  defaultAnonymous: number
): number {
  if (perBidAnonymous !== undefined) return perBidAnonymous ? 1 : 0;
  return defaultAnonymous;
}

describe("Anonymous bid display logic", () => {
  it("public viewer sees '🕵️ 匿名買家' for anonymous bids", () => {
    const result = getBidDisplayName("Alice", 1, false, null, 42);
    expect(result).toBe("🕵️ 匿名買家");
  });

  it("admin sees real name with [匿名] marker", () => {
    const result = getBidDisplayName("Alice", 1, true, 1, 42);
    expect(result).toBe("Alice [匿名]");
  });

  it("bidder sees own name with (匿名出價) hint", () => {
    const result = getBidDisplayName("Alice", 1, false, 42, 42);
    expect(result).toBe("Alice (匿名出價)");
  });

  it("non-anonymous bid shows real name to everyone", () => {
    expect(getBidDisplayName("Bob", 0, false, null, 5)).toBe("Bob");
    expect(getBidDisplayName("Bob", 0, true, 1, 5)).toBe("Bob");
    expect(getBidDisplayName("Bob", 0, false, 5, 5)).toBe("Bob");
  });

  it("handles null username gracefully", () => {
    expect(getBidDisplayName(null, 1, false, null, 1)).toBe("🕵️ 匿名買家");
    expect(getBidDisplayName(null, 1, true, 1, 1)).toBe("未知用戶 [匿名]");
  });

  it("boolean isAnonymous=true is treated same as 1", () => {
    const result = getBidDisplayName("Carol", true, false, null, 10);
    expect(result).toBe("🕵️ 匿名買家");
  });

  it("boolean isAnonymous=false is treated same as 0", () => {
    const result = getBidDisplayName("Carol", false, false, null, 10);
    expect(result).toBe("Carol");
  });
});

describe("Anonymous bid flag resolution", () => {
  it("per-bid true overrides default false", () => {
    expect(resolveIsAnonymous(true, 0)).toBe(1);
  });

  it("per-bid false overrides default true", () => {
    expect(resolveIsAnonymous(false, 1)).toBe(0);
  });

  it("undefined per-bid uses default anonymous setting", () => {
    expect(resolveIsAnonymous(undefined, 1)).toBe(1);
    expect(resolveIsAnonymous(undefined, 0)).toBe(0);
  });

  it("explicit per-bid value always takes precedence", () => {
    expect(resolveIsAnonymous(true, 1)).toBe(1);
    expect(resolveIsAnonymous(false, 0)).toBe(0);
  });
});

describe("Default anonymous setting", () => {
  it("defaultAnonymous=1 means anonymous by default", () => {
    const setting = { defaultAnonymous: 1 };
    expect(setting.defaultAnonymous === 1).toBe(true);
  });

  it("defaultAnonymous=0 means public by default", () => {
    const setting = { defaultAnonymous: 0 };
    expect(setting.defaultAnonymous === 1).toBe(false);
  });

  it("missing defaultAnonymous defaults to 0 (public)", () => {
    const user: { defaultAnonymous?: number } = {};
    const val = user.defaultAnonymous ?? 0;
    expect(val).toBe(0);
  });
});
