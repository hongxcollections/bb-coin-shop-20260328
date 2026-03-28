import { getDb, getAuctionById, getBidHistory, placeBid as dbPlaceBid, getAuctions as dbGetAuctions } from './db';
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
  if (bidAmount <= currentPrice) {
    return { valid: false, error: `Bid amount must be greater than current price (${currentPrice})` };
  }

  return { valid: true };
}

/**
 * Place a bid on an auction
 */
export async function placeBid(auctionId: number, userId: number, bidAmount: number) {
  const validation = await validateBid(auctionId, bidAmount);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    // Update auction current price and highest bidder
    await db
      .update(auctionsTable)
      .set({
        currentPrice: bidAmount.toString(),
        highestBidderId: userId,
      })
      .where(eq(auctionsTable.id, auctionId));

    // Record the bid
    await dbPlaceBid({
      auctionId,
      userId,
      bidAmount: bidAmount.toString(),
    });

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
