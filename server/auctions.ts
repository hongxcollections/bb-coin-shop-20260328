import { getDb, getAuctionById, getBidHistory, placeBid as dbPlaceBid, getAuctions as dbGetAuctions, getActiveProxiesForAuction, insertProxyBidLog } from './db';
import { auctions as auctionsTable } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Validate if a bid amount is valid for an auction
 */
export async function validateBid(auctionId: number, bidAmount: number): Promise<{ valid: boolean; error?: string }> {
  const auction = await getAuctionById(auctionId);

  if (!auction) {
    return { valid: false, error: 'Auction not found' };
  }

  if (auction.status !== 'active') {
    return { valid: false, error: 'Auction is not active' };
  }

  if (new Date() > auction.endTime) {
    return { valid: false, error: 'Auction has ended' };
  }

  const currentPrice = parseFloat(auction.currentPrice.toString());
  const startingPrice = parseFloat(auction.startingPrice.toString());
  const bidIncrement = auction.bidIncrement ?? 50;

  // First bid: allow bidding at starting price (no increment required)
  // Subsequent bids: must be at least currentPrice + bidIncrement
  const hasExistingBid = auction.highestBidderId !== null && auction.highestBidderId !== undefined;
  const minBid = hasExistingBid ? currentPrice + bidIncrement : startingPrice;

  if (bidAmount < minBid) {
    if (hasExistingBid) {
      return { valid: false, error: `出價金額必須至少為 HK$${minBid}（現價 HK$${currentPrice} + 每口加幅 HK$${bidIncrement}）` };
    } else {
      return { valid: false, error: `第一口出價金額必須至少為起拍價 HK$${startingPrice}` };
    }
  }

  return { valid: true };
}

/**
 * Internal helper: record a bid and update auction price/highestBidder.
 * Does NOT validate — caller is responsible for ensuring the bid is legal.
 */
async function recordBid(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, auctionId: number, userId: number, bidAmount: number) {
  await db
    .update(auctionsTable)
    .set({ currentPrice: bidAmount.toString(), highestBidderId: userId })
    .where(eq(auctionsTable.id, auctionId));

  await dbPlaceBid({ auctionId, userId, bidAmount: bidAmount.toString() });
}

/**
 * Proxy bidding engine.
 * After a manual bid is placed, check if any OTHER user has an active proxy
 * that can outbid the new highest bidder. The engine resolves the final price
 * in a single synchronous loop (no recursive DB calls) and writes one final
 * bid record for the winning proxy holder.
 *
 * Algorithm:
 * 1. Load all active proxies for the auction, sorted by maxAmount DESC.
 * 2. Find the top proxy that belongs to someone OTHER than the current highest bidder.
 * 3. If that proxy's maxAmount > currentPrice, the proxy can counter-bid.
 *    - Counter-bid = min(topProxy.maxAmount, currentPrice + bidIncrement)
 *    - But also check if the manual bidder has their own proxy and can respond.
 * 4. Repeat until no proxy can outbid, or the same user holds the top proxy.
 */
export async function runProxyBidEngine(auctionId: number, triggeringUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Max iterations to prevent infinite loops
  const MAX_ROUNDS = 50;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const auction = await getAuctionById(auctionId);
    if (!auction || auction.status !== 'active' || new Date() > auction.endTime) break;

    const currentPrice = parseFloat(auction.currentPrice.toString());
    const bidIncrement = auction.bidIncrement ?? 50;
    const currentHighestBidderId = auction.highestBidderId;

    // Get all active proxies sorted by maxAmount DESC
    const proxies = await getActiveProxiesForAuction(auctionId);

    // Find the top proxy that does NOT belong to the current highest bidder
    const topChallenger = proxies.find((p: { userId: number; maxAmount: string | number }) => p.userId !== currentHighestBidderId);

    if (!topChallenger) break; // No one can challenge

    const challengerMax = parseFloat(topChallenger.maxAmount.toString());

    // The minimum amount needed to outbid current leader
    const requiredBid = currentPrice + bidIncrement;

    if (challengerMax < requiredBid) break; // Challenger can't afford to outbid

    // Challenger can bid. Now check if current leader has a proxy to defend.
    const leaderProxy = currentHighestBidderId
      ? proxies.find((p: { userId: number; maxAmount: string | number }) => p.userId === currentHighestBidderId)
      : null;

    let finalBidAmount: number;
    let finalBidderId: number;

    if (leaderProxy) {
      const leaderMax = parseFloat(leaderProxy.maxAmount.toString());
      if (leaderMax >= challengerMax + bidIncrement) {
        // Leader can outbid challenger — settle at challenger's max + 1 increment
        finalBidAmount = Math.min(leaderMax, challengerMax + bidIncrement);
        finalBidderId = leaderProxy.userId;
      } else if (challengerMax > leaderMax) {
        // Challenger wins — bid at leader's max + 1 increment (or challenger's max)
        finalBidAmount = Math.min(challengerMax, leaderMax + bidIncrement);
        finalBidderId = topChallenger.userId;
      } else {
        // Tie: leader keeps position (first-come-first-serve)
        break;
      }
    } else {
      // No leader proxy — challenger bids the minimum required
      finalBidAmount = requiredBid;
      finalBidderId = topChallenger.userId;
    }

    // Record the proxy-triggered bid
    await recordBid(db, auctionId, finalBidderId, finalBidAmount);

    // Write audit log
    await insertProxyBidLog({
      auctionId,
      round: round + 1,
      triggerUserId: currentHighestBidderId ?? triggeringUserId,
      triggerAmount: currentPrice,
      proxyUserId: finalBidderId,
      proxyAmount: finalBidAmount,
    });

    // If the same user is still winning after this round, engine is done
    const updatedAuction = await getAuctionById(auctionId);
    if (!updatedAuction || updatedAuction.highestBidderId === currentHighestBidderId) break;
  }
}

/**
 * Place a bid on an auction, then run the proxy bidding engine.
 */
export async function placeBid(auctionId: number, userId: number, bidAmount: number) {
  const validation = await validateBid(auctionId, bidAmount);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    await recordBid(db, auctionId, userId, bidAmount);

    // Run proxy engine asynchronously — don't block the response
    runProxyBidEngine(auctionId, userId).catch(err =>
      console.error('[Auctions] Proxy engine error:', err)
    );

    return { success: true };
  } catch (error) {
    console.error('[Auctions] Failed to place bid:', error);
    throw error;
  }
}

/**
 * Get auction details with images and bid history
 */
export async function getAuctionDetails(auctionId: number) {
  const auction = await getAuctionById(auctionId);
  if (!auction) return null;

  const bidHistory = await getBidHistory(auctionId);

  return {
    ...auction,
    bidHistory,
  };
}

/**
 * Get all active auctions with pagination
 */
export async function getActiveAuctions(limit = 20, offset = 0) {
  return dbGetAuctions(limit, offset);
}

/**
 * Check if auction has ended and update status if needed
 */
export async function checkAndUpdateAuctionStatus(auctionId: number) {
  const auction = await getAuctionById(auctionId);
  if (!auction || auction.status !== 'active') return;

  if (new Date() > auction.endTime) {
    const db = await getDb();
    if (!db) return;

    try {
      await db
        .update(auctionsTable)
        .set({ status: 'ended' })
        .where(eq(auctionsTable.id, auctionId));
    } catch (error) {
      console.error('[Auctions] Failed to update auction status:', error);
    }
  }
}

/**
 * Get time remaining for auction in milliseconds
 */
export function getTimeRemaining(endTime: Date): number {
  const now = new Date();
  const remaining = endTime.getTime() - now.getTime();
  return Math.max(0, remaining);
}

/**
 * Check if auction is ending soon (within 1 hour)
 */
export function isEndingSoon(endTime: Date): boolean {
  const timeRemaining = getTimeRemaining(endTime);
  const oneHourMs = 60 * 60 * 1000;
  return timeRemaining > 0 && timeRemaining <= oneHourMs;
}
