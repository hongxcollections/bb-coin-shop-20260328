/**
 * Anti-snipe extension logic unit tests
 *
 * Tests the core decision logic: should an auction be extended?
 * Isolated from DB – pure function tests.
 */
import { describe, it, expect } from "vitest";

/**
 * Pure helper mirroring the logic in auctions.ts placeBid
 */
function shouldExtend(
  endTime: Date,
  antiSnipeMinutes: number,
  now: Date = new Date()
): boolean {
  if (antiSnipeMinutes === 0) return false;
  const antiSnipeMs = antiSnipeMinutes * 60 * 1000;
  const endMs = endTime.getTime();
  const timeLeft = endMs - now.getTime();
  return timeLeft > 0 && timeLeft <= antiSnipeMs;
}

function getNewEndTime(endTime: Date, extendMinutes: number): Date {
  return new Date(endTime.getTime() + extendMinutes * 60 * 1000);
}

describe("Anti-snipe extension logic", () => {
  const now = new Date("2026-03-30T10:00:00Z");

  it("should extend when bid is placed within antiSnipeMinutes window", () => {
    const endTime = new Date("2026-03-30T10:02:00Z"); // 2 min left
    expect(shouldExtend(endTime, 3, now)).toBe(true);
  });

  it("should NOT extend when bid is placed outside the window", () => {
    const endTime = new Date("2026-03-30T10:05:00Z"); // 5 min left, window is 3
    expect(shouldExtend(endTime, 3, now)).toBe(false);
  });

  it("should NOT extend when antiSnipeMinutes is 0 (feature disabled)", () => {
    const endTime = new Date("2026-03-30T10:00:30Z"); // 30 sec left
    expect(shouldExtend(endTime, 0, now)).toBe(false);
  });

  it("should NOT extend when auction has already ended", () => {
    const endTime = new Date("2026-03-30T09:59:00Z"); // already ended
    expect(shouldExtend(endTime, 3, now)).toBe(false);
  });

  it("should extend exactly at the boundary (timeLeft === antiSnipeMs)", () => {
    const endTime = new Date("2026-03-30T10:03:00Z"); // exactly 3 min left
    expect(shouldExtend(endTime, 3, now)).toBe(true);
  });

  it("should NOT extend one millisecond outside the boundary", () => {
    const endTime = new Date(now.getTime() + 3 * 60 * 1000 + 1); // 3min + 1ms
    expect(shouldExtend(endTime, 3, now)).toBe(false);
  });

  it("calculates new endTime correctly", () => {
    const endTime = new Date("2026-03-30T10:02:00Z");
    const newEnd = getNewEndTime(endTime, 3);
    expect(newEnd.toISOString()).toBe("2026-03-30T10:05:00.000Z");
  });

  it("calculates new endTime with custom extendMinutes", () => {
    const endTime = new Date("2026-03-30T10:02:00Z");
    const newEnd = getNewEndTime(endTime, 10);
    expect(newEnd.toISOString()).toBe("2026-03-30T10:12:00.000Z");
  });

  it("handles large antiSnipeMinutes (60 min)", () => {
    const endTime = new Date("2026-03-30T10:59:00Z"); // 59 min left
    expect(shouldExtend(endTime, 60, now)).toBe(true);
  });
});

// ── Global switch tests ───────────────────────────────────────────────────────

/**
 * Simulate the full gate logic:
 *   globalEnabled && perAuctionEnabled && shouldExtend()
 */
function shouldExtendWithGlobalSwitch(
  endTime: Date,
  antiSnipeMinutes: number,
  globalEnabled: boolean,
  now: Date = new Date()
): boolean {
  if (!globalEnabled) return false;
  return shouldExtend(endTime, antiSnipeMinutes, now);
}

describe("Anti-snipe global switch", () => {
  const now = new Date("2026-03-30T10:00:00Z");
  const endTime = new Date("2026-03-30T10:02:00Z"); // 2 min left, within 3-min window

  it("extends when global switch is ON", () => {
    expect(shouldExtendWithGlobalSwitch(endTime, 3, true, now)).toBe(true);
  });

  it("does NOT extend when global switch is OFF", () => {
    expect(shouldExtendWithGlobalSwitch(endTime, 3, false, now)).toBe(false);
  });

  it("does NOT extend when global ON but per-auction disabled (antiSnipeMinutes=0)", () => {
    expect(shouldExtendWithGlobalSwitch(endTime, 0, true, now)).toBe(false);
  });

  it("does NOT extend when both global OFF and per-auction disabled", () => {
    expect(shouldExtendWithGlobalSwitch(endTime, 0, false, now)).toBe(false);
  });
});

// ── Per-auction switch tests ────────────────────────────────────────────────

/**
 * Full three-layer gate:
 *   globalEnabled && perAuctionEnabled && antiSnipeMinutes > 0 && shouldExtend()
 */
function shouldExtendFull(
  endTime: Date,
  antiSnipeMinutes: number,
  globalEnabled: boolean,
  perAuctionEnabled: boolean,
  now: Date = new Date()
): boolean {
  if (!globalEnabled) return false;
  if (!perAuctionEnabled) return false;
  return shouldExtend(endTime, antiSnipeMinutes, now);
}

describe("Per-auction antiSnipeEnabled switch", () => {
  const now = new Date("2026-03-30T10:00:00Z");
  const endTime = new Date("2026-03-30T10:02:00Z"); // 2 min left

  it("extends when both global and per-auction are ON", () => {
    expect(shouldExtendFull(endTime, 3, true, true, now)).toBe(true);
  });

  it("does NOT extend when per-auction switch is OFF (global ON)", () => {
    expect(shouldExtendFull(endTime, 3, true, false, now)).toBe(false);
  });

  it("does NOT extend when global is OFF (per-auction ON)", () => {
    expect(shouldExtendFull(endTime, 3, false, true, now)).toBe(false);
  });

  it("does NOT extend when both switches are OFF", () => {
    expect(shouldExtendFull(endTime, 3, false, false, now)).toBe(false);
  });

  it("does NOT extend when per-auction ON but antiSnipeMinutes=0", () => {
    expect(shouldExtendFull(endTime, 0, true, true, now)).toBe(false);
  });
});

// ── Member level gate tests ────────────────────────────────────────────────

type MemberLevel = 'bronze' | 'silver' | 'gold' | 'vip';

function isMemberLevelAllowed(memberLevelsRaw: string | null | undefined, bidderLevel: MemberLevel): boolean {
  const raw = memberLevelsRaw ?? 'all';
  if (!raw || raw === 'all') return true;
  try {
    const allowed: string[] = JSON.parse(raw);
    if (allowed.length === 0) return true;
    return allowed.includes(bidderLevel);
  } catch {
    return true;
  }
}

describe("Member level gate for anti-snipe", () => {
  it("allows all levels when set to 'all'", () => {
    expect(isMemberLevelAllowed('all', 'bronze')).toBe(true);
    expect(isMemberLevelAllowed('all', 'vip')).toBe(true);
  });

  it("allows all levels when null or undefined", () => {
    expect(isMemberLevelAllowed(null, 'bronze')).toBe(true);
    expect(isMemberLevelAllowed(undefined, 'gold')).toBe(true);
  });

  it("allows only specified levels", () => {
    const raw = JSON.stringify(['gold', 'vip']);
    expect(isMemberLevelAllowed(raw, 'gold')).toBe(true);
    expect(isMemberLevelAllowed(raw, 'vip')).toBe(true);
    expect(isMemberLevelAllowed(raw, 'silver')).toBe(false);
    expect(isMemberLevelAllowed(raw, 'bronze')).toBe(false);
  });

  it("treats empty array as allow-all", () => {
    const raw = JSON.stringify([]);
    expect(isMemberLevelAllowed(raw, 'bronze')).toBe(true);
  });

  it("handles malformed JSON gracefully (allow-all fallback)", () => {
    expect(isMemberLevelAllowed('not-json', 'bronze')).toBe(true);
  });
});
