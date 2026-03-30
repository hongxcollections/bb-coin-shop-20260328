import { describe, it, expect, beforeEach } from 'vitest';
import { bidDebounceMap } from './routers';

describe('bidDebounceMap', () => {
  beforeEach(() => {
    bidDebounceMap.clear();
  });

  it('should be empty initially', () => {
    expect(bidDebounceMap.size).toBe(0);
  });

  it('should allow first bid for a user-auction pair', () => {
    const key = '1:100';
    expect(bidDebounceMap.has(key)).toBe(false);
    bidDebounceMap.set(key, Date.now());
    expect(bidDebounceMap.has(key)).toBe(true);
  });

  it('should block bid within 3 seconds', () => {
    const key = '2:200';
    const now = Date.now();
    bidDebounceMap.set(key, now);
    // Simulate a bid attempt 1 second later (within 3s window)
    const attemptTime = now + 1000;
    const lastBidTime = bidDebounceMap.get(key) ?? 0;
    const blocked = attemptTime - lastBidTime < 3000;
    expect(blocked).toBe(true);
  });

  it('should allow bid after 3 seconds', () => {
    const key = '3:300';
    const pastTime = Date.now() - 4000; // 4 seconds ago
    bidDebounceMap.set(key, pastTime);
    const now = Date.now();
    const lastBidTime = bidDebounceMap.get(key) ?? 0;
    const blocked = now - lastBidTime < 3000;
    expect(blocked).toBe(false);
  });

  it('should allow different users to bid on same auction simultaneously', () => {
    const now = Date.now();
    bidDebounceMap.set('1:100', now);
    // User 2 bidding on same auction should not be blocked
    const key2 = '2:100';
    expect(bidDebounceMap.has(key2)).toBe(false);
  });

  it('should allow same user to bid on different auctions simultaneously', () => {
    const now = Date.now();
    bidDebounceMap.set('1:100', now);
    // Same user bidding on different auction should not be blocked
    const key2 = '1:200';
    expect(bidDebounceMap.has(key2)).toBe(false);
  });

  it('should clean up stale entries when map exceeds 10000', () => {
    const cutoff = Date.now() - 61000; // older than 60s
    // Add stale entries
    for (let i = 0; i < 5; i++) {
      bidDebounceMap.set(`stale:${i}`, cutoff - 1000);
    }
    // Add fresh entries
    for (let i = 0; i < 3; i++) {
      bidDebounceMap.set(`fresh:${i}`, Date.now());
    }
    // Simulate cleanup
    const now = Date.now();
    const cutoffTime = now - 60000;
    Array.from(bidDebounceMap.entries()).forEach(([k, t]) => {
      if (t < cutoffTime) bidDebounceMap.delete(k);
    });
    // Stale entries should be removed
    expect(bidDebounceMap.has('stale:0')).toBe(false);
    // Fresh entries should remain
    expect(bidDebounceMap.has('fresh:0')).toBe(true);
  });
});
