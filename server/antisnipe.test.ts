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
