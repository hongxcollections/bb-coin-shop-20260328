import { getDb, getAuctionById, getBidHistory, placeBid as dbPlaceBid, getAuctions as dbGetAuctions, getActiveProxiesForAuction, insertProxyBidLog, getNotificationSettings, getBiddersForAuction } from './db';
import { auctions as auctionsTable, users, merchantApplications } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { sendOutbidEmail, sendWonEmail, sendEndingSoonEmail, sendMerchantWonEmail } from './email';
import { getUserById } from './db';
import { sendPushToUser, isSilverOrAbove } from './push';

// Track which auctions have had ending-soon notifications sent (in-memory, resets on restart)
const endingSoonSent = new Set<number>();

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
async function recordBid(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, auctionId: number, userId: number, bidAmount: number, isAnonymous = 0) {
  await db
    .update(auctionsTable)
    .set({ currentPrice: bidAmount.toString(), highestBidderId: userId })
    .where(eq(auctionsTable.id, auctionId));

  await dbPlaceBid({ auctionId, userId, bidAmount: bidAmount.toString(), isAnonymous });
}

/**
 * Proxy bidding engine.
 * After a manual bid is placed, check if any OTHER user has an active proxy
 * that can outbid the new highest bidder.
 */
export async function runProxyBidEngine(auctionId: number, triggeringUserId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  console.log(`[ProxyEngine] START auction=${auctionId}, triggeringUser=${triggeringUserId}`);
  const MAX_ROUNDS = 50;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const auction = await getAuctionById(auctionId);
    if (!auction || auction.status !== 'active' || new Date() > auction.endTime) {
      console.log(`[ProxyEngine] STOP round=${round}: auction inactive or ended`);
      break;
    }

    const currentPrice = parseFloat(auction.currentPrice.toString());
    const bidIncrement = auction.bidIncrement ?? 50;
    const currentHighestBidderId = auction.highestBidderId;

    const proxies = await getActiveProxiesForAuction(auctionId);
    console.log(`[ProxyEngine] round=${round} currentPrice=${currentPrice} bidIncrement=${bidIncrement} highest=${currentHighestBidderId} proxies=${JSON.stringify(proxies.map((p: any) => ({ u: p.userId, max: p.maxAmount, active: p.isActive })))}`);
    const topChallenger = proxies.find((p: { userId: number; maxAmount: string | number }) => p.userId !== currentHighestBidderId);

    if (!topChallenger) { console.log(`[ProxyEngine] STOP round=${round}: no challenger`); break; }

    const challengerMax = parseFloat(topChallenger.maxAmount.toString());
    const requiredBid = currentPrice + bidIncrement;

    if (challengerMax < requiredBid) { console.log(`[ProxyEngine] STOP round=${round}: challengerMax(${challengerMax}) < requiredBid(${requiredBid})`); break; }

    const leaderProxy = currentHighestBidderId
      ? proxies.find((p: { userId: number; maxAmount: string | number }) => p.userId === currentHighestBidderId)
      : null;

    let finalBidAmount: number;
    let finalBidderId: number;

    if (leaderProxy) {
      const leaderMax = parseFloat(leaderProxy.maxAmount.toString());
      if (leaderMax >= challengerMax + bidIncrement) {
        finalBidAmount = Math.min(leaderMax, challengerMax + bidIncrement);
        finalBidderId = leaderProxy.userId;
      } else if (challengerMax > leaderMax) {
        finalBidAmount = Math.min(challengerMax, leaderMax + bidIncrement);
        finalBidderId = topChallenger.userId;
      } else {
        break;
      }
    } else {
      finalBidAmount = requiredBid;
      finalBidderId = topChallenger.userId;
    }

    await recordBid(db, auctionId, finalBidderId, finalBidAmount);

    await insertProxyBidLog({
      auctionId,
      round: round + 1,
      triggerUserId: currentHighestBidderId ?? triggeringUserId,
      triggerAmount: currentPrice,
      proxyUserId: finalBidderId,
      proxyAmount: finalBidAmount,
    });

    // 通知被代理出價超越的舊領先者
    if (currentHighestBidderId && currentHighestBidderId !== finalBidderId) {
      notifyOutbid(auctionId, currentHighestBidderId, finalBidAmount, '').catch((err) =>
        console.error('[Auctions] Proxy outbid notify error:', err),
      );
    }

    const updatedAuction = await getAuctionById(auctionId);
    if (!updatedAuction || updatedAuction.highestBidderId === currentHighestBidderId) break;
  }
}

/**
 * Send outbid notification to the previous highest bidder.
 */
async function notifyOutbid(auctionId: number, previousHighestBidderId: number | null, newBidAmount: number, origin: string) {
  if (!previousHighestBidderId) return;

  // ── Web Push 即時通知（獨立執行，唔受任何 gate 影響；用戶有訂閱 + silver+ 就推） ──
  try {
    const auction = await getAuctionById(auctionId);
    console.log(`[Push] Outbid trigger: auction=${auctionId}, prevUser=${previousHighestBidderId}, newBid=${newBidAmount}, auctionFound=${!!auction}`);
    if (auction) {
      const isSilver = await isSilverOrAbove(previousHighestBidderId);
      console.log(`[Push] User ${previousHighestBidderId} silver+ check: ${isSilver}`);
      if (isSilver) {
        const sent = await sendPushToUser(previousHighestBidderId, {
          title: `⚡ 出價被超越 — ${auction.title}`,
          body: `目前最高出價：${auction.currency} ${newBidAmount.toLocaleString()}，立即回應！`,
          url: `/auctions/${auctionId}`,
          tag: `outbid-${auctionId}`,
        });
        console.log(`[Push] Outbid push sent to user ${previousHighestBidderId}: ${sent} device(s)`);
      }
    }
  } catch (pushErr) {
    console.error('[Push] Outbid push error:', pushErr);
  }

  // ── 電郵通知（受全局 enableOutbid + 用戶 opt-in gate 限制） ──
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.enableOutbid) return;
    if (!origin) return; // 無 origin 就無法做電郵連結

    const db = await getDb();
    if (!db) return;

    const auction = await getAuctionById(auctionId);
    if (!auction) return;

    const userRows = await db.select({ email: users.email, name: users.name, notifyOutbid: users.notifyOutbid }).from(users).where(eq(users.id, previousHighestBidderId));
    const prevUser = userRows[0];
    if (!prevUser?.email) return;
    if (!prevUser.notifyOutbid) return; // User opted out of email

    await sendOutbidEmail({
      to: prevUser.email,
      senderName: settings.senderName,
      senderEmail: settings.senderEmail,
      userName: prevUser.name ?? `用戶 #${previousHighestBidderId}`,
      auctionTitle: auction.title,
      auctionId,
      newHighestBid: newBidAmount,
      currency: auction.currency,
      auctionUrl: `${origin}/auctions/${auctionId}`,
    });
  } catch (err) {
    console.error('[Email] Outbid notification error:', err);
  }
}

/**
 * Send won notification to the highest bidder when auction ends.
 */
export async function notifyWon(auctionId: number, origin: string) {
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.enableWon) return;

    const auction = await getAuctionById(auctionId);
    if (!auction || !auction.highestBidderId) return;

    const db = await getDb();
    if (!db) return;

    const userRows = await db.select({ email: users.email, name: users.name, notifyWon: users.notifyWon }).from(users).where(eq(users.id, auction.highestBidderId));
    const winner = userRows[0];
    if (!winner?.email) return;
    if (!winner.notifyWon) return; // User opted out

    await sendWonEmail({
      to: winner.email,
      senderName: settings.senderName,
      senderEmail: settings.senderEmail,
      userName: winner.name ?? `用戶 #${auction.highestBidderId}`,
      auctionTitle: auction.title,
      auctionId,
      finalPrice: parseFloat(auction.currentPrice.toString()),
      currency: auction.currency,
      auctionUrl: `${origin}/auctions/${auctionId}`,
      paymentInstructions: settings.paymentInstructions ?? null,
      deliveryInfo: settings.deliveryInfo ?? null,
    });
  } catch (err) {
    console.error('[Email] Won notification error:', err);
  }
}

/**
 * Notify the merchant (auction creator) when their auction ends with winner details.
 */
export async function notifyMerchantWon(auctionId: number, origin: string) {
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.senderEmail) return;

    const auction = await getAuctionById(auctionId);
    if (!auction || !auction.highestBidderId || !auction.createdBy) return;

    const db = await getDb();
    if (!db) return;

    // Get merchant info
    const merchantRows = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, auction.createdBy));
    const merchant = merchantRows[0];
    if (!merchant?.email) return;

    // Get winner info
    const winnerRows = await db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, auction.highestBidderId));
    const winner = winnerRows[0];

    await sendMerchantWonEmail({
      to: merchant.email,
      senderName: settings.senderName,
      senderEmail: settings.senderEmail,
      merchantName: merchant.name ?? `商戶 #${auction.createdBy}`,
      auctionTitle: auction.title,
      auctionId,
      finalPrice: parseFloat(auction.currentPrice.toString()),
      currency: auction.currency,
      winnerName: winner?.name ?? `用戶 #${auction.highestBidderId}`,
      winnerPhone: winner?.phone ?? null,
      auctionUrl: `${origin}/auctions/${auctionId}`,
    });
  } catch (err) {
    console.error('[Email] Merchant won notification error:', err);
  }
}

/**
 * Send ending-soon notifications to all bidders (once per auction per server session).
 */
export async function notifyEndingSoon(auctionId: number, origin: string) {
  if (endingSoonSent.has(auctionId)) return;
  try {
    const settings = await getNotificationSettings();
    if (!settings || !settings.enableEndingSoon) return;

    const auction = await getAuctionById(auctionId);
    if (!auction || auction.status !== 'active') return;

    const bidders = await getBiddersForAuction(auctionId);
    if (bidders.length === 0) return;

    endingSoonSent.add(auctionId);

    for (const bidder of bidders) {
      if (!bidder.email) continue;
      // Check user's personal notification preference
      const bidderUser = await getUserById(bidder.userId);
      if (!bidderUser?.notifyEndingSoon) continue;
      await sendEndingSoonEmail({
        to: bidder.email,
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        userName: bidder.name ?? `用戶 #${bidder.userId}`,
        auctionTitle: auction.title,
        auctionId,
        currentPrice: parseFloat(auction.currentPrice.toString()),
        currency: auction.currency,
        minutesLeft: settings.endingSoonMinutes,
        auctionUrl: `${origin}/auctions/${auctionId}`,
      });
    }
  } catch (err) {
    console.error('[Email] Ending-soon notification error:', err);
  }
}

/**
 * Place a bid on an auction, then run the proxy bidding engine.
 * Also sends outbid notification to the previous highest bidder.
 */
export async function placeBid(auctionId: number, userId: number, bidAmount: number, origin = '', isAnonymous = 0) {
  const validation = await validateBid(auctionId, bidAmount);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Capture previous highest bidder before overwriting
  const auctionBefore = await getAuctionById(auctionId);
  const previousHighestBidderId = auctionBefore?.highestBidderId ?? null;

  try {
    await recordBid(db, auctionId, userId, bidAmount, isAnonymous);

    // ── Anti-snipe extension ─────────────────────────────────────────────────
    let extended = false;
    let newEndTime: Date | undefined;
    const auctionAfter = await getAuctionById(auctionId);
    const globalSettings = await getNotificationSettings();
    const antiSnipeGloballyEnabled = globalSettings ? (globalSettings.enableAntiSnipe ?? 1) === 1 : true;
    if (antiSnipeGloballyEnabled && auctionAfter && auctionAfter.status === 'active') {
      const perAuctionEnabled = (auctionAfter.antiSnipeEnabled ?? 1) === 1 && (auctionAfter.antiSnipeMinutes ?? 3) > 0;
      // Check member level gate
      const memberLevelsRaw = (auctionAfter as { antiSnipeMemberLevels?: string | null }).antiSnipeMemberLevels ?? 'all';
      let memberLevelAllowed = true;
      if (memberLevelsRaw && memberLevelsRaw !== 'all') {
        try {
          const allowedLevels: string[] = JSON.parse(memberLevelsRaw);
          if (allowedLevels.length > 0) {
            const bidder = await getUserById(userId);
            const bidderLevel = (bidder as { memberLevel?: string } | null)?.memberLevel ?? 'bronze';
            memberLevelAllowed = allowedLevels.includes(bidderLevel);
          }
        } catch {
          // Malformed JSON: fall back to allow-all
          memberLevelAllowed = true;
        }
      }
      if (perAuctionEnabled && memberLevelAllowed) {
        const antiSnipeMs = (auctionAfter.antiSnipeMinutes ?? 3) * 60 * 1000;
        const extendMs = (auctionAfter.extendMinutes ?? 3) * 60 * 1000;
        const now = Date.now();
        const endMs = new Date(auctionAfter.endTime).getTime();
        const timeLeft = endMs - now;
        if (timeLeft > 0 && timeLeft <= antiSnipeMs) {
          newEndTime = new Date(endMs + extendMs);
          await db
            .update(auctionsTable)
            .set({ endTime: newEndTime })
            .where(eq(auctionsTable.id, auctionId));
          extended = true;
          console.log(`[AntiSnipe] Auction #${auctionId} extended by ${auctionAfter.extendMinutes ?? 3} min. New endTime: ${newEndTime.toISOString()}`);
        }
      }
    }

    // Run proxy engine synchronously so client receives the latest state in the same response
    try {
      await runProxyBidEngine(auctionId, userId);
    } catch (err) {
      console.error('[Auctions] Proxy engine error:', err);
    }

    // Send outbid email to previous highest bidder (fire-and-forget)
    if (previousHighestBidderId && previousHighestBidderId !== userId) {
      notifyOutbid(auctionId, previousHighestBidderId, bidAmount, origin).catch(err =>
        console.error('[Auctions] Outbid notify error:', err)
      );
    }

    return { success: true, extended, newEndTime, extendMinutes: auctionAfter?.extendMinutes ?? 3 };
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
 * Check if auction has ended and update status if needed.
 * Triggers won notification on transition to ended.
 */
export async function checkAndUpdateAuctionStatus(auctionId: number, origin = '') {
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

      // Send won notification (fire-and-forget)
      notifyWon(auctionId, origin).catch(err =>
        console.error('[Auctions] Won notify error:', err)
      );
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
