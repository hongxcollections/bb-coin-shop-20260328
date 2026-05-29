import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb, getAuctions, getAuctionById, getAuctionImages, getBidHistory, createAuction, addAuctionImage, placeBid as dbPlaceBid, getUserBids, getUserBidsGrouped, updateAuction, deleteAuction, deleteAuctionImage, getAuctionsByCreator, getDraftAuctions, getArchivedAuctions, getArchivedAuctionsFiltered, setProxyBid, getProxyBid, deactivateProxyBid, getProxyBidLogs, getAnonymousBids, closeExpiredAuctions, sendWinnerAutoReply, getDashboardStats, toggleFavorite, getUserFavorites, getFavoriteIds, getMyWonAuctions, getAllBidsForExport, getSiteSetting, setSiteSetting, getAllSiteSettings, getWonOrders, updatePaymentStatus, getAnyExistingImageUrl, getAdBanners, getAllAdBanners, upsertAdBanner, saveCoinAnalysisHistory, getUserCoinAnalysisHistory, deleteCoinAnalysisHistory, updateCoinAnalysisHistoryImage, searchRelatedAuctions, setMerchantPageSizes } from "./db";
import type { AdTargetType } from "./db";
import type { Auction } from "../drizzle/schema";
import { merchantApplications as merchantAppsTable, merchantProducts as merchantProductsTable, auctions, bids, merchantAuctionSessions, merchantAuctionSessionItems, communitySeederDrafts, auctionComments, groupAuctionRounds, groupAuctionColumnTemplates, groupAuctionImages, groupAuctionItems, groupAuctionBids } from "../drizzle/schema";
import { sanitizeUserText } from "./_core/sanitize";
import { eq, sql, and } from "drizzle-orm";
import { validateBid, placeBid, getAuctionDetails, isEndingSoon, notifyEndingSoon, notifyWon, notifyMerchantWon, checkAndUpdateAuctionStatus } from "./auctions";
import { getNotificationSettings, upsertNotificationSettings, updateUserEmail, updateUserName, updateUserPhotoUrl, updateUserNotificationPrefs, getUserById, getUserPublicStats, getAllUsers, getRecentRegistrations, setUserMemberLevel, getOrCreateSellerDeposit, getAllSellerDeposits, topUpDeposit, deductCommission, refundCommission, updateSellerDepositSettings, getDepositTransactions, getAllDepositTransactions, canSellerList, adjustDeposit, getActiveSubscriptionPlans, getAllSubscriptionPlans, getSubscriptionPlanById, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, createUserSubscription, getUserActiveSubscription, getUserSubscriptions, getAllUserSubscriptions, approveSubscription, rejectSubscription, cancelSubscription, deleteUserSubscription, getSubscriptionStats, getExpiringSoonSubscriptions, adminUpdateSubscriptionEndDate, getAllUsersExtended, adminUpdateUser, adminSetMerchantFbRefreshPreview, adminSetUserPassword, countMerchantVideosThisMonth, getUserMonthlyVideoQuota, getUserMaxVideoSeconds, clearMustChangePassword, deleteUserAndData, getWonAuctionsByUser, adminGetUserStats, createMerchantApplication, getMerchantApplicationByUser, getAllMerchantApplications, reviewMerchantApplication, approveOnboardingApplication, getWonOrdersByCreator, getMerchantSettings, upsertMerchantSettings, upsertMerchantFbGroups, upsertWatermarkSettings, setMerchantListingLayout, setMerchantEndedAuctionVisibility, getEndedAuctionsByMerchant, updateMerchantProfile, autoDeductCommissionOnAuctionEnd, autoDeductGroupAuctionCommission, getListingQuotaInfo, deductListingQuota, deductListingQuotaBulk, adminSetSubscriptionQuota, adminSetSubscriptionEndDate, createRefundRequest, getMyRefundRequests, getAllRefundRequests, reviewRefundRequest, purgeMerchantAuctionData, cleanOrphanMerchantData, revokeMerchantStatus, createDepositTopUpRequest, getMyDepositTopUpRequests, getAllDepositTopUpRequests, reviewDepositTopUpRequest, listDepositTierPresets, upsertDepositTierPreset, deleteDepositTierPreset, computeTierSwitchDiff, requestTierChange, listMyTierChangeRequests, listAllTierChangeRequests, reviewTierChangeRequest, listMerchantProducts, getMerchantProduct, createMerchantProduct, updateMerchantProduct, deleteMerchantProduct, listApprovedMerchants, exportPackagesData, importPackagesData, createProductOrder, getProductOrdersByMerchant, getProductOrdersByBuyer, getAllProductOrders, confirmProductOrder, cancelProductOrder, requestCancelProductOrder, withdrawCancelRequest, respondCancelRequest, deleteBuyerOrder, deleteMerchantOrder, getHiddenProductOrdersByBuyer, getHiddenProductOrdersByMerchant, restoreBuyerOrder, restoreMerchantOrder, countHiddenProductOrdersByBuyer, countHiddenProductOrdersByMerchant, assertBuyerNotLockedFromMerchant, getBuyerLockFromMerchant, setMerchantFailureLock, getMerchantAuctionOrders, confirmMerchantAuctionOrder, cancelMerchantAuctionOrder, countPendingMerchantAuctionOrders, countMerchantAuctionOrdersByStatus, countMerchantProductOrdersByStatus, countBuyerPendingWonAuctions, countBuyerAcceptedOffers, cancelBuyerOffer, hideBuyerOffer, hideMerchantOffer, createFeaturedListing, getActiveFeaturedListings, getMerchantFeaturedListings, getAllFeaturedListings, cancelFeaturedListing, getFeaturedSlotStatus, purgeActiveFeaturedListings, FEATURED_TIER_PRICES, FEATURED_TIER_LABELS, MAX_FEATURED_SLOTS, toggleMessageReaction, listReactionsForRoom, listReactionsForMessage, upsertChatAutoReply, getLastMerchantOrAutoReplyAt, searchChatMessagesInRoom, searchChatMessagesAcrossMyRooms, setAutoGenerateCover, setAutoGenerateProductCover, setMerchantCategories, setMerchantOffersEnabled, setMerchantOfferLimits, createProductOffer, countRecentBuyerOffersForProduct, getProductOfferById, getActiveBuyerOfferForProduct, listOffersForBuyer, listOffersForMerchant, countPendingOffersForMerchant, respondProductOffer, markOfferPurchased, claimAcceptedOffer, releaseClaimedOffer, getUserMemberLevel, getRecentlyEndedForMainPage, setMainPageEndedDisplay, setShowUnsoldEnded } from "./db";
import { storagePut, storageSignPut } from "./storage";
import {
  createCollectionPost,
  listCollectionPosts,
  getCollectionPostDetail,
  listCollectionPostComments,
  addCollectionPostComment,
  deleteCollectionPostComment,
  toggleCollectionPostLike,
  toggleCollectionPostSave,
  deleteCollectionPost,
  adminSetPostHidden,
  adminListFlaggedPosts,
  adminCountFlagged,
  checkForbidden,
  getMerchantPostQuotaInfo,
  getCommunityUserStats,
  listTopWeeklyCreators,
} from "./community";
import {
  CHALLENGE_COUNTRIES,
  CHALLENGE_CATEGORIES,
  hkTodayStr,
  adminCreateChallenge,
  adminUpdateChallenge,
  adminDeleteChallenge,
  adminListChallenges,
  getTodayChallenge,
  getChallengeById,
  submitChallengeAnswer,
  getMyAnswerForChallenge,
  getChallengeStats,
  getChallengeWinners,
  getLeaderboard as getChallengeLeaderboard,
  getMyChallengeStats,
  listMyAnswerHistory,
  generateCensoredImage,
} from "./dailyChallenge";
import { applyWatermark } from "./watermark";
import { getRawPool } from "./db";
import { TRPCError } from "@trpc/server";
import { getVapidPublicKey, savePushSubscription, removePushSubscription, sendPushToUser, sendPushToEndpoint } from "./push";
import { getLoyaltyConfig, updateLoyaltyConfig, getEarlyBirdTodayStatus, getMyLoyaltyStatus, recalculateUserLevel, runDailyLoyaltyMaintenance, getMyAutoBidStatus, enforceAutoBidLimit, enforceAnonymousBidPermission, type LoyaltyConfig } from "./loyalty";
import { ENV } from "./_core/env";
import type { IncomingMessage } from "http";
import { invokeLLM } from "./_core/llm";
import type { InvokeParams, InvokeResult } from "./_core/llm";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * 取得電郵連結用的 origin（例：https://hongxcollections.com）
 * 優先用 SITE_URL env var，其次從 request headers 取。
 */
function getEmailOrigin(req?: IncomingMessage): string {
  if (ENV.siteUrl) return ENV.siteUrl;
  if (!req) return '';
  const origin = (req as any).headers?.origin as string | undefined;
  const referer = (req as any).headers?.referer as string | undefined;
  if (origin) return origin;
  if (referer) {
    try {
      const u = new URL(referer);
      return u.origin; // 直接用 URL.origin，避免 regex 截錯
    } catch { /* ignore */ }
  }
  return '';
}

// 出價防抖 Map：鍵為 "userId:auctionId"，値為最後出價時間戳
// 防止同一用戶對同一拍賣在 3 秒內重複出價，減少平台 API 請求量
export const bidDebounceMap = new Map<string, number>();

/**
 * 為商戶專場 generate unique slug（每商戶獨立 namespace）。
 * 由 input string 提取 ASCII alnum + dash，撞名加 -2 / -3 / ...
 */
async function generateUniqueSessionSlug(merchantUserId: number, source: string): Promise<string> {
  const base = (source || 'session')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60) || 'session';
  const db = await getDb();
  const { and: andOp } = await import('drizzle-orm');
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await db.select({ id: merchantAuctionSessions.id })
      .from(merchantAuctionSessions)
      .where(andOp(
        eq(merchantAuctionSessions.merchantUserId, merchantUserId),
        eq(merchantAuctionSessions.slug, candidate),
      ))
      .limit(1);
    if (existing.length === 0) return candidate;
  }
  // Fallback：加 random suffix
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 商戶專場成交統計：item「已結束」嘅判斷 = session.status==='ended' 或 endTime <= now。
 * 已結束 + highestBidderId → 成交；已結束 + 冇 bidder → 流拍。
 */
function computeSessionSummary(auctionsRows: any[], session: { status: string; endAt: Date | string | null }) {
  const nowMs = Date.now();
  const endAtMs = session.endAt ? new Date(session.endAt).getTime() : 0;
  const sessionEnded = session.status === 'ended' || (endAtMs > 0 && endAtMs <= nowMs);
  let soldCount = 0, unsoldCount = 0, activeCount = 0, totalGmv = 0;
  const totalsByCurrency: Record<string, number> = {};
  let primaryCurrency = 'HKD';
  for (const a of auctionsRows) {
    const cur = a.currency || 'HKD';
    if (a.currency) primaryCurrency = a.currency;
    const itemEndedByTime = a.endTime ? new Date(a.endTime).getTime() <= nowMs : false;
    const itemEnded = sessionEnded || a.status === 'ended' || itemEndedByTime;
    if (!itemEnded) { activeCount++; continue; }
    if (a.highestBidderId) {
      soldCount++;
      const amt = parseFloat(String(a.currentPrice)) || 0;
      totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + amt;
      totalGmv += amt;
    } else {
      unsoldCount++;
    }
  }
  return {
    totalCount: auctionsRows.length,
    soldCount,
    unsoldCount,
    activeCount,
    totalGmv,            // legacy 單貨幣 sum，UI 只喺單一 currency session 顯示
    currency: primaryCurrency,
    totalsByCurrency,    // 多貨幣明細，UI 應優先 render 呢個
    sessionEnded,
  };
}

/**
 * 解析影片時長（秒）。支援 MP4/MOV（解析 mvhd box）。
 * WebM 暫不支援，返回 null 表示「無法解析」（呼叫方應放行，靠 client-side 兜底）。
 * 解析失敗一律返回 null，避免誤殺合法上傳。
 */
function extractVideoDurationSeconds(buf: Buffer, mime: string): number | null {
  try {
    if (mime === 'video/mp4' || mime === 'video/quicktime') {
      const limit = Math.min(buf.length - 32, 5 * 1024 * 1024); // 只掃前 5MB（mvhd 通常喺頭部 moov）
      for (let i = 0; i < limit; i++) {
        if (buf[i] === 0x6d && buf[i + 1] === 0x76 && buf[i + 2] === 0x68 && buf[i + 3] === 0x64) {
          // 找到 'mvhd'，payload 由 i+4 開始
          const p = i + 4;
          const version = buf[p];
          if (version === 0) {
            const timescale = buf.readUInt32BE(p + 12);
            const duration = buf.readUInt32BE(p + 16);
            if (timescale > 0 && duration > 0) return duration / timescale;
          } else if (version === 1) {
            const timescale = buf.readUInt32BE(p + 20);
            const durHigh = buf.readUInt32BE(p + 24);
            const durLow = buf.readUInt32BE(p + 28);
            const duration = durHigh * 4294967296 + durLow;
            if (timescale > 0 && duration > 0) return duration / timescale;
          }
          return null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  auctions: router({
    list: publicProcedure
      .input(z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
        category: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        // Auto-close expired auctions in background (non-blocking)
        const origin = getEmailOrigin(ctx.req as any);
        closeExpiredAuctions().then(closedIds => {
          if (closedIds.length > 0) {
            closedIds.forEach(id => {
              notifyWon(id, origin).catch(() => {});
              notifyMerchantWon(id, origin).catch(() => {});
              autoDeductCommissionOnAuctionEnd(id).catch(() => {});
              sendWinnerAutoReply(id).catch(() => {});
            });
          }
        }).catch(() => {});
        const auctionList = await getAuctions(input.limit, input.offset, input.category);
        const isAdmin = ctx.user?.role === 'admin';
        const withImages = await Promise.all(
          auctionList.map(async (auction: { id: number; highestBidderName?: string | null; highestBidderIsAnonymous?: number; [key: string]: unknown }) => {
            let highestBidderName = auction.highestBidderName ?? null;
            if (auction.highestBidderIsAnonymous === 1) {
              highestBidderName = isAdmin ? `${highestBidderName ?? '未知'} (匿名)` : '🕵️ 匿名買家';
            }
            return {
              ...auction,
              highestBidderName,
              images: await getAuctionImages(auction.id),
            };
          })
        );
        return withImages;
      }),

    listRecentEnded: publicProcedure.query(async () => {
      return getRecentlyEndedForMainPage();
    }),

    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        // Auto-close expired auctions in background (non-blocking)
        const origin = getEmailOrigin(ctx.req as any);
        closeExpiredAuctions().then(closedIds => {
          if (closedIds.length > 0) {
            closedIds.forEach(id => {
              notifyWon(id, origin).catch(() => {});
              notifyMerchantWon(id, origin).catch(() => {});
              autoDeductCommissionOnAuctionEnd(id).catch(() => {});
              sendWinnerAutoReply(id).catch(() => {});
            });
          }
        }).catch(() => {});
        const auction = await getAuctionById(input.id);
        if (!auction) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Auction not found' });
        }

        // Fetch images and bid history in parallel
        const [images, bidHistory] = await Promise.all([
          getAuctionImages(input.id),
          getBidHistory(input.id),
        ]);

        return {
          ...auction,
          images,
          bidHistory,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string(),
        startingPrice: z.number().min(0),
        endTime: z.date(),
        bidIncrement: z.number().int().min(10).max(5000).default(30),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).default('HKD'),
        antiSnipeEnabled: z.number().int().min(0).max(1).default(1),
        antiSnipeMinutes: z.number().int().min(0).max(60).default(3),
        extendMinutes: z.number().int().min(1).max(60).default(3),
        antiSnipeMemberLevels: z.union([z.literal('all'), z.array(z.enum(['bronze','silver','gold','vip'])).transform(arr => arr.length === 0 ? 'all' : JSON.stringify(arr))]).optional(),
        videoUrl: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can create auctions' });
        }

        const result = await createAuction({
          title: input.title,
          description: input.description,
          startingPrice: input.startingPrice.toString(),
          currentPrice: input.startingPrice.toString(),
          endTime: input.endTime,
          createdBy: ctx.user.id,
          status: 'active',
          bidIncrement: input.bidIncrement,
          currency: input.currency,
          antiSnipeEnabled: input.antiSnipeEnabled,
          antiSnipeMinutes: input.antiSnipeMinutes,
          extendMinutes: input.extendMinutes,
          antiSnipeMemberLevels: input.antiSnipeMemberLevels ?? 'all',
          videoUrl: input.videoUrl ?? null,
        });

        return result;
      }),

    uploadImage: protectedProcedure
      .input(z.object({
        auctionId: z.number(),
        imageData: z.string(),
        fileName: z.string(),
        displayOrder: z.number().default(0),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can upload images' });
        }

        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(input.mimeType)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid image format' });
        }

        try {
          const buffer = Buffer.from(input.imageData, 'base64');
          if (buffer.length > 5 * 1024 * 1024) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Image size exceeds 5MB limit' });
          }

          const fileKey = `auctions/${input.auctionId}/${Date.now()}-${input.fileName}`;
          const { url } = await storagePut(fileKey, buffer, input.mimeType);

          await addAuctionImage({
            auctionId: input.auctionId,
            imageUrl: url,
            displayOrder: input.displayOrder,
          });

          return { success: true, url };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error('[Router] Failed to upload image:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upload image' });
        }
      }),

    /** 上傳拍賣短片（admin only），返回 URL，需與 create/update 一齊保存 */
    uploadVideo: protectedProcedure
      .input(z.object({
        videoData: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can upload videos' });
        }
        const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
        const mime = (input.mimeType || '').toLowerCase();
        if (!allowedMimes.includes(mime)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只支援 MP4、WebM、MOV 格式' });
        }
        const buffer = Buffer.from(input.videoData, 'base64');
        if (buffer.length > 30 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '影片不可超過 30MB' });
        }
        const maxSec = await getUserMaxVideoSeconds(ctx.user.id);
        const dur = extractVideoDurationSeconds(buffer, mime);
        if (dur !== null && dur > maxSec) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `影片不可超過 ${maxSec} 秒（目前 ${Math.round(dur)} 秒）` });
        }
        const ext = mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : 'mov';
        const key = `auction-videos/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, mime);
        return { url };
      }),

    placeBid: protectedProcedure
      .input(z.object({
        auctionId: z.number(),
        bidAmount: z.number().positive(),
        origin: z.string().optional(),
        isAnonymous: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 停權檢查
        if ((ctx.user as any).isBanned === 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您的帳號已被停權，無法進行出價' });
        }
        // 防抖：同一用戶對同一拍賣，3 秒內不允許重複出價
        const debounceKey = `${ctx.user.id}:${input.auctionId}`;
        const lastBidTime = bidDebounceMap.get(debounceKey) ?? 0;
        const now = Date.now();
        if (now - lastBidTime < 3000) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: '請稍候幾秒再試，請勿重複出價' });
        }
        bidDebounceMap.set(debounceKey, now);
        // 清除過舊的防抖記錄（防止記憶體漏水）
        if (bidDebounceMap.size > 10000) {
          const cutoff = now - 60000;
          Array.from(bidDebounceMap.entries()).forEach(([k, t]) => {
            if (t < cutoff) bidDebounceMap.delete(k);
          });
        }
        // 商戶不能競投自己刊登的拍賣
        const auctionForBid = await getAuctionById(input.auctionId);
        if (auctionForBid && auctionForBid.createdBy === ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不能競投自己刊登的拍賣' });
        }
        // 失約封鎖檢查（針對該拍賣商戶）
        if (auctionForBid?.createdBy) {
          try { await assertBuyerNotLockedFromMerchant(ctx.user.id, auctionForBid.createdBy, '出價'); }
          catch (err) { throw new TRPCError({ code: 'FORBIDDEN', message: err instanceof Error ? err.message : '已被該商戶暫停出價' }); }
        }
        // Loyalty 等級限制：匿名出價權限校驗
        if ((input.isAnonymous ?? 0) === 1) {
          try {
            await enforceAnonymousBidPermission(ctx.user.id);
          } catch (err) {
            throw new TRPCError({ code: 'FORBIDDEN', message: err instanceof Error ? err.message : '匿名出價權限不足' });
          }
        }
        try {
          const result = await placeBid(input.auctionId, ctx.user.id, input.bidAmount, input.origin ?? '', input.isAnonymous ?? 0);
          return { success: true, extended: result.extended ?? false, newEndTime: result.newEndTime, extendMinutes: result.extendMinutes };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to place bid';
          throw new TRPCError({ code: 'BAD_REQUEST', message });
        }
      }),

    myBids: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserBidsGrouped(ctx.user.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startingPrice: z.number().min(0).optional(),
        endTime: z.date().optional(),
        bidIncrement: z.number().int().min(10).max(5000).optional(),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).optional(),
        antiSnipeEnabled: z.number().int().min(0).max(1).optional(),
        antiSnipeMinutes: z.number().int().min(0).max(60).optional(),
        extendMinutes: z.number().int().min(1).max(60).optional(),
        antiSnipeMemberLevels: z.union([z.literal('all'), z.array(z.enum(['bronze','silver','gold','vip'])).transform(arr => arr.length === 0 ? 'all' : JSON.stringify(arr))]).optional(),
        videoUrl: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update auctions' });
        }

        const auction = await getAuctionById(input.id);
        if (!auction) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Auction not found' });
        }

        // If startingPrice is being changed, verify no bids exist
        if (input.startingPrice !== undefined) {
          const bidHistory = await getBidHistory(input.id);
          if (bidHistory.length > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '已有出價記錄，不能修改起拍價' });
          }
        }

        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.startingPrice !== undefined) {
          updateData.startingPrice = String(input.startingPrice);
          updateData.currentPrice = String(input.startingPrice);
        }
        if (input.endTime !== undefined) updateData.endTime = input.endTime;
        if (input.bidIncrement !== undefined) updateData.bidIncrement = input.bidIncrement;
        if (input.currency !== undefined) updateData.currency = input.currency;
        if (input.antiSnipeEnabled !== undefined) updateData.antiSnipeEnabled = input.antiSnipeEnabled;
        if (input.antiSnipeMinutes !== undefined) updateData.antiSnipeMinutes = input.antiSnipeMinutes;
        if (input.extendMinutes !== undefined) updateData.extendMinutes = input.extendMinutes;
        if (input.antiSnipeMemberLevels !== undefined) updateData.antiSnipeMemberLevels = input.antiSnipeMemberLevels;
        if (input.videoUrl !== undefined) updateData.videoUrl = input.videoUrl;

        try {
          await updateAuction(input.id, updateData);
          return { success: true };
        } catch (error) {
          console.error('[Router] Failed to update auction:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update auction' });
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can delete auctions' });
        }

        const auction = await getAuctionById(input.id);
        if (!auction) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Auction not found' });
        }

        try {
          await deleteAuction(input.id);
          return { success: true };
        } catch (error) {
          console.error('[Router] Failed to delete auction:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete auction' });
        }
      }),

    merchantDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此拍賣' });
        }
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '你只能刪除自己的拍賣' });
        }
        if (auction.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只能刪除進行中的拍賣' });
        }
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '資料庫暫時無法連接' });
        const [bidRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(bids).where(eq(bids.auctionId, input.id));
        const bidCount = Number(bidRow?.count ?? 0);
        if (bidCount > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣已有出價，不可刪除' });
        }
        try {
          await deleteAuction(input.id);
          return { success: true };
        } catch (error) {
          console.error('[Router] merchantDelete failed:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '刪除失敗，請稍後再試' });
        }
      }),

    deleteImage: protectedProcedure
      .input(z.object({ imageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can delete images' });
        }

        try {
          await deleteAuctionImage(input.imageId);
          return { success: true };
        } catch (error) {
          console.error('[Router] Failed to delete image:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete image' });
        }
      }),

    myAuctions: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can view their auctions' });
        }

        const auctionList = await getAuctionsByCreator(ctx.user.id);

        // Auto-update expired auctions status to 'ended'
        const now = new Date();
        const expiredIds = auctionList
          .filter((a: { status: string; endTime: Date | string }) =>
            a.status === 'active' && new Date(a.endTime) <= now
          )
          .map((a: { id: number }) => a.id);
        if (expiredIds.length > 0) {
          // 用 checkAndUpdateAuctionStatus 而唔係 updateAuction，
          // 先會正確 init auctionOrderStatus='pending' + 發 won notify + recalc loyalty
          const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
          await Promise.all(
            expiredIds.map((id: number) => checkAndUpdateAuctionStatus(id, origin))
          );
        }

        // Re-fetch to get updated statuses
        const updatedList = expiredIds.length > 0
          ? await getAuctionsByCreator(ctx.user.id)
          : auctionList;

        const withImages = await Promise.all(
          updatedList.map(async (auction: { id: number; highestBidderName?: string | null; highestBidderIsAnonymous?: number; [key: string]: unknown }) => {
            // Admin sees real name + (匿名) marker
            let highestBidderName = auction.highestBidderName ?? null;
            if (auction.highestBidderIsAnonymous === 1) {
              highestBidderName = `${highestBidderName ?? '未知'} (匿名)`;
            }
            return {
              ...auction,
              highestBidderName,
              images: await getAuctionImages(auction.id),
            };
          })
        );
        return withImages;
      }),

    drafts: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can view drafts' });
        }
        const draftList = await getDraftAuctions();
        const withImages = await Promise.all(
          draftList.map(async (auction: { id: number; [key: string]: unknown }) => ({
            ...auction,
            images: await getAuctionImages(auction.id),
          }))
        );
        return withImages;
      }),

    publish: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startingPrice: z.number().min(0).optional(),
        endTime: z.date(),
        bidIncrement: z.number().int().min(10).max(5000).optional(),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can publish drafts' });
        }
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到草稿' });
        if (auction.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣並非草稿狀態' });
        if (input.endTime <= new Date()) throw new TRPCError({ code: 'BAD_REQUEST', message: '結束時間必須為未來時間' });

        const updateData: Record<string, unknown> = { status: 'active', endTime: input.endTime };
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.startingPrice !== undefined) {
          updateData.startingPrice = input.startingPrice.toString();
          updateData.currentPrice = input.startingPrice.toString();
        }
        if (input.bidIncrement !== undefined) updateData.bidIncrement = input.bidIncrement;
        if (input.currency !== undefined) updateData.currency = input.currency;

        await updateAuction(input.id, updateData);
        return { success: true };
      }),

    batchPublish: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1).max(100),
        endTime: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can batch publish drafts' });
        }
        if (input.endTime <= new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '結束時間必須為未來時間' });
        }
        const results = await Promise.allSettled(
          input.ids.map(async (id) => {
            const auction = await getAuctionById(id);
            if (!auction || auction.status !== 'draft') return { id, skipped: true };
            await updateAuction(id, { status: 'active', endTime: input.endTime });
            return { id, success: true };
          })
        );
        const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as { success?: boolean }).success).length;
        const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as { skipped?: boolean }).skipped).length;
        return { succeeded, skipped, total: input.ids.length };
      }),

    batchDelete: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can batch delete drafts' });
        }
        const results = await Promise.allSettled(
          input.ids.map(async (id) => {
            const auction = await getAuctionById(id);
            if (!auction || auction.status !== 'draft') return { id, skipped: true };
            await deleteAuction(id);
            return { id, success: true };
          })
        );
        const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as { success?: boolean }).success).length;
        return { succeeded, total: input.ids.length };
      }),

    adminGenerateTestWonAuction: protectedProcedure
      .input(z.object({
        merchantUserId: z.number().int().positive(),
        count: z.number().int().min(1).max(30).default(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        const { users: usersTable } = await import('../drizzle/schema');
        const { ne, and } = await import('drizzle-orm');

        const creatorUserId = input.merchantUserId;

        // Fetch eligible winners once
        const allUsers = await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(and(ne(usersTable.id, creatorUserId), ne(usersTable.id, ctx.user.id)));
        if (allUsers.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '資料庫內沒有其他會員，無法隨機選取中標者' });

        const testItems = [
          { title: '1997年香港金紫荊紀念幣', desc: '回歸紀念，原盒附證書', category: '紀念幣' as const },
          { title: '1981年香港五毫硬幣', desc: '英女皇頭像，品相良好', category: '古幣' as const },
          { title: '1935年香港一毫銀幣', desc: '喬治五世頭像，銀光好', category: '銀幣' as const },
          { title: '1967年香港一毫', desc: '英女皇頭像，流通品', category: '古幣' as const },
          { title: '1863年香港一仙銅幣', desc: '早期殖民地幣，珍貴', category: '古幣' as const },
          { title: '2000年千禧紀念金幣', desc: '千禧年紀念版，附原裝盒', category: '紀念幣' as const },
          { title: '1975年香港一元', desc: '皇冠獅子圖案，原光', category: '古幣' as const },
          { title: '1993年香港十元', desc: '回歸前版本，品相極佳', category: '古幣' as const },
        ];
        const prices = [280, 350, 480, 600, 750, 900, 1200, 1500, 1800, 2200];
        const existingImageUrl = await getAnyExistingImageUrl();
        const imageUrl = existingImageUrl ?? 'https://placehold.co/400x400/d4af37/ffffff?text=TEST';
        const endTime = new Date(Date.now() - 60 * 60 * 1000);

        const results: { auctionId: number; winningPrice: number; title: string; winnerName: string }[] = [];

        for (let i = 0; i < input.count; i++) {
          const randomWinner = allUsers[Math.floor(Math.random() * allUsers.length)];
          const winnerUserId = randomWinner.id;
          const winnerName = randomWinner.name ?? `用戶 #${randomWinner.id}`;
          const template = testItems[Math.floor(Math.random() * testItems.length)];
          const winningPrice = prices[Math.floor(Math.random() * prices.length)];
          const startingPrice = Math.floor(winningPrice * 0.5);

          const newAuction = await createAuction({
            title: `【測試結標】${template.title}`,
            description: `${template.desc}｜系統測試用，已結標`,
            startingPrice: startingPrice.toString(),
            currentPrice: winningPrice.toString(),
            highestBidderId: winnerUserId,
            endTime,
            bidIncrement: 30,
            currency: 'HKD' as const,
            status: 'ended' as const,
            createdBy: creatorUserId,
            category: template.category,
          });
          await addAuctionImage({ auctionId: newAuction.id, imageUrl, displayOrder: 0 });
          await dbPlaceBid({
            auctionId: newAuction.id,
            userId: winnerUserId,
            bidAmount: winningPrice.toString(),
            isAnonymous: 0,
          });
          await autoDeductCommissionOnAuctionEnd(newAuction.id).catch(() => {});
          results.push({ auctionId: newAuction.id, winningPrice, title: `【測試結標】${template.title}`, winnerName });
        }

        return { items: results, count: results.length };
      }),

    adminGenerateAuctionResult: protectedProcedure
      .input(z.object({
        merchantUserId: z.number().int().positive(),
        count: z.number().int().min(1).max(30).default(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        const { merchantProducts: mpTable } = await import('../drizzle/schema');
        const { eq, inArray } = await import('drizzle-orm');

        // 隨機中文名生成
        const surnames = ['陳', '李', '張', '劉', '黃', '吳', '鄭', '王', '林', '周', '何', '梁', '盧', '蔡', '謝', '羅', '曾', '許', '鄧', '馮'];
        const givenNames = ['志明', '偉強', '嘉倫', '美玲', '小燕', '建國', '麗雯', '文輝', '子聰', '翠珊', '逸飛', '寶儀', '家豪', '欣怡', '浩然', '敏儀', '俊傑', '雅詩', '永康', '碧珊'];
        const randomName = () => surnames[Math.floor(Math.random() * surnames.length)] + givenNames[Math.floor(Math.random() * givenNames.length)];

        // 取該商戶的出售商品
        const products = await db
          .select()
          .from(mpTable)
          .where(eq(mpTable.merchantId, input.merchantUserId));

        if (products.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '此用戶沒有出售商品，請先生成出售商品' });

        // 隨機抽取（允許重複抽，但優先不重複）
        const shuffled = [...products].sort(() => Math.random() - 0.5);
        const picked = Array.from({ length: input.count }, (_, i) => shuffled[i % shuffled.length]);

        const results: { auctionId: number; winningPrice: number; title: string; winnerName: string }[] = [];

        for (const product of picked) {
          const winningPrice = Number(product.price);
          const startingPrice = Math.floor(winningPrice * 0.5);
          const endTime = new Date(Date.now() - 60 * 60 * 1000);
          const fakeWinnerName = randomName();

          // 取商品圖片
          let imageUrl: string | null = null;
          try {
            const imgs = product.images ? JSON.parse(product.images) : [];
            imageUrl = Array.isArray(imgs) && imgs.length > 0 ? (imgs[0]?.imageUrl ?? imgs[0]) : null;
          } catch {}
          imageUrl = imageUrl ?? await getAnyExistingImageUrl() ?? 'https://placehold.co/400x400/d4af37/ffffff?text=拍賣';

          // 以 admin 作 highestBidderId（系統操作），但展示假名字
          const adminUserId = ctx.user.id;
          const newAuction = await createAuction({
            title: product.title,
            description: product.description ?? '',
            startingPrice: startingPrice.toString(),
            currentPrice: winningPrice.toString(),
            highestBidderId: adminUserId,
            endTime,
            bidIncrement: 30,
            currency: (product.currency ?? 'HKD') as 'HKD' | 'USD' | 'CNY' | 'GBP',
            status: 'ended' as const,
            createdBy: input.merchantUserId,
            category: (product.category ?? '其他') as any,
          });
          await addAuctionImage({ auctionId: newAuction.id, imageUrl, displayOrder: 0 });
          await autoDeductCommissionOnAuctionEnd(newAuction.id).catch(() => {});
          results.push({ auctionId: newAuction.id, winningPrice, title: product.title, winnerName: fakeWinnerName });
        }

        return { items: results, count: results.length };
      }),

    adminGenerateTestListings: protectedProcedure
      .input(z.object({
        merchantUserId: z.number().int().positive(),
        count: z.number().int().min(1).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can generate test listings' });
        }
        const testItems = [
          { title: '1981年香港五毫硬幣', desc: '英女皇頭像，品相良好' },
          { title: '1967年香港一毫', desc: '英女皇頭像，流通品' },
          { title: '1975年香港一元', desc: '皇冠獅子圖案，原光' },
          { title: '1978年香港二毫', desc: '英女皇頭像，少見年份' },
          { title: '1985年香港五元', desc: '港督時代發行，普通品' },
          { title: '1993年香港十元', desc: '回歸前版本，品相極佳' },
          { title: '1997年香港金紫荊紀念幣', desc: '回歸紀念，原盒附證書' },
          { title: '1941年香港一仙', desc: '二戰前發行，稀有' },
          { title: '1863年香港一仙銅幣', desc: '早期殖民地幣，珍貴' },
          { title: '1935年香港一毫銀幣', desc: '喬治五世頭像，銀光好' },
        ];
        const prices = [50, 80, 100, 120, 150, 200, 250, 300, 380, 500];
        const increments = [10, 20, 30, 50];
        // Reuse any existing image URL from DB; fallback to a gold placeholder if none exist yet
        const existingImageUrl = await getAnyExistingImageUrl();
        const imageUrl = existingImageUrl ?? 'https://placehold.co/400x400/d4af37/ffffff?text=TEST';

        const created: number[] = [];
        const placeholderEndTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days placeholder
        for (let i = 0; i < input.count; i++) {
          const template = testItems[i % testItems.length];
          const suffix = input.count > testItems.length ? ` (${Math.floor(i / testItems.length) + 1})` : '';
          const startingPrice = prices[i % prices.length];
          const bidIncrement = increments[i % increments.length];
          const newAuction = await createAuction({
            title: `【測試】${template.title}${suffix}`,
            description: `${template.desc}｜系統測試用拍品，請勿出價`,
            startingPrice: startingPrice.toString(),
            currentPrice: startingPrice.toString(),
            endTime: placeholderEndTime,
            bidIncrement,
            currency: 'HKD' as const,
            status: 'draft' as const,
            createdBy: input.merchantUserId,
          });
          await addAuctionImage({ auctionId: newAuction.id, imageUrl, displayOrder: 0 });
          created.push(newAuction.id);
        }
        return { created: created.length, ids: created };
      }),

    relist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can relist auctions' });
        }
        const original = await getAuctionById(input.id);
        if (!original) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });

        // Create a new draft with the same details, resetting price and bids
        const newAuction = await createAuction({
          title: original.title,
          description: original.description ?? undefined,
          startingPrice: original.startingPrice,
          currentPrice: original.startingPrice, // reset to starting price
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days
          status: 'draft',
          bidIncrement: original.bidIncrement,
          currency: original.currency,
          createdBy: ctx.user.id,
          relistSourceId: input.id, // track the original auction
        });

        // Copy images from original auction
        const originalImages = await getAuctionImages(input.id);
        for (const img of originalImages) {
          await addAuctionImage({
            auctionId: newAuction.id,
            imageUrl: img.imageUrl,
            displayOrder: img.displayOrder,
          });
        }

        return { success: true, newAuctionId: newAuction.id };
      }),

    updateStartingPrice: protectedProcedure
      .input(z.object({
        id: z.number(),
        startingPrice: z.number().min(0, '起拍價不能為負數'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update starting price' });
        }
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.status === 'ended') throw new TRPCError({ code: 'BAD_REQUEST', message: '已結束的拍賣不可修改' });

        // Verify no bids exist
        const bidHistory = await getBidHistory(input.id);
        if (bidHistory.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已有出價記錄，不能修改起拍價' });
        }

        await updateAuction(input.id, {
          startingPrice: String(input.startingPrice),
          currentPrice: String(input.startingPrice),
        });

        return { success: true };
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can archive auctions' });
        }
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.status !== 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已結束的拍賣才能封存' });
        }
        await updateAuction(input.id, { archived: 1, archivedAt: new Date() });
        return { success: true };
      }),

    getArchived: protectedProcedure
      .input(z.object({
        category: z.string().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).optional().refine(
        (val) => {
          if (!val || !val.dateFrom || !val.dateTo) return true;
          return val.dateFrom <= val.dateTo;
        },
        { message: "起始日期不能晚於結束日期" }
      ))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can view archived auctions' });
        }
        const hasFilter = input && (input.category || input.dateFrom || input.dateTo);
        const archivedList = hasFilter
          ? await getArchivedAuctionsFiltered({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              category: input!.category as any,
              dateFrom: input!.dateFrom,
              dateTo: input!.dateTo,
            })
          : await getArchivedAuctions();
        const withImages = await Promise.all(
          archivedList.map(async (auction: { id: number; highestBidderName?: string | null; highestBidderIsAnonymous?: number; [key: string]: unknown }) => {
            // Admin sees real name + (匿名) marker for archived auctions
            let highestBidderName = auction.highestBidderName ?? null;
            if (auction.highestBidderIsAnonymous === 1) {
              highestBidderName = `${highestBidderName ?? '未知'} (匿名)`;
            }
            return {
              ...auction,
              highestBidderName,
              images: await getAuctionImages(auction.id),
            };
          })
        );
        return withImages;
      }),

    permanentDelete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can permanently delete auctions' });
        }
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (!auction.archived) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已封存的拍賣才能永久刪除' });
        }
        await deleteAuction(input.id);
        return { success: true };
      }),

    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can restore auctions' });
        }
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (!auction.archived) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣並未被封存' });
        }
        await updateAuction(input.id, { archived: 0 });
        return { success: true };
      }),

    batchRestore: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can batch restore auctions' });
        }
        const results = await Promise.allSettled(
          input.ids.map(async (id) => {
            const auction = await getAuctionById(id);
            if (!auction || !auction.archived) return { id, skipped: true };
            await updateAuction(id, { archived: 0 });
            return { id, success: true };
          })
        );
        const succeeded = results.filter(
          (r) => r.status === 'fulfilled' && (r.value as { success?: boolean }).success
        ).length;
        const skipped = results.filter(
          (r) => r.status === 'fulfilled' && (r.value as { skipped?: boolean }).skipped
        ).length;
        return { succeeded, skipped, total: input.ids.length };
      }),

    // ── Proxy Bidding ────────────────────────────────────────────────────────
    setProxyBid: protectedProcedure
      .input(z.object({
        auctionId: z.number(),
        maxAmount: z.number().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 停權檢查
        if ((ctx.user as any).isBanned === 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您的帳號已被停權，無法進行代理出價' });
        }
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy === ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: '不能競投自己刊登的拍賣' });
        if (auction.status !== 'active') throw new TRPCError({ code: 'BAD_REQUEST', message: '拍賣已結束，無法設定代理出價' });
        if (new Date() > auction.endTime) throw new TRPCError({ code: 'BAD_REQUEST', message: '拍賣已結束，無法設定代理出價' });

        const currentPrice = parseFloat(auction.currentPrice.toString());
        const startingPrice = parseFloat(auction.startingPrice.toString());
        const hasExistingBid = !!auction.highestBidderId;
        const minAllowed = hasExistingBid ? currentPrice + (auction.bidIncrement ?? 30) : startingPrice;

        if (input.maxAmount < minAllowed) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `代理出價上限必須至少為 HK$${minAllowed}`,
          });
        }

        // Loyalty 等級限制：銅牌每月配額 + 銀牌單次上限
        try {
          await enforceAutoBidLimit(ctx.user.id, input.maxAmount);
        } catch (err) {
          throw new TRPCError({ code: 'FORBIDDEN', message: err instanceof Error ? err.message : '代理出價權限不足' });
        }

        await setProxyBid(input.auctionId, ctx.user.id, input.maxAmount);
        return { success: true };
      }),

    getMyProxyBid: protectedProcedure
      .input(z.object({ auctionId: z.number() }))
      .query(async ({ input, ctx }) => {
        const proxy = await getProxyBid(input.auctionId, ctx.user.id);
        if (!proxy) return null;
        return {
          maxAmount: parseFloat(proxy.maxAmount.toString()),
          isActive: proxy.isActive === 1,
          updatedAt: proxy.updatedAt,
        };
      }),

    cancelProxyBid: protectedProcedure
      .input(z.object({ auctionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await deactivateProxyBid(input.auctionId, ctx.user.id);
        return { success: true };
      }),

    getProxyBidLogs: publicProcedure
      .input(z.object({ auctionId: z.number() }))
      .query(async ({ input }) => {
        const logs = await getProxyBidLogs(input.auctionId);
        return logs.map((log: { id: number; round: number; triggerUserId: number; triggerUserName: string; triggerAmount: string | number; proxyUserId: number; proxyUserName: string; proxyAmount: string | number; createdAt: Date }) => ({
          id: log.id,
          round: log.round,
          triggerUserId: log.triggerUserId,
          triggerUserName: log.triggerUserName,
          triggerAmount: parseFloat(log.triggerAmount.toString()),
          proxyUserId: log.proxyUserId,
          proxyUserName: log.proxyUserName,
          proxyAmount: parseFloat(log.proxyAmount.toString()),
          createdAt: log.createdAt,
        }));
      }),

    auctionBidHistory: publicProcedure
      .input(z.object({ auctionId: z.number() }))
      .query(async ({ input, ctx }) => {
        const history = await getBidHistory(input.auctionId);
        const isAdmin = ctx.user?.role === 'admin';
        return history.map((b: { id: number; auctionId: number; userId: number | null; bidAmount: string | number; createdAt: Date; username: string | null; memberLevel?: string | null; isAnonymous?: number }) => ({
          id: b.id,
          userId: b.userId,
          // Admin sees real name with anonymous marker; public sees '匿名買家'
          username: b.isAnonymous === 1
            ? (isAdmin ? `${b.username ?? '未知'} (匿名)` : '🕵️ 匿名買家')
            : (b.username ?? '匿名'),
          bidAmount: parseFloat(b.bidAmount.toString()),
          createdAt: b.createdAt,
          memberLevel: b.memberLevel ?? 'bronze',
          isAnonymous: b.isAnonymous === 1,
        }));
      }),
  }),

  notificationSettings: router({
    get: protectedProcedure.query(async () => {
      const settings = await getNotificationSettings();
      return settings ?? {
        senderName: 'hongxcollections',
        senderEmail: 'ywkyee@gmail.com',
        enableOutbid: 1,
        enableWon: 1,
        enableEndingSoon: 1,
        endingSoonMinutes: 60,
        enableAntiSnipe: 1,
        paymentInstructions: null as string | null,
        deliveryInfo: null as string | null,
      };
    }),

    update: protectedProcedure
      .input(z.object({
        senderName: z.string().min(1).max(128).optional(),
        senderEmail: z.string().email().optional(),
        enableOutbid: z.number().min(0).max(1).optional(),
        enableWon: z.number().min(0).max(1).optional(),
        enableEndingSoon: z.number().min(0).max(1).optional(),
        endingSoonMinutes: z.number().min(5).max(1440).optional(),
        enableAntiSnipe: z.number().min(0).max(1).optional(),
        paymentInstructions: z.string().max(2000).nullable().optional(),
        deliveryInfo: z.string().max(2000).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const ok = await upsertNotificationSettings(input);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save settings' });
        return { success: true };
      }),

    testEndingSoon: protectedProcedure
      .input(z.object({ auctionId: z.number(), origin: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await notifyEndingSoon(input.auctionId, input.origin ?? '');
        return { success: true };
      }),

    testWon: protectedProcedure
      .input(z.object({ auctionId: z.number(), origin: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await notifyWon(input.auctionId, input.origin ?? '');
        return { success: true };
      }),
  }),

  users: router({
    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllUsers();
      }),
    setMemberLevel: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), memberLevel: z.enum(['bronze', 'silver', 'gold', 'vip']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const ok = await setUserMemberLevel(input.userId, input.memberLevel);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to set member level' });
        return { success: true };
      }),
    updateEmail: protectedProcedure
      .input(z.object({ email: z.union([z.string().email(), z.literal('')]) }))
      .mutation(async ({ input, ctx }) => {
        const ok = await updateUserEmail(ctx.user.id, input.email);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update email' });
        return { success: true };
      }),

    updateName: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .mutation(async ({ input, ctx }) => {
        const ok = await updateUserName(ctx.user.id, input.name.trim());
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update name' });
        return { success: true };
      }),

    uploadAvatar: protectedProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64, 'base64');
        if (buffer.length > 2 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片不能超過 2MB' });
        }
        const ext = input.mimeType.split('/')[1];
        const key = `avatars/user_${ctx.user.id}_${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        const ok = await updateUserPhotoUrl(ctx.user.id, url);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save avatar' });
        return { photoUrl: url };
      }),

    getNotificationPrefs: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
        return {
          notifyOutbid: user.notifyOutbid ?? 1,
          notifyWon: user.notifyWon ?? 1,
          notifyEndingSoon: user.notifyEndingSoon ?? 1,
        };
      }),

    updateNotificationPrefs: protectedProcedure
      .input(z.object({
        notifyOutbid: z.number().int().min(0).max(1),
        notifyWon: z.number().int().min(0).max(1),
        notifyEndingSoon: z.number().int().min(0).max(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const ok = await updateUserNotificationPrefs(ctx.user.id, input);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update notification preferences' });
        return { success: true };
      }),

    getDefaultAnonymous: protectedProcedure
      .query(async ({ ctx }) => {
        const user = await getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
        return { defaultAnonymous: (user as { defaultAnonymous?: number }).defaultAnonymous ?? 0 };
      }),

    setDefaultAnonymous: protectedProcedure
      .input(z.object({ defaultAnonymous: z.number().int().min(0).max(1) }))
      .mutation(async ({ input, ctx }) => {
        const db = await (await import('./db')).getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        const { users: usersTable } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(usersTable).set({ defaultAnonymous: input.defaultAnonymous } as Record<string, unknown>).where(eq(usersTable.id, ctx.user.id));
        return { success: true };
      }),

    publicProfile: publicProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const stats = await getUserPublicStats(input.userId);
        if (!stats) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該用戶' });
        return stats;
      }),

    // Admin: get all anonymous bids with real user info
    getAnonymousBids: protectedProcedure
      .input(z.object({ page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(100).optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can view anonymous bids' });
        const result = await getAnonymousBids({ page: input.page, pageSize: input.pageSize });
        return result;
      }),

    getDashboardStats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can view dashboard stats' });
        const stats = await getDashboardStats();
        return stats;
      }),

    // Admin: get all users with extended info (phone, merchant status, deposit info)
    listAllExtended: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllUsersExtended();
      }),

    // Admin: get won auctions for a specific user
    getWonAuctions: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getWonAuctionsByUser(input.userId);
      }),

    // Admin: get comprehensive stats for a single user
    adminUserStats: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const stats = await adminGetUserStats(input.userId);
        if (!stats) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到用戶統計' });
        return stats;
      }),

    getMerchantOrders: protectedProcedure
      .input(z.object({ merchantUserId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getWonOrdersByCreator(input.merchantUserId);
      }),

    // Admin: update any user's profile (name, email, phone, memberLevel, isBanned, monthlyVideoQuota)
    adminUpdate: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(20).optional(),
        memberLevel: z.enum(['bronze', 'silver', 'gold', 'vip']).optional(),
        isBanned: z.number().int().min(0).max(1).optional(),
        monthlyVideoQuota: z.number().int().min(0).max(1000).optional(),
        maxVideoSeconds: z.number().int().min(1).max(3600).optional(),
        fbRefreshPreviewEnabled: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { userId, memberLevel, isBanned, monthlyVideoQuota, maxVideoSeconds, fbRefreshPreviewEnabled, ...profileData } = input;
        const userUpdate: { name?: string; email?: string; phone?: string; isBanned?: number; monthlyVideoQuota?: number; maxVideoSeconds?: number } = { ...profileData };
        if (isBanned !== undefined) userUpdate.isBanned = isBanned;
        if (monthlyVideoQuota !== undefined) userUpdate.monthlyVideoQuota = monthlyVideoQuota;
        if (maxVideoSeconds !== undefined) userUpdate.maxVideoSeconds = maxVideoSeconds;
        if (Object.keys(userUpdate).length > 0) {
          const ok = await adminUpdateUser(userId, userUpdate);
          if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新用戶資料失敗' });
        }
        if (memberLevel) {
          const ok = await setUserMemberLevel(userId, memberLevel);
          if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新會員等級失敗' });
        }
        if (fbRefreshPreviewEnabled !== undefined) {
          const ok = await adminSetMerchantFbRefreshPreview(userId, fbRefreshPreviewEnabled);
          if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新 FB 預覽掣設定失敗' });
        }
        return { success: true };
      }),

    // Admin: 修改商戶當前訂閱嘅到期日（影響系統自動過期判定）
    adminUpdateSubscriptionEndDate: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        endDate: z.string().min(1, '請選擇日期'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const dt = new Date(input.endDate);
        if (isNaN(dt.getTime())) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '日期格式錯誤' });
        }
        const res = await adminUpdateSubscriptionEndDate(input.userId, dt);
        if (!res.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: res.reason ?? '更新失敗' });
        }
        return res;
      }),

    // Admin: 設定任何用戶的密碼（設定後會員首次登入須強制更改）
    adminSetPassword: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        newPassword: z.string().min(6, '密碼至少需要6個字符').max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const target = await getUserById(input.userId);
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該用戶' });
        if (target.role === 'admin') throw new TRPCError({ code: 'BAD_REQUEST', message: '不能修改管理員密碼' });
        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        const ok = await adminSetUserPassword(input.userId, hashedPassword);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '設定密碼失敗' });
        return { success: true };
      }),

    // 會員：強制更改密碼（管理員設定後首次登入觸發，清除 mustChangePassword 旗標）
    forceChangePassword: protectedProcedure
      .input(z.object({
        newPassword: z.string().min(6, '密碼至少需要6個字符').max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const hashedPassword = await bcrypt.hash(input.newPassword, 10);
        const dbConn = await (await import('./db')).getDb();
        if (!dbConn) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '數據庫不可用' });
        const { users: usersTable } = await import('../drizzle/schema');
        const { eq: eqFn } = await import('drizzle-orm');
        await dbConn.update(usersTable)
          .set({ password: hashedPassword, mustChangePassword: 0 } as Record<string, unknown>)
          .where(eqFn(usersTable.id, ctx.user.id));
        return { success: true };
      }),

    // Admin: update merchant deposit settings
    adminUpdateDeposit: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        requiredDeposit: z.number().min(0).optional(),
        commissionRate: z.number().min(0).max(1).optional(),
        productCommissionRate: z.number().min(0).max(1).optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { userId, ...settings } = input;
        const ok = await updateSellerDepositSettings(userId, settings);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新保證金設定失敗' });
        return { success: true };
      }),

    // Admin: delete user and all related data
    adminDelete: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (input.userId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: '不能刪除自己的帳號' });
        const target = await getUserById(input.userId);
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到該用戶' });
        if (target.role === 'admin') throw new TRPCError({ code: 'BAD_REQUEST', message: '不能刪除管理員帳號' });
        const result = await deleteUserAndData(input.userId);
        if (!result.success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error ?? '刪除失敗' });
        return { success: true };
      }),

    // Admin: purge all auction-related data for a merchant (keep the user account)
    adminPurgeMerchantData: protectedProcedure
      .input(z.object({ merchantUserId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (input.merchantUserId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: '不能清空自己的資料' });
        const result = await purgeMerchantAuctionData(input.merchantUserId);
        if (!result.success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error ?? '清空失敗' });
        return result;
      }),

    // Admin: clear OWN auction data (createdBy OR highestBidder = admin) — raw SQL for reliability
    adminClearOwnAuctions: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const adminId = ctx.user.id;
        const pool = await getRawPool();
        try {
          // 1. Find all auction IDs where admin is creator OR highest bidder
          const [rows] = await pool.execute(
            'SELECT id FROM `auctions` WHERE `createdBy` = ? OR `highestBidderId` = ?',
            [adminId, adminId]
          ) as any[];
          const ids: number[] = (rows as any[]).map((r: any) => r.id);
          console.log(`[adminClearOwnAuctions] adminId=${adminId}, found ${ids.length} auctions:`, ids);

          if (ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            // Disable FK checks to avoid any constraint issues
            await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
            try {
              await pool.execute(`DELETE FROM \`proxyBidLogs\` WHERE \`auctionId\` IN (${placeholders})`, ids);
              await pool.execute(`DELETE FROM \`proxyBids\` WHERE \`auctionId\` IN (${placeholders})`, ids);
              await pool.execute(`DELETE FROM \`bids\` WHERE \`auctionId\` IN (${placeholders})`, ids);
              await pool.execute(`DELETE FROM \`auctionImages\` WHERE \`auctionId\` IN (${placeholders})`, ids);
              await pool.execute(`DELETE FROM \`favorites\` WHERE \`auctionId\` IN (${placeholders})`, ids);
              await pool.execute(`DELETE FROM \`deposit_transactions\` WHERE \`relatedAuctionId\` IN (${placeholders})`, ids);
              await pool.execute(`DELETE FROM \`commissionRefundRequests\` WHERE \`auctionId\` IN (${placeholders})`, ids);
              // Delete the auctions themselves
              const [delRes] = await pool.execute(`DELETE FROM \`auctions\` WHERE \`id\` IN (${placeholders})`, ids) as any[];
              console.log(`[adminClearOwnAuctions] Deleted auctions result:`, (delRes as any).affectedRows);
            } finally {
              await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
            }
          }

          // 2. Clean up any remaining bids BY admin on other auctions
          await pool.execute('DELETE FROM `bids` WHERE `userId` = ?', [adminId]);
          await pool.execute('DELETE FROM `proxyBids` WHERE `userId` = ?', [adminId]);
          await pool.execute('DELETE FROM `proxyBidLogs` WHERE `proxyUserId` = ? OR `triggerUserId` = ?', [adminId, adminId]);

          console.log(`[adminClearOwnAuctions] Done. Deleted ${ids.length} auctions for adminId=${adminId}`);
          return { success: true, deletedAuctions: ids.length, deletedBids: 0, deletedImages: 0, deletedProxyBids: 0, deletedFavorites: 0, deletedDepositTxns: 0, deletedRefundRequests: 0, deletedExternalBids: 0 };
        } catch (err) {
          console.error('[adminClearOwnAuctions] Error:', err);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err instanceof Error ? err.message : '清除失敗' });
        }
      }),

    // Admin: clear OWN merchant products
    adminClearOwnProducts: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        try {
          const [result] = await pool.execute(
            'DELETE FROM `merchantProducts` WHERE `merchantId` = ?',
            [ctx.user.id]
          ) as any[];
          const deleted = (result as any).affectedRows ?? 0;
          console.log(`[adminClearOwnProducts] adminId=${ctx.user.id}, deleted ${deleted} products`);
          return { deleted };
        } catch (err) {
          console.error('[adminClearOwnProducts] Error:', err);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err instanceof Error ? err.message : '清除失敗' });
        }
      }),

    // Admin: one-shot cleanup of all orphan merchant data (records whose userId no longer exists in users table)
    adminCleanOrphanData: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await cleanOrphanMerchantData();
        if (!result.success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error ?? '清理失敗' });
        return result;
      }),

    // Admin: revoke a merchant's approved status (keep user account, remove from marketplace)
    adminRevokeMerchant: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (input.userId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: '不能撤銷自己的商戶資格' });
        const result = await revokeMerchantStatus(input.userId);
        if (!result.success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error ?? '撤銷失敗' });
        return { success: true };
      }),

    // Admin: export deposit tier presets + subscription plans as JSON
    adminExportPackages: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return exportPackagesData();
      }),

    // Admin: import deposit tier presets + subscription plans from JSON
    adminImportPackages: protectedProcedure
      .input(z.object({
        depositTiers: z.array(z.object({
          id: z.number().int(),
          name: z.string(),
          amount: z.string(),
          maintenancePct: z.string(),
          warningPct: z.string(),
          commissionRate: z.string(),
          description: z.string().nullable(),
          isActive: z.number().int(),
          sortOrder: z.number().int(),
        })),
        subscriptionPlans: z.array(z.object({
          id: z.number().int(),
          name: z.string(),
          memberLevel: z.enum(["bronze", "silver", "gold", "vip"]),
          monthlyPrice: z.string(),
          yearlyPrice: z.string(),
          maxListings: z.number().int(),
          commissionDiscount: z.string(),
          description: z.string().nullable(),
          benefits: z.string().nullable(),
          sortOrder: z.number().int(),
          isActive: z.number().int(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await importPackagesData(input);
        if (!result.success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error ?? '匯入失敗' });
        return result;
      }),

    // Admin: create a new user account directly
    adminCreateUser: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        phone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        password: z.string().min(1).max(128),
        memberLevel: z.enum(["bronze", "silver", "gold", "vip"]).default("bronze"),
        role: z.enum(["user", "admin"]).default("user"),
        isMerchant: z.boolean().default(false),
        merchantName: z.string().max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (!input.phone && !input.email) throw new TRPCError({ code: 'BAD_REQUEST', message: '請提供手機或電郵' });
        const identifier = input.phone ?? input.email!;
        const openId = `local_${identifier}`;
        const db = await (await import('./db')).getDb();
        const { users: usersTable } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        // Check duplicate
        const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.openId, openId)).limit(1);
        if (existing.length > 0) throw new TRPCError({ code: 'CONFLICT', message: '該手機或電郵已有帳號' });
        const hashedPassword = await bcrypt.hash(input.password, 10);
        const [result] = await db.insert(usersTable).values({
          openId,
          name: input.name,
          phone: input.phone ?? null,
          email: input.email ?? null,
          password: hashedPassword,
          loginMethod: input.phone ? 'phone' : 'email',
          role: input.role,
          memberLevel: input.memberLevel,
        });
        const newUserId = (result as { insertId: number }).insertId;
        if (input.isMerchant) {
          await getOrCreateSellerDeposit(newUserId);
          await createMerchantApplication({
            userId: newUserId,
            contactName: sanitizeUserText(input.name),
            merchantName: sanitizeUserText(input.merchantName || input.name),
            selfIntro: '',
            whatsapp: input.phone ?? '',
            yearsExperience: '0',
            merchantIcon: null,
            categories: '[]',
            samplePhotos: '[]',
            status: 'approved' as const,
            adminNote: '管理員直接建立',
          });

          // ── 隨機分配保證金套餐 ──
          try {
            const tiers = await listDepositTierPresets(true);
            if (tiers.length > 0) {
              const tier = tiers[Math.floor(Math.random() * tiers.length)];
              const settings: { requiredDeposit?: number; warningDeposit?: number; commissionRate?: number; productCommissionRate?: number } = {};
              const tierAmount = tier.amount ? parseFloat(String(tier.amount)) : 0;
              const mPct = (tier as any).maintenancePct ? parseFloat(String((tier as any).maintenancePct)) : 80;
              const wPct = (tier as any).warningPct ? parseFloat(String((tier as any).warningPct)) : 60;
              if (tierAmount > 0) {
                // requiredDeposit = 維持水平 = tier.amount × maintenancePct / 100
                settings.requiredDeposit = Math.round((tierAmount * mPct) / 100 * 100) / 100;
                settings.warningDeposit = Math.round((tierAmount * wPct) / 100 * 100) / 100;
              }
              if (tier.commissionRate) settings.commissionRate = parseFloat(String(tier.commissionRate));
              if ((tier as any).productCommissionRate) settings.productCommissionRate = parseFloat(String((tier as any).productCommissionRate));
              await updateSellerDepositSettings(newUserId, settings);
              // 初始保證金餘額 = 套餐所需金額 × 2
              if (tierAmount > 0) {
                await topUpDeposit(newUserId, tierAmount * 2, `管理員建立商戶，初始保證金（套餐金額 ×2）`, ctx.user.id);
              }
              console.log(`[adminCreateUser] Applied deposit tier "${tier.name}" to user ${newUserId}, initial balance = ${tierAmount * 2}`);
            }
          } catch (err) {
            console.error('[adminCreateUser] Failed to apply deposit tier:', err);
          }

          // ── 隨機分配月費訂閱 ──
          try {
            const plans = await getActiveSubscriptionPlans();
            if (plans.length > 0) {
              const plan = plans[Math.floor(Math.random() * plans.length)];
              const now = new Date();
              const endDate = new Date(now);
              endDate.setMonth(endDate.getMonth() + 1);
              const dbInner = await (await import('./db')).getDb();
              if (dbInner) {
                const { userSubscriptions: uSubTable } = await import('../drizzle/schema');
                await dbInner.insert(uSubTable).values({
                  userId: newUserId,
                  planId: plan.id,
                  billingCycle: 'monthly' as const,
                  status: 'active' as const,
                  startDate: now,
                  endDate: endDate,
                  approvedBy: ctx.user.id,
                  approvedAt: now,
                  adminNote: '管理員建立時自動分配',
                  remainingQuota: plan.maxListings ?? 0,
                  paymentMethod: null,
                  paymentReference: null,
                  paymentProofUrl: null,
                });
                // 更新會員等級：只升級，唔降級（保留 admin 揀嘅等級為下限）
                const LEVEL_ORDER: Record<string, number> = { bronze: 0, silver: 1, gold: 2, vip: 3 };
                const adminLvlRank = LEVEL_ORDER[input.memberLevel] ?? 0;
                const planLvlRank = LEVEL_ORDER[plan.memberLevel] ?? 0;
                if (planLvlRank > adminLvlRank) {
                  const { users: uTable } = await import('../drizzle/schema');
                  const { eq: eqInner } = await import('drizzle-orm');
                  await dbInner.update(uTable).set({ memberLevel: plan.memberLevel }).where(eqInner(uTable.id, newUserId));
                  console.log(`[adminCreateUser] Applied subscription plan "${plan.name}" to user ${newUserId}, level upgraded ${input.memberLevel} → ${plan.memberLevel}`);
                } else {
                  console.log(`[adminCreateUser] Applied subscription plan "${plan.name}" to user ${newUserId}, kept admin-chosen level ${input.memberLevel} (plan level ${plan.memberLevel} not higher)`);
                }
              }
            }
          } catch (err) {
            console.error('[adminCreateUser] Failed to apply subscription:', err);
          }
        }
        return { success: true, userId: newUserId };
      }),

    // Admin: list pending email reset requests
    getEmailResetRequests: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { getPendingResetRequests } = await import('./_core/resetRequestStore');
        return getPendingResetRequests();
      }),

    // Admin: mark a reset request as handled
    dismissEmailResetRequest: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { dismissResetRequest } = await import('./_core/resetRequestStore');
        dismissResetRequest(input.id);
        return { success: true };
      }),

    adminListRecentRegistrations: protectedProcedure
      .input(z.object({
        days: z.number().int().min(1).max(30).default(3),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getRecentRegistrations(input.days, input.page, input.pageSize);
      }),
  }),

  favorites: router({
    toggle: protectedProcedure
      .input(z.object({ auctionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return toggleFavorite(ctx.user.id, input.auctionId);
      }),
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserFavorites(ctx.user.id);
      }),
    ids: protectedProcedure
      .query(async ({ ctx }) => {
        return getFavoriteIds(ctx.user.id);
      }),
  }),

  wonAuctions: router({
    // 用戶得標記錄：已結束且自己是最高出價者
    myWon: protectedProcedure
      .query(async ({ ctx }) => {
        return getMyWonAuctions(ctx.user.id);
      }),

    // 買家：未付款／待處理嘅得標數量（badge 用）
    myPendingActionCount: protectedProcedure
      .query(async ({ ctx }) => {
        return countBuyerPendingWonAuctions(ctx.user.id);
      }),

    // 更新付款狀態（買家標記已付款；管理員可設定任何狀態）
    updatePaymentStatus: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        status: z.enum(['pending_payment', 'paid', 'delivered']),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user.role === 'admin';
        const result = await updatePaymentStatus(input.auctionId, input.status, ctx.user.id, isAdmin);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error ?? '更新失敗' });
        }
        return { success: true };
      }),

    // 管理員查看所有得標訂單
    allOrders: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        return getWonOrders();
      }),

    // 管理員重發得標通知 Email
    resendEmail: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        origin: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        const auction = await getAuctionById(input.auctionId);
        if (!auction || auction.status !== 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只能對已結束的拍賣重發通知' });
        }
        if (!auction.highestBidderId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣沒有得標者' });
        }
        const winner = await getUserById(auction.highestBidderId);
        if (!winner?.email) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '得標者尚未填寫電郵地址，無法發送通知' });
        }
        const settings = await getNotificationSettings();
        // Derive origin: prefer SITE_URL env var, then explicit input, then request headers
        const origin = getEmailOrigin(ctx.req as any) || input.origin || '';
        if (!settings?.senderEmail) {
          console.warn('[Email] resendEmail: senderEmail not configured in notification settings');
        }
        const { sendWonEmail } = await import('./email');
        const sent = await sendWonEmail({
          to: winner.email,
          senderName: settings?.senderName ?? 'hongxcollections',
          senderEmail: settings?.senderEmail ?? 'noreply@example.com',
          userName: winner.name ?? `用戶 #${auction.highestBidderId}`,
          auctionTitle: auction.title,
          auctionId: input.auctionId,
          finalPrice: parseFloat(auction.currentPrice.toString()),
          currency: auction.currency,
          auctionUrl: `${getEmailOrigin(ctx.req as any) || origin}/auctions/${input.auctionId}`,
          paymentInstructions: settings?.paymentInstructions ?? null,
          deliveryInfo: settings?.deliveryInfo ?? null,
        });
        if (!sent) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Email 發送失敗，請確認 Resend API 設定是否正確' });
        }
        return { success: true, sentTo: winner.email };
      }),

    // Admin: count all pending approvals (for nav badge)
    adminGetPendingCount: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') return { total: 0 };
        const db = await getDb();
        if (!db) return { total: 0 };
        try {
          const [r] = await db.execute(sql`
            SELECT (
              (SELECT COUNT(*) FROM merchantApplications WHERE status = 'pending') +
              (SELECT COUNT(*) FROM commissionRefundRequests WHERE status = 'pending') +
              (SELECT COUNT(*) FROM depositTopUpRequests WHERE status = 'pending') +
              (SELECT COUNT(*) FROM userSubscriptions WHERE status = 'pending') +
              (SELECT COUNT(*) FROM depositTierChangeRequests WHERE status = 'pending')
            ) AS total
          `);
          return { total: Number((r as any).total ?? 0) };
        } catch {
          return { total: 0 };
        }
      }),
  }),

  export: router({
    // 管理員匯出出價記錄 CSV
    bids: protectedProcedure
      .input(z.object({ auctionId: z.number().int().positive().optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can export bids' });
        return getAllBidsForExport(input.auctionId);
      }),
  }),

  sellerDeposits: router({
    // Get current user's deposit info
    myDeposit: protectedProcedure
      .query(async ({ ctx }) => {
        const deposit = await getOrCreateSellerDeposit(ctx.user.id);
        if (!deposit) return null;

        // 預警 / 維持門檻：以「商戶申請揀嘅 tier」為單一資料源計算，避免 DB 舊值唔同步
        let requiredDeposit = parseFloat(deposit.requiredDeposit.toString());
        let warningDeposit = parseFloat(String((deposit as { warningDeposit?: string | number }).warningDeposit ?? requiredDeposit * 2));
        try {
          const app = await getMerchantApplicationByUser(ctx.user.id);
          const tierId = (app as { chosenDepositTierId?: number | null } | null)?.chosenDepositTierId;
          if (tierId) {
            const tiers = await listDepositTierPresets(false);
            const tier = tiers.find(t => t.id === tierId);
            if (tier) {
              const tierAmt = tier.amount ? parseFloat(tier.amount.toString()) : 0;
              const mPct = (tier as { maintenancePct?: string | number }).maintenancePct ? parseFloat(String((tier as { maintenancePct?: string | number }).maintenancePct)) : 80;
              const wPct = (tier as { warningPct?: string | number }).warningPct ? parseFloat(String((tier as { warningPct?: string | number }).warningPct)) : 60;
              if (tierAmt > 0) {
                requiredDeposit = Math.round(tierAmt * mPct) / 100;
                warningDeposit = Math.round(tierAmt * wPct) / 100;
              }
            }
          }
        } catch (err) {
          console.error('[myDeposit] Failed to compute thresholds from tier:', err);
        }

        return {
          id: deposit.id,
          balance: parseFloat(deposit.balance.toString()),
          requiredDeposit,
          warningDeposit,
          commissionRate: parseFloat(deposit.commissionRate.toString()),
          productCommissionRate: parseFloat(String((deposit as { productCommissionRate?: string | number }).productCommissionRate ?? deposit.commissionRate)),
          currentTierId: (deposit as { currentTierId?: number | null }).currentTierId ?? null,
          isActive: deposit.isActive === 1,
        };
      }),

    // Check if current user can list
    canList: protectedProcedure
      .query(async ({ ctx }) => {
        return canSellerList(ctx.user.id);
      }),

    // Admin: get all seller deposits
    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllSellerDeposits();
      }),

    // Admin: get deposit for a specific user
    getByUser: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const deposit = await getOrCreateSellerDeposit(input.userId);
        if (!deposit) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到保證金記錄' });
        return {
          id: deposit.id,
          userId: deposit.userId,
          balance: parseFloat(deposit.balance.toString()),
          requiredDeposit: parseFloat(deposit.requiredDeposit.toString()),
          commissionRate: parseFloat(deposit.commissionRate.toString()),
          isActive: deposit.isActive === 1,
        };
      }),

    // Admin: top up deposit
    topUp: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        amount: z.number().positive(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await topUpDeposit(input.userId, input.amount, input.description ?? '', ctx.user.id);
        return result;
      }),

    // Admin: deduct commission
    deductCommission: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        amount: z.number().positive(),
        auctionId: z.number().int().positive(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await deductCommission(input.userId, input.amount, input.auctionId, input.description ?? '', ctx.user.id);
        return result;
      }),

    // Admin: refund commission
    refundCommission: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        amount: z.number().positive(),
        auctionId: z.number().int().positive(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await refundCommission(input.userId, input.amount, input.auctionId, input.description ?? '', ctx.user.id);
        return result;
      }),

    // Admin: adjust deposit balance
    adjust: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        amount: z.number(), // can be positive or negative
        description: z.string().min(1, '請填寫調整原因'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await adjustDeposit(input.userId, input.amount, input.description, ctx.user.id);
        return result;
      }),

    // Admin: update deposit settings
    updateSettings: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        requiredDeposit: z.number().min(0).optional(),
        warningDeposit: z.number().min(0).optional(),
        commissionRate: z.number().min(0).max(1).optional(),
        productCommissionRate: z.number().min(0).max(1).optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const ok = await updateSellerDepositSettings(input.userId, {
          requiredDeposit: input.requiredDeposit,
          warningDeposit: input.warningDeposit,
          commissionRate: input.commissionRate,
          productCommissionRate: input.productCommissionRate,
          isActive: input.isActive,
        });
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新失敗' });
        return { success: true };
      }),

    // Admin: get transactions for a user
    getTransactions: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getDepositTransactions(input.userId, input.limit, input.offset);
      }),

    // Admin: get all transactions
    getAllTransactions: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
      }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllDepositTransactions(input?.limit ?? 100, input?.offset ?? 0);
      }),

    // ── Deposit Top-Up Requests (merchant self-service) ──

    // Merchant: submit a top-up request
    submitTopUpRequest: protectedProcedure
      .input(z.object({
        tierId: z.number().int().positive().optional(),
        amount: z.number().positive('金額必須大於 0'),
        referenceNo: z.string().max(100).optional(),
        bank: z.string().max(100).optional(),
        note: z.string().max(500).optional(),
        receiptUrl: z.string().url().max(500).optional().or(z.literal('')),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createDepositTopUpRequest({
          userId: ctx.user.id,
          tierId: input.tierId,
          amount: input.amount,
          referenceNo: input.referenceNo,
          bank: input.bank,
          note: input.note,
          receiptUrl: input.receiptUrl || undefined,
        });
        return result;
      }),

    // Merchant: get own top-up requests
    myTopUpRequests: protectedProcedure
      .query(async ({ ctx }) => {
        return getMyDepositTopUpRequests(ctx.user.id);
      }),

    // Admin: get all top-up requests
    allTopUpRequests: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllDepositTopUpRequests();
      }),

    // Admin: approve or reject a top-up request
    reviewTopUpRequest: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(['approved', 'rejected']),
        adminNote: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await reviewDepositTopUpRequest(input.id, input.status, input.adminNote, ctx.user.id);
        return { success: true };
      }),
  }),

  // ── 保證金套餐設定 ──────────────────────────────────────────────────────────
  depositTiers: router({
    // Merchant/public: list active tiers to pick during top-up
    listActive: publicProcedure
      .query(async () => {
        return listDepositTierPresets(true);
      }),

    // Admin: list all tiers (including inactive)
    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return listDepositTierPresets(false);
      }),

    // Admin: create or update a tier
    upsert: protectedProcedure
      .input(z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(1).max(100),
        amount: z.number().positive(),
        maintenancePct: z.number().min(0).max(100),
        warningPct: z.number().min(0).max(100),
        commissionRate: z.number().min(0).max(1).optional(),
        productCommissionRate: z.number().min(0).max(1).optional(),
        description: z.string().max(500).optional().nullable(),
        isActive: z.number().int().min(0).max(1).optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const id = await upsertDepositTierPreset(input);
        return { success: true, id };
      }),

    // Admin: delete a tier
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await deleteDepositTierPreset(input.id);
        return { success: true };
      }),

    // ── 商戶轉保證金套餐 ──
    // 預覽差價（揀套餐前 call）
    previewSwitch: protectedProcedure
      .input(z.object({ toTierId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        return computeTierSwitchDiff(ctx.user.id, input.toTierId);
      }),

    // 商戶提交轉套餐申請
    requestChange: protectedProcedure
      .input(z.object({
        toTierId: z.number().int().positive(),
        paymentMethod: z.string().max(50).optional(),
        paymentReference: z.string().max(100).optional(),
        receiptUrl: z.string().max(500).optional(),
        note: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await requestTierChange(ctx.user.id, input);
        } catch (e) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : '提交失敗' });
        }
      }),

    // 商戶睇自己嘅申請紀錄
    myChangeRequests: protectedProcedure
      .query(async ({ ctx }) => {
        return listMyTierChangeRequests(ctx.user.id);
      }),

    // Admin: 列所有 tier change 申請
    listChangeRequests: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return listAllTierChangeRequests();
      }),

    // Admin: 批 / 拒
    reviewChangeRequest: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(['approved', 'rejected']),
        adminNote: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          await reviewTierChangeRequest(input.id, input.status, input.adminNote, ctx.user.id);
          return { success: true };
        } catch (e) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : '審核失敗' });
        }
      }),
  }),

  subscriptions: router({
    // ── Public: Get active plans ──
    getPlans: publicProcedure
      .query(async () => {
        return getActiveSubscriptionPlans();
      }),

    // ── User: Get my active subscription ──
    mySubscription: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserActiveSubscription(ctx.user.id);
      }),

    // ── User: Get my subscription history ──
    myHistory: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserSubscriptions(ctx.user.id);
      }),

    // ── User: Submit subscription request ──
    subscribe: protectedProcedure
      .input(z.object({
        planId: z.number().int().positive(),
        billingCycle: z.enum(['monthly', 'yearly']),
        paymentMethod: z.string().optional(),
        paymentReference: z.string().optional(),
        paymentProofUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 防止重複申請：已有任何 pending 訂閱（首次或續期）時拒絕
        const history = await getUserSubscriptions(ctx.user.id);
        const hasPending = (history as Array<{ status: string }>).some(s => s.status === 'pending');
        if (hasPending) throw new TRPCError({ code: 'BAD_REQUEST', message: '您已有待審核的訂閱申請，請耐心等候管理員確認收款後再操作。' });
        // Verify plan exists and is active
        const plan = await getSubscriptionPlanById(input.planId);
        if (!plan || !plan.isActive) throw new TRPCError({ code: 'NOT_FOUND', message: '訂閱計劃不存在或已停用' });
        return createUserSubscription({
          userId: ctx.user.id,
          planId: input.planId,
          billingCycle: input.billingCycle,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
          paymentProofUrl: input.paymentProofUrl,
        });
      }),

    // ── User: Submit renewal request (一鍵延長) ──
    renew: protectedProcedure
      .input(z.object({
        paymentMethod: z.string().optional(),
        paymentReference: z.string().optional(),
        paymentProofUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 揾 parent：優先 active，冇就揾最近 expired（允許過期後申請續期）
        const active = await getUserActiveSubscription(ctx.user.id);
        const history = await getUserSubscriptions(ctx.user.id);
        type _HistRow = { id: number; planId: number; billingCycle: string; status: string; isRenewal?: number | null };
        const parentSub: _HistRow | null = (active as _HistRow | null)
          ?? (history as _HistRow[]).find(h => h.status === 'expired') ?? null;
        if (!parentSub) throw new TRPCError({ code: 'BAD_REQUEST', message: '冇訂閱記錄，請直接揀計劃訂閱' });
        // 防止重複申請：check 有冇 pending 嘅 renewal
        const pendingRenewal = (history as Array<{ status: string; isRenewal?: number | null }>).find(
          h => h.status === 'pending' && h.isRenewal === 1
        );
        if (pendingRenewal) throw new TRPCError({ code: 'BAD_REQUEST', message: '已有續期申請待審核，請耐心等候' });
        return createUserSubscription({
          userId: ctx.user.id,
          planId: parentSub.planId,
          billingCycle: parentSub.billingCycle as 'monthly' | 'yearly',
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
          paymentProofUrl: input.paymentProofUrl,
          isRenewal: true,
          parentSubscriptionId: parentSub.id,
        });
      }),

    // ── User: Upload payment proof image ──
    uploadPaymentProof: protectedProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.base64, 'base64');
        const ext = input.filename.split('.').pop() || 'jpg';
        const key = `payment-proofs/${ctx.user.id}/${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, `image/${ext}`);
        return { url };
      }),

    // ── Admin: Get all plans (including inactive) ──
    adminListPlans: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllSubscriptionPlans();
      }),

    // ── Admin: Create plan ──
    adminCreatePlan: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        memberLevel: z.enum(['bronze', 'silver', 'gold', 'vip']),
        monthlyPrice: z.number().min(0),
        yearlyPrice: z.number().min(0),
        maxListings: z.number().int().min(0).default(0),
        commissionDiscount: z.number().min(0).max(1).default(0),
        description: z.string().optional(),
        benefits: z.string().optional(),
        sortOrder: z.number().int().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return createSubscriptionPlan(input);
      }),

    // ── Admin: Update plan ──
    adminUpdatePlan: protectedProcedure
      .input(z.object({
        planId: z.number().int().positive(),
        name: z.string().min(1).optional(),
        memberLevel: z.enum(['bronze', 'silver', 'gold', 'vip']).optional(),
        monthlyPrice: z.number().min(0).optional(),
        yearlyPrice: z.number().min(0).optional(),
        maxListings: z.number().int().min(0).optional(),
        commissionDiscount: z.number().min(0).max(1).optional(),
        description: z.string().optional(),
        benefits: z.string().optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { planId, ...data } = input;
        return updateSubscriptionPlan(planId, data);
      }),

    // ── Admin: Delete plan ──
    adminDeletePlan: protectedProcedure
      .input(z.object({ planId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return deleteSubscriptionPlan(input.planId);
      }),

    // ── Admin: List all subscriptions ──
    adminListSubscriptions: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllUserSubscriptions(input?.status);
      }),

    // ── Admin: Manually adjust a subscription's remaining quota ──
    adminUpdateQuota: protectedProcedure
      .input(z.object({
        subscriptionId: z.number().int().positive(),
        remainingQuota: z.number().int().min(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return adminSetSubscriptionQuota(input.subscriptionId, input.remainingQuota);
      }),

    adminUpdateEndDate: protectedProcedure
      .input(z.object({
        subscriptionId: z.number().int().positive(),
        endDate: z.string().min(1, '請選擇日期'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const dt = new Date(input.endDate);
        if (isNaN(dt.getTime())) throw new TRPCError({ code: 'BAD_REQUEST', message: '日期格式錯誤' });
        return adminSetSubscriptionEndDate(input.subscriptionId, dt);
      }),

    // ── Admin: Get subscription stats ──
    adminStats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getSubscriptionStats();
      }),

    // ── Admin: List subscriptions expiring within N days ──
    adminExpiringSoon: protectedProcedure
      .input(z.object({ days: z.number().int().min(1).max(60).optional() }).optional())
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getExpiringSoonSubscriptions(input?.days ?? 7);
      }),

    // ── Admin: Approve subscription ──
    adminApprove: protectedProcedure
      .input(z.object({
        subscriptionId: z.number().int().positive(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return approveSubscription(input.subscriptionId, ctx.user.id, input.adminNote);
      }),

    // ── Admin: Reject subscription ──
    adminReject: protectedProcedure
      .input(z.object({
        subscriptionId: z.number().int().positive(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return rejectSubscription(input.subscriptionId, ctx.user.id, input.adminNote);
      }),

    // ── Admin: Cancel subscription ──
    adminCancel: protectedProcedure
      .input(z.object({
        subscriptionId: z.number().int().positive(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return cancelSubscription(input.subscriptionId, ctx.user.id, input.adminNote);
      }),

    // ── Admin: Delete rejected/cancelled subscription record ──
    adminDeleteRecord: protectedProcedure
      .input(z.object({ subscriptionId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return deleteUserSubscription(input.subscriptionId);
      }),
  }),

  push: router({
    getPublicKey: publicProcedure.query(() => ({ publicKey: getVapidPublicKey() })),
    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string().min(10),
        keys: z.object({ p256dh: z.string(), auth: z.string() }),
        userAgent: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await savePushSubscription(ctx.user.id, { endpoint: input.endpoint, keys: input.keys }, input.userAgent);
        return { success: true };
      }),
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await removePushSubscription(input.endpoint, ctx.user.id);
        return { success: true };
      }),
    test: protectedProcedure.mutation(async ({ ctx }) => {
      const sent = await sendPushToUser(ctx.user.id, {
        title: "🪙 測試推播",
        body: "推播功能正常運作！",
        url: "/member-benefits",
      });
      return { sent };
    }),
  }),

  siteSettings: router({
    getAll: publicProcedure.query(async () => getAllSiteSettings()),
    set: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // 商戶可獨立調整嘅 keys（其他全部 admin only）
        const MERCHANT_ALLOWED_KEYS = new Set(['noBidMessage', 'noBidEnabled']);
        const isAdmin = ctx.user.role === 'admin';
        let isMerchantAllowed = false;
        if (!isAdmin && MERCHANT_ALLOWED_KEYS.has(input.key)) {
          const app = await getMerchantApplicationByUser(ctx.user.id);
          isMerchantAllowed = app?.status === 'approved';
        }
        if (!isAdmin && !isMerchantAllowed) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can change this setting' });
        }
        const result = await setSiteSetting(input.key, input.value);
        // 即時套用 OTP 速率限制設定到記憶體 config
        if (['otpCooldownSecs', 'otpMaxPerHour', 'otpIpMaxPerWindow', 'otpIpWindowMins'].includes(input.key)) {
          const { updateOtpConfig } = await import('./_core/otpStore');
          const { updateIpOtpConfig } = await import('./_core/authRoutes');
          const v = parseInt(input.value, 10);
          if (!isNaN(v) && v > 0) {
            if (input.key === 'otpCooldownSecs') updateOtpConfig({ cooldownMs: v * 1000 });
            if (input.key === 'otpMaxPerHour') updateOtpConfig({ maxSendsPerHour: v });
            if (input.key === 'otpIpMaxPerWindow') updateIpOtpConfig({ maxRequests: v });
            if (input.key === 'otpIpWindowMins') updateIpOtpConfig({ windowMs: v * 60 * 1000 });
          }
        }
        return result;
      }),
  }),

  // ─── Loyalty 會員活動等級系統 ─────────────────────────────────────────────
  loyalty: router({
    // 公開：今日早鳥名額（首頁 banner 用）
    earlyBirdStatus: publicProcedure.query(async () => getEarlyBirdTodayStatus()),

    // 公開：升級門檻 + 好處參數（任何用戶可查，畀 LoyaltyChart 顯示）
    publicConfig: publicProcedure.query(async () => {
      const c = await getLoyaltyConfig();
      return {
        silverBidCount: c.silverBidCount,
        silverWinCount: c.silverWinCount,
        silver90DaySpend: c.silver90DaySpend,
        goldWinCount: c.goldWinCount,
        gold90DaySpend: c.gold90DaySpend,
        inactivityDaysForDowngrade: c.inactivityDaysForDowngrade,
        silverCashbackRate: c.silverCashbackRate,
        goldCashbackRate: c.goldCashbackRate,
        vipCashbackRate: c.vipCashbackRate,
        silverPreviewHours: c.silverPreviewHours,
        goldPreviewHours: c.goldPreviewHours,
        bronzeAutoBidQuota: c.bronzeAutoBidQuota,
        silverAutoBidMaxAmount: c.silverAutoBidMaxAmount,
        earlyBirdEnabled: c.earlyBirdEnabled,
        earlyBirdDailyQuota: c.earlyBirdDailyQuota,
        earlyBirdTrialLevel: c.earlyBirdTrialLevel,
        earlyBirdTrialDays: c.earlyBirdTrialDays,
      };
    }),

    // 用戶：查自己嘅等級 + 下一級進度
    myStatus: protectedProcedure.query(async ({ ctx }) => {
      return getMyLoyaltyStatus(ctx.user.id);
    }),

    // 用戶：查自己嘅代理出價配額 + 匿名出價權限（前端 UI 用）
    myAutoBidStatus: protectedProcedure.query(async ({ ctx }) => {
      return getMyAutoBidStatus(ctx.user.id);
    }),

    // Admin：讀配置
    adminGetConfig: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      return getLoyaltyConfig();
    }),

    // Admin：更新配置
    adminUpdateConfig: protectedProcedure
      .input(z.object({
        earlyBirdEnabled: z.boolean().optional(),
        earlyBirdDailyQuota: z.number().int().min(0).max(9999).optional(),
        earlyBirdTrialLevel: z.enum(['silver', 'gold', 'vip']).optional(),
        earlyBirdTrialDays: z.number().int().min(1).max(365).optional(),
        silverBidCount: z.number().int().min(0).max(99999).optional(),
        silverWinCount: z.number().int().min(0).max(99999).optional(),
        silver90DaySpend: z.number().int().min(0).max(99999999).optional(),
        goldWinCount: z.number().int().min(0).max(99999).optional(),
        gold90DaySpend: z.number().int().min(0).max(99999999).optional(),
        inactivityDaysForDowngrade: z.number().int().min(0).max(3650).optional(),
        silverCashbackRate: z.number().min(0).max(1).optional(),
        goldCashbackRate: z.number().min(0).max(1).optional(),
        vipCashbackRate: z.number().min(0).max(1).optional(),
        silverPreviewHours: z.number().int().min(0).max(720).optional(),
        goldPreviewHours: z.number().int().min(0).max(720).optional(),
        bronzeAutoBidQuota: z.number().int().min(0).max(9999).optional(),
        silverAutoBidMaxAmount: z.number().int().min(0).max(99999999).optional(),
        silverCanAnonymous: z.boolean().optional(),
        goldDefaultAnonymous: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        await updateLoyaltyConfig(input as Partial<Record<keyof LoyaltyConfig, string | number | boolean>>);
        return { ok: true };
      }),

    // Admin：手動跑每日維護（試用到期 + 長期無活動降級）
    adminRunMaintenance: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
      return runDailyLoyaltyMaintenance();
    }),

    // Admin：強制重算某用戶等級
    adminRecalcUser: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin only' });
        const level = await recalculateUserLevel(input.userId);
        return { level };
      }),
  }),

  // ─── 商戶申請 ─────────────────────────────────────────────────────────────
  merchants: router({
    /**
     * 簽發 S3 presigned PUT URL，畀 client 直接上載到 S3，跳過 server proxy 同 base64。
     * 對冇水印商戶：返回 direct mode，client 直接 PUT 到 S3。
     * 對有水印商戶：返回 server mode，client fallback 用舊 base64 endpoint。
     */
    signImageUpload: protectedProcedure
      .input(z.object({
        kind: z.enum(['product', 'auction-temp']),
        mimeType: z.string().default('image/jpeg'),
        fileName: z.string().default('image.jpg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp'];
        const mime = (input.mimeType || 'image/jpeg').toLowerCase();
        if (!allowedMimes.includes(mime)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `不支援此圖片格式（${mime}）` });
        }
        if (input.kind === 'product') {
          const app = await getMerchantApplicationByUser(ctx.user.id);
          if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
          }
        }
        const wm = await getMerchantSettings(ctx.user.id);
        if (wm.watermarkEnabled) {
          return { mode: 'server' as const };
        }
        const ext = mime === 'image/png' ? 'png'
          : mime === 'image/webp' ? 'webp'
          : mime === 'image/gif' ? 'gif'
          : 'jpg';
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const key = input.kind === 'product'
          ? `merchant-products/${ctx.user.id}/${uid}.${ext}`
          : `temp/${ctx.user.id}/${uid}.${ext}`;
        const signed = await storageSignPut(key, mime, 300);
        return { mode: 'direct' as const, uploadUrl: signed.uploadUrl, finalUrl: signed.finalUrl, key: signed.key };
      }),

    // 上傳樣本照片（任何已登入會員）
    uploadPhoto: protectedProcedure
      .input(z.object({
        imageData: z.string(),   // base64
        fileName: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp'];
        const mimeToUse = (input.mimeType || 'image/jpeg').toLowerCase();
        if (!allowedMimes.includes(mimeToUse)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `不支援此圖片格式（${mimeToUse}），請使用 JPG、PNG 或 WebP` });
        }
        const buffer = Buffer.from(input.imageData, 'base64');
        if (buffer.length > 8 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片不可超過 8MB' });
        }
        const fileKey = `merchant-applications/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url };
      }),

    // 提交申請（新版：可選 3-in-1 onboarding，揀 plan + 保證金 tier + 上載收據）
    submit: protectedProcedure
      .input(z.object({
        contactName: z.string().min(1).max(100),
        merchantName: z.string().min(1).max(100),
        selfIntro: z.string().min(10),
        whatsapp: z.string().min(5),
        merchantIcon: z.string().url().optional(),
        // ── T1: 3-in-1 onboarding 選填欄位 ──
        chosenPlanId: z.number().int().positive().optional(),
        chosenPeriod: z.enum(['monthly', 'yearly']).optional(),
        chosenDepositTierId: z.number().int().positive().optional(),
        totalAmount: z.number().min(0).optional(),
        paymentReference: z.string().max(255).optional(),
        paymentProofUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role === 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '管理員帳號無需申請商戶' });
        }
        const existing = await getMerchantApplicationByUser(ctx.user.id);
        if (existing && existing.status === 'pending') {
          throw new TRPCError({ code: 'CONFLICT', message: '你已有一份待審申請，請耐心等候' });
        }

        // ── 3-in-1 onboarding 全有全無檢查（避免 admin 端尷尬狀態）──
        const onboardingFields = [
          input.chosenPlanId, input.chosenPeriod, input.chosenDepositTierId,
          input.paymentReference, input.paymentProofUrl,
        ];
        const someOnboarding = onboardingFields.some(v => v != null && v !== '');
        const allOnboarding = !!(input.chosenPlanId && input.chosenPeriod
          && input.chosenDepositTierId && input.paymentReference && input.paymentProofUrl);
        if (someOnboarding && !allOnboarding) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '完整入駐套餐需同時提供：訂閱計劃、月／年費、保證金套餐、付款參考號、收據圖。請補齊或切換至「純資料申請」模式',
          });
        }

        // 如果用戶揀咗 plan/tier，驗證合法
        if (input.chosenPlanId) {
          const plan = await getSubscriptionPlanById(input.chosenPlanId);
          if (!plan || !plan.isActive) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '所選訂閱計劃不存在或已停用' });
          }
        }
        if (input.chosenDepositTierId) {
          const tiers = await listDepositTierPresets(true);
          if (!tiers.find(t => t.id === input.chosenDepositTierId)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '所選保證金套餐不存在或已停用' });
          }
        }

        await createMerchantApplication({
          userId: ctx.user.id,
          contactName: sanitizeUserText(input.contactName),
          merchantName: sanitizeUserText(input.merchantName),
          selfIntro: sanitizeUserText(input.selfIntro),
          whatsapp: input.whatsapp,
          merchantIcon: input.merchantIcon ?? null,
          status: 'pending',
          chosenPlanId: input.chosenPlanId ?? null,
          chosenPeriod: input.chosenPeriod ?? null,
          chosenDepositTierId: input.chosenDepositTierId ?? null,
          totalAmount: input.totalAmount != null ? input.totalAmount.toFixed(2) : null,
          paymentReference: input.paymentReference ?? null,
          paymentProofUrl: input.paymentProofUrl ?? null,
        });
        return { success: true };
      }),

    // 查看自己的申請狀態
    myApplication: protectedProcedure.query(async ({ ctx }) => {
      return getMerchantApplicationByUser(ctx.user.id) ?? null;
    }),

    // 商戶更新自己的資料
    updateProfile: protectedProcedure
      .input(z.object({
        merchantName: z.string().min(1).max(100),
        selfIntro: z.string().max(1000).default(""),
        whatsapp: z.string().min(1).max(50),
        facebook: z.string().max(500).nullable().optional(),
        merchantIcon: z.string().url().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (!app || app.status !== 'approved') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有已審核商戶才能修改資料' });
        }
        await updateMerchantProfile(ctx.user.id, {
          merchantName: sanitizeUserText(input.merchantName),
          selfIntro: sanitizeUserText(input.selfIntro),
          whatsapp: input.whatsapp,
          facebook: input.facebook ?? null,
          merchantIcon: input.merchantIcon ?? null,
        });
        return { success: true };
      }),

    // 快速檢查是否為商戶（只認「已批准申請」一個來源，避免 sellerDeposits 自動建立造成誤判）
    isMerchant: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      return app?.status === 'approved';
    }),

    // 商戶：查看自己的拍賣
    myAuctions: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
      }
      const list = await getAuctionsByCreator(ctx.user.id);
      const now = new Date();
      const expiredIds = list
        .filter((a: { status: string; endTime: Date | string }) => a.status === 'active' && new Date(a.endTime) <= now)
        .map((a: { id: number }) => a.id);
      if (expiredIds.length > 0) {
        // 用 checkAndUpdateAuctionStatus 而唔係 updateAuction，
        // 先會正確 init auctionOrderStatus='pending' + 發 won notify + recalc loyalty
        const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
        await Promise.all(expiredIds.map((id: number) => checkAndUpdateAuctionStatus(id, origin)));
      }
      const withImages = await Promise.all(list.map(async (a) => ({
        ...a,
        // 商戶唔應看到匿名出價者真實姓名
        highestBidderName: (a as { highestBidderIsAnonymous?: number; highestBidderName?: string | null }).highestBidderIsAnonymous === 1
          ? '🕵️ 匿名買家'
          : (a as { highestBidderName?: string | null }).highestBidderName ?? null,
        status: expiredIds.includes(a.id) ? 'ended' : a.status,
        images: await getAuctionImages(a.id),
      })));
      return withImages;
    }),

    // 管理員：查看所有申請
    listAll: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      return getAllMerchantApplications();
    }),

    // 管理員：審批申請
    review: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['approved', 'rejected']),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await reviewMerchantApplication(input.id, input.status, input.adminNote);
        return { success: true };
      }),

    // 管理員：T1 一鍵批核 onboarding（同時開通商戶 + 訂閱 + 保證金）
    approveOnboarding: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        adminNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return approveOnboardingApplication(input.id, ctx.user.id, input.adminNote);
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：拍賣管理
    // ═══════════════════════════════════════════════════════

    /** 商戶建立草稿拍賣 */
    createAuction: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().default(''),
        startingPrice: z.number().min(0),
        bidIncrement: z.number().int().min(10).max(5000).default(30),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).default('HKD'),
        antiSnipeEnabled: z.number().int().min(0).max(1).default(1),
        antiSnipeMinutes: z.number().int().min(0).max(60).default(3),
        extendMinutes: z.number().int().min(1).max(60).default(3),
        category: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
        privateNote: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 停權檢查
        if ((ctx.user as any).isBanned === 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您的帳號已被停權，無法刊登拍賣' });
        }
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有已審批商戶才可刊登拍賣' });
        }
        const result = await createAuction({
          title: input.title,
          description: input.description,
          startingPrice: input.startingPrice.toString(),
          currentPrice: input.startingPrice.toString(),
          endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'draft',
          bidIncrement: input.bidIncrement,
          currency: input.currency,
          createdBy: ctx.user.id,
          antiSnipeEnabled: input.antiSnipeEnabled,
          antiSnipeMinutes: input.antiSnipeMinutes,
          extendMinutes: input.extendMinutes,
          category: input.category,
          videoUrl: input.videoUrl ?? null,
          privateNote: input.privateNote ?? null,
        });
        return result;
      }),

    /** 商戶上傳圖片（只限自己的拍賣） */
    uploadAuctionImage: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        imageData: z.string().min(1),
        fileName: z.string().min(1),
        displayOrder: z.number().int().min(0).default(0),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能為自己的拍賣上傳圖片' });
        }
        let buffer = Buffer.from(input.imageData, 'base64');
        // 加上水印（依商戶設定）
        const app = await getMerchantApplicationByUser(ctx.user.id);
        const merchantName = app?.merchantName || ctx.user.name || `用戶#${ctx.user.id}`;
        const wmSettings = await getMerchantSettings(ctx.user.id);
        if (wmSettings.watermarkEnabled) {
          const wmText = wmSettings.watermarkText?.trim() || merchantName;
          buffer = await applyWatermark(buffer, wmText, input.mimeType, {
            opacity: wmSettings.watermarkOpacity,
            shadow: wmSettings.watermarkShadow === 1,
            position: wmSettings.watermarkPosition as any,
            size: wmSettings.watermarkSize,
          });
        }
        const ext = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/gif' ? 'gif' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const key = `auctions/${input.auctionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url: imageUrl } = await storagePut(key, buffer, input.mimeType);
        await addAuctionImage({ auctionId: input.auctionId, imageUrl, displayOrder: input.displayOrder });
        return { success: true, imageUrl };
      }),

    /** 預先上傳圖片到暫存位置（不需要 auctionId，填表期間並行上載） */
    preSaveImage: protectedProcedure
      .input(z.object({
        imageData: z.string().min(1),
        mimeType: z.string().default('image/jpeg'),
        fileName: z.string().default('image.jpg'),
      }))
      .mutation(async ({ input, ctx }) => {
        let buffer = Buffer.from(input.imageData, 'base64');
        // 加上水印（依商戶設定）
        const app2 = await getMerchantApplicationByUser(ctx.user.id);
        const merchantName2 = app2?.merchantName || ctx.user.name || `用戶#${ctx.user.id}`;
        const wmSettings2 = await getMerchantSettings(ctx.user.id);
        if (wmSettings2.watermarkEnabled) {
          const wmText2 = wmSettings2.watermarkText?.trim() || merchantName2;
          buffer = await applyWatermark(buffer, wmText2, input.mimeType, {
            opacity: wmSettings2.watermarkOpacity,
            shadow: wmSettings2.watermarkShadow === 1,
            position: wmSettings2.watermarkPosition as any,
            size: wmSettings2.watermarkSize,
          });
        }
        const ext = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const key = `temp/${ctx.user.id}/${uid}.${ext}`;
        const { url } = await storagePut(key, buffer, 'image/jpeg');
        return { key, url };
      }),

    /** 批量關聯預先上傳的圖片 URL 到草稿（無需重新上傳） */
    registerPreSavedImages: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        images: z.array(z.object({
          url: z.string().min(1),
          displayOrder: z.number().int().min(0),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能為自己的拍賣關聯圖片' });
        }
        for (const img of input.images) {
          await addAuctionImage({ auctionId: input.auctionId, imageUrl: img.url, displayOrder: img.displayOrder });
        }
        return { success: true, count: input.images.length };
      }),

    /** 商戶刪除圖片（只限自己的拍賣） */
    deleteAuctionImage: protectedProcedure
      .input(z.object({ auctionId: z.number(), imageId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能刪除自己拍賣的圖片' });
        }
        await deleteAuctionImage(input.imageId);
        return { success: true };
      }),

    /** 商戶更新草稿（只限 draft 且自己的） */
    updateAuction: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        startingPrice: z.number().min(0).optional(),
        bidIncrement: z.number().int().min(10).max(5000).optional(),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).optional(),
        antiSnipeEnabled: z.number().int().min(0).max(1).optional(),
        antiSnipeMinutes: z.number().int().min(0).max(60).optional(),
        extendMinutes: z.number().int().min(1).max(60).optional(),
        category: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
        privateNote: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能編輯自己的拍賣' });
        }
        if (auction.status !== 'draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只能編輯草稿狀態的拍賣' });
        }
        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.startingPrice !== undefined) {
          updateData.startingPrice = input.startingPrice.toString();
          updateData.currentPrice = input.startingPrice.toString();
        }
        if (input.bidIncrement !== undefined) updateData.bidIncrement = input.bidIncrement;
        if (input.currency !== undefined) updateData.currency = input.currency;
        if (input.antiSnipeEnabled !== undefined) updateData.antiSnipeEnabled = input.antiSnipeEnabled;
        if (input.antiSnipeMinutes !== undefined) updateData.antiSnipeMinutes = input.antiSnipeMinutes;
        if (input.extendMinutes !== undefined) updateData.extendMinutes = input.extendMinutes;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.videoUrl !== undefined) updateData.videoUrl = input.videoUrl;
        if (input.privateNote !== undefined) updateData.privateNote = input.privateNote;
        await updateAuction(input.id, updateData);
        return { success: true };
      }),

    /** 商戶修改進行中拍賣（標題/詳情/分類；起拍價/加幅/貨幣只可喺未有出價時改） */
    updateActiveAuction: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        privateNote: z.string().max(500).nullable().optional(),
        category: z.string().optional(),
        videoUrl: z.string().nullable().optional(),
        startingPrice: z.number().min(0).optional(),
        bidIncrement: z.number().int().min(10).max(5000).optional(),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能編輯自己的拍賣' });
        }
        if (auction.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此功能只適用於進行中的拍賣' });
        }
        // 改價格 / 加幅 / 貨幣 必須未有出價
        const priceFieldsTouched =
          input.startingPrice !== undefined ||
          input.bidIncrement !== undefined ||
          input.currency !== undefined;
        if (priceFieldsTouched) {
          const bidHistory = await getBidHistory(input.id);
          if (bidHistory.length > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '已有出價記錄，不可修改起拍價／加幅／貨幣' });
          }
        }
        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.privateNote !== undefined) updateData.privateNote = input.privateNote;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.videoUrl !== undefined) updateData.videoUrl = input.videoUrl;
        if (input.startingPrice !== undefined) {
          updateData.startingPrice = String(input.startingPrice);
          updateData.currentPrice = String(input.startingPrice);
        }
        if (input.bidIncrement !== undefined) updateData.bidIncrement = input.bidIncrement;
        if (input.currency !== undefined) updateData.currency = input.currency;
        await updateAuction(input.id, updateData);
        return { success: true };
      }),

    /** 商戶設定拍賣顯示模式（草稿 + 進行中均可改） */
    setDisplayMode: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        displayMode: z.enum(["default", "facebook"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能編輯自己的拍賣' });
        }
        if (auction.status !== 'draft' && auction.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿或進行中拍賣可設定顯示模式' });
        }
        await updateAuction(input.id, { displayMode: input.displayMode });
        return { success: true };
      }),

    /** 商戶刪除草稿拍賣 */
    deleteAuction: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能刪除自己的拍賣' });
        }
        if (auction.status !== 'draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有草稿可被刪除' });
        }
        await deleteAuction(input.id);
        return { success: true };
      }),

    /** 商戶永久刪除已封存嘅拍賣（流拍 → 封存 → 永久刪除） */
    permanentDeleteAuction: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能刪除自己的拍賣' });
        }
        // 必須係已封存
        if ((auction as { archived?: number | null }).archived !== 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已封存嘅拍賣先可以永久刪除' });
        }
        // 有買家（成交）唔畀刪，保留訂單記錄
        if (auction.highestBidderId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已成交嘅拍賣唔可以永久刪除' });
        }
        await deleteAuction(input.id);
        return { success: true };
      }),

    /** 商戶查看自己的草稿 */
    myDrafts: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const draftList = await getDraftAuctions();
        const mine = draftList.filter((a: { createdBy?: number }) => a.createdBy === ctx.user.id);
        const withImages = await Promise.all(mine.map(async (a: { id: number; [key: string]: unknown }) => ({
          ...a,
          images: await getAuctionImages(a.id),
        })));
        return withImages;
      }),

    /** 複製草稿（不含圖片，標題加 [複製]） */
    duplicateDraft: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到草稿' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能複製自己的草稿' });
        }
        const suffix = '[複製]';
        const maxBase = 255 - suffix.length;
        const newTitle = auction.title.length <= maxBase
          ? auction.title + suffix
          : auction.title.slice(0, maxBase) + suffix;
        const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const newAuction = await createAuction({
          title: newTitle,
          description: auction.description ?? undefined,
          startingPrice: auction.startingPrice,
          currentPrice: auction.startingPrice,
          endTime: thirtyDaysLater,
          status: 'draft',
          bidIncrement: auction.bidIncrement,
          currency: auction.currency,
          createdBy: ctx.user.id,
          category: auction.category ?? undefined,
          antiSnipeEnabled: auction.antiSnipeEnabled,
          antiSnipeMinutes: auction.antiSnipeMinutes,
          extendMinutes: auction.extendMinutes,
          antiSnipeMemberLevels: auction.antiSnipeMemberLevels ?? undefined,
          privateNote: auction.privateNote ?? undefined,
        });
        return { id: newAuction.id };
      }),

    /** 商戶發佈草稿拍賣 */
    publishDraft: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        endTime: z.date(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startingPrice: z.number().min(0).optional(),
        bidIncrement: z.number().int().min(10).max(5000).optional(),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到草稿' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能發佈自己的草稿' });
        }
        if (auction.status !== 'draft') throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣並非草稿狀態' });
        if (input.endTime <= new Date()) throw new TRPCError({ code: 'BAD_REQUEST', message: '結束時間必須為未來時間' });
        // Require at least one image
        const images = await getAuctionImages(input.id);
        if (images.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '請先上傳至少一幅圖片才能發佈' });
        // Check both publish conditions (admin bypasses)
        let remainingQuota: number | null = null;
        let unlimitedQuota = false;
        if (ctx.user.role !== 'admin') {
          const [depositCheck, quotaInfo] = await Promise.all([
            canSellerList(ctx.user.id),
            getListingQuotaInfo(ctx.user.id),
          ]);
          const hasQuota = !!quotaInfo && (quotaInfo.unlimited || quotaInfo.remainingQuota >= 1);
          const failReasons: string[] = [];
          if (!hasQuota) {
            if (!quotaInfo) {
              failReasons.push('條件一：您的月費計劃已過期或尚未訂閱，請先續訂後才可發佈拍賣');
            } else {
              const quotaTmpl = await getSiteSetting('publishQuotaErrorMsg') ?? '發佈點數不足（剩餘 {remaining} 次，需要 {required} 次）';
              const quotaErrMsg = quotaTmpl
                .replace('{remaining}', String(quotaInfo.remainingQuota))
                .replace('{required}', '1');
              failReasons.push(`條件一：${quotaErrMsg}`);
            }
          }
          if (!depositCheck.canList) {
            let depositErrMsg: string;
            if (depositCheck.balance !== undefined && depositCheck.required !== undefined) {
              const tmpl = await getSiteSetting('publishDepositErrorMsg') ?? '保證金維持水平不足（餘額 {balance}，需要 {required}）';
              depositErrMsg = tmpl
                .replace('{balance}', `$${depositCheck.balance.toFixed(2)}`)
                .replace('{required}', `$${depositCheck.required.toFixed(2)}`);
            } else {
              depositErrMsg = depositCheck.reason ?? '保證金條件不符';
            }
            failReasons.push(`條件二：${depositErrMsg}`);
          }
          if (failReasons.length > 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: failReasons.join('；') });
          }
          // Both conditions passed — deduct quota
          const quotaResult = await deductListingQuota(ctx.user.id);
          if (!quotaResult.success) throw new TRPCError({ code: 'FORBIDDEN', message: quotaResult.reason ?? '發佈次數不足' });
          if (quotaResult.remaining !== undefined) remainingQuota = quotaResult.remaining;
          if (quotaResult.unlimited) unlimitedQuota = true;
        }
        const updateData: Record<string, unknown> = { status: 'active', endTime: input.endTime };
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.startingPrice !== undefined) {
          updateData.startingPrice = input.startingPrice.toString();
          updateData.currentPrice = input.startingPrice.toString();
        }
        if (input.bidIncrement !== undefined) updateData.bidIncrement = input.bidIncrement;
        if (input.currency !== undefined) updateData.currency = input.currency;
        await updateAuction(input.id, updateData);
        return { success: true, remainingQuota, unlimitedQuota };
      }),

    /** 商戶批量發佈草稿（同一結束時間） */
    batchPublishDrafts: protectedProcedure
      .input(z.object({
        ids: z.array(z.number().int().positive()).min(1).max(50),
        endTime: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.endTime <= new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '結束時間必須為未來時間' });
        }
        // Determine how many valid drafts (with images) we're about to publish for quota check
        const auctionChecks = await Promise.all(input.ids.map(async id => {
          const a = await getAuctionById(id);
          if (!a || a.status !== 'draft') return null;
          if (a.createdBy !== ctx.user.id && ctx.user.role !== 'admin') return null;
          const imgs = await getAuctionImages(id);
          if (imgs.length === 0) return null;
          return a;
        }));
        const toPublishCount = auctionChecks.filter(Boolean).length;
        if (ctx.user.role !== 'admin' && toPublishCount > 0) {
          const [depositCheck, quotaInfo] = await Promise.all([
            canSellerList(ctx.user.id),
            getListingQuotaInfo(ctx.user.id),
          ]);
          const hasQuota = !!quotaInfo && (quotaInfo.unlimited || quotaInfo.remainingQuota >= toPublishCount);
          const failReasons: string[] = [];
          if (!hasQuota) {
            if (!quotaInfo) {
              failReasons.push('條件一：您的月費計劃已過期或尚未訂閱，請先續訂後才可發佈拍賣');
            } else {
              const quotaTmpl = await getSiteSetting('publishQuotaErrorMsg') ?? '發佈點數不足（剩餘 {remaining} 次，需要 {required} 次）';
              const quotaErrMsg = quotaTmpl
                .replace('{remaining}', String(quotaInfo.remainingQuota))
                .replace('{required}', String(toPublishCount));
              failReasons.push(`條件一：${quotaErrMsg}`);
            }
          }
          if (!depositCheck.canList) {
            let depositErrMsg: string;
            if (depositCheck.balance !== undefined && depositCheck.required !== undefined) {
              const tmpl = await getSiteSetting('publishDepositErrorMsg') ?? '保證金維持水平不足（餘額 {balance}，需要 {required}）';
              depositErrMsg = tmpl
                .replace('{balance}', `$${depositCheck.balance.toFixed(2)}`)
                .replace('{required}', `$${depositCheck.required.toFixed(2)}`);
            } else {
              depositErrMsg = depositCheck.reason ?? '保證金條件不符';
            }
            failReasons.push(`條件二：${depositErrMsg}`);
          }
          if (failReasons.length > 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: failReasons.join('；') });
          }
        }
        const results = await Promise.allSettled(
          input.ids.map(async (id) => {
            const auction = await getAuctionById(id);
            if (!auction || auction.status !== 'draft') return { id, skipped: true };
            if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') return { id, forbidden: true };
            const imgs = await getAuctionImages(id);
            if (imgs.length === 0) return { id, skipped: true, reason: 'no_image' };
            await updateAuction(id, { status: 'active', endTime: input.endTime });
            return { id, success: true };
          })
        );
        const succeeded = results.filter(r => r.status === 'fulfilled' && (r.value as { success?: boolean }).success).length;
        const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as { skipped?: boolean }).skipped).length;
        // Atomically deduct all succeeded publications in one DB call (avoids race condition)
        let remainingQuota: number | null = null;
        let unlimitedQuota = false;
        if (ctx.user.role !== 'admin' && succeeded > 0) {
          const deductResult = await deductListingQuotaBulk(ctx.user.id, succeeded);
          unlimitedQuota = deductResult.unlimited ?? false;
          if (!unlimitedQuota) remainingQuota = deductResult.remaining ?? null;
        } else if (ctx.user.role !== 'admin') {
          const qi = await getListingQuotaInfo(ctx.user.id);
          if (qi) { unlimitedQuota = qi.unlimited; if (!qi.unlimited) remainingQuota = qi.remainingQuota; }
        }
        return { succeeded, skipped, total: input.ids.length, remainingQuota, unlimitedQuota };
      }),

    /** 商戶封存已結束的拍賣 */
    archiveAuction: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能封存自己的拍賣' });
        }
        if (auction.status !== 'ended') throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已結束的拍賣才能封存' });
        await updateAuction(input.id, { archived: 1, archivedAt: new Date() });
        return { success: true };
      }),

    /** 商戶查看自己的封存拍賣 */
    myArchived: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const allArchived = await getArchivedAuctions();
        const mine = allArchived.filter((a: { createdBy?: number }) => a.createdBy === ctx.user.id);
        const withImages = await Promise.all(mine.map(async (a: { id: number; [key: string]: unknown }) => ({
          ...a,
          images: await getAuctionImages(a.id),
        })));
        return withImages;
      }),

    /** 商戶恢復封存的拍賣 */
    restoreAuction: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能恢復自己的封存拍賣' });
        }
        await updateAuction(input.id, { archived: 0, archivedAt: null });
        return { success: true };
      }),

    /** 商戶重新刊登（複製為新草稿） */
    relistAuction: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有已審批商戶才可重新刊登' });
        }
        const original = await getAuctionById(input.id);
        if (!original) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (original.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能重新刊登自己的拍賣' });
        }
        const newAuction = await createAuction({
          title: original.title,
          description: original.description ?? undefined,
          startingPrice: original.startingPrice,
          currentPrice: original.startingPrice,
          endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'draft',
          bidIncrement: original.bidIncrement,
          currency: original.currency,
          category: (original as any).category ?? undefined,
          createdBy: ctx.user.id,
          relistSourceId: input.id,
        });
        const originalImages = await getAuctionImages(input.id);
        for (const img of originalImages) {
          await addAuctionImage({ auctionId: newAuction.id, imageUrl: img.imageUrl, displayOrder: img.displayOrder });
        }
        // 原件 archive，避免佢繼續出現喺 eligible list（與 relist 並列造成視覺重複）
        await updateAuction(input.id, { archived: 1, archivedAt: new Date() });
        return { success: true, newAuctionId: newAuction.id };
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：訂單管理
    // ═══════════════════════════════════════════════════════

    /** 商戶查看自己拍賣的得標訂單 */
    myOrders: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        console.log(`[myOrders] userId=${ctx.user.id} role=${ctx.user.role} appStatus=${app?.status ?? 'none'}`);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          console.warn(`[myOrders] FORBIDDEN userId=${ctx.user.id}`);
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        // 🔴 Lazy expiry：商戶若直接入訂單頁未開過拍賣管理頁，過期 auction 仍係 active
        // 必須 trigger checkAndUpdateAuctionStatus 確保 status='ended' + auctionOrderStatus='pending'
        try {
          const list = await getAuctionsByCreator(ctx.user.id);
          const nowMs = Date.now();
          const expiredIds = list
            .filter((a: { status: string; endTime: Date | string }) => a.status === 'active' && new Date(a.endTime).getTime() <= nowMs)
            .map((a: { id: number }) => a.id);
          if (expiredIds.length > 0) {
            const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
            await Promise.all(expiredIds.map((id: number) => checkAndUpdateAuctionStatus(id, origin)));
          }
        } catch (e) {
          console.warn('[myOrders] lazy expiry failed:', e);
        }
        const orders = await getWonOrdersByCreator(ctx.user.id);
        // 有得標者但狀態未設定 → 自動設為 pending_payment
        const toInit = orders.filter(o => o.winnerName && !o.paymentStatus);
        if (toInit.length > 0) {
          await Promise.all(toInit.map(o => updateAuction(o.id, { paymentStatus: 'pending_payment' })));
          toInit.forEach(o => { o.paymentStatus = 'pending_payment'; });
        }
        return orders;
      }),

    /** 商戶更新自己拍賣的付款狀態 */
    updateOrderStatus: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        status: z.enum(['pending_payment', 'paid', 'delivered']),
      }))
      .mutation(async ({ input, ctx }) => {
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能更新自己拍賣的付款狀態' });
        }
        const result = await updatePaymentStatus(input.auctionId, input.status, ctx.user.id, true);
        if (!result.success) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error ?? '更新失敗' });
        return { success: true };
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：保證金交易流水
    // ═══════════════════════════════════════════════════════

    /** 商戶查看自己的保證金交易記錄 */
    myTransactions: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const fromDate = input.fromDate ? new Date(input.fromDate) : undefined;
        const toDate = input.toDate ? new Date(input.toDate) : undefined;
        return getDepositTransactions(ctx.user.id, input.limit, input.offset, fromDate, toDate);
      }),

    /** 取得商戶個人設定 */
    getSettings: protectedProcedure
      .query(async ({ ctx }) => {
        return getMerchantSettings(ctx.user.id);
      }),

    getMyCategories: protectedProcedure
      .query(async ({ ctx }) => {
        const s = await getMerchantSettings(ctx.user.id);
        if (s.productCategories) {
          try {
            const parsed = JSON.parse(s.productCategories);
            if (Array.isArray(parsed) && parsed.length > 0) return { categories: parsed as string[] };
          } catch {}
        }
        return { categories: null };
      }),

    updateMyCategories: protectedProcedure
      .input(z.object({ categories: z.array(z.string().min(1).max(50)).min(1).max(50) }))
      .mutation(async ({ input, ctx }) => {
        await setMerchantCategories(ctx.user.id, input.categories);
        return { success: true };
      }),

    /** 公開：取得商戶交收/付款資訊（供買家在拍賣/商品詳情頁查看） */
    getPaymentInfo: publicProcedure
      .input(z.object({ merchantUserId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const settings = await getMerchantSettings(input.merchantUserId);
        return {
          paymentInstructions: settings?.paymentInstructions ?? null,
          deliveryInfo: settings?.deliveryInfo ?? null,
        };
      }),

    /** 更新商戶個人設定 */
    updateSettings: protectedProcedure
      .input(z.object({
        defaultEndDayOffset: z.number().int().min(1).max(365),
        defaultEndTime: z.string().regex(/^\d{2}:\d{2}$/, '時間格式須為 HH:MM'),
        defaultStartingPrice: z.number().min(0),
        defaultBidIncrement: z.number().int().min(1),
        defaultAntiSnipeEnabled: z.number().int().min(0).max(1),
        defaultAntiSnipeMinutes: z.number().int().min(0).max(60),
        defaultExtendMinutes: z.number().int().min(1).max(60),
        paymentInstructions: z.string().max(3000).nullable().optional(),
        deliveryInfo: z.string().max(3000).nullable().optional(),
        fbShareTemplate: z.string().max(2000).nullable().optional(),
        fbShareTemplateProduct: z.string().max(2000).nullable().optional(),
        winnerAutoReplyMessage: z.string().max(1000).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertMerchantSettings(ctx.user.id, input.defaultEndDayOffset, input.defaultEndTime, input.defaultStartingPrice, input.defaultBidIncrement, input.defaultAntiSnipeEnabled, input.defaultAntiSnipeMinutes, input.defaultExtendMinutes, input.paymentInstructions, input.deliveryInfo, input.fbShareTemplate, input.fbShareTemplateProduct, input.winnerAutoReplyMessage);
        return { success: true };
      }),

    /** 更新預設 FB 群組清單（順序分享用） */
    updateFbGroups: protectedProcedure
      .input(z.object({
        groups: z.array(z.object({
          name: z.string().min(1).max(80),
          url: z.string().url().max(500),
        })).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        const json = JSON.stringify(input.groups);
        await upsertMerchantFbGroups(ctx.user.id, json);
        return { success: true };
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：水印設定
    // ═══════════════════════════════════════════════════════

    /** 取得水印設定 */
    getWatermarkSettings: protectedProcedure
      .query(async ({ ctx }) => {
        const s = await getMerchantSettings(ctx.user.id);
        return {
          watermarkEnabled: s.watermarkEnabled,
          watermarkText: s.watermarkText,
          watermarkOpacity: s.watermarkOpacity,
          watermarkShadow: s.watermarkShadow,
          watermarkPosition: s.watermarkPosition,
          watermarkSize: s.watermarkSize,
        };
      }),

    /** 更新水印設定 */
    updateWatermarkSettings: protectedProcedure
      .input(z.object({
        watermarkEnabled: z.number().int().min(0).max(1),
        watermarkText: z.string().max(100).nullable().optional(),
        watermarkOpacity: z.number().int().min(1).max(100),
        watermarkShadow: z.number().int().min(0).max(1),
        watermarkPosition: z.enum([
          "center-horizontal",
          "center-diagonal",
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ]),
        watermarkSize: z.number().int().min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertWatermarkSettings(
          ctx.user.id,
          input.watermarkEnabled,
          input.watermarkText ?? null,
          input.watermarkOpacity,
          input.watermarkShadow,
          input.watermarkPosition,
          input.watermarkSize,
        );
        return { success: true };
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：發佈配額
    // ═══════════════════════════════════════════════════════

    /** 儲存商品版面偏好 */
    setListingLayout: protectedProcedure
      .input(z.object({ layout: z.enum(["list", "grid2", "grid3", "big"]) }))
      .mutation(async ({ input, ctx }) => {
        await setMerchantListingLayout(ctx.user.id, input.layout);
        return { success: true };
      }),

    /** 完結拍賣顯示設定（showEndedAuctions / hideEndedAfterDays） — 商戶頁 */
    setEndedAuctionVisibility: protectedProcedure
      .input(z.object({
        showEndedAuctions: z.number().int().min(0).max(1),
        hideEndedAfterDays: z.number().int().min(0).max(365),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setMerchantEndedAuctionVisibility(ctx.user.id, input.showEndedAuctions, input.hideEndedAfterDays);
        return { success: true };
      }),

    /** 流拍顯示設定（showUnsoldEnded）— 主頁 + 商戶主頁 */
    setShowUnsoldEnded: protectedProcedure
      .input(z.object({
        showUnsoldEnded: z.number().int().min(0).max(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setShowUnsoldEnded(ctx.user.id, input.showUnsoldEnded);
        return { success: true };
      }),

    /** 拍賣主頁完結拍賣紀錄設定（showEndedOnMainPage / mainPageEndedDays） */
    setMainPageEndedDisplay: protectedProcedure
      .input(z.object({
        showEndedOnMainPage: z.number().int().min(0).max(1),
        mainPageEndedDays: z.number().int().min(0).max(30),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setMainPageEndedDisplay(ctx.user.id, input.showEndedOnMainPage, input.mainPageEndedDays);
        return { success: true };
      }),

    /** 設定商戶商店每頁顯示數量 */
    setPageSizes: protectedProcedure
      .input(z.object({
        auctionsPerPage: z.number().int().min(1).max(50),
        productsPerPage: z.number().int().min(1).max(50),
        showSoldProducts: z.number().int().min(0).max(1).default(1),
      }))
      .mutation(async ({ input, ctx }) => {
        await setMerchantPageSizes(ctx.user.id, input.auctionsPerPage, input.productsPerPage, input.showSoldProducts);
        return { success: true };
      }),

    /** 取得本人發佈配額資訊 */
    getQuotaInfo: protectedProcedure
      .query(async ({ ctx }) => {
        return getListingQuotaInfo(ctx.user.id);
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：退傭申請
    // ═══════════════════════════════════════════════════════

    /** 商戶提交退傭申請 */
    submitRefundRequest: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        reason: z.enum(['buyer_missing', 'buyer_refused', 'mutual_cancel', 'other']),
        reasonDetail: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        // Verify this auction belongs to the merchant and has ended
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能申請自己的拍賣' });
        }
        if (auction.status !== 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已結束的拍賣才能申請退傭' });
        }
        if (!auction.highestBidderId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '流拍拍賣不需申請退傭（無成交傭金）' });
        }
        const deposit = await getOrCreateSellerDeposit(ctx.user.id);
        if (!deposit) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '找不到保證金記錄' });
        const rate = parseFloat(deposit.commissionRate.toString());
        const commission = parseFloat((parseFloat(String(auction.currentPrice)) * rate).toFixed(2));
        try {
          await createRefundRequest({ auctionId: input.auctionId, userId: ctx.user.id, commissionAmount: commission, reason: input.reason, reasonDetail: input.reasonDetail });
          return { success: true };
        } catch (e: unknown) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : '申請失敗' });
        }
      }),

    /** 商戶查看自己的退傭申請 */
    myRefundRequests: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        return getMyRefundRequests(ctx.user.id);
      }),

    /** Admin: 查看所有退傭申請 */
    adminGetRefundRequests: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllRefundRequests();
      }),

    /** Admin: 審批退傭申請 */
    adminReviewRefundRequest: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(['approved', 'rejected']),
        adminNote: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        try {
          await reviewRefundRequest(input.id, input.status, input.adminNote, ctx.user.id);
          return { success: true };
        } catch (e: unknown) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : '審批失敗' });
        }
      }),

    // ── 管理員：自動生成商品 ──────────────────────────────────────────────────

    /** Admin：為指定商戶自動生成固定價格商品 */
    adminGenerateProducts: protectedProcedure
      .input(z.object({
        merchantUserId: z.number().int().positive(),
        count: z.number().int().min(1).max(50),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can generate products' });
        }
        const app = await getMerchantApplicationByUser(input.merchantUserId);
        if (!app || app.status !== 'approved') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此用戶並非已批准商戶' });
        }
        const templates = [
          { title: '1981年香港五毫硬幣', desc: '英女皇頭像，品相良好，流通品', category: '其他', price: 80 },
          { title: '1967年香港一毫', desc: '英女皇頭像，流通品，少見年份', category: '其他', price: 120 },
          { title: '1975年香港一元', desc: '皇冠獅子圖案，原光未流通', category: '其他', price: 200 },
          { title: '1997年香港金紫荊紀念幣', desc: '回歸紀念，原盒附證書，品相完美', category: '紀念幣', price: 380 },
          { title: '1935年香港一毫銀幣', desc: '喬治五世頭像，銀光好', category: '銀幣', price: 500 },
          { title: '1863年香港一仙銅幣', desc: '早期殖民地幣，珍貴藏品', category: '古幣', price: 800 },
          { title: '中國1980年長城流通紀念幣套裝', desc: '人民銀行發行，原套未拆，品相極佳', category: '紀念幣', price: 1200 },
          { title: '1941年香港一仙', desc: '二戰前發行，存世量極少', category: '古幣', price: 950 },
          { title: '美國1921年摩根銀元', desc: '品相MS62，原光未流通', category: '外幣', price: 1500 },
          { title: '英國1887年維多利亞女皇金幣', desc: '22K黃金鑄造，歷史珍品', category: '金幣', price: 8800 },
        ];
        // ── 檢查商戶公佈額度是否足夠 ─────────────────────────────────────────
        const quotaInfo = await getListingQuotaInfo(input.merchantUserId);
        if (quotaInfo && !quotaInfo.unlimited && quotaInfo.remainingQuota < input.count) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `商戶公佈額度不足（剩餘 ${quotaInfo.remainingQuota} 次，需要 ${input.count} 次）`,
          });
        }

        const imageUrl = 'https://placehold.co/400x400/d4af37/ffffff?text=商品';
        const created: number[] = [];
        for (let i = 0; i < input.count; i++) {
          const t = templates[i % templates.length];
          const suffix = input.count > templates.length ? ` (${Math.floor(i / templates.length) + 1})` : '';
          const id = await createMerchantProduct({
            merchantId: input.merchantUserId,
            merchantName: app.merchantName,
            merchantIcon: app.merchantIcon ?? undefined,
            whatsapp: app.whatsapp ?? undefined,
            title: `【測試】${t.title}${suffix}`,
            description: `${t.desc}｜系統測試商品，請勿購買`,
            price: t.price,
            currency: 'HKD',
            category: t.category,
            images: JSON.stringify([imageUrl]),
            stock: 1,
          });
          created.push(id);
        }

        // ── 扣減商戶公佈額度（有限額時才扣） ────────────────────────────────
        if (quotaInfo && !quotaInfo.unlimited && created.length > 0) {
          await deductListingQuotaBulk(input.merchantUserId, created.length);
        }

        return { created: created.length, ids: created };
      }),

    /** 管理員：清除某商戶的所有出售商品 */
    adminClearMerchantProducts: protectedProcedure
      .input(z.object({ merchantUserId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can clear merchant products' });
        }
        const db = await getDb();
        const result = await db.delete(merchantProductsTable).where(eq(merchantProductsTable.merchantId, input.merchantUserId));
        const deleted = (result as any).rowsAffected ?? 0;
        return { deleted };
      }),

    // ── 商戶市集 ─────────────────────────────────────────────────────────────

    /** 公開：取得所有已批准商戶列表 */
    listApprovedMerchants: publicProcedure.query(async () => {
      return listApprovedMerchants();
    }),

    /** 公開：取得單一已批准商戶資料 */
    getPublicMerchant: publicProcedure
      .input(z.object({ userId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const { and } = await import('drizzle-orm');
        const rows = await db.select().from(merchantAppsTable)
          .where(and(eq(merchantAppsTable.userId, input.userId), eq(merchantAppsTable.status, 'approved')))
          .limit(1);
        return rows[0] ?? null;
      }),

    /** 公開：取得某商戶拍賣中商品（含封面圖） */
    getMerchantAuctions: publicProcedure
      .input(z.object({ userId: z.number().int() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { sql: drizzleSql, and: drizzleAnd } = await import('drizzle-orm');
        const { users: usersTable } = await import('../drizzle/schema');
        try {
          const rows = await db.select({
            id: auctions.id,
            title: auctions.title,
            currentPrice: auctions.currentPrice,
            startingPrice: auctions.startingPrice,
            endTime: auctions.endTime,
            status: auctions.status,
            currency: auctions.currency,
            category: auctions.category,
            bidIncrement: auctions.bidIncrement,
            createdBy: auctions.createdBy,
            highestBidderId: auctions.highestBidderId,
            highestBidderName: usersTable.name,
            highestBidderIsAnonymous: drizzleSql<number>`COALESCE((SELECT isAnonymous FROM bids WHERE auctionId = ${auctions.id} AND userId = ${auctions.highestBidderId} ORDER BY id DESC LIMIT 1), 0)`,
            bidCount: drizzleSql<number>`(SELECT COUNT(*) FROM bids WHERE auctionId = ${auctions.id})`,
            createdAt: auctions.createdAt,
            antiSnipeEnabled: auctions.antiSnipeEnabled,
            antiSnipeMinutes: auctions.antiSnipeMinutes,
            extendMinutes: auctions.extendMinutes,
          }).from(auctions)
            .leftJoin(usersTable, eq(auctions.highestBidderId, usersTable.id))
            .where(drizzleAnd(
              eq(auctions.createdBy, input.userId),
              eq(auctions.status, 'active'),
              drizzleSql`(${auctions.archived} = 0 OR ${auctions.archived} IS NULL)`,
            ))
            .orderBy(auctions.endTime);

          // 用與主拍賣列表相同的方法取得封面圖片，並處理匿名出價
          return await Promise.all(
            rows.map(async (row) => {
              const imgs = await getAuctionImages(row.id);
              const highestBidderName = row.highestBidderIsAnonymous === 1
                ? '🕵️ 匿名買家'
                : (row.highestBidderName ?? null);
              return { ...row, coverImage: imgs[0]?.imageUrl ?? null, highestBidderName };
            })
          );
        } catch (err) {
          console.error('[getMerchantAuctions] error:', err);
          return [];
        }
      }),

    /** 公開：取得商戶完結拍賣（受 showEndedAuctions / hideEndedAfterDays 控制） */
    getEndedAuctions: publicProcedure
      .input(z.object({ userId: z.number().int() }))
      .query(async ({ input }) => {
        const settings = await getMerchantSettings(input.userId);
        if (!settings.showEndedAuctions) return [];
        return getEndedAuctionsByMerchant(input.userId, settings.hideEndedAfterDays, settings.showUnsoldEnded);
      }),

    /** 公開：取得單一出售商品詳情 */
    getPublicProduct: publicProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        const product = await getMerchantProduct(input.id);
        if (!product || product.status === 'hidden') throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在' });
        return product;
      }),

    /** 公開：取得商品列表（可按 merchantId / category 篩選） */
    listProducts: publicProcedure
      .input(z.object({
        merchantId: z.number().int().optional(),
        category: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return listMerchantProducts({ merchantId: input?.merchantId, category: input?.category, status: 'active_and_sold' });
      }),

    /** 商戶：取得自己的商品（包括 hidden/sold） */
    myProducts: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
      }
      return listMerchantProducts({ merchantId: ctx.user.id, status: 'all' });
    }),

    /** 商戶：新增商品（需通過保證金 + 公佈額度檢查） */
    addProduct: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        price: z.number().min(0),
        currency: z.string().default('HKD'),
        category: z.string().max(500).optional(),
        images: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
        stock: z.number().int().min(1).default(1),
        allowOffers: z.number().int().min(0).max(1).optional(),
        privateNote: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 停權檢查
        if ((ctx.user as any).isBanned === 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您的帳號已被停權，無法上架商品' });
        }
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }

        // ── 保證金檢查 ───────────────────────────────────────────────────────
        const depositCheck = await canSellerList(ctx.user.id);
        if (!depositCheck.canList) {
          throw new TRPCError({ code: 'FORBIDDEN', message: depositCheck.reason ?? '保證金不足，無法上架商品' });
        }

        // ── 公佈額度檢查 ─────────────────────────────────────────────────────
        const quotaInfo = await getListingQuotaInfo(ctx.user.id);
        if (!quotaInfo) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '您的月費計劃已過期或尚未訂閱，請先續訂後才可上架商品',
          });
        }
        const hasQuota = quotaInfo.unlimited || quotaInfo.remainingQuota >= 1;
        if (!hasQuota) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `公佈額度不足（剩餘 ${quotaInfo.remainingQuota} 次），請先購買月費計劃`,
          });
        }

        // ── 建立商品 ─────────────────────────────────────────────────────────
        const id = await createMerchantProduct({
          merchantId: ctx.user.id,
          merchantName: app?.merchantName ?? ctx.user.name ?? '商戶',
          merchantIcon: app?.merchantIcon ?? undefined,
          whatsapp: app?.whatsapp ?? undefined,
          title: input.title,
          description: input.description,
          price: input.price,
          currency: input.currency,
          category: input.category,
          images: input.images,
          videoUrl: input.videoUrl ?? null,
          stock: input.stock,
          allowOffers: input.allowOffers,
          privateNote: input.privateNote ?? null,
        });

        // ── 扣減公佈額度（有限額時才扣） ────────────────────────────────────
        if (quotaInfo && !quotaInfo.unlimited) {
          await deductListingQuota(ctx.user.id);
        }

        return { id };
      }),

    /** 商戶：更新商品 */
    updateProduct: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        price: z.number().min(0).optional(),
        currency: z.string().optional(),
        category: z.string().max(500).optional(),
        images: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
        stock: z.number().int().min(0).optional(),
        status: z.enum(['active', 'sold', 'hidden']).optional(),
        allowOffers: z.number().int().min(0).max(1).optional(),
        privateNote: z.string().max(500).nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const { id, ...data } = input;
        await updateMerchantProduct(id, ctx.user.id, data as any);
        return { success: true };
      }),

    /** 商戶：開關「接受排價」總開關 */
    setAutoGenerateCover: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setAutoGenerateCover(ctx.user.id, input.enabled ? 1 : 0);
        return { success: true };
      }),

    setAutoGenerateProductCover: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setAutoGenerateProductCover(ctx.user.id, input.enabled ? 1 : 0);
        return { success: true };
      }),

    setOffersEnabled: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setMerchantOffersEnabled(ctx.user.id, input.enabled ? 1 : 0);
        return { success: true };
      }),

    /** 商戶：設定買家失約封鎖（總開關 + 門檻 + 凍結日數） */
    setFailureLock: protectedProcedure
      .input(z.object({
        threshold: z.number().int().min(1).max(20),
        lockDays: z.number().int().min(1).max(60),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setMerchantFailureLock(ctx.user.id, input.threshold, input.lockDays, input.enabled);
        return { success: true };
      }),

    /** 買家：查詢自己係邊個商戶被封鎖（可選用，前端友善提示） */
    myLockStatusForMerchant: protectedProcedure
      .input(z.object({ merchantId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const lock = await getBuyerLockFromMerchant(ctx.user.id, input.merchantId);
        return lock;
      }),

    /** 商戶：查詢某買家對自己嘅失約紀錄（用於取消訂單對話框顯示） */
    getBuyerFailureStats: protectedProcedure
      .input(z.object({ buyerId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const lock = await getBuyerLockFromMerchant(input.buyerId, ctx.user.id);
        return lock;
      }),

    /** 商戶：設定排價限制（同一商品 X 日內最多 Y 次） */
    setOfferLimits: protectedProcedure
      .input(z.object({
        windowDays: z.number().int().min(1).max(365),
        maxPerWindow: z.number().int().min(1).max(20),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await setMerchantOfferLimits(ctx.user.id, input.windowDays, input.maxPerWindow);
        return { success: true };
      }),

    /** 商戶：刪除商品 */
    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        await deleteMerchantProduct(input.id, ctx.user.id);
        return { success: true };
      }),

    /** 商戶：上傳商品圖片 */
    uploadProductImage: protectedProcedure
      .input(z.object({
        imageData: z.string(),
        fileName: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/bmp'];
        const mimeToUse = (input.mimeType || 'image/jpeg').toLowerCase();
        if (!allowedMimes.includes(mimeToUse)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `不支援此圖片格式（${mimeToUse}），請使用 JPG、PNG 或 WebP` });
        }
        let buffer = Buffer.from(input.imageData, 'base64');
        if (buffer.length > 8 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片不可超過 8MB' });
        }
        // 加上水印（依商戶設定）
        const merchantName = app?.merchantName || ctx.user.name || `用戶#${ctx.user.id}`;
        const wmSettingsProd = await getMerchantSettings(ctx.user.id);
        if (wmSettingsProd.watermarkEnabled) {
          const wmTextProd = wmSettingsProd.watermarkText?.trim() || merchantName;
          buffer = await applyWatermark(buffer, wmTextProd, mimeToUse, {
            opacity: wmSettingsProd.watermarkOpacity,
            shadow: wmSettingsProd.watermarkShadow === 1,
            position: wmSettingsProd.watermarkPosition as any,
            size: wmSettingsProd.watermarkSize,
          });
        }
        const fileKey = `merchant-products/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, mimeToUse);
        return { url };
      }),

    /** 商戶／會員：取得本月影片配額狀態（用於上傳前顯示剩餘條數及秒數上限） */
    getMyVideoQuota: protectedProcedure
      .query(async ({ ctx }) => {
        const [quota, used, maxSeconds] = await Promise.all([
          getUserMonthlyVideoQuota(ctx.user.id),
          countMerchantVideosThisMonth(ctx.user.id),
          getUserMaxVideoSeconds(ctx.user.id),
        ]);
        return { quota, used, remaining: Math.max(0, quota - used), maxSeconds };
      }),

    /** 商戶：上傳短片（用於商品或自己的拍賣），返回 URL，需與 create/update 一齊保存 */
    uploadVideo: protectedProcedure
      .input(z.object({
        videoData: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';
        if (app?.status !== 'approved' && !isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
        const mime = (input.mimeType || '').toLowerCase();
        if (!allowedMimes.includes(mime)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只支援 MP4、WebM、MOV 格式' });
        }
        const buffer = Buffer.from(input.videoData, 'base64');
        if (buffer.length > 30 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '影片不可超過 30MB' });
        }
        const maxSec = await getUserMaxVideoSeconds(ctx.user.id);
        const dur = extractVideoDurationSeconds(buffer, mime);
        if (dur !== null && dur > maxSec) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `影片不可超過 ${maxSec} 秒（目前 ${Math.round(dur)} 秒）` });
        }
        // 月配額：admin 不受限
        if (!isAdmin) {
          const quota = await getUserMonthlyVideoQuota(ctx.user.id);
          const used = await countMerchantVideosThisMonth(ctx.user.id);
          if (used >= quota) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `本月影片上傳已達上限（${used}/${quota} 條）。如需提高配額請聯絡管理員。`,
            });
          }
        }
        const ext = mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : 'mov';
        const key = `merchant-videos/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, mime);
        return { url };
      }),
  }),

  // ── 商戶專場拍賣 (Merchant Auction Sessions) ─────────────────────────────
  // 商戶建立小型拍賣會：揀名、結束日，將自己嘅 auction 加入；公開 URL 集中展示
  merchantSessions: router({
    /** 商戶：列出自己嘅所有 sessions（最新喺前） */
    myList: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只限商戶會員' });
      }
      const db = await getDb();
      const { desc } = await import('drizzle-orm');
      const rows = await db.select().from(merchantAuctionSessions)
        .where(eq(merchantAuctionSessions.merchantUserId, ctx.user.id))
        .orderBy(desc(merchantAuctionSessions.createdAt));
      return rows;
    }),

    /** 商戶：取得單一 session 詳情 + 內容 auctions（拎齊圖片同價錢） */
    getMine: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.id)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        const { asc, inArray } = await import('drizzle-orm');
        const items = await db.select().from(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.sessionId, input.id))
          .orderBy(asc(merchantAuctionSessionItems.displayOrder), asc(merchantAuctionSessionItems.id));
        let auctionsRows: any[] = [];
        if (items.length > 0) {
          const ids = items.map(it => it.auctionId);
          // 用 raw SQL JOIN users + bidCount subquery，確保 currentPrice / highestBidderName / bidCount fresh
          const idsCsv = ids.join(',');
          const rawRows: any = await db.execute(sql.raw(`
            SELECT a.*, u.name AS highestBidderName,
              seller.name AS sellerName,
              (SELECT COUNT(*) FROM bids WHERE bids.auctionId = a.id) AS bidCount,
              COALESCE((SELECT isAnonymous FROM bids WHERE auctionId = a.id AND userId = a.highestBidderId ORDER BY id DESC LIMIT 1), 0) AS highestBidderIsAnonymous
            FROM auctions a
            LEFT JOIN users u ON u.id = a.highestBidderId
            LEFT JOIN users seller ON seller.id = a.createdBy
            WHERE a.id IN (${idsCsv})
          `));
          const rows: any[] = Array.isArray(rawRows) ? (rawRows[0] as any[]) : [];
          auctionsRows = await Promise.all(rows.map(async (a: any) => ({
            ...a,
            highestBidderName: a.highestBidderIsAnonymous === 1 ? '🕵️ 匿名買家' : (a.highestBidderName ?? null),
            images: await getAuctionImages(a.id),
          })));
        }
        // Best-effort DB sync 令 /auctions/:id 直連都 align（fail 唔影響 response）
        // 🔴 用 GREATEST 保留 anti-snipe 已經延長嘅 endTime（個別 auction 觸發延長 > session.endAt 時要尊重）
        try {
          const idsCsvSync = auctionsRows.map((a: any) => a.id).join(',');
          if (idsCsvSync.length > 0) {
            await db.execute(sql.raw(`
              UPDATE auctions a
              JOIN merchantAuctionSessions s ON s.id = ${session.id}
              SET a.endTime = GREATEST(s.endAt, a.endTime)
              WHERE a.id IN (${idsCsvSync})
            `));
          }
        } catch {}
        // 🔴 Bulletproof: 用 max(session.endAt, auction.endTime) 強制覆蓋，
        // 保證 hero 同 item 一致；同時尊重 anti-snipe 對個別 auction 嘅延長
        {
          const sEndMs = new Date(session.endAt).getTime();
          for (const a of auctionsRows) {
            const aEndMs = a.endTime ? new Date(a.endTime).getTime() : 0;
            a.endTime = aEndMs > sEndMs ? a.endTime : session.endAt;
          }
        }
        const auctionMap = new Map(auctionsRows.map(a => [a.id, a]));
        const merged = items.map(it => ({ ...it, auction: auctionMap.get(it.auctionId) || null }));
        const summary = computeSessionSummary(auctionsRows, session);
        return { session, items: merged, summary };
      }),

    /** 建立新專場（status=draft） */
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(2).max(200),
        slug: z.string().max(80).optional(),
        description: z.string().max(2000).optional(),
        coverImage: z.string().url().optional(),
        endAt: z.date(),
        visibility: z.enum(['public', 'unlisted']).default('public'),
        addItemsCutoffMinutes: z.number().int().min(0).max(1440).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只限商戶會員' });
        }
        if (input.endAt.getTime() < Date.now() + 5 * 60 * 1000) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '結束時間至少要 5 分鐘後' });
        }
        const slug = await generateUniqueSessionSlug(ctx.user.id, input.slug?.trim() || input.title);
        const db = await getDb();
        const [result]: any = await db.insert(merchantAuctionSessions).values({
          merchantUserId: ctx.user.id,
          slug,
          title: sanitizeUserText(input.title),
          description: input.description ? sanitizeUserText(input.description) : null,
          coverImage: input.coverImage || null,
          endAt: input.endAt,
          visibility: input.visibility,
          status: 'draft',
          ...(input.addItemsCutoffMinutes !== undefined ? { addItemsCutoffMinutes: input.addItemsCutoffMinutes } : {}),
        });
        return { id: result.insertId, slug };
      }),

    /** 更新 session metadata */
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(2).max(200).optional(),
        description: z.string().max(2000).optional().nullable(),
        coverImage: z.string().url().optional().nullable(),
        endAt: z.date().optional(),
        visibility: z.enum(['public', 'unlisted']).optional(),
        addItemsCutoffMinutes: z.number().int().min(0).max(1440).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.id)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        if (session.status === 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已結束嘅專場不可修改' });
        }
        const patch: any = {};
        if (input.title !== undefined) patch.title = sanitizeUserText(input.title);
        if (input.description !== undefined) patch.description = input.description ? sanitizeUserText(input.description) : null;
        if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
        if (input.endAt !== undefined) {
          if (input.endAt.getTime() < Date.now() + 5 * 60 * 1000) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: '結束時間至少要 5 分鐘後' });
          }
          patch.endAt = input.endAt;
        }
        if (input.visibility !== undefined) patch.visibility = input.visibility;
        if (input.addItemsCutoffMinutes !== undefined) patch.addItemsCutoffMinutes = input.addItemsCutoffMinutes;
        if (Object.keys(patch).length === 0) return { ok: true };
        await db.update(merchantAuctionSessions).set(patch)
          .where(eq(merchantAuctionSessions.id, input.id));
        // Auto-sync: 改咗專場結束時間 → 同步更新所有掛喺呢場嘅商品 endTime
        let syncedItems = 0;
        if (patch.endAt) {
          try {
            const itemRows = await db.select({ auctionId: merchantAuctionSessionItems.auctionId })
              .from(merchantAuctionSessionItems)
              .where(eq(merchantAuctionSessionItems.sessionId, input.id));
            const itemIds = itemRows.map(r => r.auctionId);
            if (itemIds.length > 0) {
              const idsCsvUp = itemIds.join(',');
              // DB-side copy 避免 JS Date TZ round-trip（保證 auctions.endTime === merchantAuctionSessions.endAt）
              await db.execute(sql.raw(`
                UPDATE auctions a
                JOIN merchantAuctionSessions s ON s.id = ${input.id}
                SET a.endTime = s.endAt
                WHERE a.id IN (${idsCsvUp})
              `));
              syncedItems = itemIds.length;
            }
          } catch (e) {
            (ctx.req as any)?.log?.warn?.({ err: e, sessionId: input.id }, 'session update endTime sync failed');
          }
        }
        return { ok: true, syncedItems };
      }),

    /** Publish: draft → published */
    publish: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.id)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        if (session.status !== 'draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只可以 publish 草稿' });
        }
        // 自動激活所有 items（draft / 流拍）→ active，endTime 設為 session.endAt，清 archived flag
        const { inArray: inArr2, and: and2, isNull: isNull2 } = await import('drizzle-orm');
        const itemRows = await db.select({ auctionId: merchantAuctionSessionItems.auctionId })
          .from(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.sessionId, input.id));
        const itemAuctionIds = itemRows.map(r => r.auctionId);
        let activatedCount = 0;
        if (itemAuctionIds.length > 0) {
          const eligible = await db.select({ id: auctions.id }).from(auctions)
            .where(and2(
              inArr2(auctions.id, itemAuctionIds),
              eq(auctions.createdBy, session.merchantUserId),
              inArr2(auctions.status, ['draft', 'ended'] as any),
              isNull2(auctions.highestBidderId),
            )!);
          if (eligible.length > 0) {
            const eligibleIds = eligible.map(a => a.id);
            await db.update(auctions).set({
              status: 'active' as any,
              endTime: session.endAt,
              archived: 0,
              archivedAt: null as any,
            }).where(inArr2(auctions.id, eligibleIds));
            activatedCount = eligibleIds.length;
          }
        }
        await db.update(merchantAuctionSessions).set({ status: 'published' })
          .where(eq(merchantAuctionSessions.id, input.id));
        return { ok: true, activated: activatedCount };
      }),

    /** End: published → ended (manual) */
    end: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.id)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        await db.update(merchantAuctionSessions).set({ status: 'ended' })
          .where(eq(merchantAuctionSessions.id, input.id));
        // 凍結場內所有 active auctions（避免手動 end 後仲俾人出價，搞到 combined email 嘅 winners/totals 失準）
        // 並初始化 auctionOrderStatus + paymentStatus，確保商戶後台拍賣訂單即時見到記錄
        try {
          await db.execute(sql.raw(
            `UPDATE auctions a JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id ` +
            `SET a.status='ended', a.endTime=NOW() ` +
            `WHERE sit.sessionId=${input.id} AND a.status='active'`
          ));
          await db.execute(sql.raw(
            `UPDATE auctions a JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id ` +
            `SET a.auctionOrderStatus='pending' ` +
            `WHERE sit.sessionId=${input.id} AND a.status='ended' AND a.highestBidderId IS NOT NULL AND a.auctionOrderStatus IS NULL`
          ));
          await db.execute(sql.raw(
            `UPDATE auctions a JOIN merchantAuctionSessionItems sit ON sit.auctionId=a.id ` +
            `SET a.paymentStatus='pending_payment' ` +
            `WHERE sit.sessionId=${input.id} AND a.status='ended' AND a.highestBidderId IS NOT NULL AND a.paymentStatus IS NULL`
          ));
        } catch (e) {
          console.error('[Email] Manual end: freeze auctions failed:', e);
        }
        // 原子聲明發信權，避免重複發
        try {
          const claim: any = await db.execute(sql.raw(
            `UPDATE merchantAuctionSessions SET combinedWonEmailSentAt=NOW() WHERE id=${input.id} AND combinedWonEmailSentAt IS NULL`
          ));
          const claimAffected = claim?.[0]?.affectedRows ?? claim?.affectedRows ?? 0;
          if (claimAffected > 0) {
            const { notifyCombinedSessionWon } = await import('./auctions');
            // 用 trusted env 為先，避免被 spoofed Origin header 攻擊（phishing）
            const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
            notifyCombinedSessionWon(input.id, origin).catch(err =>
              console.error(`[Email] Manual end combined invoice failed for session ${input.id}:`, err));
          }
        } catch (err) {
          console.error('[Email] Manual end combined invoice trigger error:', err);
        }
        return { ok: true };
      }),

    /** Combined invoice email status — sentAt + 每位 winner 嘅發信對象/金額 */
    getEmailStatus: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        const rawRows: any = await db.execute(sql.raw(`
          SELECT a.id AS auctionId, a.title, a.currentPrice, a.currency, a.highestBidderId,
            u.email AS winnerEmail, u.name AS winnerName, u.notifyWon AS winnerNotifyWon
          FROM merchantAuctionSessionItems sit
          JOIN auctions a ON a.id = sit.auctionId
          LEFT JOIN users u ON u.id = a.highestBidderId
          WHERE sit.sessionId = ${input.sessionId} AND a.highestBidderId IS NOT NULL
          ORDER BY sit.displayOrder ASC, sit.id ASC
        `));
        const items: any[] = Array.isArray(rawRows) ? (rawRows[0] as any[]) : [];
        const byWinner = new Map<number, any>();
        for (const it of items) {
          let g = byWinner.get(it.highestBidderId);
          if (!g) {
            g = {
              userId: it.highestBidderId,
              email: it.winnerEmail ?? null,
              name: it.winnerName ?? `用戶 #${it.highestBidderId}`,
              optedOut: it.winnerNotifyWon === 0 || it.winnerNotifyWon === false,
              itemCount: 0,
              totalsByCurrency: {} as Record<string, number>,
            };
            byWinner.set(it.highestBidderId, g);
          }
          g.itemCount++;
          const cur = it.currency || 'HKD';
          const amt = parseFloat(String(it.currentPrice)) || 0;
          g.totalsByCurrency[cur] = (g.totalsByCurrency[cur] || 0) + amt;
        }
        const winners: any[] = [];
        byWinner.forEach((g) => winners.push(g));
        return { sentAt: (session as any).combinedWonEmailSentAt ?? null, winners };
      }),

    /** 重發 combined invoice — winnerUserId 唔填即全部重發 */
    resendCombinedInvoice: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), winnerUserId: z.number().int().positive().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        if (session.status !== 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '專場未結束，未可發送中標通知' });
        }
        const { notifyCombinedSessionWon } = await import('./auctions');
        // Trusted env first — never trust Origin header for outbound email links
        const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
        const r = await notifyCombinedSessionWon(input.sessionId, origin, input.winnerUserId ? { onlyWinnerUserId: input.winnerUserId } : undefined);
        // 成功 send 完先更新 audit timestamp（全部重發先寫，單個 winner 重發唔郁全場 sentAt）
        if (!input.winnerUserId && r.sent > 0) {
          await db.execute(sql.raw(
            `UPDATE merchantAuctionSessions SET combinedWonEmailSentAt=NOW() WHERE id=${input.sessionId}`
          ));
        }
        return { ok: true, sent: r.sent, skipped: r.skipped };
      }),

    /** Delete (only draft + 0 items) */
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.id)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        // 容許刪除：(1) draft，或 (2) 任何 status 但冇商品
        const itemRows = await db.select({ id: merchantAuctionSessionItems.id })
          .from(merchantAuctionSessionItems).where(eq(merchantAuctionSessionItems.sessionId, input.id));
        const isEmpty = itemRows.length === 0;
        if (session.status !== 'draft' && !isEmpty) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已發佈/已結束嘅專場必須冇商品先可以刪除。請先移除所有商品，或改為「結束」。' });
        }
        await db.delete(merchantAuctionSessionItems).where(eq(merchantAuctionSessionItems.sessionId, input.id));
        await db.delete(merchantAuctionSessions).where(eq(merchantAuctionSessions.id, input.id));
        return { ok: true };
      }),

    /** 加入 auction 落 session（必須係自己嘅 auction） */
    addItems: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        auctionIds: z.array(z.number().int().positive()).min(1).max(200),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const { inArray, and } = await import('drizzle-orm');
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        if (session.status === 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已結束嘅專場不可加 item' });
        }
        // 結束前 N 分鐘 cut-off，避免 bidder 漏睇新加入嘅商品
        if (session.status === 'published') {
          const cutoffMin = (session as any).addItemsCutoffMinutes ?? 30;
          const cutoffMs = new Date(session.endAt).getTime() - cutoffMin * 60 * 1000;
          if (Date.now() >= cutoffMs) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `已過加品截止時間（結束前 ${cutoffMin} 分鐘內不可再加入新商品）` });
          }
        }
        // 驗證 auctions 全部屬於呢個 merchant，且非 archived
        const myAuctions = await db.select({ id: auctions.id, status: auctions.status, archived: auctions.archived, highestBidderId: auctions.highestBidderId }).from(auctions)
          .where(and(inArray(auctions.id, input.auctionIds), eq(auctions.createdBy, session.merchantUserId)));
        // Server-side filter: 只接受 draft 或 (ended + 無人贏)，拒絕 archived
        const myIds = new Set(
          myAuctions
            .filter((a: any) => {
              if (a.archived === 1) return false; // 已 archive 唔可加入
              if (a.status === 'draft') return true;
              if (a.status === 'ended' && !a.highestBidderId) return true;
              // active / sold / 其他：唔出現喺 eligible list 但仍可加入（endTime sync only）
              return true;
            })
            .map((a: any) => a.id)
        );
        const valid = input.auctionIds.filter(id => myIds.has(id));
        if (valid.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '所有 auction 都不屬於你' });
        }
        // 攞返已加入嘅
        const existing = await db.select({ auctionId: merchantAuctionSessionItems.auctionId })
          .from(merchantAuctionSessionItems)
          .where(and(
            eq(merchantAuctionSessionItems.sessionId, input.sessionId),
            inArray(merchantAuctionSessionItems.auctionId, valid),
          ));
        const existingSet = new Set(existing.map(e => e.auctionId));
        const toAdd = valid.filter(id => !existingSet.has(id));
        if (toAdd.length === 0) return { added: 0, skipped: valid.length };
        // 攞最大 displayOrder 接住排
        const [maxRow]: any = await db.execute(sql`SELECT COALESCE(MAX(displayOrder), 0) as maxOrder FROM merchantAuctionSessionItems WHERE sessionId = ${input.sessionId}`);
        let nextOrder = Number((maxRow as any[])?.[0]?.maxOrder || 0) + 1;
        const values = toAdd.map(auctionId => ({
          sessionId: input.sessionId, auctionId, displayOrder: nextOrder++,
        }));
        await db.insert(merchantAuctionSessionItems).values(values);
        // 更新 itemCount
        await db.update(merchantAuctionSessions)
          .set({ itemCount: sql`(SELECT COUNT(*) FROM merchantAuctionSessionItems WHERE sessionId = ${input.sessionId})` })
          .where(eq(merchantAuctionSessions.id, input.sessionId));
        // Auto-sync: 加入專場嘅商品 endTime 一律 align 到 session.endAt（DB-side copy 避免 JS Date TZ round-trip）
        // 同時：流拍商品 (status='ended' && 無中標) 加入後重置 → 視乎 session 狀態變 'active' (published) 或 'draft'，清除舊出價，重置價錢
        let revivedEnded = 0;
        try {
          const idsCsvAdd = toAdd.join(',');
          // 1) 一律同步 endTime to session.endAt (DB-side copy)
          await db.execute(sql.raw(`
            UPDATE auctions a
            JOIN merchantAuctionSessions s ON s.id = ${input.sessionId}
            SET a.endTime = s.endAt
            WHERE a.id IN (${idsCsvAdd})
          `));
          // 2) 揾出流拍商品 (status='ended' && highestBidderId IS NULL)
          const endedRowsRaw: any = await db.execute(sql.raw(`
            SELECT id, startingPrice FROM auctions
            WHERE id IN (${idsCsvAdd}) AND status = 'ended' AND highestBidderId IS NULL
          `));
          const endedRows: any[] = Array.isArray(endedRowsRaw) ? (endedRowsRaw[0] as any[]) : [];
          if (endedRows.length > 0) {
            const endedIds = endedRows.map(r => r.id);
            const endedCsv = endedIds.join(',');
            // 清出價（流拍應該本來就無 bids，但保險起見）
            try { await db.execute(sql.raw(`DELETE FROM bids WHERE auctionId IN (${endedCsv})`)); } catch {}
            try { await db.execute(sql.raw(`DELETE FROM proxyBids WHERE auctionId IN (${endedCsv})`)); } catch {}
            try { await db.execute(sql.raw(`DELETE FROM proxyBidLogs WHERE auctionId IN (${endedCsv})`)); } catch {}
            // 重置 currentPrice = startingPrice + 重新開放
            const newStatus = session.status === 'published' ? 'active' : 'draft';
            await db.execute(sql.raw(`
              UPDATE auctions
              SET status = '${newStatus}',
                  currentPrice = startingPrice,
                  highestBidderId = NULL
              WHERE id IN (${endedCsv})
            `));
            revivedEnded = endedRows.length;
          }
        } catch (e) {
          (ctx.req as any)?.log?.warn?.({ err: e, sessionId: input.sessionId, toAdd }, 'addItems endTime/revive sync failed');
        }
        return { added: toAdd.length, skipped: valid.length - toAdd.length, revivedEnded };
      }),

    /** 從 session 移除一個 auction（item 本身唔影響 auction 本體；可選擇順便收返做流拍隱藏） */
    removeItem: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        auctionId: z.number().int().positive(),
        /** true = 同時將 auction 收返做流拍（status=ended + archived=1），喺主站隱藏；false = 維持現狀繼續喺主站賣 */
        archiveAuction: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const { and } = await import('drizzle-orm');
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        // 已有人出價嘅 auction 唔可以拆除（保護 bidder 權益）
        const [auc0] = await db.select().from(auctions).where(eq(auctions.id, input.auctionId)).limit(1);
        if (auc0 && auc0.highestBidderId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此商品已有人出價，不得從專場拆除。如要結束，請等 endTime 自然結算。' });
        }
        await db.delete(merchantAuctionSessionItems).where(and(
          eq(merchantAuctionSessionItems.sessionId, input.sessionId),
          eq(merchantAuctionSessionItems.auctionId, input.auctionId),
        ));
        await db.update(merchantAuctionSessions)
          .set({ itemCount: sql`(SELECT COUNT(*) FROM merchantAuctionSessionItems WHERE sessionId = ${input.sessionId})` })
          .where(eq(merchantAuctionSessions.id, input.sessionId));
        // 若商戶選擇收返做流拍：用 atomic UPDATE 確保中間有 bid 入嚟唔會誤改
        if (input.archiveAuction) {
          await db.execute(sql`
            UPDATE auctions
            SET status = 'ended', archived = 1, archivedAt = NOW()
            WHERE id = ${input.auctionId}
              AND createdBy = ${session.merchantUserId}
              AND highestBidderId IS NULL
          `);
        }
        return { ok: true };
      }),

    /** V2: 一鍵將 session 入面所有 draft / 流拍 auction publish (status → active, endTime → session.endAt) */
    bulkPublishItems: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const { and, inArray, isNull } = await import('drizzle-orm');
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (session.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的專場' });
        }
        const items = await db.select().from(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.sessionId, input.sessionId));
        if (items.length === 0) return { published: 0 };
        const ids = items.map(it => it.auctionId);
        const eligible = await db.select({ id: auctions.id }).from(auctions)
          .where(and(
            inArray(auctions.id, ids),
            inArray(auctions.status, ['draft', 'ended'] as any),
            eq(auctions.createdBy, session.merchantUserId),
            isNull(auctions.highestBidderId),
          )!);
        if (eligible.length === 0) return { published: 0 };
        const eligibleIds = eligible.map(a => a.id);
        await db.update(auctions).set({
          status: 'active' as any,
          endTime: session.endAt,
          archived: 0,
          archivedAt: null as any,
        }).where(inArray(auctions.id, eligibleIds));
        return { published: eligibleIds.length };
      }),

    /** 商戶：列出自己可加入專場嘅 auctions — 只計 draft（未發佈）+ 流拍（已結束無人贏） */
    myEligibleAuctions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const { desc, and, or, isNull, notInArray } = await import('drizzle-orm');
      // 揾出已喺任何 draft/published 專場入面嘅 auctionId，唔再給加入新專場
      const inActiveSessionRaw: any = await db.execute(
        sql`SELECT DISTINCT si.auctionId FROM merchantAuctionSessionItems si
            JOIN merchantAuctionSessions s ON s.id = si.sessionId
            WHERE s.merchantUserId = ${ctx.user.id}
              AND s.status IN ('draft','published')`
      );
      const inActiveSessionIds: number[] = (
        Array.isArray(inActiveSessionRaw) ? (inActiveSessionRaw[0] as any[]) : []
      ).map((r: any) => Number(r.auctionId));

      const baseWhere = and(
        eq(auctions.createdBy, ctx.user.id),
        or(
          eq(auctions.status, 'draft' as any),
          and(eq(auctions.status, 'ended' as any), isNull(auctions.highestBidderId))
        ),
        // 排除已 archive 嘅 auction（removeItem archiveAuction=true 或手動 archive）
        sql`(${auctions.archived} = 0 OR ${auctions.archived} IS NULL)`,
      );
      const where = inActiveSessionIds.length > 0
        ? and(baseWhere, notInArray(auctions.id, inActiveSessionIds))
        : baseWhere;
      const rows = await db.select().from(auctions)
        .where(where)
        .orderBy(desc(auctions.createdAt));
      const enriched = await Promise.all(rows.map(async (a: any) => ({
        ...a,
        images: await getAuctionImages(a.id),
      })));
      return enriched;
    }),

    /** 公開：根據 merchantUserId + slug 取 session（unlisted 都拎到，只要知 URL） */
    getPublic: publicProcedure
      .input(z.object({
        merchantUserId: z.number().int().positive(),
        slug: z.string().min(1).max(80),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { and, asc, inArray } = await import('drizzle-orm');
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(and(
            eq(merchantAuctionSessions.merchantUserId, input.merchantUserId),
            eq(merchantAuctionSessions.slug, input.slug),
          )).limit(1);
        if (!session || session.status === 'draft') {
          throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在或未發佈' });
        }
        const items = await db.select().from(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.sessionId, session.id))
          .orderBy(asc(merchantAuctionSessionItems.displayOrder), asc(merchantAuctionSessionItems.id));
        let auctionsRows: any[] = [];
        if (items.length > 0) {
          const ids = items.map(it => it.auctionId);
          // JOIN users + bidCount subquery，攞 fresh currentPrice / highestBidderName / bidCount
          const idsCsv = ids.join(',');
          const rawRows: any = await db.execute(sql.raw(`
            SELECT a.*, u.name AS highestBidderName,
              seller.name AS sellerName,
              (SELECT COUNT(*) FROM bids WHERE bids.auctionId = a.id) AS bidCount,
              COALESCE((SELECT isAnonymous FROM bids WHERE auctionId = a.id AND userId = a.highestBidderId ORDER BY id DESC LIMIT 1), 0) AS highestBidderIsAnonymous
            FROM auctions a
            LEFT JOIN users u ON u.id = a.highestBidderId
            LEFT JOIN users seller ON seller.id = a.createdBy
            WHERE a.id IN (${idsCsv})
          `));
          const rows: any[] = Array.isArray(rawRows) ? (rawRows[0] as any[]) : [];
          auctionsRows = await Promise.all(rows.map(async (a: any) => ({
            ...a,
            highestBidderName: a.highestBidderIsAnonymous === 1 ? '🕵️ 匿名買家' : (a.highestBidderName ?? null),
            images: await getAuctionImages(a.id),
          })));
          // Best-effort DB sync（fail 唔影響 response）
          // 🔴 用 GREATEST 保留 anti-snipe 已經延長嘅 endTime
          try {
            const idsCsvSync2 = auctionsRows.map((a: any) => a.id).join(',');
            if (idsCsvSync2.length > 0) {
              await db.execute(sql.raw(`
                UPDATE auctions a
                JOIN merchantAuctionSessions s ON s.id = ${session.id}
                SET a.endTime = GREATEST(s.endAt, a.endTime)
                WHERE a.id IN (${idsCsvSync2})
              `));
            }
          } catch {}
          // 🔴 用 max(session.endAt, auction.endTime) 強制覆蓋，尊重 anti-snipe 延長
          {
            const sEndMs = new Date(session.endAt).getTime();
            for (const a of auctionsRows) {
              const aEndMs = a.endTime ? new Date(a.endTime).getTime() : 0;
              a.endTime = aEndMs > sEndMs ? a.endTime : session.endAt;
            }
          }
        }
        // 攞 merchant 名（從 merchantApplications）
        const merchantApp = await getMerchantApplicationByUser(input.merchantUserId);
        const merchantName = merchantApp?.merchantName || '商戶';
        const merchantIcon = merchantApp?.merchantIcon || null;
        const auctionMap = new Map(auctionsRows.map(a => [a.id, a]));
        const merged = items
          .map(it => auctionMap.get(it.auctionId))
          .filter((a): a is typeof auctionsRows[number] => !!a);
        const summary = computeSessionSummary(auctionsRows, session);
        return { session, auctions: merged, merchantName, merchantIcon, summary };
      }),

    /** 公開：列出全站所有「已發佈 + public + 仲未結束」嘅 sessions（俾商戶 directory 加 icon） */
    listAllActivePublic: publicProcedure
      .query(async () => {
        const db = await getDb();
        const { and, gt, asc } = await import('drizzle-orm');
        const nowDate = new Date();
        const rows = await db.select({
          id: merchantAuctionSessions.id,
          merchantUserId: merchantAuctionSessions.merchantUserId,
          slug: merchantAuctionSessions.slug,
          title: merchantAuctionSessions.title,
          endAt: merchantAuctionSessions.endAt,
          coverImage: merchantAuctionSessions.coverImage,
          itemCount: merchantAuctionSessions.itemCount,
        }).from(merchantAuctionSessions)
          .where(and(
            eq(merchantAuctionSessions.status, 'published'),
            eq(merchantAuctionSessions.visibility, 'public'),
            gt(merchantAuctionSessions.endAt, nowDate),
          ))
          .orderBy(asc(merchantAuctionSessions.endAt));
        return rows;
      }),

    /** 公開：列出某商戶嘅所有 published + public sessions */
    listPublicByMerchant: publicProcedure
      .input(z.object({ merchantUserId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { and, desc, ne } = await import('drizzle-orm');
        const rows = await db.select().from(merchantAuctionSessions)
          .where(and(
            eq(merchantAuctionSessions.merchantUserId, input.merchantUserId),
            ne(merchantAuctionSessions.status, 'draft'),
            eq(merchantAuctionSessions.visibility, 'public'),
          ))
          .orderBy(desc(merchantAuctionSessions.endAt));
        return rows;
      }),

    /** 公開：取 auction 屬於邊個 published session（俾 AuctionDetail 顯示「屬於專場 X」） */
    findSessionForAuction: publicProcedure
      .input(z.object({ auctionId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { and, desc, inArray, ne } = await import('drizzle-orm');
        const items = await db.select().from(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.auctionId, input.auctionId));
        if (items.length === 0) return null;
        const sessionIds = items.map(it => it.sessionId);
        const sessions = await db.select().from(merchantAuctionSessions)
          .where(and(
            inArray(merchantAuctionSessions.id, sessionIds),
            ne(merchantAuctionSessions.status, 'draft'),
          ))
          .orderBy(desc(merchantAuctionSessions.endAt))
          .limit(1);
        const s = sessions[0];
        if (!s) return null;
        const merchantApp = await getMerchantApplicationByUser(s.merchantUserId);
        return { ...s, merchantName: merchantApp?.merchantName || '商戶' };
      }),

    /**
     * Admin: 完整拆除整個商戶專場
     * - 清除所有 merchantAuctionSessionItems
     * - 刪除 session 本身
     * - 對每件 auction:
     *   • status='draft' → 維持 'draft'（回原狀）
     *   • status='ended' && 無中標者 → 維持 'ended'（流拍）
     *   • 其他（active 或 ended-with-winner）→ status='active'，endTime 延長至 NOW + 7 日
     * - 一律清除 bids / proxyBids / proxyBidLogs（即「會員中拍紀錄」）
     * - 一律 reset currentPrice = startingPrice，highestBidderId = NULL
     */
    adminTeardown: adminProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        confirmTitle: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const { inArray } = await import('drizzle-orm');
        const [session] = await db.select().from(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId)).limit(1);
        if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: '專場不存在' });
        if (input.confirmTitle.trim() !== session.title.trim()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `請輸入完整專場名稱「${session.title}」確認拆除` });
        }
        const items = await db.select().from(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.sessionId, input.sessionId));
        const auctionIds = items.map(it => it.auctionId);

        let restoredDraft = 0, restoredEnded = 0, restoredActive = 0, bidsCleared = 0;
        if (auctionIds.length > 0) {
          const aucs = await db.select().from(auctions).where(inArray(auctions.id, auctionIds));
          // 清除 bids / proxyBids / proxyBidLogs
          const placeholders = auctionIds.map(() => '?').join(',');
          try {
            const r: any = await db.execute(sql.raw(`DELETE FROM bids WHERE auctionId IN (${auctionIds.join(',')})`));
            bidsCleared = Array.isArray(r) ? (r[0] as any)?.affectedRows || 0 : 0;
          } catch (e) { (ctx.req as any)?.log?.warn?.({ err: e }, 'adminTeardown: clear bids failed'); }
          try { await db.execute(sql.raw(`DELETE FROM proxyBids WHERE auctionId IN (${auctionIds.join(',')})`)); } catch {}
          try { await db.execute(sql.raw(`DELETE FROM proxyBidLogs WHERE auctionId IN (${auctionIds.join(',')})`)); } catch {}

          // 逐件 reset 狀態 + currentPrice + highestBidderId
          const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          for (const a of aucs) {
            const hasWinner = !!a.highestBidderId;
            let targetStatus: 'draft' | 'active' | 'ended' = 'active';
            let newEndTime = a.endTime;
            if (a.status === 'draft') {
              targetStatus = 'draft';
              restoredDraft++;
            } else if (a.status === 'ended' && !hasWinner) {
              targetStatus = 'ended'; // 流拍維持
              restoredEnded++;
            } else {
              targetStatus = 'active';
              newEndTime = sevenDaysLater;
              restoredActive++;
            }
            await db.update(auctions).set({
              status: targetStatus,
              endTime: newEndTime,
              currentPrice: a.startingPrice,
              highestBidderId: null,
            }).where(eq(auctions.id, a.id));
          }
        }

        // 拆除 session 本身
        await db.delete(merchantAuctionSessionItems)
          .where(eq(merchantAuctionSessionItems.sessionId, input.sessionId));
        await db.delete(merchantAuctionSessions)
          .where(eq(merchantAuctionSessions.id, input.sessionId));

        (ctx.req as any)?.log?.info?.({
          sessionId: input.sessionId, title: session.title, merchantUserId: session.merchantUserId,
          itemCount: items.length, restoredDraft, restoredEnded, restoredActive, bidsCleared,
          adminId: ctx.user.id,
        }, 'merchantSession.adminTeardown executed');

        return { ok: true, itemCount: items.length, restoredDraft, restoredEnded, restoredActive, bidsCleared };
      }),

    /** Admin: 列出所有商戶專場（俾管理後台揀邊個拆除） */
    adminListAll: adminProcedure
      .input(z.object({ merchantUserId: z.number().int().positive().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { desc, and } = await import('drizzle-orm');
        const where = input.merchantUserId
          ? and(eq(merchantAuctionSessions.merchantUserId, input.merchantUserId))
          : undefined;
        const rows = await db.select().from(merchantAuctionSessions)
          .where(where as any)
          .orderBy(desc(merchantAuctionSessions.createdAt))
          .limit(200);
        // 加 merchantName
        const result = await Promise.all(rows.map(async (s) => {
          const app = await getMerchantApplicationByUser(s.merchantUserId);
          return { ...s, merchantName: app?.merchantName || `User#${s.merchantUserId}` };
        }));
        return result;
      }),
  }),

  // 商品訂單
  productOrders: router({
    /** 買家落單 */
    create: protectedProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().min(1).max(99).default(1),
        buyerNote: z.string().max(500).optional(),
        buyerPushEndpoint: z.string().url().optional(), // 買家當前瀏覽器的推送識別碼
      }))
      .mutation(async ({ input, ctx }) => {
        const product = await getMerchantProduct(input.productId);
        if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到商品' });
        if (product.status !== 'active') throw new TRPCError({ code: 'BAD_REQUEST', message: '此商品已下架或售罄' });
        if (product.stock < input.quantity) throw new TRPCError({ code: 'BAD_REQUEST', message: '庫存不足' });
        if (product.merchantId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: '不能購買自己的商品' });

        // 失約封鎖檢查
        try { await assertBuyerNotLockedFromMerchant(ctx.user.id, product.merchantId, '落單'); }
        catch (err) { throw new TRPCError({ code: 'FORBIDDEN', message: err instanceof Error ? err.message : '已被該商戶暫停落單' }); }

        const deposit = await getOrCreateSellerDeposit(product.merchantId);
        // 優先用貨品傭金率，若未設定則 fallback 拍賣傭金率，最後 fallback 5%
        const commissionRate = deposit
          ? parseFloat(String((deposit as any).productCommissionRate ?? deposit.commissionRate))
          : 0.05;

        const orderId = await createProductOrder({
          productId: product.id,
          buyerId: ctx.user.id,
          merchantId: product.merchantId,
          title: product.title,
          price: parseFloat(String(product.price)),
          currency: product.currency ?? 'HKD',
          quantity: input.quantity,
          commissionRate,
          buyerName: (ctx.user as any).name ?? undefined,
          buyerPhone: ctx.user.phone ?? undefined,
          buyerNote: input.buyerNote,
        });

        // 通知商戶：新訂單
        const buyerName = (ctx.user as any).name ?? `會員#${ctx.user.id}`;
        const currency = product.currency ?? 'HKD';
        const total = (parseFloat(String(product.price)) * input.quantity).toLocaleString('zh-HK', { minimumFractionDigits: 0 });
        const noteStr = input.buyerNote?.trim() ? `\n備註：${input.buyerNote.trim()}` : '';
        const siteBase = getEmailOrigin(ctx.req);
        const productUrl = `${siteBase}/merchant-products/${product.id}`;
        const merchantOrdersUrl = `${siteBase}/merchant-products?tab=orders`;
        sendPushToUser(product.merchantId, {
          title: '🛒 新訂單',
          body: `${buyerName} 落單：${product.title}${input.quantity > 1 ? ` ×${input.quantity}` : ''} $${total} ${currency}${noteStr}`,
          url: merchantOrdersUrl,
          tag: `product-order-${orderId}`,
        }).catch(() => {});

        // 通知買家：落單確認（精準推送到落單的那個瀏覽器，如無則推全部）
        const buyerPayload = {
          title: '✅ 訂單已收到',
          body: `${product.title}${input.quantity > 1 ? ` ×${input.quantity}` : ''} $${total} ${currency}，等待商戶確認`,
          url: productUrl,
          tag: `order-confirm-${orderId}`,
        };
        if (input.buyerPushEndpoint) {
          sendPushToEndpoint(input.buyerPushEndpoint, buyerPayload).catch(() => {});
        } else {
          sendPushToUser(ctx.user.id, buyerPayload).catch(() => {});
        }

        return { orderId };
      }),

    /** 商戶：確認成交（同時扣傭金） */
    confirm: protectedProcedure
      .input(z.object({ orderId: z.number(), finalPrice: z.number().positive().optional() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }

        // 確認前先取訂單資料，用於通知買家
        const db = await getDb();
        let orderSnap: any = null;
        if (db) {
          const rows = await db.execute(sql`SELECT * FROM productOrders WHERE id = ${input.orderId} LIMIT 1`);
          orderSnap = ((rows[0] as any[])[0]) ?? null;
        }

        const result = await confirmProductOrder(input.orderId, ctx.user.id, input.finalPrice);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });

        // 確認成交後通知買家（push + email），fire-and-forget
        if (orderSnap) {
          (async () => {
            try {
              const buyerId = orderSnap.buyerId;
              const productTitle = orderSnap.title ?? '商品';
              const currency = orderSnap.currency ?? 'HKD';
              const unitPrice = input.finalPrice ?? parseFloat(String(orderSnap.price));
              const quantity = parseInt(String(orderSnap.quantity)) || 1;
              const siteBase = getEmailOrigin(ctx.req as any);
              const orderUrl = `${siteBase}/merchant-products`;

              // Push 通知買家
              sendPushToUser(buyerId, {
                title: '✅ 訂單已確認成交',
                body: `${productTitle}${quantity > 1 ? ` ×${quantity}` : ''} ${currency} $${(unitPrice * quantity).toLocaleString()}，請安排付款及交收`,
                url: orderUrl,
                tag: `order-confirmed-${input.orderId}`,
              }).catch(() => {});

              // Email 通知買家（若有 email）
              const buyer = await getUserById(buyerId);
              if (buyer?.email) {
                const settings = await getNotificationSettings();
                const merchantSettings = await getMerchantSettings(ctx.user.id);
                const merchantApp = await getMerchantApplicationByUser(ctx.user.id);
                const { sendProductOrderConfirmedEmail } = await import('./email');
                await sendProductOrderConfirmedEmail({
                  to: buyer.email,
                  senderName: settings.senderName,
                  senderEmail: settings.senderEmail,
                  userName: buyer.name ?? `會員 #${buyerId}`,
                  productTitle,
                  orderId: input.orderId,
                  finalPrice: unitPrice,
                  quantity,
                  currency,
                  orderUrl,
                  paymentInstructions: merchantSettings.paymentInstructions ?? settings.paymentInstructions ?? null,
                  deliveryInfo: merchantSettings.deliveryInfo ?? settings.deliveryInfo ?? null,
                  merchantName: merchantApp?.merchantName ?? null,
                  merchantWhatsapp: merchantApp?.whatsapp ?? null,
                });
              }
            } catch (e) {
              console.error('[confirm product order] notification failed', e);
            }
          })();
        }

        return { success: true };
      }),

    /** 取消訂單（商戶或管理員，買家請改用 requestCancel） */
    cancel: protectedProcedure
      .input(z.object({ orderId: z.number(), reason: z.string().max(200).optional(), markAsFailure: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user.role === 'admin';
        if (!isAdmin) {
          // 確認是商戶
          const app = await getMerchantApplicationByUser(ctx.user.id);
          if (app?.status !== 'approved') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '買家不可直接取消，請改用「申請取消訂單」' });
          }
        }
        const result = await cancelProductOrder(input.orderId, ctx.user.id, isAdmin, input.reason, input.markAsFailure);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 買家：申請取消訂單（需商戶批准） */
    requestCancel: protectedProcedure
      .input(z.object({ orderId: z.number(), reason: z.string().trim().min(1, '請填寫取消原因').max(300) }))
      .mutation(async ({ input, ctx }) => {
        const result = await requestCancelProductOrder(input.orderId, ctx.user.id, input.reason);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        if (result.merchantId) {
          const buyerName = (ctx.user as any).name ?? `會員#${ctx.user.id}`;
          const reasonStr = input.reason?.trim() ? `\n原因：${input.reason.trim()}` : '';
          sendPushToUser(result.merchantId, {
            title: '⚠️ 買家申請取消訂單',
            body: `${buyerName} 申請取消：${result.productTitle ?? '訂單'}${reasonStr}`,
            url: `${getEmailOrigin(ctx.req)}/merchant-products?tab=orders`,
            tag: `order-cancel-req-${input.orderId}`,
          }).catch(() => {});
        }
        return { success: true };
      }),

    /** 買家：撤回取消申請 */
    withdrawCancelRequest: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await withdrawCancelRequest(input.orderId, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 商戶：批准 / 拒絕買家嘅取消申請 */
    respondCancelRequest: protectedProcedure
      .input(z.object({ orderId: z.number(), action: z.enum(['approve', 'reject']), rejectReason: z.string().max(300).optional(), markAsFailure: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const result = await respondCancelRequest(input.orderId, ctx.user.id, input.action, input.rejectReason, input.markAsFailure);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        if (result.buyerId) {
          const title = input.action === 'approve' ? '✅ 取消申請已批准' : '❌ 取消申請被拒絕';
          const body = input.action === 'approve'
            ? `商戶已批准取消：${result.productTitle ?? '訂單'}`
            : `商戶拒絕取消：${result.productTitle ?? '訂單'}${input.rejectReason?.trim() ? `\n原因：${input.rejectReason.trim()}` : ''}`;
          sendPushToUser(result.buyerId, {
            title, body,
            url: `${getEmailOrigin(ctx.req)}/bid-history?tab=orders`,
            tag: `order-cancel-resp-${input.orderId}`,
          }).catch(() => {});
        }
        return { success: true };
      }),

    /** 商戶：我的訂單 */
    myMerchantOrders: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        return getProductOrdersByMerchant(ctx.user.id, input.status);
      }),

    /** 商戶：訂單分類數量（badge 用） */
    myMerchantStatusCounts: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') return { pending: 0, confirmed: 0, cancelled: 0 };
        return countMerchantProductOrdersByStatus(ctx.user.id);
      }),

    /** 買家：我的訂單 */
    myBuyerOrders: protectedProcedure
      .query(async ({ ctx }) => {
        return getProductOrdersByBuyer(ctx.user.id);
      }),

    /** 買家：我嘅已隱藏訂單 */
    myBuyerHiddenOrders: protectedProcedure
      .query(async ({ ctx }) => {
        return getHiddenProductOrdersByBuyer(ctx.user.id);
      }),

    /** 買家：已隱藏訂單嘅數量（badge 用） */
    myBuyerHiddenCount: protectedProcedure
      .query(async ({ ctx }) => {
        return countHiddenProductOrdersByBuyer(ctx.user.id);
      }),

    /** 商戶：我嘅已隱藏訂單 */
    myMerchantHiddenOrders: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        return getHiddenProductOrdersByMerchant(ctx.user.id);
      }),

    /** 商戶：已隱藏訂單嘅數量（badge 用） */
    myMerchantHiddenCount: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') return 0;
        return countHiddenProductOrdersByMerchant(ctx.user.id);
      }),

    /** 買家：將訂單從自己清單軟隱藏（紀錄永遠保留，商戶側不受影響） */
    deleteBuyerOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await deleteBuyerOrder(input.orderId, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 買家：取消隱藏訂單（還原到正常清單） */
    restoreBuyerOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await restoreBuyerOrder(input.orderId, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 商戶：將訂單從自己清單軟隱藏（紀錄永遠保留，買家側不受影響） */
    deleteMerchantOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user.role === 'admin';
        if (!isAdmin) {
          const app = await getMerchantApplicationByUser(ctx.user.id);
          if (app?.status !== 'approved') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
          }
        }
        const result = await deleteMerchantOrder(input.orderId, ctx.user.id, isAdmin);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 商戶：取消隱藏訂單（還原到正常清單） */
    restoreMerchantOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user.role === 'admin';
        if (!isAdmin) {
          const app = await getMerchantApplicationByUser(ctx.user.id);
          if (app?.status !== 'approved') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
          }
        }
        const result = await restoreMerchantOrder(input.orderId, ctx.user.id, isAdmin);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 管理員：所有訂單 */
    adminList: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllProductOrders(input?.status);
      }),

    /** 管理員：代商戶確認成交 */
    adminConfirm: protectedProcedure
      .input(z.object({ orderId: z.number(), finalPrice: z.number().positive().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await confirmProductOrder(input.orderId, ctx.user.id, input.finalPrice, true);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),
  }),

  // 拍賣訂單（auction 結束後嘅交收管理）
  auctionOrders: router({
    /** 商戶：我的拍賣訂單 */
    myMerchant: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        // 🔴 Lazy expiry：確保過期 auction 已 mark ended + 已 init auctionOrderStatus='pending'
        // 否則 getMerchantAuctionOrders 嘅 filter `auctionOrderStatus IS NOT NULL` 會隱藏佢
        try {
          const list = await getAuctionsByCreator(ctx.user.id);
          const nowMs = Date.now();
          const expiredIds = list
            .filter((a: { status: string; endTime: Date | string }) => a.status === 'active' && new Date(a.endTime).getTime() <= nowMs)
            .map((a: { id: number }) => a.id);
          if (expiredIds.length > 0) {
            const origin = process.env.PUBLIC_BASE_URL || 'https://hongxcollections.com';
            await Promise.all(expiredIds.map((id: number) => checkAndUpdateAuctionStatus(id, origin)));
          }
          // 🔴 安全網：對「已 ended 但 auctionOrderStatus 仍 NULL」嘅孤兒 row 做即時 backfill
          // （checkAndUpdateAuctionStatus 只處理 active→ended；歷史孤兒只能靠 bootstrap，
          //   依家加埋呢層 self-heal 確保唔使等 server restart）
          const { getRawPool } = await import('./db');
          const pool = await getRawPool();
          await pool.execute(
            `UPDATE auctions SET auctionOrderStatus='pending'
             WHERE createdBy=? AND status='ended' AND highestBidderId IS NOT NULL AND auctionOrderStatus IS NULL`,
            [ctx.user.id]
          );
        } catch (e) {
          console.warn('[auctionOrders.myMerchant] lazy expiry failed:', e);
        }
        return getMerchantAuctionOrders(ctx.user.id, input.status);
      }),

    /** 商戶：待確認拍賣訂單數量（顯示 badge 用） */
    myPendingCount: protectedProcedure
      .query(async ({ ctx }) => {
        return countPendingMerchantAuctionOrders(ctx.user.id);
      }),

    /** 商戶：拍賣訂單分類數量 */
    myMerchantStatusCounts: protectedProcedure
      .query(async ({ ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') return { pending: 0, confirmed: 0, cancelled: 0 };
        return countMerchantAuctionOrdersByStatus(ctx.user.id);
      }),

    /** 商戶：確認交收 */
    confirm: protectedProcedure
      .input(z.object({ auctionId: z.number(), finalPrice: z.number().positive().optional() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';
        if (!isAdmin && app?.status !== 'approved') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const result = await confirmMerchantAuctionOrder(input.auctionId, ctx.user.id, isAdmin, input.finalPrice);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 商戶：取消交收 */
    cancel: protectedProcedure
      .input(z.object({ auctionId: z.number(), reason: z.string().max(200).optional() }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';
        if (!isAdmin && app?.status !== 'approved') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const result = await cancelMerchantAuctionOrder(input.auctionId, ctx.user.id, isAdmin, input.reason);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),
  }),

  // 拍賣成交紀錄管理
  auctionRecords: router({
    /** 列出所有紀錄（管理員） */
    list: protectedProcedure
      .input(z.object({
        importStatus: z.enum(['pending', 'confirmed', 'all']).default('all'),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        const limit = Math.max(1, Math.min(500, Number(input.limit)));
        const offset = Math.max(0, Number(input.offset));
        let query = 'SELECT * FROM `auctionRecords`';
        const params: any[] = [];
        if (input.importStatus !== 'all') {
          query += ' WHERE importStatus = ?';
          params.push(input.importStatus);
        }
        query += ` ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`;
        const [rows]: any = await pool.execute(query, params);
        // Count
        let countQuery = 'SELECT COUNT(*) as cnt FROM `auctionRecords`';
        const countParams: any[] = [];
        if (input.importStatus !== 'all') {
          countQuery += ' WHERE importStatus = ?';
          countParams.push(input.importStatus);
        }
        const [countRows]: any = await pool.execute(countQuery, countParams);
        return { records: rows, total: countRows[0]?.cnt || 0 };
      }),

    /** 公開：最近成交紀錄（首頁社交証明用） */
    recentSold: publicProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const pool = await getRawPool();
        const limit = Math.max(1, Math.min(50, Number(input.limit)));
        const [rows]: any = await pool.execute(
          `SELECT id, title, soldPrice, currency, auctionHouse, auctionDate, imageUrl, imagesJson
           FROM \`auctionRecords\`
           WHERE saleStatus = 'sold' AND soldPrice IS NOT NULL AND importStatus = 'confirmed'
           ORDER BY auctionDate DESC, id DESC
           LIMIT ${limit}`
        );
        return rows as Array<{
          id: number;
          title: string;
          soldPrice: number | null;
          currency: string;
          auctionHouse: string | null;
          auctionDate: string | null;
          imageUrl: string | null;
          imagesJson: string | null;
        }>;
      }),

    /** 批量儲存（pending 狀態，從截圖提取後） */
    savePending: protectedProcedure
      .input(z.object({
        lots: z.array(z.object({
          lotNumber: z.string().nullable().optional(),
          title: z.string(),
          description: z.string().nullable().optional(),
          estimateLow: z.number().nullable().optional(),
          estimateHigh: z.number().nullable().optional(),
          soldPrice: z.number().nullable().optional(),
          currency: z.string().default('HKD'),
          auctionHouse: z.string().nullable().optional(),
          auctionDate: z.string().nullable().optional(),
          saleStatus: z.enum(['sold', 'unsold']).default('sold'),
          sourceNote: z.string().nullable().optional(),
        }))
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        let inserted = 0;
        for (const lot of input.lots) {
          await pool.execute(
            `INSERT INTO \`auctionRecords\`
             (lotNumber, title, description, estimateLow, estimateHigh, soldPrice, currency,
              auctionHouse, auctionDate, saleStatus, sourceNote, importStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
              lot.lotNumber ?? null,
              lot.title,
              lot.description ?? null,
              lot.estimateLow ?? null,
              lot.estimateHigh ?? null,
              lot.soldPrice ?? null,
              lot.currency ?? 'HKD',
              lot.auctionHouse ?? null,
              lot.auctionDate ?? null,
              lot.saleStatus ?? 'sold',
              lot.sourceNote ?? null,
            ]
          );
          inserted++;
        }
        return { inserted };
      }),

    /**
     * 查詢 pending 紀錄中哪些與已確認的紀錄重複
     * 重複定義：同一 auctionHouse + auctionDate + lotNumber（三個都不為 null）
     */
    checkDuplicates: protectedProcedure
      .input(z.object({}))
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        const [pending]: any = await pool.execute(
          `SELECT id, lotNumber, auctionHouse, auctionDate FROM \`auctionRecords\`
           WHERE importStatus = 'pending'`
        );
        const duplicates: { pendingId: number; confirmedId: number }[] = [];
        for (const row of pending) {
          if (!row.lotNumber || !row.auctionHouse || !row.auctionDate) continue;
          const [found]: any = await pool.execute(
            `SELECT id FROM \`auctionRecords\`
             WHERE importStatus = 'confirmed'
               AND auctionHouse = ? AND auctionDate = ? AND lotNumber = ?
             LIMIT 1`,
            [row.auctionHouse, row.auctionDate, row.lotNumber]
          );
          if (found.length > 0) {
            duplicates.push({ pendingId: row.id, confirmedId: found[0].id });
          }
        }
        return duplicates;
      }),

    /** 確認單條紀錄（pending → confirmed），支援重複偵測 */
    confirm: protectedProcedure
      .input(z.object({ id: z.number(), force: z.boolean().default(false) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        // 查詢這條 pending 紀錄
        const [rows]: any = await pool.execute(
          'SELECT lotNumber, auctionHouse, auctionDate FROM `auctionRecords` WHERE id = ?',
          [input.id]
        );
        const record = rows[0];
        // 非強制模式：查重
        if (!input.force && record?.lotNumber && record?.auctionHouse && record?.auctionDate) {
          const [dupes]: any = await pool.execute(
            `SELECT id FROM \`auctionRecords\`
             WHERE importStatus = 'confirmed'
               AND auctionHouse = ? AND auctionDate = ? AND lotNumber = ?
             LIMIT 1`,
            [record.auctionHouse, record.auctionDate, record.lotNumber]
          );
          if (dupes.length > 0) {
            return { success: false, isDuplicate: true, duplicateId: dupes[0].id as number };
          }
        }
        await pool.execute('UPDATE `auctionRecords` SET importStatus = ? WHERE id = ?', ['confirmed', input.id]);
        return { success: true, isDuplicate: false };
      }),

    /** 批量確認全部 pending（自動跳過重複，除非 force=true） */
    confirmAll: protectedProcedure
      .input(z.object({ force: z.boolean().default(false) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        if (input.force) {
          const [result]: any = await pool.execute(
            'UPDATE `auctionRecords` SET importStatus = ? WHERE importStatus = ?',
            ['confirmed', 'pending']
          );
          return { confirmed: result.affectedRows, skipped: 0 };
        }
        // 逐條檢查重複
        const [pending]: any = await pool.execute(
          'SELECT id, lotNumber, auctionHouse, auctionDate FROM `auctionRecords` WHERE importStatus = \'pending\''
        );
        let confirmed = 0;
        let skipped = 0;
        for (const row of pending) {
          if (row.lotNumber && row.auctionHouse && row.auctionDate) {
            const [dupes]: any = await pool.execute(
              `SELECT id FROM \`auctionRecords\`
               WHERE importStatus = 'confirmed'
                 AND auctionHouse = ? AND auctionDate = ? AND lotNumber = ?
               LIMIT 1`,
              [row.auctionHouse, row.auctionDate, row.lotNumber]
            );
            if (dupes.length > 0) { skipped++; continue; }
          }
          await pool.execute('UPDATE `auctionRecords` SET importStatus = ? WHERE id = ?', ['confirmed', row.id]);
          confirmed++;
        }
        return { confirmed, skipped };
      }),

    /** 更新單條紀錄 */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        lotNumber: z.string().nullable().optional(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        estimateLow: z.number().nullable().optional(),
        estimateHigh: z.number().nullable().optional(),
        soldPrice: z.number().nullable().optional(),
        currency: z.string().optional(),
        auctionHouse: z.string().nullable().optional(),
        auctionDate: z.string().nullable().optional(),
        saleStatus: z.enum(['sold', 'unsold']).optional(),
        sourceNote: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        const { id, ...fields } = input;
        const setClauses: string[] = [];
        const params: any[] = [];
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) {
            setClauses.push(`\`${k}\` = ?`);
            params.push(v);
          }
        }
        if (setClauses.length === 0) return { success: true };
        params.push(id);
        await pool.execute(`UPDATE \`auctionRecords\` SET ${setClauses.join(', ')} WHERE id = ?`, params);
        return { success: true };
      }),

    /** 刪除紀錄 */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        await pool.execute('DELETE FROM `auctionRecords` WHERE id = ?', [input.id]);
        return { success: true };
      }),

    /** 從 Spink 拍賣頁批量導入所有拍品 */
    importFromSpinkAuction: protectedProcedure
      .input(z.object({
        url: z.string().url(),
        maxLots: z.number().min(1).max(1000).default(300),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (!input.url.includes('live.spink.com')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '請輸入有效的 Spink URL（live.spink.com/...）' });
        }

        const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        const CONCURRENCY = 15;
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        // --- Step 1: 確定拍賣頁 URL ---
        let auctionPageUrl = input.url;
        let auctionTitle: string | null = null;

        if (input.url.includes('/lots/view/')) {
          // 如果是 lot URL，先取得拍賣 ID
          const lotRes = await fetch(input.url, { headers: { 'User-Agent': UA } });
          const lotHtml = await lotRes.text();
          const aidM = lotHtml.match(/href="\/auctions\/(4-[A-Za-z0-9]+)"/);
          if (aidM) auctionPageUrl = `https://live.spink.com/auctions/${aidM[1]}`;
          const atM = lotHtml.match(/class="auction-title[^"]*"[^>]*>\s*([^\n<]+)/);
          auctionTitle = atM?.[1]?.trim() ?? null;
        }

        // 生成本次批次編號（格式：YYYYMMDD-XXXXX）
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        const randStr = Math.random().toString(36).slice(2,7).toUpperCase();
        const batchId = `${dateStr}-${randStr}`;

        // --- Step 2: 從拍賣頁提取初始 lot IDs ---
        const auctionRes = await fetch(auctionPageUrl, { headers: { 'User-Agent': UA } });
        const auctionHtml = await auctionRes.text();

        if (!auctionTitle) {
          const atM = auctionHtml.match(/class="auction-title[^"]*"[^>]*>\s*([^\n<]+)/);
          auctionTitle = atM?.[1]?.trim() ?? null;
        }

        const initMatches = [...auctionHtml.matchAll(/lots\/view\/(4-[A-Za-z0-9]+)/g)];
        const initIds = [...new Set(initMatches.map(m => m[1]))];
        if (initIds.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '無法找到拍品，請確認 URL 是 live.spink.com/auctions/... 格式' });
        }

        // --- Step 3: 解析單個 lot 頁 ---
        const parseLot = async (lotId: string) => {
          try {
            const url = `https://live.spink.com/lots/view/${lotId}`;
            const res = await fetch(url, { headers: { 'User-Agent': UA } });
            if (!res.ok) return null;
            const html = await res.text();

            // next lot ID
            const nextM = html.match(/class="next btn[^"]*"\s+href="\/lots\/view\/([A-Za-z0-9\-]+)"/);
            const nextLotId = nextM?.[1] ?? null;

            // lot data
            const titleM = html.match(/<meta property="og:title" content="([^"]+)"/);
            const title = titleM
              ? titleM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
              : null;
            if (!title) return { nextLotId, data: null };

            const lotNumM = html.match(/class="lot-number ng-binding">(\w+)</);
            const estimateM = html.match(/HK\$([0-9,]+)\s*-\s*HK\$([0-9,]+)/);
            const descM = html.match(/<meta name="description" content="([^"]+)"/);
            const availM = html.match(/<meta property="product:availability" content="([^"]+)"/);
            const allImgMs = [...html.matchAll(/href="(https:\/\/images4-cdn\.auctionmobility\.com\/is3\/[^"]+maxwidth=1600[^"]*)"/g)];
            const allImageUrls = [...new Set(allImgMs.map(m => m[1].replace(/&amp;/g, '&')))];
            const soldAmountM = html.match(/class="sold-amount[^"]*"[^>]*>\s*HK\$([0-9,]+)/);
            const soldTextM   = soldAmountM || html.match(/\bSOLD\s+HK\$([0-9,]+)/i);
            const isEnded = /\bENDED\b/.test(html);
            // 只有找到實際金額才視為成交；無金額一律流拍
            const saleStatus: 'sold' | 'unsold' = !!soldTextM ? 'sold' : 'unsold';

            return {
              nextLotId,
              data: {
                title,
                lotNumber: lotNumM?.[1] ?? null,
                estimateLow: estimateM ? parseFloat(estimateM[1].replace(/,/g, '')) : null,
                estimateHigh: estimateM ? parseFloat(estimateM[2].replace(/,/g, '')) : null,
                description: descM ? descM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() : null,
                saleStatus,
                soldPrice: soldTextM ? parseFloat(soldTextM[1].replace(/,/g, '')) : null,
                imageUrl: allImageUrls[0] ?? null,
                imagesJson: allImageUrls.length > 0 ? JSON.stringify(allImageUrls) : null,
              },
            };
          } catch { return null; }
        };

        // --- Step 4: 取得已存 lot URLs（避免重複）---
        const dbPool = await getRawPool();
        const [existingRows]: any = await dbPool.execute(
          'SELECT sourceNote FROM `auctionRecords` WHERE auctionHouse = \'Spink\' AND sourceNote IS NOT NULL'
        );
        const existingUrls = new Set<string>(
          (existingRows as any[]).map((r: any) => r.sourceNote as string)
        );

        // --- Step 5: 佇列處理（BFS + chain walking）---
        const queue: string[] = [...initIds];
        const discovered = new Set<string>(initIds);
        let imported = 0;
        let skipped = 0;
        let errors = 0;

        while (queue.length > 0 && imported + skipped < input.maxLots) {
          const batchSize = Math.min(CONCURRENCY, input.maxLots - imported - skipped, queue.length);
          const batch = queue.splice(0, batchSize);

          const results = await Promise.all(batch.map(id => parseLot(id)));

          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const lotId = batch[i];
            const lotUrl = `https://live.spink.com/lots/view/${lotId}`;
            const sourceNote = auctionTitle ? `${auctionTitle} | ${lotUrl}` : lotUrl;

            // 發現 next lot，加入佇列
            if (result?.nextLotId && !discovered.has(result.nextLotId)) {
              discovered.add(result.nextLotId);
              if (imported + skipped + queue.length < input.maxLots) {
                queue.push(result.nextLotId);
              }
            }

            if (!result?.data) { errors++; continue; }

            // 跳過已存在的 lot
            const alreadyExists = [...existingUrls].some(url => url.includes(lotId));
            if (alreadyExists) { skipped++; continue; }

            try {
              await dbPool.execute(
                `INSERT INTO \`auctionRecords\`
                 (lotNumber, title, description, estimateLow, estimateHigh, soldPrice, currency,
                  auctionHouse, auctionDate, saleStatus, sourceNote, imageUrl, imagesJson, batchId, importStatus)
                 VALUES (?, ?, ?, ?, ?, ?, 'HKD', 'Spink', NULL, ?, ?, ?, ?, ?, 'pending')`,
                [
                  result.data.lotNumber,
                  result.data.title,
                  result.data.description,
                  result.data.estimateLow,
                  result.data.estimateHigh,
                  result.data.soldPrice ?? null,
                  result.data.saleStatus,
                  sourceNote,
                  result.data.imageUrl,
                  result.data.imagesJson,
                  batchId,
                ]
              );
              existingUrls.add(sourceNote);
              imported++;
            } catch { errors++; }
          }

          if (queue.length > 0) await sleep(80);
        }

        return {
          imported,
          skipped,
          errors,
          auctionTitle,
          discovered: discovered.size,
          batchId,
          hasMore: queue.length > 0 || (discovered.size < input.maxLots),
        };
      }),

    /** 列出所有批次（batchId 分組） */
    listBatches: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          `SELECT batchId,
                  COUNT(*) AS total,
                  SUM(importStatus = 'pending') AS pending,
                  SUM(importStatus = 'confirmed') AS confirmed,
                  MIN(createdAt) AS createdAt,
                  MAX(sourceNote) AS sampleNote
           FROM \`auctionRecords\`
           WHERE batchId IS NOT NULL
           GROUP BY batchId
           ORDER BY createdAt DESC`
        );
        return rows as {
          batchId: string;
          total: number;
          pending: number;
          confirmed: number;
          createdAt: string;
          sampleNote: string | null;
        }[];
      }),

    /** 刪除指定批次的所有紀錄 */
    deleteBatch: protectedProcedure
      .input(z.object({ batchId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        const [result]: any = await pool.execute(
          'DELETE FROM `auctionRecords` WHERE batchId = ?',
          [input.batchId]
        );
        return { deleted: result.affectedRows };
      }),

    /** 從 Spink URL 直接爬取拍品資料並建立 pending 紀錄 */
    importFromSpinkUrl: protectedProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (!input.url.includes('live.spink.com/lots/view/')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '請輸入有效的 Spink lot URL（live.spink.com/lots/view/...）' });
        }
        const res = await fetch(input.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
        });
        if (!res.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: `無法存取 URL: HTTP ${res.status}` });
        const html = await res.text();

        // --- 解析 title ---
        const ogTitleM = html.match(/<meta property="og:title" content="([^"]+)"/);
        const title = ogTitleM
          ? ogTitleM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
          : '';
        if (!title) throw new TRPCError({ code: 'BAD_REQUEST', message: '無法解析拍品標題，請確認 URL' });

        // --- 解析 lot number ---
        const lotNumM = html.match(/class="lot-number ng-binding">(\w+)</);
        const lotNumber = lotNumM?.[1] ?? null;

        // --- 解析估計低/高 ---
        const estimateM = html.match(/HK\$([0-9,]+)\s*-\s*HK\$([0-9,]+)/);
        const estimateLow = estimateM ? parseFloat(estimateM[1].replace(/,/g, '')) : null;
        const estimateHigh = estimateM ? parseFloat(estimateM[2].replace(/,/g, '')) : null;

        // --- 解析描述 ---
        const descMetaM = html.match(/<meta name="description" content="([^"]+)"/);
        const description = descMetaM
          ? descMetaM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim()
          : null;

        // --- 解析成交/流拍狀態 + 成交金額 ---
        const soldAmountM2  = html.match(/class="sold-amount[^"]*"[^>]*>\s*HK\$([0-9,]+)/);
        const soldTextM2    = soldAmountM2 || html.match(/\bSOLD\s+HK\$([0-9,]+)/i);
        // 只有找到實際金額才視為成交；無金額一律流拍
        const saleStatus: 'sold' | 'unsold' = !!soldTextM2 ? 'sold' : 'unsold';
        const soldPrice2 = soldTextM2 ? parseFloat(soldTextM2[1].replace(/,/g, '')) : null;

        // --- 解析拍賣場次標題 ---
        const auctionTitleM = html.match(/class="auction-title[^"]*"[^>]*>\s*([^\n<]+)/);
        const auctionTitle = auctionTitleM?.[1]?.trim() ?? null;

        // --- 解析高清圖片 URL（全部） ---
        const imgMatches = [...html.matchAll(/href="(https:\/\/images4-cdn\.auctionmobility\.com\/is3\/[^"]+maxwidth=1600[^"]*)"/g)];
        const imageUrls = imgMatches.map(m => m[1].replace(/&amp;/g, '&'));

        // --- 下載第一張圖並上傳 S3 ---
        let storedImageUrl: string | null = null;
        if (imageUrls.length > 0) {
          try {
            const imgRes = await fetch(imageUrls[0]);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const key = `auction-records/spink-${Date.now()}.jpg`;
              const { url: s3Url } = await storagePut(key, buf, 'image/jpeg');
              storedImageUrl = s3Url;
            }
          } catch (e) {
            console.warn('[importFromSpinkUrl] 圖片上傳失敗:', (e as Error).message);
          }
        }

        // 收集所有圖片 URL（Spink CDN 原址）
        const allSpinkUrls = [...new Set(imageUrls)];
        const imagesJsonStr = allSpinkUrls.length > 0 ? JSON.stringify(allSpinkUrls) : null;

        // --- 插入 DB ---
        const pool = await getRawPool();
        const [result]: any = await pool.execute(
          `INSERT INTO \`auctionRecords\`
           (lotNumber, title, description, estimateLow, estimateHigh, soldPrice, currency,
            auctionHouse, auctionDate, saleStatus, sourceNote, imageUrl, imagesJson, importStatus)
           VALUES (?, ?, ?, ?, ?, ?, 'HKD', 'Spink', NULL, ?, ?, ?, ?, 'pending')`,
          [
            lotNumber,
            title,
            description,
            estimateLow,
            estimateHigh,
            soldPrice2,
            saleStatus,
            auctionTitle ? `${auctionTitle} | ${input.url}` : input.url,
            storedImageUrl,
            imagesJsonStr,
          ]
        );

        return {
          id: result.insertId as number,
          lotNumber,
          title,
          saleStatus,
          estimateLow,
          estimateHigh,
          imageUrl: storedImageUrl,
          imageCount: imageUrls.length,
        };
      }),

    /** 從 Spink 拍賣頁按批號配對圖片 + 連結（適合截圖上傳的舊紀錄） */
    matchImagesByLotNumber: protectedProcedure
      .input(z.object({
        url: z.string().url(),
        maxLots: z.number().min(1).max(1000).default(400),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        if (!input.url.includes('live.spink.com')) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '請輸入有效的 Spink URL' });
        }

        const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        const CONCURRENCY = 15;
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        const pool = await getRawPool();

        // 取得所有待配對紀錄（imageUrl 為 NULL）
        const [targetRows]: any = await pool.execute(
          `SELECT id, lotNumber FROM \`auctionRecords\` WHERE imageUrl IS NULL AND lotNumber IS NOT NULL`
        );
        if (!targetRows.length) return { matched: 0, total: 0, message: '所有紀錄已有圖片' };
        const needMap = new Map<string, number[]>();
        for (const r of targetRows as any[]) {
          const key = String(r.lotNumber).trim();
          if (!needMap.has(key)) needMap.set(key, []);
          needMap.get(key)!.push(r.id);
        }

        // 取得拍賣初始 lot IDs
        let auctionPageUrl = input.url;
        let auctionTitle: string | null = null;
        if (input.url.includes('/lots/view/')) {
          const res = await fetch(input.url, { headers: { 'User-Agent': UA } });
          const html = await res.text();
          const m = html.match(/href="\/auctions\/(4-[A-Za-z0-9]+)"/);
          if (m) auctionPageUrl = `https://live.spink.com/auctions/${m[1]}`;
        }
        const auctionRes = await fetch(auctionPageUrl, { headers: { 'User-Agent': UA } });
        const auctionHtml = await auctionRes.text();
        const atM = auctionHtml.match(/class="auction-title[^"]*"[^>]*>\s*([^\n<]+)/);
        auctionTitle = atM?.[1]?.trim() ?? null;
        const initIds = [...new Set([...auctionHtml.matchAll(/lots\/view\/(4-[A-Za-z0-9]+)/g)].map(m => m[1]))];
        if (!initIds.length) throw new TRPCError({ code: 'BAD_REQUEST', message: '無法找到拍品' });

        // 爬取每個 lot，按批號配對
        const queue = [...initIds];
        const discovered = new Set<string>(initIds);
        let matched = 0;

        while (queue.length > 0 && matched + (input.maxLots - queue.length) < input.maxLots) {
          const batch = queue.splice(0, CONCURRENCY);
          await Promise.all(batch.map(async (lotId) => {
            try {
              const url = `https://live.spink.com/lots/view/${lotId}`;
              const res = await fetch(url, { headers: { 'User-Agent': UA } });
              if (!res.ok) return;
              const html = await res.text();

              // next lot
              const nextM = html.match(/class="next btn[^"]*"\s+href="\/lots\/view\/([A-Za-z0-9\-]+)"/);
              if (nextM?.[1] && !discovered.has(nextM[1]) && discovered.size < input.maxLots) {
                discovered.add(nextM[1]);
                queue.push(nextM[1]);
              }

              // lot number
              const lotNumM = html.match(/class="lot-number ng-binding">(\w+)</);
              const lotNumber = lotNumM?.[1];
              if (!lotNumber) return;

              const ids = needMap.get(lotNumber);
              if (!ids?.length) return; // 沒有對應的紀錄

              // image
              const imgM = html.match(/href="(https:\/\/images4-cdn\.auctionmobility\.com\/is3\/[^"]+maxwidth=1600[^"]*)"/);
              const imageUrl = imgM ? imgM[1].replace(/&amp;/g, '&') : null;
              const sourceNote = `${auctionTitle ? auctionTitle + ' | ' : ''}${url}`;

              for (const id of ids) {
                await pool.execute(
                  'UPDATE `auctionRecords` SET imageUrl = ?, sourceNote = ? WHERE id = ? AND imageUrl IS NULL',
                  [imageUrl, sourceNote, id]
                );
                matched++;
              }
              needMap.delete(lotNumber); // 已配對，移除
            } catch { /* skip */ }
          }));
          if (needMap.size === 0) break; // 所有紀錄都已配對
          if (queue.length > 0) await sleep(80);
        }

        return { matched, total: targetRows.length, auctionTitle };
      }),

    /** 補全所有 Spink 紀錄的圖片（imageUrl 為 NULL 但有 sourceNote URL） */
    backfillImages: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        const CONCURRENCY = 10;
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          `SELECT id, sourceNote FROM \`auctionRecords\`
           WHERE imageUrl IS NULL AND sourceNote LIKE '%live.spink.com/lots/view/%'`
        );
        if (!rows.length) return { updated: 0, total: 0 };

        let updated = 0;
        const queue: { id: number; url: string }[] = (rows as any[]).map((r: any) => {
          const m = r.sourceNote.match(/https?:\/\/live\.spink\.com\/lots\/view\/[^\s|]+/);
          return m ? { id: r.id, url: m[0] } : null;
        }).filter(Boolean) as { id: number; url: string }[];

        while (queue.length > 0) {
          const batch = queue.splice(0, CONCURRENCY);
          await Promise.all(batch.map(async ({ id, url }) => {
            try {
              const res = await fetch(url, { headers: { 'User-Agent': UA } });
              if (!res.ok) return;
              const html = await res.text();
              const imgM = html.match(/href="(https:\/\/images4-cdn\.auctionmobility\.com\/is3\/[^"]+maxwidth=1600[^"]*)"/);
              if (!imgM) return;
              const imageUrl = imgM[1].replace(/&amp;/g, '&');
              await pool.execute('UPDATE `auctionRecords` SET imageUrl = ? WHERE id = ?', [imageUrl, id]);
              updated++;
            } catch { /* skip */ }
          }));
          if (queue.length > 0) await sleep(80);
        }
        return { updated, total: rows.length };
      }),

    /** 補全已入庫 Spink 紀錄的所有圖片 URL（imagesJson） */
    backfillImagesJson: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        const CONCURRENCY = 8;
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          `SELECT id, sourceNote FROM \`auctionRecords\`
           WHERE importStatus = 'confirmed'
             AND imagesJson IS NULL
             AND sourceNote LIKE '%live.spink.com%'`
        );
        if (!rows.length) return { updated: 0, total: 0 };

        let updated = 0;
        const queue: { id: number; url: string }[] = (rows as any[]).map((r: any) => {
          const m = r.sourceNote.match(/https?:\/\/live\.spink\.com\/lots\/view\/[^\s|]+/);
          return m ? { id: r.id, url: m[0] } : null;
        }).filter(Boolean) as { id: number; url: string }[];

        while (queue.length > 0) {
          const batch = queue.splice(0, CONCURRENCY);
          await Promise.all(batch.map(async ({ id, url }) => {
            try {
              const res = await fetch(url, { headers: { 'User-Agent': UA } });
              if (!res.ok) return;
              const html = await res.text();
              const allImgMs = [...html.matchAll(/href="(https:\/\/images4-cdn\.auctionmobility\.com\/is3\/[^"]+maxwidth=1600[^"]*)"/g)];
              const allUrls = [...new Set(allImgMs.map(m => m[1].replace(/&amp;/g, '&')))];
              if (allUrls.length === 0) return;
              await pool.execute(
                'UPDATE `auctionRecords` SET imagesJson = ? WHERE id = ?',
                [JSON.stringify(allUrls), id]
              );
              updated++;
            } catch { /* skip */ }
          }));
          if (queue.length > 0) await sleep(80);
        }
        return { updated, total: rows.length };
      }),

    /** 補全已入庫 Spink 紀錄的成交金額（重新抓頁面 SOLD HK$XXX） */
    backfillSoldPrices: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        const CONCURRENCY = 8;
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          `SELECT id, sourceNote, saleStatus FROM \`auctionRecords\`
           WHERE importStatus = 'confirmed'
             AND soldPrice IS NULL
             AND sourceNote LIKE '%live.spink.com%'`
        );
        if (!rows.length) return { updated: 0, skipped: 0, total: 0 };

        let updated = 0;
        let skipped = 0;
        const queue: { id: number; url: string }[] = (rows as any[]).map((r: any) => {
          const m = r.sourceNote.match(/https?:\/\/live\.spink\.com\/lots\/view\/[^\s|]+/);
          return m ? { id: r.id, url: m[0] } : null;
        }).filter(Boolean) as { id: number; url: string }[];

        while (queue.length > 0) {
          const batch = queue.splice(0, CONCURRENCY);
          await Promise.all(batch.map(async ({ id, url }) => {
            try {
              const res = await fetch(url, { headers: { 'User-Agent': UA } });
              if (!res.ok) { skipped++; return; }
              const html = await res.text();
              const soldAmountM = html.match(/class="sold-amount[^"]*"[^>]*>\s*HK\$([0-9,]+)/);
              const soldM = soldAmountM || html.match(/\bSOLD\s+HK\$([0-9,]+)/i);
              if (!soldM) {
                // 找不到金額 → 修正為流拍
                await pool.execute(
                  'UPDATE `auctionRecords` SET saleStatus = ? WHERE id = ?',
                  ['unsold', id]
                );
                skipped++;
                return;
              }
              const soldPrice = parseFloat(soldM[1].replace(/,/g, ''));
              await pool.execute(
                'UPDATE `auctionRecords` SET soldPrice = ?, saleStatus = ? WHERE id = ?',
                [soldPrice, 'sold', id]
              );
              updated++;
            } catch { skipped++; }
          }));
          if (queue.length > 0) await sleep(100);
        }
        return { updated, skipped, total: rows.length };
      }),

    /** 公開搜尋已入庫紀錄（關鍵字全文搜尋） */
    search: publicProcedure
      .input(z.object({
        keyword:      z.string().default(''),
        saleStatus:   z.enum(['all', 'sold', 'unsold']).default('all'),
        auctionHouse: z.string().optional(),
        limit:        z.number().min(1).max(100).default(40),
        offset:       z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        const pool = await getRawPool();
        const like = `%${input.keyword.trim()}%`;
        const hasTerm = input.keyword.trim().length > 0;
        const params: any[] = [];
        let where = "importStatus = 'confirmed'";

        if (hasTerm) {
          where += ` AND (title LIKE ? OR description LIKE ? OR lotNumber LIKE ?
                         OR auctionHouse LIKE ? OR auctionDate LIKE ? OR sourceNote LIKE ?)`;
          params.push(like, like, like, like, like, like);
        }
        if (input.saleStatus !== 'all') {
          where += ' AND saleStatus = ?';
          params.push(input.saleStatus);
        }
        if (input.auctionHouse) {
          where += ' AND auctionHouse = ?';
          params.push(input.auctionHouse);
        }

        const limit  = Math.max(1, Math.min(100, Number(input.limit)));
        const offset = Math.max(0, Number(input.offset));

        const [rows]: any = await pool.execute(
          `SELECT id, lotNumber, title, description, estimateLow, estimateHigh,
                  soldPrice, currency, auctionHouse, auctionDate, saleStatus,
                  imageUrl, imagesJson, sourceNote
           FROM \`auctionRecords\`
           WHERE ${where}
           ORDER BY auctionDate DESC, id DESC
           LIMIT ${limit} OFFSET ${offset}`,
          params
        );
        const [cnt]: any = await pool.execute(
          `SELECT COUNT(*) as n FROM \`auctionRecords\` WHERE ${where}`,
          params
        );
        return { records: rows as any[], total: Number(cnt[0]?.n ?? 0) };
      }),

    /** 取得所有已入庫拍賣行列表（供篩選用） */
    listHouses: publicProcedure
      .query(async () => {
        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          `SELECT DISTINCT auctionHouse FROM \`auctionRecords\`
           WHERE importStatus = 'confirmed' AND auctionHouse IS NOT NULL
           ORDER BY auctionHouse`
        );
        return (rows as any[]).map((r: any) => r.auctionHouse as string);
      }),

    /** 批量刪除全部 pending（撤回這批截圖提取結果） */
    deletePending: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        const [result]: any = await pool.execute(
          'DELETE FROM `auctionRecords` WHERE importStatus = ?',
          ['pending']
        );
        return { deleted: result.affectedRows };
      }),
  }),

  /** 資料庫備份管理（管理員專用） */
  backup: router({
    /** 手動立即觸發備份 */
    run: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '管理員限定' });
        const { runBackup } = await import('./backup');
        return await runBackup();
      }),

    /** 列出所有備份檔案 */
    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '管理員限定' });
        const { listBackups } = await import('./backup');
        return await listBackups();
      }),

    /** 手動觸發通知清理 */
    cleanupNotifications: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '管理員限定' });
        const { runNotificationCleanup } = await import('./backup');
        return await runNotificationCleanup();
      }),

    /** 手動觸發出價記錄歸檔 */
    archiveBids: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '管理員限定' });
        const { runBidsArchive } = await import('./backup');
        return await runBidsArchive();
      }),

    /** DB 容量查詢 */
    dbSize: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '管理員限定' });
        const { getDbSize } = await import('./backup');
        return await getDbSize();
      }),
  }),

  /** 首頁：本網站近期成交（競拍 + 商品） */
  home: router({
    recentActivity: publicProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const pool = await getRawPool();
        const limit = Math.max(1, Math.min(50, Number(input.limit)));
        // 最近 3 個月已結拍且有人出價的拍賣（隨機抽樣）
        const [auctionRows]: any = await pool.execute(
          `SELECT a.id, a.title, a.currentPrice AS price, a.currency,
                  (SELECT ai.imageUrl FROM \`auctionImages\` ai
                   WHERE ai.auctionId = a.id ORDER BY ai.displayOrder ASC LIMIT 1) AS thumb,
                  a.endTime AS date, 'auction' AS type
           FROM \`auctions\` a
           WHERE a.status = 'ended'
             AND a.highestBidderId IS NOT NULL
             AND a.currentPrice > 0
             AND a.archived = 0
             AND a.endTime >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
           ORDER BY RAND()
           LIMIT 40`
        );
        // 最近 3 個月已售出的商品（隨機抽樣）
        const [productRows]: any = await pool.execute(
          `SELECT id, title, price, currency, images, updatedAt AS date, 'product' AS type
           FROM \`merchantProducts\`
           WHERE status = 'sold'
             AND updatedAt >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
           ORDER BY RAND()
           LIMIT 40`
        );
        // 解析商品圖片
        const processedProducts = (productRows as any[]).map((p: any) => {
          let thumb: string | null = null;
          if (p.images) {
            try {
              const parsed = JSON.parse(p.images);
              if (Array.isArray(parsed) && parsed[0]) {
                const first = parsed[0];
                thumb = typeof first === 'string' ? first : first.imageUrl ?? first.url ?? null;
              } else if (typeof parsed === 'string') {
                thumb = parsed;
              }
            } catch {}
          }
          return { ...p, thumb };
        });
        // 合併後再隨機洗牌，取前 limit 筆
        const combined = [...auctionRows, ...processedProducts];
        for (let i = combined.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combined[i], combined[j]] = [combined[j], combined[i]];
        }
        return combined.slice(0, limit) as Array<{
          id: number;
          title: string;
          price: string;
          currency: string;
          thumb: string | null;
          date: string;
          type: 'auction' | 'product';
        }>;
      }),
  }),

  // ── 主打商品付費刊登 ──────────────────────────────────────────────────
  featuredListings: router({
    /** 公開：取首頁正在進行的主打（含商品詳情） */
    getActive: publicProcedure.query(async () => {
      return getActiveFeaturedListings();
    }),

    /** 公開：查看主打位狀態（幾個 active、幾個 queued、上限）*/
    slotStatus: publicProcedure.query(async () => {
      return getFeaturedSlotStatus();
    }),

    /** 商戶：查看自己的主打記錄（含排隊位置） */
    myListings: protectedProcedure.query(async ({ ctx }) => {
      return getMerchantFeaturedListings(ctx.user.id);
    }),

    /** 商戶：申請主打（自動扣保證金；有位即啟動，滿則排隊）*/
    submit: protectedProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        tier: z.enum(['day1', 'day3', 'day7']),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有通過審核的商戶才可申請主打刊登' });
        }
        const product = await getMerchantProduct(input.productId);
        if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到此商品' });
        if (product.merchantId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只能為自己的商品申請主打' });
        }
        if (product.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有上架中的商品才可申請主打' });
        }
        const result = await createFeaturedListing(
          ctx.user.id,
          input.productId,
          product.title,
          product.merchantName,
          input.tier,
        );
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error ?? '申請失敗' });
        return result; // { ok, queued, queuePosition, listing }
      }),

    /** 商戶：取消自己的主打（排隊中全額退費，進行中按比例）*/
    cancelMine: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const result = await cancelFeaturedListing(input.id, ctx.user.id, true, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return result;
      }),

    /** 管理員：取所有主打記錄 */
    adminList: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return getAllFeaturedListings(input?.limit ?? 200);
      }),

    /** 管理員：取消主打（按比例退費） */
    adminCancel: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const result = await cancelFeaturedListing(input.id, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return result;
      }),

    /** 管理員：一鍵清除所有進行中及排隊中的主打（維護重置用） */
    adminPurge: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return purgeActiveFeaturedListings();
      }),

    /** 公開：取各時段收費資訊及主打上限（動態讀取 siteSettings） */
    pricing: publicProcedure.query(async () => {
      const { getFeaturedConfig } = await import('./db');
      return getFeaturedConfig();
    }),

    /** 管理員：取主打方案設定 */
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const { getFeaturedConfig } = await import('./db');
      return getFeaturedConfig();
    }),

    /** 管理員：更新主打方案設定 */
    updateConfig: protectedProcedure
      .input(z.object({
        tiers: z.array(z.object({
          tier: z.string(),
          label: z.string().min(1),
          price: z.number().min(0),
          hours: z.number().int().min(1),
        })),
        maxSlots: z.number().int().min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { updateFeaturedConfig } = await import('./db');
        const ok = await updateFeaturedConfig(input);
        if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '儲存設定失敗' });
        return { success: true };
      }),
  }),

  // ─── 系統測試（管理員專用）───────────────────────────────────────────────
  systemTest: router({
    /** 伺服器 Ping — 回傳伺服器時間戳及往返時延 */
    ping: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const serverTime = new Date().toISOString();
      return { ok: true, serverTime };
    }),

    /** 資料庫延遲 — 執行最輕量 SQL 並量測耗時 */
    dbCheck: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const t0 = Date.now();
      try {
        const pool = await getRawPool();
        if (!pool) throw new Error('資料庫未初始化 (pool is null)');
        await pool.execute('SELECT 1');
        const ms = Date.now() - t0;
        return { ok: true, ms };
      } catch (err: any) {
        return { ok: false, ms: Date.now() - t0, error: err?.message ?? String(err) };
      }
    }),

    /** 發送測試電郵 */
    sendTestEmail: protectedProcedure
      .input(z.object({ to: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { sendEmailWithDetails } = await import('./email');
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fdf8f0;border-radius:12px;">
            <h2 style="color:#b45309;margin-bottom:8px;">🔔 系統測試電郵</h2>
            <p style="color:#555;">這是由管理員發送的測試電郵，確認電郵系統運作正常。</p>
            <hr style="border:1px solid #f0e0c0;margin:16px 0;" />
            <p style="font-size:12px;color:#999;">發送時間：${new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}</p>
          </div>`;
        const result = await sendEmailWithDetails({
          to: input.to,
          senderName: 'hongxcollections 系統',
          senderEmail: 'noreply@hongxcollections.com',
          subject: '【測試】系統電郵通知測試',
          html,
        });
        return result;
      }),

    /** 發送測試短訊 */
    sendTestSms: protectedProcedure
      .input(z.object({ phone: z.string().min(8) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { sendOtpSms } = await import('./_core/sms');
        const testCode = '000000';
        const result = await sendOtpSms(input.phone, testCode);
        return result;
      }),
  }),

  // ── 廣告橫幅管理 ─────────────────────────────────────────────────────────
  ads: router({
    /** 公開：取得某身份的當前廣告（前台用） */
    getActive: publicProcedure
      .input(z.object({ targetType: z.enum(['guest', 'member', 'merchant']) }))
      .query(async ({ input }) => {
        const { targetType } = input;
        const enabled = await getSiteSetting(`ad.${targetType}.enabled`);
        if (enabled !== 'true') return null;
        const banners = await getAdBanners(targetType as AdTargetType);
        const filled = banners.filter(b => b.title || b.body);
        if (filled.length === 0) return null;
        const banner = filled[Math.floor(Math.random() * filled.length)];
        return { slot: banner.slot, title: banner.title, body: banner.body };
      }),

    /** 公開：server 自動判斷身份，返回當前廣告（前台用） */
    getBanner: publicProcedure
      .query(async ({ ctx }) => {
        let targetType: AdTargetType = 'guest';
        if (ctx.user) {
          const isMerchant = await (async () => {
            const { canSellerList } = await import('./db');
            const result = await canSellerList(ctx.user!.id);
            return result.canList;
          })();
          targetType = isMerchant ? 'merchant' : 'member';
        }
        const enabled = await getSiteSetting(`ad.${targetType}.enabled`);
        if (enabled !== 'true') return null;
        const banners = await getAdBanners(targetType);
        const filled = banners.filter(b => b.title || b.body);
        if (filled.length === 0) return null;
        const banner = filled[Math.floor(Math.random() * filled.length)];
        return { targetType, slot: banner.slot, title: banner.title, body: banner.body };
      }),

    /** 管理員：取得所有廣告內容 */
    getAll: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const banners = await getAllAdBanners();
        const configs = await Promise.all(['guest', 'member', 'merchant'].map(async (t) => ({
          targetType: t,
          enabled: (await getSiteSetting(`ad.${t}.enabled`)) === 'true',
          activeSlot: parseInt(await getSiteSetting(`ad.${t}.activeSlot`) ?? '1', 10) || 1,
        })));
        return { banners, configs };
      }),

    /** 管理員：儲存某個版本的廣告內容 */
    upsert: protectedProcedure
      .input(z.object({
        targetType: z.enum(['guest', 'member', 'merchant']),
        slot: z.number().int().min(1).max(3),
        title: z.string().max(200).nullable().optional(),
        body: z.string().max(5000).nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        await upsertAdBanner(input.targetType as AdTargetType, input.slot, input.title ?? null, input.body ?? null);
        return { success: true };
      }),

    /** 管理員：設定某身份的 on/off 和當前版本 */
    setConfig: protectedProcedure
      .input(z.object({
        targetType: z.enum(['guest', 'member', 'merchant']),
        enabled: z.boolean().optional(),
        activeSlot: z.number().int().min(1).max(3).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { targetType, enabled, activeSlot } = input;
        if (enabled !== undefined) await setSiteSetting(`ad.${targetType}.enabled`, enabled ? 'true' : 'false');
        if (activeSlot !== undefined) await setSiteSetting(`ad.${targetType}.activeSlot`, String(activeSlot));
        return { success: true };
      }),
  }),

  // ─── Coin / Stamp AI Analysis ─────────────────────────────────────────────
  coinAnalysis: router({
    // 分析圖片：回傳歷史、成分、尺寸等資料
    analyze: publicProcedure
      .input(z.object({
        imageBase64: z.string(), // base64 encoded image
        mimeType: z.string().default("image/jpeg"),
        lang: z.enum(["zh", "en"]).default("zh"),
      }))
      .mutation(async ({ input, ctx }) => {
        // 視覺分析需要支援圖片的模型，直接呼叫以覆蓋預設文字模型
        const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;

        // ── 視覺模型優先順序 ──────────────────────────────────────────────────
        type VisionApi = { url: string; key: string; model: string };
        const OR = "https://openrouter.ai/api/v1/chat/completions";
        const GG = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

        const getModelsToTry = (): VisionApi[] => {
          const list: VisionApi[] = [];
          // ① Forge (最優先)
          if (ENV.forgeApiKey) {
            const base = ENV.forgeApiUrl?.trim()
              ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
              : "https://forge.manus.im/v1/chat/completions";
            list.push({ url: base, key: ENV.forgeApiKey, model: "gemini-2.5-flash" });
          }
          // ③ llama-4-maverick（付費，穩定，視覺強，Gemini+Search 後備）
          if (ENV.openRouterApiKey) {
            list.push({ url: OR, key: ENV.openRouterApiKey, model: "meta-llama/llama-4-maverick" });
          }
          // ③ Gemini 2.5-flash（診斷確認可用）
          if (ENV.geminiApiKey) {
            list.push({ url: GG, key: ENV.geminiApiKey, model: "gemini-2.5-flash" });
          }
          if (ENV.geminiApiKey2) {
            list.push({ url: GG, key: ENV.geminiApiKey2, model: "gemini-2.5-flash" });
          }
          // ③ Gemini 2.0-flash 後備
          if (ENV.geminiApiKey) {
            list.push({ url: GG, key: ENV.geminiApiKey, model: "gemini-2.0-flash" });
          }
          if (ENV.geminiApiKey2) {
            list.push({ url: GG, key: ENV.geminiApiKey2, model: "gemini-2.0-flash" });
          }
          // ④ OpenAI
          if (ENV.openAiApiKey) {
            list.push({ url: "https://api.openai.com/v1/chat/completions", key: ENV.openAiApiKey, model: "gpt-4o" });
          }
          // ⑤ OpenRouter（Nemotron 排最後，因為常返回 null content）
          if (ENV.openRouterApiKey) {
            list.push(
              { url: OR, key: ENV.openRouterApiKey, model: "baidu/qianfan-ocr-fast:free" },
              { url: OR, key: ENV.openRouterApiKey, model: "nvidia/nemotron-nano-12b-v2-vl:free" },
              { url: OR, key: ENV.openRouterApiKey, model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free" },
              { url: OR, key: ENV.openRouterApiKey, model: "openrouter/free" },
            );
          }
          if (list.length === 0) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "未設定 AI API，無法分析" });
          }
          return list;
        };

        // ── 強化版系統提示 ────────────────────────────────────────────────────
        const systemPrompt = input.lang === "zh"
          ? `你是世界頂尖的錢幣學家與郵票鑑定專家，擁有豐富的亞洲及全球收藏品鑑定經驗。

【第一步：優先讀取鑑定盒文字】
若圖片中有 PCGS、NGC、PMG、PCGS-BN 等評級公司的鑑定盒（slab），必須先讀取盒上所有可見文字，包括：
- 評級結果（如 MS64、VF30、Counterfeit、Genuine、Do Not Holder）
- 錢幣年份、面額、發行地區
- 型號（如 LM-858、KM-522、Y-329 等）
- 直徑尺寸（如 39.5mm）
- 鑑定流水號
這些文字是最可靠的鑑定資料，必須反映在 certificationInfo 欄位和其他欄位中。

請極仔細分析圖片，重點觀察：
【錢幣】正背面圖案、人像、所有文字銘文（尤其國名、面額、年份）、鑄幣廠標記、邊緣設計、合金顏色
【郵票】圖案主題、面值、齒孔規格、水印、印刷方式、發行機構、字體特徵
【品相】磨損程度（流通/輕微流通/未流通）、氧化/包漿、光澤、瑕疵、龜裂

以 JSON 格式回覆，所有欄位必須填寫，不可填「不詳」——若無法確定，請根據圖片特徵作出最合理的專業推斷並加上「（推估）」：
{
  "type": "錢幣" 或 "郵票" 或 "紀念品" 或 "其他",
  "name": "完整官方名稱（包含國家、系列、年份、面額）",
  "country": "發行國家或地區",
  "year": "發行年份（可填範圍，如 1960-1965）",
  "denomination": "面額及貨幣單位",
  "material": "材質及成分（如 .925 銀、.890 銀、黃銅合金、紙質等；若為仿製品請說明仿製材質）",
  "dimensions": "直徑或長×闊（mm）",
  "weight": "重量（g），不適用則填「-」",
  "condition": "品相（若有PCGS/NGC評級則直接引用，如 PCGS MS64；否則用 AU/EF/VF/F，加文字說明）",
  "certificationInfo": "鑑定機構資料（如 PCGS Counterfeit / Do Not Holder，型號 LM-858，39.5mm；無鑑定則填「-」）",
  "historicalBackground": "歷史背景（4-6句，涵蓋：發行背景、歷史意義、收藏市場地位）",
  "rarity": "稀有程度（常見 / 普通 / 較罕見 / 罕見 / 極罕見）及原因",
  "estimatedValue": "估計市值港元範圍（如 HKD 200-500），說明參考依據",
  "imageGenerationPrompt": "A detailed English art prompt for this item: oil painting style, museum lighting, dramatic composition, include historical context"
}`
          : `You are a world-class numismatist and philatelist with decades of global coin and stamp expertise.

[STEP 1: READ GRADING SLAB TEXT FIRST]
If the image contains a PCGS, NGC, PMG, or other grading service slab, read ALL visible text on it first:
- Grade (MS64, VF30, Counterfeit, Genuine, Do Not Holder, etc.)
- Year, denomination, issuing region
- Catalog number (LM-858, KM-522, Y-329, etc.)
- Size (e.g. 39.5mm)
- Certification serial number
These details are the most reliable identification data and must be reflected in certificationInfo and other fields.

Carefully examine the image, paying close attention to:
[COINS] Obverse/reverse designs, portraits, ALL inscriptions (country, denomination, date), mint marks, edge design, alloy color
[STAMPS] Subject/design, denomination, perforation gauge, watermark, printing method, issuer, typeface
[CONDITION] Wear level (circulated/lightly circulated/uncirculated), toning/patina, luster, defects

Reply in JSON. All fields are REQUIRED — if uncertain, provide your best expert inference based on visible evidence and add "(estimated)":
{
  "type": "coin" | "stamp" | "commemorative" | "other",
  "name": "Full official name (country, series, year, denomination)",
  "country": "Issuing country or region",
  "year": "Year(s) of issue (range if applicable)",
  "denomination": "Face value with currency unit",
  "material": "Material and composition (e.g. .925 silver, .890 silver, brass alloy, paper; if counterfeit, state counterfeit material)",
  "dimensions": "Diameter or L×W in mm",
  "weight": "Weight in grams, or '-' if not applicable",
  "condition": "Grade — use PCGS/NGC grade if certified (e.g. PCGS MS64); otherwise AU/EF/VF/F with description",
  "certificationInfo": "Grading service details (e.g. PCGS Counterfeit / Do Not Holder, LM-858, 39.5mm; or '-' if none)",
  "historicalBackground": "Historical background (4-6 sentences covering: issuance context, historical significance, collector market standing)",
  "rarity": "Rarity level and reason",
  "estimatedValue": "Estimated market value range in HKD with reference basis",
  "imageGenerationPrompt": "A detailed English art prompt: oil painting style, museum lighting, dramatic composition, historical context"
}`;

        // ── 精簡版提示（非Gemini模型，token有限，去掉歷史背景和藝術提示）──
        const compactPrompt = input.lang === "zh"
          ? `你是錢幣/郵票鑑定專家。若圖片有PCGS/NGC鑑定盒，必須先讀取盒上所有文字（評級如MS64/VF30/Counterfeit、年份、面額、型號如LM-858、流水號）。只輸出純JSON物件：
{"type":"錢幣/郵票/其他","name":"完整名稱（國家+系列+年份+面額）","country":"發行國","year":"年份","denomination":"面額","material":"材質","dimensions":"尺寸mm","weight":"重量g","condition":"品相或PCGS/NGC評級","certificationInfo":"鑑定機構及評級資料，無則填-","rarity":"稀有程度","estimatedValue":"估計市值HKD範圍"}`
          : `You are a coin/stamp grading expert. If the image has a PCGS/NGC slab, read ALL visible text first (grade like MS64/Counterfeit, year, denomination, catalog# like LM-858, serial). Output ONLY raw JSON:
{"type":"coin/stamp/other","name":"Full name (country+series+year+denomination)","country":"Issuer","year":"Year","denomination":"Face value","material":"Material","dimensions":"Size mm","weight":"Weight g","condition":"Grade or PCGS/NGC grade","certificationInfo":"Grading service details or -","rarity":"Rarity level","estimatedValue":"Estimated HKD range"}`;

        const makePayload = (prompt: string, maxTok: number) => ({
          max_tokens: maxTok,
          temperature: 0.1,
          messages: [
            { role: "system", content: prompt },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
                {
                  type: "text",
                  text: input.lang === "zh"
                    ? "請鑑定圖片。只輸出純JSON（{開頭}結尾），不要markdown或解釋。"
                    : "Analyze the image. Output ONLY raw JSON (starting { ending }), no markdown or explanation."
                },
              ],
            },
          ],
        });

        const visionPayload = makePayload(systemPrompt, 1800);
        const compactPayload = makePayload(compactPrompt, 1200);

        const modelsToTry = getModelsToTry();
        const errors: string[] = [];
        const REQUEST_TIMEOUT_MS = 18_000;  // 普通模型 18 秒
        const REASONING_TIMEOUT_MS = 30_000; // 推理模型 30 秒
        const TOTAL_BUDGET_MS = 50_000;      // 整體最多 50 秒
        const budgetStart = Date.now();
        const remainingBudget = () => TOTAL_BUDGET_MS - (Date.now() - budgetStart);
        let data: Record<string, string> | null = null;
        let modelUsed = "";

        // ── JSON 提取輔助（平衡括弧算法，處理 markdown / thinking 標籤）
        const extractJson = (raw: unknown): Record<string, string> | null => {
          let content = typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? (raw as Array<{type:string;text?:string}>).find(p => p.type === "text")?.text ?? ""
              : "";
          // 去除 Gemini 2.5 thinking 標籤 <thinking>...</thinking>
          content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
          // 去除 markdown ```json ... ``` 或 ``` ... ```
          content = content.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
          // 正確的 JSON 物件提取：跳過字串內的括弧，避免誤算深度
          const startIdx = content.indexOf("{");
          if (startIdx === -1) return null;
          let depth = 0;
          let inStr = false;
          let esc = false;
          let endIdx = -1;
          for (let i = startIdx; i < content.length; i++) {
            const ch = content[i];
            if (esc) { esc = false; continue; }
            if (ch === "\\" && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (!inStr) {
              if (ch === "{") depth++;
              else if (ch === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
            }
          }
          if (endIdx === -1) return null;
          const slice = content.substring(startIdx, endIdx + 1);

          // 修復 LLM 常見問題：字串內的未逸出換行符
          const repairJson = (s: string): string => {
            let result = "";
            let inStr = false;
            let esc = false;
            for (let i = 0; i < s.length; i++) {
              const ch = s[i];
              if (esc) { result += ch; esc = false; continue; }
              if (ch === "\\" && inStr) { result += ch; esc = true; continue; }
              if (ch === '"') { inStr = !inStr; result += ch; continue; }
              // 字串內的未逸出控制字符，轉換為合法逸出序列
              if (inStr && (ch === "\n" || ch === "\r")) { result += ch === "\n" ? "\\n" : "\\r"; continue; }
              if (inStr && ch === "\t") { result += "\\t"; continue; }
              result += ch;
            }
            return result;
          };

          try {
            const parsed = JSON.parse(slice);
            if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
            return Object.keys(parsed).length >= 3 ? parsed : null;
          } catch {
            // 嘗試修復後再解析
            try {
              const parsed = JSON.parse(repairJson(slice));
              if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
              return Object.keys(parsed).length >= 3 ? parsed : null;
            } catch { return null; }
          }
        };

        // ── Gemini + Google Search Grounding（最高精準度，接近 Google Lens）────
        // 使用 Gemini 原生 API + Google Search Tool，讓 AI 搜尋網絡補充資料
        const tryGeminiWithSearch = async (apiKey: string): Promise<Record<string, string> | null> => {
          // 2.5-flash 支援 googleSearch + 視覺，2.0-flash 容易 429
          const nativeUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          const searchInstruction = input.lang === "zh"
            ? "\n\n請用 Google 搜尋確認此錢幣的正式名稱、歷史背景和市場行情，然後只輸出純JSON物件（以{開頭、以}結尾）。"
            : "\n\nUse Google Search to verify the coin's official name, history and market value. Output ONLY a raw JSON object (starting with { ending with }).";

          const reqBody = {
            contents: [{ parts: [
              { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
              { text: systemPrompt + searchInstruction },
            ]}],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.1 },
          };
          const ctrl = new AbortController();
          const geminiTimeout = Math.min(25_000, remainingBudget() - 2000);
          if (geminiTimeout < 3000) { errors.push("gemini+search: 預算不足"); return null; }
          const t = setTimeout(() => ctrl.abort(), geminiTimeout);
          try {
            const resp = await fetch(nativeUrl, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(reqBody),
              signal: ctrl.signal,
            });
            clearTimeout(t);
            if (!resp.ok) {
              const errJson = await resp.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
              errors.push(`gemini+search: ${resp.status} ${errJson?.error?.message ?? ""}`);
              return null;
            }
            const result = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
            const rawText = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? "";
            const parsed = extractJson(rawText);
            if (parsed) return parsed;
            errors.push(`gemini+search: 無效JSON[${rawText.substring(0, 200)}]`);
            return null;
          } catch (e: unknown) {
            clearTimeout(t);
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`gemini+search: ${msg.includes("abort") ? "timeout" : msg}`);
            return null;
          }
        };

        // ── ① Gemini+Search 最優先（Google 搜尋加持，精準度最高）──────────────
        if (!data && ENV.geminiApiKey) {
          data = await tryGeminiWithSearch(ENV.geminiApiKey);
          if (data) modelUsed = "Gemini+Search";
        }
        if (!data && ENV.geminiApiKey2) {
          data = await tryGeminiWithSearch(ENV.geminiApiKey2);
          if (data) modelUsed = "Gemini+Search";
        }

        // ── ② llama-4-maverick（付費、穩定、視覺強，作後備）─────────────────
        if (!data && ENV.openRouterApiKey) {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), Math.min(25_000, remainingBudget() - 2000));
          try {
            const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${ENV.openRouterApiKey}` },
              body: JSON.stringify({ ...visionPayload, model: "meta-llama/llama-4-maverick" }),
              signal: ctrl.signal,
            });
            clearTimeout(t);
            if (r.ok) {
              const res = await r.json() as { choices: Array<{ message: { content: unknown } }> };
              const parsed = extractJson(res.choices?.[0]?.message?.content);
              if (parsed) { data = parsed; modelUsed = "meta-llama/llama-4-maverick"; }
              else errors.push(`llama-4-maverick: 無效回應`);
            } else {
              const errBody = await r.json().catch(() => ({})) as { error?: { message?: string } };
              errors.push(`llama-4-maverick: ${r.status} ${errBody?.error?.message?.substring(0, 100) ?? ""}`);
            }
          } catch (e: unknown) {
            clearTimeout(t);
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`llama-4-maverick: ${msg.includes("abort") ? "timeout" : msg}`);
          }
        }

        for (const api of modelsToTry) {
          if (data) break;
          // 總預算耗盡就直接放棄剩餘模型
          if (remainingBudget() < 3000) { errors.push("總時間預算耗盡"); break; }
          // 高端模型用完整提示，小模型用精簡提示避免 token 超限
          const isGeminiModel = api.url.includes("generativelanguage.googleapis.com");
          const isHighEndModel = isGeminiModel
            || api.model.includes("llama-4")
            || api.model.includes("claude")
            || api.model.includes("gpt-4")
            || api.model.includes("gemini");
          const isReasoningModel = api.model.includes("reasoning") || api.model.includes("nemotron") || api.model.includes("omni");
          const baseTimeout = isReasoningModel ? REASONING_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
          const requestTimeout = Math.min(baseTimeout, remainingBudget() - 2000);
          // 高端模型用完整提示+1800 tokens；小模型用精簡提示+1200 tokens（避免 null content）
          const selectedPayload = isHighEndModel ? visionPayload : compactPayload;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), requestTimeout);
          try {
            const resp = await fetch(api.url, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${api.key}` },
              body: JSON.stringify({ ...selectedPayload, model: api.model }),
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (!resp.ok) {
              errors.push(`${api.model}: ${resp.status}`);
              continue;
            }
            const result = await resp.json() as { choices: Array<{ message: { content: unknown; reasoning?: string } }> };
            // 推理模型：content 可能為 null，嘗試從 reasoning 欄位提取 JSON
            let raw: unknown = result.choices?.[0]?.message?.content;
            if ((raw === null || raw === undefined) && result.choices?.[0]?.message?.reasoning) {
              raw = result.choices[0].message.reasoning;
            }
            const parsed = extractJson(raw);
            if (parsed) { data = parsed; modelUsed = api.model; break; }
            // 調試：顯示原始回應前 300 字
            const rawText = typeof raw === "string" ? raw : JSON.stringify(raw) ?? "";
            errors.push(`${api.model}: 無效回應[${rawText.substring(0, 300).replace(/\n/g, "↵")}]`);
          } catch (e: unknown) {
            clearTimeout(timer);
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${api.model}: ${msg.includes("abort") ? "timeout" : msg}`);
          }
        }
        if (!data) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errors.length > 0
              ? `AI 分析失敗（已試 ${errors.length} 個模型）：${errors.join(" | ")}`
              : "AI 未能分析此圖片，請嘗試更清晰的圖片",
          });
        }
        // 自動儲存鑑定歷史（await 以取得 historyId）
        let historyId: number | null = null;
        if (ctx.user?.id) {
          historyId = await saveCoinAnalysisHistory(ctx.user.id, {
            coinName: data.name ?? data.Name,
            coinType: data.type ?? data.Type,
            coinCountry: data.country ?? data.Country,
            analysisData: JSON.stringify(data),
          }).catch(() => null);
        }
        return { success: true, data, modelUsed, historyId };
      }),

    // 生成藝術插畫
    generateArt: adminProcedure
      .input(z.object({
        prompt: z.string(),
        imageBase64: z.string().optional(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI 插畫功能目前暫未開放" });
        }
        const { generateImage } = await import("./_core/imageGeneration");
        const fullPrompt = `${input.prompt}, vibrant colors, detailed, museum quality, dramatic lighting, golden ratio composition`;
        const result = await generateImage({
          prompt: fullPrompt,
          originalImages: input.imageBase64
            ? [{ b64Json: input.imageBase64, mimeType: input.mimeType }]
            : undefined,
        });
        return { success: true, imageUrl: result.url };
      }),

    // 上載鑑定圖片到 S3
    uploadImage: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buf = Buffer.from(input.imageBase64, "base64");
        const ext = input.mimeType.includes("png") ? "png" : "jpg";
        const key = `coin-analysis/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const result = await storagePut(key, buf, input.mimeType);
        return { url: result.url };
      }),

    // 搜尋相關拍賣
    searchRelated: publicProcedure
      .input(z.object({
        keywords: z.array(z.string()).max(5),
      }))
      .query(async ({ input }) => {
        const results = await searchRelatedAuctions(input.keywords, 6);
        return results;
      }),

    // 鑑定歷史記錄（需登入）
    history: router({
      list: protectedProcedure
        .input(z.object({ limit: z.number().default(20) }))
        .query(async ({ input, ctx }) => {
          const rows = await getUserCoinAnalysisHistory(ctx.user.id, input.limit);
          return rows.map(r => ({
            ...r,
            analysisData: (() => { try { return JSON.parse(r.analysisData); } catch { return {}; } })(),
            imageUrl: r.imageUrl ?? null,
          }));
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
          const ok = await deleteCoinAnalysisHistory(input.id, ctx.user.id);
          return { success: ok };
        }),

      updateImage: protectedProcedure
        .input(z.object({ id: z.number(), imageUrl: z.string().url() }))
        .mutation(async ({ input, ctx }) => {
          const ok = await updateCoinAnalysisHistoryImage(input.id, ctx.user.id, input.imageUrl);
          return { success: ok };
        }),
    }),
  }),

  // ─── AI Assist：分享文案 + 影片旁白稿（粵語口語） ─────────────────────────
  aiAssist: router({
    generateShareCopy: protectedProcedure
      .input(z.object({
        kind: z.enum(['product', 'auction']),
        id: z.number().int().positive(),
      }))
      .mutation(async ({ input, ctx }) => {
        const enabled = await getSiteSetting('aiShareCopyEnabled');
        if (enabled === 'false') throw new TRPCError({ code: 'FORBIDDEN', message: 'AI 文案功能暫時關閉' });

        const checkRate = aiRateLimit(ctx.user.id, 'share', 30);
        if (!checkRate.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: checkRate.message });

        let title = '', desc = '', priceStr = '', extra = '';
        if (input.kind === 'product') {
          const p = await getMerchantProduct(input.id);
          if (!p || p.merchantId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在或無權限' });
          title = p.title;
          desc = p.description ?? '';
          const sym = p.currency === 'USD' ? 'US$' : p.currency === 'CNY' ? '¥' : 'HK$';
          priceStr = `${sym}${parseFloat(String(p.price)).toLocaleString()}`;
          extra = `分類：${p.category ?? '未分類'}｜出售價：${priceStr}`;
        } else {
          const a = await getAuctionById(input.id);
          if (!a || a.createdBy !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: '拍賣不存在或無權限' });
          title = a.title;
          desc = a.description ?? '';
          const sym = a.currency === 'USD' ? 'US$' : a.currency === 'CNY' ? '¥' : 'HK$';
          priceStr = `${sym}${parseFloat(String(a.currentPrice)).toLocaleString()}`;
          const endDate = new Date(a.endTime);
          extra = `分類：${a.category ?? '未分類'}｜目前出價：${priceStr}｜結標：${endDate.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}`;
        }

        const systemPrompt = `你係香港錢幣／紙鈔／郵票拍賣平台「hongxcollections」嘅文案高手。
請用【香港粵語口語】寫一段 Facebook / WhatsApp 群組分享 post，吸引買家。

要求：
1. 100-200 字，唔好太長
2. 用粵語口語：例如「快手」「執平嘢」「手快有手慢冇」「靚靚一張」「啱晒收藏」「靚仔／靚女」「快D入嚟睇」之類
3. 開頭用 1-2 個 emoji 吸睛（💰🪙💎🔥👀✨等）
4. 中間段落 plain text，唔好用太多 emoji
5. 結尾加 1-2 個 hashtag（例如 #hongxcollections #${input.kind === 'auction' ? '拍賣' : '出售'}）+ CTA
6. 唔好寫 URL（系統會自動加）
7. 唔好寫價錢以外嘅虛假資料；如果商品描述空白，純靠標題發揮，但唔好作料
8. 直接輸出文案內容，唔好加任何前言／解釋／引號`;

        const userPrompt = `商品標題：${title}\n${extra}\n商品描述：${desc || '（無）'}`;

        try {
          const result = await invokeLLMSafe({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxTokens: 600,
          });
          const content = result.choices?.[0]?.message?.content;
          const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map(c => (c as any).text || '').join('') : '';
          if (!text.trim()) throw new Error('AI 回覆為空');
          return { text: text.trim() };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI 文案生成失敗：${e?.message ?? e}` });
        }
      }),

    generateVideoScript: protectedProcedure
      .input(z.object({
        kind: z.enum(['product', 'auction']),
        id: z.number().int().positive(),
        durationSec: z.number().int().min(20).max(120).default(45),
      }))
      .mutation(async ({ input, ctx }) => {
        const enabled = await getSiteSetting('aiVideoScriptEnabled');
        if (enabled === 'false') throw new TRPCError({ code: 'FORBIDDEN', message: 'AI 旁白稿功能暫時關閉' });

        const checkRate = aiRateLimit(ctx.user.id, 'script', 30);
        if (!checkRate.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: checkRate.message });

        let title = '', desc = '', priceStr = '', cat = '';
        if (input.kind === 'product') {
          const p = await getMerchantProduct(input.id);
          if (!p || p.merchantId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在或無權限' });
          title = p.title; desc = p.description ?? ''; cat = p.category ?? '';
          const sym = p.currency === 'USD' ? 'US$' : p.currency === 'CNY' ? '¥' : 'HK$';
          priceStr = `${sym}${parseFloat(String(p.price)).toLocaleString()}`;
        } else {
          const a = await getAuctionById(input.id);
          if (!a || a.createdBy !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: '拍賣不存在或無權限' });
          title = a.title; desc = a.description ?? ''; cat = a.category ?? '';
          const sym = a.currency === 'USD' ? 'US$' : a.currency === 'CNY' ? '¥' : 'HK$';
          priceStr = `${sym}${parseFloat(String(a.currentPrice)).toLocaleString()}`;
        }

        const systemPrompt = `你係「hongxcollections」嘅影片旁白編劇，專寫錢幣／紙鈔／郵票短片旁白稿。
用【香港粵語口語】寫一段約 ${input.durationSec} 秒嘅旁白稿（${Math.round(input.durationSec * 3.5)}-${Math.round(input.durationSec * 4.5)} 字之間）。

結構：
【開場 hook】(約 5 秒) — 用粵語口語打招呼吸睛，例如「各位錢幣迷大家好！」「Wow～今次帶嚟一張靚嘢！」
【賣點】(約 ${Math.round(input.durationSec * 0.5)} 秒) — 介紹今件商品最特別嘅地方
【細節】(約 ${Math.round(input.durationSec * 0.3)} 秒) — 形容下相片可以見到嘅細節（例如品相、色澤、印刷、邊紋）
【CTA】(約 5 秒) — 叫人 ${input.kind === 'auction' ? '快手出價' : 'DM 入手'}，例如「手快有手慢冇！」「快D WhatsApp 我啦！」

要求：
1. 全程粵語口語，唔好書面語（唔好寫「的」「了」「在」，要寫「嘅」「咗」「喺」）
2. 用【】標示段落，方便商家睇住稿錄音
3. 唔好作虛假資料；如果描述空白純靠標題＋分類發揮
4. 直接輸出旁白稿，唔好加前言／解釋`;

        const userPrompt = `商品標題：${title}\n分類：${cat || '未指定'}\n價錢：${priceStr}\n描述：${desc || '（無）'}`;

        try {
          const result = await invokeLLMSafe({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxTokens: 1500,
          });
          const content = result.choices?.[0]?.message?.content;
          const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map(c => (c as any).text || '').join('') : '';
          if (!text.trim()) throw new Error('AI 回覆為空');
          return { text: text.trim() };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI 旁白生成失敗：${e?.message ?? e}` });
        }
      }),
  }),

  // ─── 客服 Chatbot：只回答網站使用問題 ─────────────────────────────────────
  chatbot: router({
    ask: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(500),
        history: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(2000),
        })).max(10).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        // 管理後台開關：chatbotEnabled (預設 "true")
        const enabledSetting = await getSiteSetting('chatbotEnabled');
        if (enabledSetting === 'false') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'AI客服暫時關閉，請稍後再試或 WhatsApp 97927793' });
        }

        const userId = ctx.user?.id ?? 0;
        const ipKey = userId ? `u:${userId}` : `ip:${(ctx.req as any)?.ip ?? 'unknown'}`;
        const limit = userId ? 100 : 20;
        const checkRate = chatbotRateLimit(ipKey, limit);
        if (!checkRate.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: checkRate.message });

        const kb = loadChatbotKb();
        const systemPrompt = `你係「hongxcollections」香港錢幣拍賣網站嘅客服助手。

【嚴格規則】
1. **只回答網站使用問題**（例如：點註冊、點上架、點出價、點付款、運費、退款、會員等級、商家申請、影片配額、Facebook 分享等）
2. 如果用戶問錢幣鑑定、估價、市場行情、投資建議、其他話題（例如政治、新聞、天氣、其他購物網站），**禮貌拒絕**並建議：
   - 鑑定／估價 → 引導去「Coin Analysis / AI 鑑定」頁面或瀏覽「拍賣」頁睇類似錢幣成交價
   - 其他話題 → 「呢方面我幫唔到你，但網站使用上有問題隨時問我 🙏」
3. 用【香港粵語口語】回答，例如「咁樣」「啱啱」「唔該」「點解」「咗」「嘅」「喺」
4. 簡短：通常 2-5 句，必要時用 bullet point
5. 唔知答案就老實講「呢個我未必清楚，建議直接 WhatsApp hongxcollections：97927793」
6. 唔好作料、唔好估，淨係根據以下知識庫內容回答

【知識庫】
${kb}`;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: systemPrompt },
          ...input.history.map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: input.message },
        ];

        try {
          const result = await invokeLLMSafe({ messages, maxTokens: 600 });
          const content = result.choices?.[0]?.message?.content;
          const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map(c => (c as any).text || '').join('') : '';
          if (!text.trim()) throw new Error('AI 回覆為空');
          return { reply: text.trim() };
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Chatbot 回覆失敗：${e?.message ?? e}` });
        }
      }),
  }),

  // ─── 拍賣私密聊天室 ──────────────────────────────────────────────────────
  chat: router({
    /** 列出我嘅所有聊天室 */
    listMyRooms: protectedProcedure.query(async ({ ctx }) => {
      const { listMyChatRooms } = await import('./db');
      return listMyChatRooms(ctx.user.id);
    }),

    /** 我嘅總未讀訊息數 (頂部 badge) */
    unreadTotal: protectedProcedure.query(async ({ ctx }) => {
      const { getMyChatUnreadTotal } = await import('./db');
      const total = await getMyChatUnreadTotal(ctx.user.id);
      return { total };
    }),

    /** Bidder 開新對話 (或取得已存在嘅 room)。需要 silver+ 會員等級。 */
    openRoom: protectedProcedure
      .input(z.object({ auctionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getOrCreateChatRoom, getUserMemberLevel, getAuctionById } = await import('./db');
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找唔到呢個拍賣' });

        // 拍賣已結束就唔可以再開新對話 (read-only)
        const ended = auction.status === 'ended' || (auction.endTime && new Date(auction.endTime).getTime() < Date.now());
        if (ended) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '拍賣已結束，唔可以再開新對話' });
        }

        // 商戶自己唔可以同自己 chat
        if (auction.createdBy === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '你係呢個拍賣嘅商戶，唔需要同自己對話' });
        }

        // 銀牌+ gate (admin 例外)
        if (ctx.user.role !== 'admin') {
          const lvl = await getUserMemberLevel(ctx.user.id);
          if (lvl !== 'silver' && lvl !== 'gold' && lvl !== 'vip') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: '只有銀牌或以上會員可以同商戶對話。請先升級會員等級 🥈',
            });
          }
        }

        const result = await getOrCreateChatRoom(input.auctionId, ctx.user.id, auction.createdBy);
        if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '建立對話失敗' });
        return { roomId: result.room.id, isNew: result.isNew };
      }),

    /** 商品查詢：直接開商戶對話（唔需要拍賣 ID，用 auctionId=-merchantId 作 sentinel） */
    openRoomByMerchant: protectedProcedure
      .input(z.object({ merchantId: z.number(), productTitle: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { getOrCreateChatRoom, getUserMemberLevel, getUserById } = await import('./db');
        if (input.merchantId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '你係呢個商戶，唔需要同自己對話' });
        }
        const merchant = await getUserById(input.merchantId);
        if (!merchant) throw new TRPCError({ code: 'NOT_FOUND', message: '找唔到呢個商戶' });
        if (ctx.user.role !== 'admin') {
          const lvl = await getUserMemberLevel(ctx.user.id);
          if (lvl !== 'silver' && lvl !== 'gold' && lvl !== 'vip') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '只有銀牌或以上會員可以同商戶對話。請先升級會員等級 🥈' });
          }
        }
        // sentinel: auctionId = -merchantId，每個買家對每個商戶只有一個通用對話間
        const sentinelId = -input.merchantId;
        const result = await getOrCreateChatRoom(sentinelId, ctx.user.id, input.merchantId);
        if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '建立對話失敗' });
        return { roomId: result.room.id, isNew: result.isNew };
      }),

    /** 取得 room 詳情 + 訊息列表 (僅參與者) */
    getRoom: protectedProcedure
      .input(z.object({ roomId: z.number(), limit: z.number().default(100) }))
      .query(async ({ input, ctx }) => {
        const { getChatRoomById, listChatMessages, getAuctionById, getUserById, markChatRoomRead } = await import('./db');
        const room = await getChatRoomById(input.roomId);
        if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: '找唔到對話' });
        if (room.bidderId !== ctx.user.id && room.merchantId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '冇權查看呢個對話' });
        }

        const [auction, bidder, merchant, messages, reactions] = await Promise.all([
          getAuctionById(room.auctionId),
          getUserById(room.bidderId),
          getUserById(room.merchantId),
          listChatMessages(input.roomId, input.limit),
          listReactionsForRoom(input.roomId),
        ]);

        // 順手標記已讀
        await markChatRoomRead(input.roomId, ctx.user.id);

        const myRole: 'bidder' | 'merchant' = room.bidderId === ctx.user.id ? 'bidder' : 'merchant';
        const other = myRole === 'bidder' ? merchant : bidder;
        return {
          room,
          auction: auction ? { id: auction.id, title: auction.title, status: auction.status, currentPrice: auction.currentPrice, currency: auction.currency, endTime: auction.endTime } : null,
          myRole,
          other: other ? { id: other.id, name: other.name, photoUrl: other.photoUrl } : null,
          messages,
          reactions: reactions.map(r => ({ messageId: r.messageId, emoji: r.emoji, userId: r.userId })),
        };
      }),

    /** 發送訊息 (text 或 image) */
    sendMessage: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        content: z.string().max(2000).optional(),
        imageUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!input.content && !input.imageUrl) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '訊息內容或圖片至少要有一樣' });
        }
        const { getChatRoomById, insertChatMessage, getUserById, getUserMemberLevel, getAuctionById } = await import('./db');
        const { notifyNewChatMessage } = await import('./_core/chatWebSocket');
        const room = await getChatRoomById(input.roomId);
        if (!room) throw new TRPCError({ code: 'NOT_FOUND', message: '對話不存在' });

        // 拍賣結束後對話變 read-only，唔可以再發訊息（admin 都唔可以，避免擾亂買家）
        const auction = await getAuctionById(room.auctionId);
        const ended = auction && (auction.status === 'ended' || (auction.endTime && new Date(auction.endTime).getTime() < Date.now()));
        if (ended) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '拍賣已結束，呢個對話已封存，只可瀏覽歷史訊息' });
        }

        let senderRole: 'bidder' | 'merchant';
        let recipientId: number;
        if (room.bidderId === ctx.user.id) {
          senderRole = 'bidder';
          recipientId = room.merchantId;
          // Bidder 必須維持 silver+ (admin 例外)
          if (ctx.user.role !== 'admin') {
            const lvl = await getUserMemberLevel(ctx.user.id);
            if (lvl !== 'silver' && lvl !== 'gold' && lvl !== 'vip') {
              throw new TRPCError({ code: 'FORBIDDEN', message: '只有銀牌或以上會員可以發送訊息' });
            }
          }
        } else if (room.merchantId === ctx.user.id) {
          senderRole = 'merchant';
          recipientId = room.bidderId;
        } else {
          throw new TRPCError({ code: 'FORBIDDEN', message: '你唔係呢個對話嘅參與者' });
        }

        const messageType: 'text' | 'image' = input.imageUrl ? 'image' : 'text';
        const msg = await insertChatMessage({
          roomId: input.roomId,
          senderId: ctx.user.id,
          senderRole,
          messageType,
          content: input.content ?? null,
          imageUrl: input.imageUrl ?? null,
        });
        if (!msg) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '訊息發送失敗' });

        const senderUser = await getUserById(ctx.user.id);
        await notifyNewChatMessage({
          roomId: input.roomId,
          message: msg,
          recipientUserId: recipientId,
          senderName: senderUser?.name ?? '對方',
        });

        // ── 商戶離線自動回覆 ─────────────────────────────────────────────────
        // 條件：發送者係 bidder + 收件商戶有設定 + 商戶現時冇 WS online + 30 分鐘 cooldown 內冇發過
        if (senderRole === 'bidder') {
          try {
            const { isUserViewingRoomNow } = await import('./_core/chatWebSocket');
            // 商戶必須「正在查看呢個對話」先當 online；只係開住網站其他 tab 都會觸發自動回覆
            if (!isUserViewingRoomNow(recipientId, input.roomId)) {
              const settings = await getMerchantSettings(recipientId);
              if (settings.chatAutoReplyEnabled && settings.chatAutoReplyMessage && settings.chatAutoReplyMessage.trim()) {
                const lastAt = await getLastMerchantOrAutoReplyAt(input.roomId, recipientId);
                const cooldownMs = 30 * 60 * 1000;
                if (!lastAt || (Date.now() - lastAt.getTime()) > cooldownMs) {
                  const { insertChatMessage } = await import('./db');
                  const autoMsg = await insertChatMessage({
                    roomId: input.roomId,
                    senderId: recipientId,
                    senderRole: 'system',
                    messageType: 'text',
                    content: `🤖 自動回覆：${settings.chatAutoReplyMessage.trim()}`,
                  });
                  if (autoMsg) {
                    await notifyNewChatMessage({
                      roomId: input.roomId,
                      message: autoMsg,
                      recipientUserId: ctx.user.id, // 通知 bidder
                      senderName: '商戶（自動回覆）',
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('[chat] auto-reply error:', e);
          }
        }

        return { success: true, message: msg };
      }),

    /** Toggle reaction (emoji) on a message。Silver+ gate 同 sendMessage 一致。 */
    toggleReaction: protectedProcedure
      .input(z.object({
        messageId: z.number(),
        emoji: z.string().min(1).max(16),
      }))
      .mutation(async ({ input, ctx }) => {
        const ALLOWED = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];
        if (!ALLOWED.includes(input.emoji)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不支援嘅 emoji' });
        }
        const { getChatRoomById, getUserMemberLevel, getMessageRoomId } = await import('./db');
        const { notifyReactionChanged } = await import('./_core/chatWebSocket');

        const targetRoomId = await getMessageRoomId(input.messageId);
        if (!targetRoomId) throw new TRPCError({ code: 'NOT_FOUND', message: '訊息不存在' });

        const room = await getChatRoomById(targetRoomId);
        if (!room || (room.bidderId !== ctx.user.id && room.merchantId !== ctx.user.id && ctx.user.role !== 'admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '冇權喺呢個對話加表情' });
        }
        // Bidder 必須維持 silver+
        if (room.bidderId === ctx.user.id && ctx.user.role !== 'admin') {
          const lvl = await getUserMemberLevel(ctx.user.id);
          if (lvl !== 'silver' && lvl !== 'gold' && lvl !== 'vip') {
            throw new TRPCError({ code: 'FORBIDDEN', message: '只有銀牌或以上會員可以加表情' });
          }
        }

        const { added } = await toggleMessageReaction(input.messageId, ctx.user.id, input.emoji);
        const latest = await listReactionsForMessage(input.messageId);
        notifyReactionChanged(targetRoomId, {
          messageId: input.messageId,
          emoji: input.emoji,
          userId: ctx.user.id,
          added,
          reactions: latest.map(r => ({ emoji: r.emoji, userId: r.userId })),
        });
        return { added, reactions: latest.map(r => ({ emoji: r.emoji, userId: r.userId })) };
      }),

    /** 喺指定 room 內搜尋訊息（必須係參與者）。 */
    searchInRoom: protectedProcedure
      .input(z.object({ roomId: z.number(), query: z.string().min(1).max(100), limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        const { getChatRoomById } = await import('./db');
        const room = await getChatRoomById(input.roomId);
        if (!room || (room.bidderId !== ctx.user.id && room.merchantId !== ctx.user.id && ctx.user.role !== 'admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '冇權搜尋呢個對話' });
        }
        const messages = await searchChatMessagesInRoom(input.roomId, input.query, input.limit);
        return { messages };
      }),

    /** 跨我所有 rooms 全文搜尋。 */
    searchMessages: protectedProcedure
      .input(z.object({ query: z.string().min(1).max(100), limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        const results = await searchChatMessagesAcrossMyRooms(ctx.user.id, input.query, input.limit);
        return { results };
      }),

    /** 標記為已讀 */
    markRead: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { markChatRoomRead } = await import('./db');
        const ok = await markChatRoomRead(input.roomId, ctx.user.id);
        return { success: ok };
      }),

    /** 上傳聊天圖片 (回 URL，唔自動建立 message — 由 sendMessage 帶入 imageUrl) */
    uploadImage: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        // base64 of 5MB binary ≈ 6.67MB string. Allow up to 7.5MB to absorb headers/whitespace.
        // 提早攔截 string size，避免攻擊者用超大 payload 觸發 base64 decode CPU/memory spike。
        imageData: z.string().min(1).max(7_500_000),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowed.includes(input.mimeType)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不支援嘅圖片格式' });
        }
        const { getChatRoomById, getAuctionById } = await import('./db');
        const room = await getChatRoomById(input.roomId);
        if (!room || (room.bidderId !== ctx.user.id && room.merchantId !== ctx.user.id)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '冇權上傳到呢個對話' });
        }
        // 拍賣結束後對話變 read-only，唔可以再上傳圖片
        const auction = await getAuctionById(room.auctionId);
        const ended = auction && (auction.status === 'ended' || (auction.endTime && new Date(auction.endTime).getTime() < Date.now()));
        if (ended) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '拍賣已結束，呢個對話已封存，只可瀏覽歷史訊息' });
        }
        const buffer = Buffer.from(input.imageData, 'base64');
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片大小不可超過 5MB' });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        const key = `chat/${input.roomId}/${Date.now()}-${ctx.user.id}-${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url };
      }),

    /** 商戶廣播訊息畀某拍賣所有曾出價買家 (1/小時 rate limit) */
    broadcast: protectedProcedure
      .input(z.object({
        auctionId: z.number(),
        message: z.string().min(1).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const { getAuctionById, broadcastToBidders, getMerchantLastBroadcastAt, getUserById } = await import('./db');
        const { notifyNewChatMessage } = await import('./_core/chatWebSocket');
        const auction = await getAuctionById(input.auctionId);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND', message: '找唔到呢個拍賣' });
        if (auction.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有呢個拍賣嘅商戶可以廣播' });
        }
        // 拍賣結束後唔可以再廣播
        const bcEnded = auction.status === 'ended' || (auction.endTime && new Date(auction.endTime).getTime() < Date.now());
        if (bcEnded) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '拍賣已結束，唔可以再廣播' });
        }

        // 1/小時 rate limit
        const last = await getMerchantLastBroadcastAt(input.auctionId, ctx.user.id);
        if (last) {
          const elapsedMin = Math.floor((Date.now() - last.getTime()) / 60_000);
          if (elapsedMin < 60) {
            const wait = 60 - elapsedMin;
            throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: `每小時只可廣播一次，請 ${wait} 分鐘後再試` });
          }
        }

        const result = await broadcastToBidders(input.auctionId, ctx.user.id, input.message);
        // 推送即時通知到每個 room
        const senderUser = await getUserById(ctx.user.id);
        const senderName = senderUser?.name ?? '商戶';
        for (const roomId of result.rooms) {
          const { getChatRoomById, listChatMessages } = await import('./db');
          const room = await getChatRoomById(roomId);
          if (!room) continue;
          const msgs = await listChatMessages(roomId, 1);
          const newest = msgs[msgs.length - 1];
          if (newest) {
            await notifyNewChatMessage({
              roomId,
              message: newest,
              recipientUserId: room.bidderId,
              senderName,
            });
          }
        }
        return { sent: result.sent };
      }),

    /** 用戶拆除（軟刪除）自己嘅對話室，從列表消失 */
    deleteRoom: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { archiveChatRoom } = await import('./db');
        const ok = await archiveChatRoom(input.roomId, ctx.user.id);
        if (!ok) throw new TRPCError({ code: 'FORBIDDEN', message: '找唔到對話，或者你冇權刪除' });
        return { success: true };
      }),

    /** Admin: 取得 chat 設定 (公開讀取) */
    getRetentionDays: publicProcedure.query(async () => {
      const v = await getSiteSetting('chat.retentionDays');
      return { days: v ? parseInt(v, 10) : 90 };
    }),

    /** Admin: 設定 chat 保留期 + 立即跑一次清理 */
    setRetentionDays: adminProcedure
      .input(z.object({ days: z.number().int().min(7).max(3650) }))
      .mutation(async ({ input }) => {
        await setSiteSetting('chat.retentionDays', String(input.days));
        return { success: true, days: input.days };
      }),

    /** Admin: 立即跑一次清理 (測試用) */
    purgeNow: adminProcedure.mutation(async () => {
      const { purgeOldChatRooms } = await import('./db');
      const v = await getSiteSetting('chat.retentionDays');
      const days = v ? parseInt(v, 10) : 90;
      const result = await purgeOldChatRooms(days);
      return { ...result, days };
    }),

    /** 商戶取自己嘅自動回覆設定 */
    getMyAutoReply: protectedProcedure.query(async ({ ctx }) => {
      const s = await getMerchantSettings(ctx.user.id);
      return { enabled: !!s.chatAutoReplyEnabled, message: s.chatAutoReplyMessage ?? '' };
    }),

    /** 商戶更新自動回覆設定 */
    updateMyAutoReply: protectedProcedure
      .input(z.object({ enabled: z.boolean(), message: z.string().max(500) }))
      .mutation(async ({ input, ctx }) => {
        const trimmed = input.message.trim();
        if (input.enabled && !trimmed) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '啟用自動回覆必須填內容' });
        }
        await upsertChatAutoReply(ctx.user.id, input.enabled ? 1 : 0, trimmed || null);
        return { success: true };
      }),
  }),

  // ─── 排價 (price offer) ─────────────────────────────────────────────────
  offers: router({
    /** 買家：建立排價 */
    create: protectedProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        amount: z.number().positive(),
        buyerNote: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if ((ctx.user as any).isBanned === 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '您的帳號已被停權' });
        }
        const product = await getMerchantProduct(input.productId);
        if (!product || product.status !== 'active' || (product as any).stock <= 0) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在或已售出' });
        }
        if (product.merchantId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不能對自己嘅商品排價' });
        }
        // 全域 + 個別商品 toggle
        const settings = await getMerchantSettings(product.merchantId);
        if (!settings.offersGloballyEnabled) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '此商戶暫時唔接受排價' });
        }
        if (Number((product as any).allowOffers ?? 1) === 0) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '此商品唔接受排價' });
        }
        // 銀牌+ 限制
        const lvl = (await getUserMemberLevel(ctx.user.id)) ?? 'bronze';
        if (!['silver','gold','vip'].includes(lvl) && (ctx.user as any).role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '銀牌或以上會員先可以排價' });
        }
        // 最低 50%
        const listPrice = Number((product as any).price);
        const minAllowed = listPrice * 0.5;
        if (input.amount < minAllowed) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `排價最低 ${product.currency} $${minAllowed.toFixed(2)}（標價嘅 50%）` });
        }
        if (input.amount >= listPrice) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '排價金額需要低於標價，否則請直接落單' });
        }
        // 已有未處理排價？
        const existing = await getActiveBuyerOfferForProduct(ctx.user.id, input.productId);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: '你對此商品已有一個未處理嘅排價' });
        }
        // 失約封鎖檢查
        try { await assertBuyerNotLockedFromMerchant(ctx.user.id, product.merchantId, '排價'); }
        catch (err) { throw new TRPCError({ code: 'FORBIDDEN', message: err instanceof Error ? err.message : '已被該商戶暫停排價' }); }
        // 同一商品 X 日內最多 Y 次（由商戶後台設定，預設 7 日 3 次；包括已取消／已拒絕）
        const windowDays = Math.max(1, Number((settings as any).offerWindowDays ?? 7));
        const maxPerWindow = Math.max(1, Number((settings as any).offerMaxPerWindow ?? 3));
        const recentCount = await countRecentBuyerOffersForProduct(ctx.user.id, input.productId, windowDays * 24);
        if (recentCount >= maxPerWindow) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: `同一商品 ${windowDays} 日內最多排價 ${maxPerWindow} 次` });
        }
        const note = input.buyerNote ? sanitizeUserText(input.buyerNote) : null;
        const id = await createProductOffer({
          productId: input.productId,
          buyerId: ctx.user.id,
          merchantId: product.merchantId,
          amount: input.amount,
          currency: product.currency || 'HKD',
          buyerNote: note,
        });
        return { id };
      }),

    /** 買家：睇返自己對某商品嘅排價 */
    myActiveForProduct: protectedProcedure
      .input(z.object({ productId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        return await getActiveBuyerOfferForProduct(ctx.user.id, input.productId);
      }),

    /** 買家：列出自己所有排價 */
    listMine: protectedProcedure.query(async ({ ctx }) => {
      return await listOffersForBuyer(ctx.user.id);
    }),

    /** 商戶：清除已拒絕／已取消／已過期嘅排價紀錄（軟刪） */
    hideForMerchant: protectedProcedure
      .input(z.object({ offerId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const result = await hideMerchantOffer(input.offerId, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason ?? '清除失敗' });
        return { success: true };
      }),

    /** 買家：清除已拒絕／已取消／已過期嘅排價紀錄（軟刪） */
    hide: protectedProcedure
      .input(z.object({ offerId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const result = await hideBuyerOffer(input.offerId, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason ?? '清除失敗' });
        return { success: true };
      }),

    /** 買家：取消未回覆嘅排價 */
    cancel: protectedProcedure
      .input(z.object({ offerId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const result = await cancelBuyerOffer(input.offerId, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason ?? '取消失敗' });
        return { success: true };
      }),

    /** 買家：商戶已接受、等待我去買嘅排價數（badge 用） */
    myAcceptedCount: protectedProcedure.query(async ({ ctx }) => {
      return await countBuyerAcceptedOffers(ctx.user.id);
    }),

    /** 商戶：列出收到嘅排價 */
    listForMerchant: protectedProcedure
      .input(z.object({ status: z.enum(['all','pending','accepted','rejected','expired','purchased']).default('all') }))
      .query(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        return await listOffersForMerchant(ctx.user.id, input.status);
      }),

    /** 商戶：未處理排價數（badge） */
    pendingCount: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status !== 'approved' && ctx.user.role !== 'admin') return 0;
      return await countPendingOffersForMerchant(ctx.user.id);
    }),

    /** 商戶：接受／拒絕排價 */
    respond: protectedProcedure
      .input(z.object({
        offerId: z.number().int().positive(),
        action: z.enum(['accept','reject']),
        responseText: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        const result = await respondProductOffer(
          input.offerId,
          ctx.user.id,
          input.action,
          input.responseText ? sanitizeUserText(input.responseText) : null,
        );
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason ?? '操作失敗' });
        return { success: true };
      }),

    /** 買家：將已接受嘅排價轉做訂單（用 offer 金額作 unit price） */
    convertToOrder: protectedProcedure
      .input(z.object({
        offerId: z.number().int().positive(),
        buyerName: z.string().max(80).optional(),
        buyerPhone: z.string().max(40).optional(),
        buyerNote: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const offer = await getProductOfferById(input.offerId);
        if (!offer) throw new TRPCError({ code: 'NOT_FOUND', message: '排價唔存在' });
        if (offer.buyerId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: '冇權限' });
        if (offer.status !== 'accepted') throw new TRPCError({ code: 'BAD_REQUEST', message: '排價未被接受或已過期' });
        if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '排價有效期已過' });
        }
        const product = await getMerchantProduct(offer.productId);
        if (!product || product.status !== 'active' || (product as any).stock <= 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '商品已售出或下架' });
        }
        // 原子搶佔，避免重複落單（並發/重試）
        const claimed = await claimAcceptedOffer(offer.id, ctx.user.id);
        if (!claimed) {
          throw new TRPCError({ code: 'CONFLICT', message: '排價已被使用或已過期' });
        }
        let orderId: number;
        try {
          const deposit = await getOrCreateSellerDeposit(offer.merchantId);
          const commissionRate = Number(deposit?.commissionRate ?? 0.05);
          orderId = await createProductOrder({
            productId: offer.productId,
            buyerId: ctx.user.id,
            merchantId: offer.merchantId,
            title: (product as any).title,
            price: Number(offer.amount),
            currency: offer.currency,
            quantity: 1,
            commissionRate,
            buyerName: input.buyerName ?? (ctx.user as any).name ?? undefined,
            buyerPhone: input.buyerPhone ?? (ctx.user as any).phone ?? undefined,
            buyerNote: input.buyerNote ?? `排價成交（原排價 #${offer.id}）`,
          });
        } catch (err) {
          await releaseClaimedOffer(offer.id);
          throw err;
        }
        // 將 'converting' 升做 'purchased' 並寫入 orderId
        const db = await (await import("./db")).getDb();
        if (db) {
          await db.execute((await import("drizzle-orm")).sql`
            UPDATE productOffers SET status = 'purchased', orderId = ${orderId}
            WHERE id = ${offer.id} AND status = 'converting'
          `);
        }
        return { orderId };
      }),
  }),

  // ── 收藏品分享社區（藏品社區）— Phase 1 ──────────────────────────────
  community: router({
    list: publicProcedure
      .input(z.object({
        intent: z.enum(["all", "display", "seek_value", "for_sale"]).default("all"),
        sort: z.enum(["latest", "hot"]).default("latest"),
        search: z.string().optional(),
        cursor: z.number().int().optional(),
        limit: z.number().int().min(1).max(50).default(20),
        authorId: z.number().int().positive().optional(),
        // 方案 B：tab 過濾。"community"（預設）唔包商戶帖；"merchant" 只 show 商戶帖；"all" 兩種都 show。
        tab: z.enum(["community", "merchant", "all"]).default("community"),
      }))
      .query(async ({ input, ctx }) => {
        const viewerIsAdmin = ctx.user?.role === "admin";
        return listCollectionPosts({
          intent: input.intent,
          sort: input.sort,
          search: input.search,
          cursor: input.cursor,
          limit: input.limit,
          viewerIsAdmin,
          viewerUserId: ctx.user?.id ?? null,
          authorId: input.authorId,
          tab: input.tab,
        });
      }),

    // 方案 B：商戶查詢自己當月配額
    merchantPostQuota: protectedProcedure
      .query(async ({ ctx }) => {
        return getMerchantPostQuotaInfo(ctx.user.id);
      }),

    // 用戶喺社區嘅統計（發帖數 / 收到讚總數 / 收到收藏總數）
    userStats: publicProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getCommunityUserStats(input.userId);
      }),

    // 本週熱門分享者：過去 7 日收到最多讚嘅 user
    topWeeklyCreators: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }).optional())
      .query(async ({ input }) => {
        return listTopWeeklyCreators(input?.limit ?? 5);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const viewerIsAdmin = ctx.user?.role === "admin";
        const post = await getCollectionPostDetail(input.id, ctx.user?.id ?? null, viewerIsAdmin);
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "帖文不存在或已被隱藏" });
        return post;
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(2).max(255),
        body: z.string().max(5000).optional().default(""),
        intent: z.enum(["display", "seek_value", "for_sale"]).default("display"),
        tags: z.array(z.string().max(40)).max(10).default([]),
        imageUrls: z.array(z.string().url()).max(9).default([]),
        // 方案 B：商戶可附帶自己嘅 active 商品（會 set isMerchantPost=1, intent=for_sale）
        merchantProductId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.isBanned) {
          throw new TRPCError({ code: "FORBIDDEN", message: "帳戶已停權，無法發布" });
        }
        const cleanTitle = sanitizeUserText(input.title).trim();
        const cleanBody = sanitizeUserText(input.body || "").trim();
        const cleanTags = (input.tags || []).map((t) => sanitizeUserText(t).trim()).filter(Boolean);

        // 方案 B：附帶商戶商品時 — validate ownership + active + 配額
        let isMerchantPost = false;
        let merchantProductId: number | null = null;
        let finalIntent = input.intent;
        if (input.merchantProductId) {
          const quota = await getMerchantPostQuotaInfo(ctx.user.id);
          if (!quota.isMerchant) {
            throw new TRPCError({ code: "FORBIDDEN", message: "只有商戶可以附帶商品" });
          }
          if (!quota.canPost) {
            throw new TRPCError({ code: "FORBIDDEN", message: `本月商戶上架配額已滿（${quota.used}/${quota.limit}），下個月再試` });
          }
          // ownership + status check
          const { getMerchantProduct } = await import("./db");
          const product = await getMerchantProduct(input.merchantProductId);
          if (!product || (product as any).merchantId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "唔係你嘅商品" });
          }
          if ((product as any).status !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "只可以分享上架中嘅商品" });
          }
          isMerchantPost = true;
          merchantProductId = input.merchantProductId;
          finalIntent = "for_sale";
        }

        const result = await createCollectionPost({
          userId: ctx.user.id,
          title: cleanTitle,
          body: cleanBody,
          intent: finalIntent,
          tags: cleanTags,
          imageUrls: input.imageUrls,
          isMerchantPost,
          merchantProductId,
        });
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const ok = await deleteCollectionPost(input.id, ctx.user.id, ctx.user.role === "admin");
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "無權刪除" });
        return { ok: true };
      }),

    // 作者／admin 可以編輯自己嘅藏品社區帖文
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(2).max(255).optional(),
        body: z.string().max(5000).optional(),
        tags: z.array(z.string().max(40)).max(10).optional(),
        imageUrls: z.array(z.string().url()).max(9).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const rows: any = await db.execute(sql`SELECT id, userId FROM collectionPosts WHERE id = ${input.id} LIMIT 1`);
        const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
        if (!list || list.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: "帖文不存在" });
        }
        const existing = list[0];
        const isAdmin = ctx.user.role === "admin";
        if (Number(existing.userId) !== ctx.user.id && !isAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "只可以改自己嘅帖文" });
        }
        const newTitle = input.title !== undefined ? sanitizeUserText(input.title).trim() : null;
        const newBody = input.body !== undefined ? sanitizeUserText(input.body).trim() : null;
        const newTagsJson = input.tags !== undefined
          ? JSON.stringify(input.tags.map(t => sanitizeUserText(t).trim()).filter(Boolean))
          : null;
        await db.transaction(async (tx) => {
          if (newTitle !== null || newBody !== null || newTagsJson !== null) {
            await tx.execute(sql`
              UPDATE collectionPosts SET
                title = COALESCE(${newTitle}, title),
                body = COALESCE(${newBody}, body),
                tagsJson = COALESCE(${newTagsJson}, tagsJson)
              WHERE id = ${input.id}
            `);
          }
          if (input.imageUrls !== undefined) {
            await tx.execute(sql`DELETE FROM collectionPostImages WHERE postId = ${input.id}`);
            for (let i = 0; i < input.imageUrls.length; i++) {
              await tx.execute(sql`INSERT INTO collectionPostImages (postId, imageUrl, displayOrder) VALUES (${input.id}, ${input.imageUrls[i]}, ${i})`);
            }
          }
        });
        return { ok: true };
      }),

    listComments: publicProcedure
      .input(z.object({ postId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        return listCollectionPostComments(input.postId, ctx.user?.role === "admin");
      }),

    addComment: protectedProcedure
      .input(z.object({
        postId: z.number().int().positive(),
        content: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.isBanned) {
          throw new TRPCError({ code: "FORBIDDEN", message: "帳戶已停權，無法留言" });
        }
        const cleaned = sanitizeUserText(input.content).trim();
        if (!cleaned) throw new TRPCError({ code: "BAD_REQUEST", message: "留言內容不可為空" });
        return addCollectionPostComment(input.postId, ctx.user.id, cleaned);
      }),

    deleteComment: protectedProcedure
      .input(z.object({ commentId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const ok = await deleteCollectionPostComment(input.commentId, ctx.user.id, ctx.user.role === "admin");
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "無權刪除" });
        return { ok: true };
      }),

    toggleLike: protectedProcedure
      .input(z.object({ postId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        return toggleCollectionPostLike(input.postId, ctx.user.id);
      }),

    toggleSave: protectedProcedure
      .input(z.object({ postId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        return toggleCollectionPostSave(input.postId, ctx.user.id);
      }),

    // 上傳圖片（任何已登入會員，base64 上載）
    uploadImage: protectedProcedure
      .input(z.object({
        // 8MB 二進制 ≈ 11MB base64；上限 12MB 字串可堵 DoS
        imageData: z.string().max(12 * 1024 * 1024, "圖片資料過大"),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(64).default("image/jpeg"),
      }))
      .mutation(async ({ input, ctx }) => {
        const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
        const mime = (input.mimeType || "image/jpeg").toLowerCase();
        if (!allowedMimes.includes(mime)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `不支援此圖片格式（${mime}）` });
        }
        const rawBuffer = Buffer.from(input.imageData, "base64");
        if (rawBuffer.length > 8 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "圖片不可超過 8MB" });
        }
        // 壓縮：max 1600px、jpeg q82。GIF（動圖）保留原狀避免郁咗。
        let outBuffer = rawBuffer;
        let outMime = mime;
        try {
          if (mime !== "image/gif") {
            const sharpMod = (await import("sharp")).default;
            outBuffer = await sharpMod(rawBuffer, { failOn: "none" })
              .rotate() // honor EXIF orientation
              .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
              .jpeg({ quality: 82, progressive: true, mozjpeg: true })
              .toBuffer();
            outMime = "image/jpeg";
          }
        } catch {
          // 壓縮失敗（例如損壞圖片）就用原檔上載
          outBuffer = rawBuffer;
          outMime = mime;
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80).replace(/\.(png|webp|heic|heif|jpe?g)$/i, ".jpg");
        const key = `community/${ctx.user.id}/${Date.now()}-${safeName}`;
        const { url } = await storagePut(key, outBuffer, outMime);
        return { url, originalSize: rawBuffer.length, storedSize: outBuffer.length };
      }),

    // ── Admin endpoints ──
    adminListFlagged: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        return adminListFlaggedPosts();
      }),

    adminCountFlagged: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") return { count: 0 };
        return { count: await adminCountFlagged() };
      }),

    adminSetHidden: protectedProcedure
      .input(z.object({ postId: z.number().int().positive(), hidden: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        await adminSetPostHidden(input.postId, input.hidden);
        return { ok: true };
      }),

    // 預先 lint 內文，幫前端先警告（可選）
    lintContent: publicProcedure
      .input(z.object({ text: z.string().max(6000) }))
      .query(async ({ input }) => {
        const r = checkForbidden(input.text);
        return r;
      }),
  }),

  // ── 每日一幣挑戰（Daily Coin Challenge）— Phase 1 ───────────────────────
  dailyChallenge: router({
    // 用戶：取今日題目（隱藏正確答案）+ 我嘅答案 + 答中名單
    today: publicProcedure
      .query(async ({ ctx }) => {
        const c = await getTodayChallenge();
        if (!c) {
          return { hasChallenge: false as const, hkDate: hkTodayStr() };
        }
        const stats = await getChallengeStats(c.id);
        const winners = await getChallengeWinners(c.id, 20);
        let myAnswer: any = null;
        if (ctx.user?.id) {
          myAnswer = await getMyAnswerForChallenge(c.id, ctx.user.id);
        }
        const safe = {
          id: c.id,
          // 公開畀用戶嘅 imageUrl：有 censored 用 censored，否則用原圖
          imageUrl: c.imageUrlCensored || c.imageUrl,
          hasMosaic: !!c.imageUrlCensored,
          publishDate: c.publishDate,
          hint: c.hint || null,
          status: c.status,
          createdAt: c.createdAt,
        };
        // 已答嘅 user 可以見正確答案 + 描述
        const reveal = myAnswer
          ? {
              country: c.answerCountry,
              year: Number(c.answerYear),
              category: c.answerCategory,
              tolerance: Number(c.yearTolerance ?? 5),
              description: c.description || null,
            }
          : null;
        return {
          hasChallenge: true as const,
          hkDate: hkTodayStr(),
          challenge: safe,
          stats,
          winners,
          myAnswer,
          reveal,
          options: {
            countries: CHALLENGE_COUNTRIES,
            categories: CHALLENGE_CATEGORIES,
          },
        };
      }),

    submitAnswer: protectedProcedure
      .input(z.object({
        challengeId: z.number().int().positive(),
        answerCountry: z.string().min(1).max(80),
        answerYear: z.number().int().min(-2000).max(3000),
        answerCategory: z.string().min(1).max(40),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "帳戶已停權" });
        if (!CHALLENGE_COUNTRIES.includes(input.answerCountry as any)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "國家選項無效" });
        }
        if (!CHALLENGE_CATEGORIES.includes(input.answerCategory as any)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "種類選項無效" });
        }
        try {
          const r = await submitChallengeAnswer({
            challengeId: input.challengeId,
            userId: ctx.user.id,
            answerCountry: input.answerCountry,
            answerYear: input.answerYear,
            answerCategory: input.answerCategory,
          });
          return r;
        } catch (e: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: e?.message || "提交失敗" });
        }
      }),

    leaderboard: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return getChallengeLeaderboard(input?.limit ?? 20);
      }),

    myStats: protectedProcedure
      .query(async ({ ctx }) => {
        return getMyChallengeStats(ctx.user.id);
      }),

    myHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
      .query(async ({ ctx, input }) => {
        return listMyAnswerHistory(ctx.user.id, input?.limit ?? 30);
      }),

    // ── Admin endpoints ──
    adminList: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        return adminListChallenges(100);
      }),

    adminGet: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        const c = await getChallengeById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "挑戰不存在" });
        const stats = await getChallengeStats(c.id);
        const winners = await getChallengeWinners(c.id, 50);
        return { challenge: c, stats, winners };
      }),

    adminCreate: protectedProcedure
      .input(z.object({
        imageUrl: z.string().url(),
        publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式須為 YYYY-MM-DD"),
        answerCountry: z.string().min(1).max(80),
        answerYear: z.number().int().min(-2000).max(3000),
        yearTolerance: z.number().int().min(0).max(50).default(5),
        answerCategory: z.string().min(1).max(40),
        hint: z.string().max(500).optional(),
        description: z.string().max(2000).optional(),
        status: z.enum(["draft", "published"]).default("draft"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        if (!CHALLENGE_COUNTRIES.includes(input.answerCountry as any)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "國家選項無效" });
        }
        if (!CHALLENGE_CATEGORIES.includes(input.answerCategory as any)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "種類選項無效" });
        }
        return adminCreateChallenge({ ...input, createdBy: ctx.user.id });
      }),

    adminUpdate: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        patch: z.object({
          imageUrl: z.string().url().optional(),
          publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          answerCountry: z.string().min(1).max(80).optional(),
          answerYear: z.number().int().optional(),
          yearTolerance: z.number().int().min(0).max(50).optional(),
          answerCategory: z.string().min(1).max(40).optional(),
          hint: z.string().max(500).nullable().optional(),
          description: z.string().max(2000).nullable().optional(),
          status: z.enum(["draft", "published", "closed"]).optional(),
          imageRegions: z.string().nullable().optional(),
          imageUrlCensored: z.string().nullable().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        await adminUpdateChallenge(input.id, input.patch);
        return { ok: true };
      }),

    // 為挑戰圖片加馬賽克（指定矩形區域），生成 censored 版本並儲存
    adminApplyMosaic: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        regions: z.array(z.object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          w: z.number().min(0.005).max(1),
          h: z.number().min(0.005).max(1),
        })).max(10),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        const c = await getChallengeById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "挑戰不存在" });
        try {
          const censoredUrl = input.regions.length > 0
            ? await generateCensoredImage(c.imageUrl, input.regions)
            : null;
          await adminUpdateChallenge(input.id, {
            imageRegions: input.regions.length > 0 ? JSON.stringify(input.regions) : null,
            imageUrlCensored: censoredUrl,
          });
          return { ok: true, censoredUrl };
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e?.message || "馬賽克處理失敗" });
        }
      }),

    adminDelete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        await adminDeleteChallenge(input.id);
        return { ok: true };
      }),

    adminUploadImage: protectedProcedure
      .input(z.object({
        imageData: z.string(),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
        const mime = (input.mimeType || "image/jpeg").toLowerCase();
        if (!allowedMimes.includes(mime)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `不支援此圖片格式（${mime}）` });
        }
        const buffer = Buffer.from(input.imageData, "base64");
        if (buffer.length > 8 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "圖片不可超過 8MB" });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const key = `daily-challenge/${Date.now()}-${safeName}`;
        const { url } = await storagePut(key, buffer, mime);
        return { url };
      }),

    options: publicProcedure
      .query(() => ({ countries: CHALLENGE_COUNTRIES, categories: CHALLENGE_CATEGORIES })),

    // Admin：AI 一鍵生成 3 個候選錢幣題目（國家/年份/種類/提示/描述）
    adminGenerateSuggestions: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });

        // 攞返最近 30 條挑戰嘅答案，避免重複
        const recent = await adminListChallenges(30);
        const recentList = recent
          .map((r: any) => `${r.answerCountry}/${r.answerYear}/${r.answerCategory}`)
          .join("、") || "（暫無）";

        const systemPrompt = `You are a coin/banknote challenge generator for "hongxcollections" website. Generate 3 candidate quiz questions for the daily collectible challenge.

OUTPUT FORMAT: ONLY a valid JSON array (no markdown, no code fences, no prose, no explanation). Start with [ and end with ]. Each item must have these exact keys:
- country: string, MUST be one of: ${CHALLENGE_COUNTRIES.join(" | ")}
- year: integer (1700-2025 range, real historical coin/banknote year)
- yearTolerance: integer (3-10)
- category: string, MUST be one of: ${CHALLENGE_CATEGORIES.join(" | ")}
- hint: short Cantonese hint, ≤30 chars, do NOT reveal answer directly
- description: Cantonese background story 50-120 chars
- titleHint: short Cantonese title for admin reference, ≤20 chars

REQUIREMENTS:
1. 3 items must differ in country, year, and category (diversify)
2. Must be REAL historical coins/banknotes (no fabrication)
3. Avoid recent questions: ${recentList}
4. RETURN ONLY THE JSON ARRAY. NO markdown fences. NO prose before or after.

EXAMPLE OUTPUT (exact format):
[{"country":"香港","year":1898,"yearTolerance":5,"category":"銀幣","hint":"維多利亞女皇頭像","description":"呢個係香港早期英治時代嘅 5 仙銀幣，正面有維多利亞女皇頭像，收藏價值高。","titleHint":"1898 香港 5 仙銀幣"},{"country":"中國","year":1912,"yearTolerance":3,"category":"銀幣","hint":"開國紀念幣","description":"中華民國開國紀念銀幣，正面孫中山先生頭像，背面嘉禾圖案。","titleHint":"1912 民國開國紀念幣"},{"country":"英國","year":1953,"yearTolerance":5,"category":"流通幣","hint":"伊利沙伯二世登基年","description":"英女皇伊利沙伯二世登基當年發行嘅流通硬幣，極具紀念意義。","titleHint":"1953 英國伊利沙伯二世硬幣"}]`;

        // helper：盡量 robust 抽 JSON array
        function tryParseSuggestions(raw: string): any[] | null {
          if (!raw) return null;
          let t = raw.trim();
          // 剝走所有 markdown code fences
          t = t.replace(/```(?:json|JSON)?\s*/g, "").replace(/```/g, "").trim();
          // 嘗試 1：直接 parse
          try {
            const j = JSON.parse(t);
            if (Array.isArray(j)) return j;
            if (j && Array.isArray(j.suggestions)) return j.suggestions;
            if (j && Array.isArray(j.data)) return j.data;
            if (j && Array.isArray(j.items)) return j.items;
            // 單個 object → wrap
            if (j && typeof j === "object" && j.country) return [j];
          } catch {}
          // 嘗試 2：抽第一個 [ ... ] block（greedy）
          const arrMatch = t.match(/\[[\s\S]*\]/);
          if (arrMatch) {
            try {
              const j = JSON.parse(arrMatch[0]);
              if (Array.isArray(j)) return j;
            } catch {}
          }
          // 嘗試 3：抽所有 { ... } object，逐個 parse 砌返 array
          const objMatches = t.match(/\{[^{}]*\}/g);
          if (objMatches && objMatches.length > 0) {
            const parsed: any[] = [];
            for (const om of objMatches) {
              try {
                const o = JSON.parse(om);
                if (o && typeof o === "object" && o.country) parsed.push(o);
              } catch {}
            }
            if (parsed.length > 0) return parsed;
          }
          return null;
        }

        let arr: any[] | null = null;
        let lastRaw = "";
        let lastErr = "";
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const result = await invokeLLMSafe({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: attempt === 0
                  ? "Generate 3 challenge items now. Output ONLY the JSON array, nothing else."
                  : "Your previous response was not valid JSON. Output ONLY a JSON array starting with [ and ending with ], no markdown, no explanation. Generate 3 items now." },
              ],
              maxTokens: 1500,
            });
            const content = result.choices?.[0]?.message?.content;
            const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c: any) => c.text || "").join("") : "";
            lastRaw = text;
            const parsed = tryParseSuggestions(text);
            if (parsed && parsed.length > 0) {
              arr = parsed;
              break;
            }
            lastErr = "回覆內容無法擷取 JSON";
          } catch (e: any) {
            lastErr = e?.message || String(e);
          }
        }
        try {
          if (!arr) {
            console.warn("[dailyChallenge] AI suggestions parse failed. Raw:", lastRaw.slice(0, 500));
            throw new Error(lastErr || "AI 回覆無法解析為 JSON");
          }
          const baseSuggestions = arr.slice(0, 3).map((it: any) => {
            const country = CHALLENGE_COUNTRIES.includes(it.country) ? it.country : "其他";
            const category = CHALLENGE_CATEGORIES.includes(it.category) ? it.category : "其他";
            const year = parseInt(it.year);
            const yearTolerance = Math.max(0, Math.min(50, parseInt(it.yearTolerance) || 5));
            return {
              country,
              year: isNaN(year) ? new Date().getFullYear() : year,
              yearTolerance,
              category,
              hint: String(it.hint || "").slice(0, 200),
              description: String(it.description || "").slice(0, 800),
              titleHint: String(it.titleHint || `${country} ${year} ${category}`).slice(0, 80),
            };
          });
          if (baseSuggestions.length === 0) throw new Error("AI 未生成任何建議");

          // 為每條建議從 Wikimedia Commons 揾 2-5 張真實圖片，mirror 到 S3 畀 admin 揀
          const suggestions = await Promise.all(baseSuggestions.map(async (s) => {
            let imageUrls: string[] = [];
            try {
              imageUrls = await fetchAndMirrorChallengeImages(s, 4);
            } catch (err) {
              console.warn("[dailyChallenge] image fetch failed for", s.titleHint, err);
            }
            return { ...s, imageUrls };
          }));

          return { suggestions };
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI 生成失敗：${e?.message ?? e}` });
        }
      }),
  }),

  // ── 藏品社區 AI 助手 (admin only) ─────────────────────────────────────────
  adminCommunitySeeder: router({
    /** 列出可用題材（由 DB 讀取，admin 可改） */
    listThemes: adminProcedure.query(async () => {
      const db = await getDb();
      return await getDbThemes(db);
    }),

    /** 新增題材 */
    createTheme: adminProcedure
      .input(z.object({
        id: z.string().min(2).max(60).regex(/^[a-z0-9][a-z0-9-]*$/, '只可以用細楷英文 / 數字 / dash'),
        label: z.string().min(1).max(120),
        hint: z.string().min(1).max(2000),
        sortOrder: z.number().int().min(0).max(9999).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const exist: any = await db.execute(sql`SELECT id FROM communitySeederThemes WHERE id = ${input.id} LIMIT 1`);
        const list = Array.isArray(exist) ? (exist[0] as any[]) : [];
        if (list && list.length > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '呢個 ID 已存在' });
        await db.execute(sql`
          INSERT INTO communitySeederThemes (id, label, hint, sortOrder, isSystem)
          VALUES (${input.id}, ${input.label}, ${input.hint}, ${input.sortOrder ?? 100}, false)
        `);
        return { ok: true };
      }),

    /** 改題材（label / hint / sortOrder） — id 同 isSystem 唔可改 */
    updateTheme: adminProcedure
      .input(z.object({
        id: z.string().min(2).max(60),
        label: z.string().min(1).max(120).optional(),
        hint: z.string().min(1).max(2000).optional(),
        sortOrder: z.number().int().min(0).max(9999).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const sets: any[] = [];
        if (input.label !== undefined) sets.push(sql`label = ${input.label}`);
        if (input.hint !== undefined) sets.push(sql`hint = ${input.hint}`);
        if (input.sortOrder !== undefined) sets.push(sql`sortOrder = ${input.sortOrder}`);
        if (sets.length === 0) return { ok: true };
        const setClause = sql.join(sets, sql`, `);
        await db.execute(sql`UPDATE communitySeederThemes SET ${setClause} WHERE id = ${input.id}`);
        return { ok: true };
      }),

    /** 刪題材 — system theme（例如 url-import）唔可刪 */
    deleteTheme: adminProcedure
      .input(z.object({ id: z.string().min(2).max(60) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const rows: any = await db.execute(sql`SELECT isSystem FROM communitySeederThemes WHERE id = ${input.id} LIMIT 1`);
        const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
        if (!list || list.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: '揾唔到呢個題材' });
        if (Number(list[0].isSystem) === 1) throw new TRPCError({ code: 'BAD_REQUEST', message: '系統題材唔可以刪除' });
        // 唔可以刪有 draft 用緊嘅題材
        const used: any = await db.execute(sql`SELECT COUNT(*) as c FROM communitySeederDrafts WHERE themeId = ${input.id}`);
        const usedList = Array.isArray(used) ? (used[0] as any[]) : [];
        if (usedList && Number(usedList[0]?.c || 0) > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `仲有 ${usedList[0].c} 個 draft 用緊呢個題材，唔可以刪` });
        }
        await db.execute(sql`DELETE FROM communitySeederThemes WHERE id = ${input.id}`);
        return { ok: true };
      }),

    /** 列出可作者選擇嘅 user (admin + approved merchants) */
    listEligibleAuthors: adminProcedure.query(async () => {
      const db = await getDb();
      const rows: any = await db.execute(sql.raw(`
        SELECT u.id, u.name, u.role,
          (SELECT ma.merchantName FROM merchantApplications ma WHERE ma.userId = u.id AND ma.status = 'approved' LIMIT 1) AS merchantName
        FROM users u
        WHERE u.role = 'admin'
          OR EXISTS (SELECT 1 FROM merchantApplications ma WHERE ma.userId = u.id AND ma.status = 'approved')
        ORDER BY u.role DESC, u.id ASC
      `));
      const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
      return list.map(r => ({
        id: Number(r.id),
        name: String(r.name || ''),
        role: String(r.role || ''),
        merchantName: r.merchantName ? String(r.merchantName) : null,
        label: r.merchantName ? `${r.merchantName}（${r.name}）` : `${r.name}${r.role === 'admin' ? '（管理員）' : ''}`,
      }));
    }),

    /** 揀題材 → AI 生成 3 個 draft + 自動 Wikimedia 搵圖 mirror 落 S3 */
    generateBatch: adminProcedure
      .input(z.object({ themeId: z.string().min(1).max(60) }))
      .mutation(async ({ input, ctx }) => {
        const rl = aiRateLimit(ctx.user.id, 'communitySeeder.generate', 6);
        if (!rl.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: rl.message! });

        const db0 = await getDb();
        const theme = await getDbTheme(db0, input.themeId);
        if (!theme) throw new TRPCError({ code: 'BAD_REQUEST', message: '無效題材' });

        const prompt = `你係香港資深錢幣／鈔票收藏家，以「真實藏家口吻」（廣東話 + 少量行內術語）寫 3 個獨立、唔重複嘅藏品社區分享帖，題材：「${theme.label}」。

要求：
- 每帖 title 30-60 字，吸引但唔誇張、唔標題黨
- 每帖 body 250-450 字，分 2-4 段，可有 emoji 但唔過多，內容要有歷史背景／鑑別重點／個人收藏感受其中一兩項
- 每帖提供 3-5 個中文 tag（單詞或短語，例如 "香港殖民鈔"、"伊利沙伯二世"）
- 每帖提供 3 條英文 image search query（用於 Wikimedia Commons 圖片搜尋，要具體例如 "Hong Kong 1972 50 dollar banknote" 而唔係 "Hong Kong banknote"）
- 三個帖嘅角度要明顯不同（例如：1 個歷史科普、1 個鑑別／真偽、1 個個人收藏經驗或市場觀察）

返回 strict JSON：
{"posts":[{"title":"...","body":"...","tags":["..","..","..."],"imageQueries":["en query 1","en query 2","en query 3"]},{...},{...}]}`;

        let parsed: any;
        try {
          const result = await invokeLLMSafe({
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 4096,
            responseFormat: { type: 'json_object' },
          });
          const content = result.choices?.[0]?.message?.content;
          const rawText = typeof content === 'string' ? content : (Array.isArray(content) ? content.map((c: any) => c.text || '').join('') : '');
          // 部分 model（即使開咗 json_object）會返 markdown fence ```json ... ```，先剝走
          const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          const text = (fenceMatch ? fenceMatch[1] : rawText).trim();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `AI 生成失敗：${e?.message ?? e}` });
        }
        const posts: any[] = Array.isArray(parsed?.posts) ? parsed.posts.slice(0, 3) : [];
        if (posts.length === 0) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 冇返 posts' });

        const batchId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const db = await getDb();
        const created: any[] = [];
        for (const p of posts) {
          const title = String(p.title || '').slice(0, 250).trim();
          const body = String(p.body || '').slice(0, 5000).trim();
          if (!title || !body) continue;
          const tags = Array.isArray(p.tags) ? p.tags.slice(0, 8).map((t: any) => String(t).slice(0, 40)) : [];
          const queries: string[] = Array.isArray(p.imageQueries) ? p.imageQueries.slice(0, 3).map((q: any) => String(q).slice(0, 120)) : [];

          // 並行為呢個帖搵 2 張圖
          const imgsArr = await Promise.all(queries.map(q => fetchAndMirrorCommunityImages(q, 2)));
          const seen = new Set<string>();
          const images: Array<{ url: string; source: 'commons' }> = [];
          for (const arr of imgsArr) {
            for (const url of arr) {
              if (seen.has(url)) continue;
              seen.add(url);
              images.push({ url, source: 'commons' });
              if (images.length >= 4) break;
            }
            if (images.length >= 4) break;
          }

          const [r]: any = await db.insert(communitySeederDrafts).values({
            themeId: theme.id, themeLabel: theme.label, batchId,
            title: sanitizeUserText(title), body: sanitizeUserText(body),
            tagsJson: JSON.stringify(tags), imagesJson: JSON.stringify(images),
            authorUserId: null, status: 'draft', generatedBy: ctx.user.id,
          });
          created.push({ id: r.insertId, title, body, tags, images });
        }
        return { batchId, count: created.length, drafts: created };
      }),

    /** 列 drafts (默認 status=draft) */
    listDrafts: adminProcedure
      .input(z.object({ status: z.enum(['draft', 'published', 'archived', 'all']).default('draft') }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        const { desc } = await import('drizzle-orm');
        const status = input?.status ?? 'draft';
        const rows = status === 'all'
          ? await db.select().from(communitySeederDrafts).orderBy(desc(communitySeederDrafts.createdAt)).limit(200)
          : await db.select().from(communitySeederDrafts).where(eq(communitySeederDrafts.status, status)).orderBy(desc(communitySeederDrafts.createdAt)).limit(200);
        return rows.map(r => ({
          ...r,
          tags: r.tagsJson ? safeJson(r.tagsJson, []) : [],
          images: r.imagesJson ? safeJson(r.imagesJson, []) : [],
        }));
      }),

    /** 編輯 draft (publish 後一樣可以改：status=published 時會同步 update 到 collectionPosts) */
    updateDraft: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(2).max(250).optional(),
        body: z.string().min(2).max(5000).optional(),
        tags: z.array(z.string().max(40)).max(8).optional(),
        images: z.array(z.object({ url: z.string().url(), source: z.enum(['commons', 'manual']).default('manual') })).max(10).optional(),
        authorUserId: z.number().int().positive().nullable().optional(),
        displayAuthor: z.string().max(80).nullable().optional(),
        themeId: z.string().min(1).max(60).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const [d] = await db.select().from(communitySeederDrafts).where(eq(communitySeederDrafts.id, input.id)).limit(1);
        if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft 不存在' });
        if (input.authorUserId !== undefined && input.authorUserId !== null) {
          await assertEligibleAuthor(db, input.authorUserId);
        }
        const patch: any = {};
        if (input.title !== undefined) patch.title = sanitizeUserText(input.title);
        if (input.body !== undefined) patch.body = sanitizeUserText(input.body);
        if (input.tags !== undefined) patch.tagsJson = JSON.stringify(input.tags);
        if (input.images !== undefined) patch.imagesJson = JSON.stringify(input.images);
        if (input.authorUserId !== undefined) patch.authorUserId = input.authorUserId;
        if (input.displayAuthor !== undefined) {
          patch.displayAuthor = input.displayAuthor === null ? null : sanitizeUserText(input.displayAuthor).slice(0, 80) || null;
        }
        if (input.themeId !== undefined) {
          const t = await getDbTheme(db, input.themeId);
          if (!t) throw new TRPCError({ code: 'BAD_REQUEST', message: '無效題材' });
          patch.themeId = t.id;
          patch.themeLabel = t.label;
        }

        await db.transaction(async (tx) => {
          if (Object.keys(patch).length > 0) {
            await tx.update(communitySeederDrafts).set(patch).where(eq(communitySeederDrafts.id, input.id));
          }
          if (d.status === 'published' && d.publishedPostId) {
            const newTitle = patch.title ?? d.title;
            const newBody = patch.body ?? d.body;
            const newTagsJson = patch.tagsJson ?? d.tagsJson;
            await tx.execute(sql`UPDATE collectionPosts SET title = ${newTitle}, body = ${newBody}, tagsJson = ${newTagsJson} WHERE id = ${d.publishedPostId}`);
            if (input.images !== undefined) {
              await tx.execute(sql`DELETE FROM collectionPostImages WHERE postId = ${d.publishedPostId}`);
              for (let i = 0; i < input.images.length; i++) {
                await tx.execute(sql`INSERT INTO collectionPostImages (postId, imageUrl, displayOrder) VALUES (${d.publishedPostId}, ${input.images[i].url}, ${i})`);
              }
            }
            if (input.authorUserId !== undefined && input.authorUserId !== null) {
              await tx.execute(sql`UPDATE collectionPosts SET userId = ${input.authorUserId} WHERE id = ${d.publishedPostId}`);
            }
            if (input.displayAuthor !== undefined) {
              const newDisplay = patch.displayAuthor ?? null;
              await tx.execute(sql`UPDATE collectionPosts SET displayAuthor = ${newDisplay} WHERE id = ${d.publishedPostId}`);
            }
          }
        });
        return { ok: true };
      }),

    /** 上載一張本機圖片到 S3，回傳 URL（畀 draft 編輯器加圖用） */
    uploadImage: adminProcedure
      .input(z.object({
        imageData: z.string().min(10),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
      }))
      .mutation(async ({ input }) => {
        const b64 = input.imageData.includes(',') ? input.imageData.split(',')[1] : input.imageData;
        const buf = Buffer.from(b64, 'base64');
        if (buf.length < 1_000) throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片太細' });
        if (buf.length > 5 * 1024 * 1024) throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片超過 5MB' });
        const ext = input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const key = `community-seeder/manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { url } = await storagePut(key, buf, input.mimeType);
        return { url };
      }),

    /** 為 draft 搵更多圖片 (admin 揀 query 揾建議) */
    searchImages: adminProcedure
      .input(z.object({ query: z.string().min(2).max(120), limit: z.number().int().min(1).max(8).default(4) }))
      .mutation(async ({ input }) => {
        const urls = await fetchAndMirrorCommunityImages(input.query, input.limit);
        return { images: urls.map(u => ({ url: u, source: 'commons' as const })) };
      }),

    /** 從外部 URL 抓取文章 + 圖 + 視頻 → 自動生成 1 個 draft */
    generateFromUrl: adminProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const rl = aiRateLimit(ctx.user.id, 'communitySeeder.generateFromUrl', 12);
        if (!rl.ok) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: rl.message! });
        const extracted = await fetchAndExtractFromUrl(input.url);
        if (!extracted.title && !extracted.body) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '無法從呢個連結抓取內容（可能 page 需要登入或被 block）' });
        }
        const dbForTheme = await getDb();
        const theme = (await getDbTheme(dbForTheme, 'url-import')) ?? { id: 'url-import', label: '網絡轉載' };
        const batchId = `url-${Date.now()}`;
        const images = extracted.images.map(u => ({ url: u, source: 'manual' as const }));
        const tags = extracted.tags.slice(0, 8);
        // 視頻連結 append 入 body 末尾（collectionPosts schema 唔 store videos）
        let bodyWithVideos = extracted.body || '';
        if (extracted.videos.length > 0) {
          bodyWithVideos = (bodyWithVideos + "\n\n相關影片：\n" + extracted.videos.map(v => `- ${v}`).join("\n")).trim();
        }
        const sourceLine = `\n\n（轉載自：${input.url}）`;
        const finalBody = sanitizeUserText((bodyWithVideos || '（內容空白，請手動補充）') + sourceLine).slice(0, 5000);
        const db = await getDb();
        const [r]: any = await db.insert(communitySeederDrafts).values({
          themeId: theme.id, themeLabel: theme.label, batchId,
          title: sanitizeUserText(extracted.title || '（未命名 — 請編輯標題）').slice(0, 250),
          body: finalBody,
          tagsJson: JSON.stringify(tags),
          imagesJson: JSON.stringify(images),
          authorUserId: null,
          displayAuthor: extracted.author ? sanitizeUserText(extracted.author).slice(0, 80) : null,
          sourceUrl: input.url.slice(0, 500),
          status: 'draft', generatedBy: ctx.user.id,
        });
        return {
          ok: true,
          draftId: Number(r.insertId),
          title: extracted.title,
          author: extracted.author || null,
          imageCount: images.length,
          videoCount: extracted.videos.length,
          videoUrls: extracted.videos,
          sourceUrl: input.url,
        };
      }),

    /** 發布 draft 去 collectionPosts (作者 default = 店主 大BB錢幣店；可指定其他 user) */
    publishDraft: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        authorUserId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const [d] = await db.select().from(communitySeederDrafts).where(eq(communitySeederDrafts.id, input.id)).limit(1);
        if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft 不存在' });
        if (d.status === 'published' && d.publishedPostId) {
          return { ok: true, alreadyPublished: true, postId: d.publishedPostId, draftId: d.id, title: d.title };
        }
        const images = d.imagesJson ? safeJson<Array<{ url: string }>>(d.imagesJson, []) : [];

        // 作者優先順序：明示指定 → draft 已選 → 店主 (大BB錢幣店)
        let authorUserId: number | null = input.authorUserId ?? d.authorUserId ?? null;
        if (authorUserId === null) {
          authorUserId = await getDefaultShopOwnerUserId(db);
          if (!authorUserId) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '揾唔到店主帳號（OWNER_OPEN_ID 未設定 / 帳號不存在），請喺作者 dropdown 揀返一個' });
          }
        } else {
          await assertEligibleAuthor(db, authorUserId);
        }

        const postId = await db.transaction(async (tx) => {
          const [r]: any = await tx.execute(sql`
            INSERT INTO collectionPosts (userId, title, body, intent, tagsJson, isMerchantPost, displayAuthor)
            VALUES (${authorUserId}, ${d.title}, ${d.body}, 'display', ${d.tagsJson}, 0, ${d.displayAuthor ?? null})
          `);
          const pid = Number(r?.insertId ?? (Array.isArray(r) ? (r[0] as any)?.insertId : 0));
          if (!pid) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '發布失敗' });
          for (let i = 0; i < images.length; i++) {
            await tx.execute(sql`INSERT INTO collectionPostImages (postId, imageUrl, displayOrder) VALUES (${pid}, ${images[i].url}, ${i})`);
          }
          await tx.update(communitySeederDrafts)
            .set({ status: 'published', publishedPostId: pid, authorUserId })
            .where(eq(communitySeederDrafts.id, input.id));
          return pid;
        });
        return { ok: true, postId, draftId: d.id, title: d.title };
      }),

    /** 拆除 draft (如已 published 同時刪除 collectionPosts 帖) */
    deleteDraft: adminProcedure
      .input(z.object({ id: z.number().int().positive(), alsoDeletePost: z.boolean().default(true) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const [d] = await db.select().from(communitySeederDrafts).where(eq(communitySeederDrafts.id, input.id)).limit(1);
        if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft 不存在' });
        await db.transaction(async (tx) => {
          if (d.status === 'published' && d.publishedPostId && input.alsoDeletePost) {
            await tx.execute(sql`DELETE FROM collectionPostImages WHERE postId = ${d.publishedPostId}`);
            await tx.execute(sql`DELETE FROM collectionPostLikes WHERE postId = ${d.publishedPostId}`);
            await tx.execute(sql`DELETE FROM collectionPostComments WHERE postId = ${d.publishedPostId}`);
            await tx.execute(sql`DELETE FROM collectionPostSaves WHERE postId = ${d.publishedPostId}`);
            await tx.execute(sql`DELETE FROM collectionPosts WHERE id = ${d.publishedPostId}`);
          }
          await tx.delete(communitySeederDrafts).where(eq(communitySeederDrafts.id, input.id));
        });
        return { ok: true };
      }),

    /** 🔧 Debug: 直接喺 Railway server 試 3 路 fetch，返每一步嘅實際結果 */
    testFetchUrl: adminProcedure
      .input(z.object({ url: z.string().url().max(2000) }))
      .mutation(async ({ input }) => {
        const url = input.url;
        const out: any = { url, jina: null, wayback: null, direct: null };

        // Jina
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 30_000);
          const r = await fetch(`https://r.jina.ai/${url}`, {
            headers: { Accept: "application/json", "User-Agent": "hongxcollections/1.0", "X-Return-Format": "markdown" },
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (r.ok) {
            const j: any = await r.json();
            out.jina = { ok: true, status: r.status, title: j?.data?.title || null, contentLen: (j?.data?.content || "").length };
          } else {
            out.jina = { ok: false, status: r.status, body: (await r.text()).slice(0, 300) };
          }
        } catch (e: any) { out.jina = { ok: false, err: e?.message || String(e) }; }

        // Wayback
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 25_000);
          const r = await fetch(`https://web.archive.org/web/2id_/${url}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
            redirect: "follow", signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            out.wayback = { ok: true, status: r.status, htmlLen: buf.length, titleHint: buf.toString("utf8").match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.slice(0, 100) || null };
          } else {
            out.wayback = { ok: false, status: r.status };
          }
        } catch (e: any) { out.wayback = { ok: false, err: e?.message || String(e) }; }

        // Direct
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 15_000);
          const r = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "zh-HK,zh;q=0.9,zh-TW;q=0.8,en;q=0.7",
            },
            redirect: "follow", signal: ctrl.signal,
          });
          clearTimeout(timer);
          out.direct = { ok: r.ok, status: r.status, ctype: r.headers.get("content-type") };
        } catch (e: any) { out.direct = { ok: false, err: e?.message || String(e) }; }

        return out;
      }),
  }),

  // ─── pm001.net 爬蟲工具 ──────────────────────────────────────────────────
  pm001: router({
    /** 讀取已儲存的分類列表 */
    getCategories: adminProcedure.query(async () => {
      const v = await getSiteSetting('pm001.categories');
      if (!v) return [] as { id: string; name: string; url: string }[];
      try { return JSON.parse(v) as { id: string; name: string; url: string }[]; }
      catch { return [] as { id: string; name: string; url: string }[]; }
    }),

    /** 儲存分類列表 */
    saveCategories: adminProcedure
      .input(z.array(z.object({ id: z.string(), name: z.string().min(1), url: z.string().min(1) })))
      .mutation(async ({ input }) => {
        await setSiteSetting('pm001.categories', JSON.stringify(input));
        return { success: true };
      }),

    /** 爬取指定版塊 URL，過濾含 keyword 的帖子（繁簡兩用 + 日期過濾） */
    scrape: adminProcedure
      .input(z.object({
        url: z.string().min(1),
        keyword: z.string().min(1).max(100),
        pages: z.number().int().min(1).max(10).default(3),
        dateFilter: z.number().int().min(0).max(365).default(7), // 0 = no limit
        searchScope: z.enum(['title', 'content', 'both']).default('both'),
      }))
      .mutation(async ({ input }) => {
        const [iconv, chineseConv] = await Promise.all([
          import('iconv-lite'),
          import('chinese-conv'),
        ]);

        // keyword variants: original + TC↔SC conversion (deduplicated)
        const kwSC = (chineseConv as any).sify(input.keyword);
        const kwTC = (chineseConv as any).tify(input.keyword);
        const kwVariants = [...new Set([input.keyword, kwSC, kwTC])].map(k => k.toLowerCase());
        const matchesKw = (text: string) => {
          const t = text.toLowerCase();
          return kwVariants.some(kw => t.includes(kw));
        };

        const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const cutoff = input.dateFilter > 0
          ? new Date(Date.now() - input.dateFilter * 24 * 60 * 60 * 1000)
          : null;

        // ── Phase 1: collect all unique posts from board pages ────────────────
        type RawPost = { boardId: string; id: string; title: string; postedAt: Date | null };
        const allPosts: RawPost[] = [];
        const seen = new Set<string>();

        for (let page = 1; page <= input.pages; page++) {
          try {
            const sep = input.url.includes('?') ? '&' : '?';
            const pageUrl = page === 1 ? input.url : `${input.url}${sep}page=${page}`;
            const resp = await fetch(pageUrl, {
              signal: AbortSignal.timeout(12000),
              headers: { 'User-Agent': UA },
            });
            if (!resp.ok) break;
            const buf = Buffer.from(await resp.arrayBuffer());
            const html = iconv.decode(buf, 'gb2312');

            // Pass A: build date map — extract post creation date from title attributes
            // Pattern: ID=XXXXX..."  title="...发表于：YYYY/M/D...">
            const dateMap = new Map<string, Date>();
            const dateRegex = /ID=(\d+)[^"]*"[^>]*?发表于[：:](\d{4}\/\d+\/\d+)/gi;
            let dm: RegExpExecArray | null;
            while ((dm = dateRegex.exec(html)) !== null) {
              const [, id, ds] = dm;
              if (!dateMap.has(id)) {
                const [y, mo, d] = ds.split('/').map(Number);
                dateMap.set(id, new Date(y, mo - 1, d));
              }
            }

            // Pass B: extract post titles
            const titleRegex = /dispbbs\.asp\?boardID=(\d+)&(?:amp;)?ID=(\d+)[^"<\s]*"[^>]*>([^<]{2,120})<\/a>/gi;
            let m: RegExpExecArray | null;
            while ((m = titleRegex.exec(html)) !== null) {
              const [, boardId, id, rawTitle] = m;
              const title = rawTitle.trim();
              if (!title || /^\d{4}\/\d/.test(title) || seen.has(id)) continue;
              seen.add(id);
              const postedAt = dateMap.get(id) ?? null;
              // Date filter: if cutoff set and we know the date, apply filter
              if (cutoff && postedAt && postedAt < cutoff) continue;
              allPosts.push({ boardId, id, title, postedAt });
            }
          } catch (e: any) {
            console.error('[pm001 scrape] listing page', page, e?.message);
            break;
          }
        }

        // helper: strip dvbbs author signature/profile from post HTML before searching
        function extractPostBody(rawHtml: string): string {
          // Cut at first occurrence of any known signature/userinfo marker
          const signPatterns = [
            /class=["']sign["']/i,
            /class=["']t_sign["']/i,
            /id=["']userinfo["']/i,
            /class=["'][^"']*pstatus[^"']*["']/i,
            /class=["']postbottom["']/i,
            /<!--\s*签名\s*-->/i,
          ];
          let cutAt = rawHtml.length;
          for (const pat of signPatterns) {
            const idx = rawHtml.search(pat);
            if (idx > 100 && idx < cutAt) cutAt = idx;
          }
          return rawHtml.slice(0, cutAt).replace(/<[^>]+>/g, ' ');
        }

        // ── Phase 2: title matches (skip if scope=content) ───────────────────
        type Result = { title: string; postUrl: string; id: string; matchSource: 'title' | 'content'; postedAt: string | null };
        const results: Result[] = [];
        const titleMatchIds = new Set<string>();

        if (input.searchScope !== 'content') {
          for (const p of allPosts) {
            if (matchesKw(p.title)) {
              titleMatchIds.add(p.id);
              results.push({
                title: p.title,
                postUrl: `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`,
                id: p.id,
                matchSource: 'title',
                postedAt: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : null,
              });
            }
          }
        }

        // ── Phase 3: fetch post content (skip if scope=title) ────────────────
        if (input.searchScope !== 'title') {
          // scope=content → fetch ALL posts; scope=both → fetch only non-title-matched
          const toFetch = input.searchScope === 'content'
            ? allPosts
            : allPosts.filter(p => !titleMatchIds.has(p.id));

          const BATCH = 6;
          for (let i = 0; i < toFetch.length; i += BATCH) {
            const batch = toFetch.slice(i, i + BATCH);
            const fetched = await Promise.allSettled(batch.map(async (p) => {
              const postUrl = `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`;
              const resp = await fetch(postUrl, {
                signal: AbortSignal.timeout(8000),
                headers: { 'User-Agent': UA },
                redirect: 'follow',
              });
              const finalUrl = resp.url ?? '';
              if (!resp.ok || finalUrl.includes('showerr') || finalUrl.includes('login')) return null;
              const buf = Buffer.from(await resp.arrayBuffer());
              const fullHtml = iconv.decode(buf, 'gb2312');
              // Strip signature / author profile area before searching
              const body = extractPostBody(fullHtml);
              return { p, matched: matchesKw(body) };
            }));
            for (const r of fetched) {
              if (r.status === 'fulfilled' && r.value?.matched) {
                const { p } = r.value;
                // avoid duplicate if somehow title also matched
                if (!titleMatchIds.has(p.id)) {
                  results.push({
                    title: p.title,
                    postUrl: `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`,
                    id: p.id,
                    matchSource: 'content',
                    postedAt: p.postedAt ? p.postedAt.toISOString().slice(0, 10) : null,
                  });
                }
              }
            }
          }
        }

        return { results, total: results.length, pagesScraped: input.pages };
      }),

    /** Phase 1 only: collect posts from board pages with title-match flag */
    listPosts: adminProcedure
      .input(z.object({
        url: z.string().min(1),
        keyword: z.string().min(1).max(100),
        pages: z.number().int().min(1).max(10).default(3),
        dateFilter: z.number().int().min(0).max(365).default(7),
      }))
      .mutation(async ({ input }) => {
        const [iconv, chineseConv] = await Promise.all([
          import('iconv-lite'),
          import('chinese-conv'),
        ]);
        const kwSC = (chineseConv as any).sify(input.keyword);
        const kwTC = (chineseConv as any).tify(input.keyword);
        const kwVariants = [...new Set([input.keyword, kwSC, kwTC])].map(k => k.toLowerCase());
        const matchesKw = (text: string) => {
          const t = text.toLowerCase();
          return kwVariants.some(kw => t.includes(kw));
        };
        const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const cutoff = input.dateFilter > 0
          ? new Date(Date.now() - input.dateFilter * 24 * 60 * 60 * 1000)
          : null;

        type PostInfo = { boardId: string; id: string; title: string; postedAt: string | null; titleMatched: boolean };
        const posts: PostInfo[] = [];
        const seen = new Set<string>();
        let pagesScraped = 0;

        for (let page = 1; page <= input.pages; page++) {
          try {
            const sep = input.url.includes('?') ? '&' : '?';
            const pageUrl = page === 1 ? input.url : `${input.url}${sep}page=${page}`;
            const resp = await fetch(pageUrl, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': UA } });
            if (!resp.ok) break;
            const buf = Buffer.from(await resp.arrayBuffer());
            const html = iconv.decode(buf, 'gb2312');
            pagesScraped++;

            const dateMap = new Map<string, Date>();
            const dateRegex = /ID=(\d+)[^"]*"[^>]*?发表于[：:](\d{4}\/\d+\/\d+)/gi;
            let dm: RegExpExecArray | null;
            while ((dm = dateRegex.exec(html)) !== null) {
              const [, id, ds] = dm;
              if (!dateMap.has(id)) {
                const [y, mo, d] = ds.split('/').map(Number);
                dateMap.set(id, new Date(y, mo - 1, d));
              }
            }

            const titleRegex = /dispbbs\.asp\?boardID=(\d+)&(?:amp;)?ID=(\d+)[^"<\s]*"[^>]*>([^<]{2,120})<\/a>/gi;
            let m: RegExpExecArray | null;
            while ((m = titleRegex.exec(html)) !== null) {
              const [, boardId, id, rawTitle] = m;
              const title = rawTitle.trim();
              if (!title || /^\d{4}\/\d/.test(title) || seen.has(id)) continue;
              seen.add(id);
              const postedAt = dateMap.get(id) ?? null;
              if (cutoff && postedAt && postedAt < cutoff) continue;
              posts.push({ boardId, id, title, postedAt: postedAt ? postedAt.toISOString().slice(0, 10) : null, titleMatched: matchesKw(title) });
            }
          } catch (e: any) {
            console.error('[pm001 listPosts] page', page, e?.message);
            break;
          }
        }
        return { posts, pagesScraped };
      }),

    /** Phase 2: check content of a batch of posts for keyword match (strips author signature) */
    fetchPostBatch: adminProcedure
      .input(z.object({
        posts: z.array(z.object({ boardId: z.string(), id: z.string() })).min(1).max(20),
        keyword: z.string().min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        const [iconv, chineseConv] = await Promise.all([
          import('iconv-lite'),
          import('chinese-conv'),
        ]);
        const kwSC = (chineseConv as any).sify(input.keyword);
        const kwTC = (chineseConv as any).tify(input.keyword);
        const kwVariants = [...new Set([input.keyword, kwSC, kwTC])].map(k => k.toLowerCase());
        const matchesKw = (text: string) => {
          const t = text.toLowerCase();
          return kwVariants.some(kw => t.includes(kw));
        };
        const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

        function extractPostBody(rawHtml: string): string {
          const signPatterns = [
            /class=["']sign["']/i,
            /class=["']t_sign["']/i,
            /id=["']userinfo["']/i,
            /class=["'][^"']*pstatus[^"']*["']/i,
            /class=["']postbottom["']/i,
            /<!--\s*签名\s*-->/i,
          ];
          let cutAt = rawHtml.length;
          for (const pat of signPatterns) {
            const idx = rawHtml.search(pat);
            if (idx > 100 && idx < cutAt) cutAt = idx;
          }
          return rawHtml.slice(0, cutAt).replace(/<[^>]+>/g, ' ');
        }

        const fetched = await Promise.allSettled(input.posts.map(async (p) => {
          const postUrl = `http://www.pm001.net/dispbbs.asp?boardID=${p.boardId}&ID=${p.id}&page=1`;
          const resp = await fetch(postUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA }, redirect: 'follow' });
          const finalUrl = resp.url ?? '';
          if (!resp.ok || finalUrl.includes('showerr') || finalUrl.includes('login')) return null;
          const buf = Buffer.from(await resp.arrayBuffer());
          const fullHtml = iconv.decode(buf, 'gb2312');
          const body = extractPostBody(fullHtml);
          return { id: p.id, matched: matchesKw(body) };
        }));

        const matchedIds: string[] = [];
        for (const r of fetched) {
          if (r.status === 'fulfilled' && r.value?.matched) matchedIds.push(r.value.id);
        }
        return { matchedIds };
      }),
  }),

  // ── 商戶日誌 ─────────────────────────────────────────────────────────────────
  merchantJournal: router({
    isEnabled: protectedProcedure.query(async ({ ctx }) => {
      const pool = await getRawPool();
      const [rows]: any = await pool.execute(
        'SELECT journalEnabled FROM merchantApplications WHERE userId = ? AND status = ? LIMIT 1',
        [ctx.user.id, 'approved']
      );
      return { enabled: Array.isArray(rows) && rows.length > 0 ? Number(rows[0].journalEnabled) === 1 : false };
    }),

    adminList: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const pool = await getRawPool();
      const [rows]: any = await pool.execute(
        `SELECT ma.userId, u.name, u.email, u.phone, ma.journalEnabled
         FROM merchantApplications ma
         JOIN users u ON u.id = ma.userId
         WHERE ma.status = 'approved'
         ORDER BY u.name ASC`
      );
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({
        userId: Number(r.userId),
        name: String(r.name ?? ''),
        email: r.email ? String(r.email) : null,
        phone: r.phone ? String(r.phone) : null,
        journalEnabled: Number(r.journalEnabled) === 1,
      }));
    }),

    setJournalEnabled: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), enabled: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const pool = await getRawPool();
        await pool.execute(
          "UPDATE merchantApplications SET journalEnabled = ? WHERE userId = ? AND status = 'approved'",
          [input.enabled ? 1 : 0, input.userId]
        );
        return { success: true };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const pool = await getRawPool();
      const [appRows]: any = await pool.execute(
        "SELECT journalEnabled FROM merchantApplications WHERE userId = ? AND status = 'approved' LIMIT 1",
        [ctx.user.id]
      );
      if (!Array.isArray(appRows) || appRows.length === 0 || Number(appRows[0].journalEnabled) !== 1) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '日誌功能未開通' });
      }
      const [rows]: any = await pool.execute(
        `SELECT mj.id, mj.content, mj.tags, mj.contacts,
                DATE_FORMAT(CONVERT_TZ(mj.createdAt, '+00:00', '+08:00'), '%Y-%m-%dT%H:%i:%s+08:00') as createdAt,
                DATE_FORMAT(mj.entryAt, '%Y-%m-%dT%H:%i:%s+08:00') as entryAt
         FROM merchantJournals mj
         WHERE mj.merchantUserId = ?
         ORDER BY COALESCE(mj.entryAt, mj.createdAt) DESC
         LIMIT 200`,
        [ctx.user.id]
      );
      const journalIds: number[] = (Array.isArray(rows) ? rows : []).map((j: any) => Number(j.id));
      const imageMap = new Map<number, string[]>();
      if (journalIds.length > 0) {
        const [imgRows]: any = await pool.execute(
          `SELECT journalId, imageUrl FROM merchantJournalImages WHERE journalId IN (${journalIds.map(() => '?').join(',')}) ORDER BY journalId, displayOrder`,
          journalIds
        );
        for (const r of (Array.isArray(imgRows) ? imgRows : [])) {
          const jid = Number(r.journalId);
          if (!imageMap.has(jid)) imageMap.set(jid, []);
          imageMap.get(jid)!.push(String(r.imageUrl));
        }
      }
      return (Array.isArray(rows) ? rows : []).map((j: any) => ({
        id: Number(j.id),
        content: String(j.content ?? ''),
        tags: j.tags ? String(j.tags).split(',').filter(Boolean) : [],
        contacts: j.contacts ? String(j.contacts).split(',').filter(Boolean) : [],
        createdAt: j.createdAt,
        entryAt: j.entryAt ?? j.createdAt,
        images: imageMap.get(Number(j.id)) ?? [],
      }));
    }),

    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1).max(500),
        tags: z.array(z.string().max(20)).max(5).default([]),
        imageUrls: z.array(z.string().url()).max(20).default([]),
        entryAt: z.string().optional(),
        contacts: z.array(z.string().max(30)).max(20).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        const [appRows]: any = await pool.execute(
          "SELECT journalEnabled FROM merchantApplications WHERE userId = ? AND status = 'approved' LIMIT 1",
          [ctx.user.id]
        );
        if (!Array.isArray(appRows) || appRows.length === 0 || Number(appRows[0].journalEnabled) !== 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '日誌功能未開通' });
        }
        const tagsStr = input.tags.join(',');
        const contactsStr = input.contacts.join(',');
        // Store entryAt as local (HK) time string — no Date() conversion to avoid UTC shift
        const entryAtStr = input.entryAt ? input.entryAt.replace('T', ' ').slice(0, 16) + ':00' : null;
        const [result]: any = await pool.execute(
          'INSERT INTO merchantJournals (merchantUserId, content, tags, contacts, entryAt) VALUES (?, ?, ?, ?, ?)',
          [ctx.user.id, input.content, tagsStr, contactsStr || null, entryAtStr]
        );
        const journalId = result.insertId;
        for (let i = 0; i < input.imageUrls.length; i++) {
          await pool.execute(
            'INSERT INTO merchantJournalImages (journalId, imageUrl, displayOrder) VALUES (?, ?, ?)',
            [journalId, input.imageUrls[i], i]
          );
        }
        // Sync new contacts into the global contact book
        for (const name of input.contacts) {
          try {
            await pool.execute(
              'INSERT IGNORE INTO merchantJournalContacts (merchantUserId, name) VALUES (?, ?)',
              [ctx.user.id, name]
            );
          } catch { /* ignore duplicate */ }
        }
        return { success: true, id: journalId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        content: z.string().min(1).max(500),
        tags: z.array(z.string()).default([]),
        contacts: z.array(z.string()).default([]),
        entryAt: z.string().optional(),
        imageUrls: z.array(z.string().url()).max(20).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          'SELECT id FROM merchantJournals WHERE id = ? AND merchantUserId = ? LIMIT 1',
          [input.id, ctx.user.id]
        );
        if (!Array.isArray(rows) || rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND' });
        const tagsStr = input.tags.join(',');
        const contactsStr = input.contacts.join(',');
        // Store entryAt as local (HK) time string — no Date() conversion to avoid UTC shift
        const entryAtStr = input.entryAt ? input.entryAt.replace('T', ' ').slice(0, 16) + ':00' : null;
        await pool.execute(
          'UPDATE merchantJournals SET content = ?, tags = ?, contacts = ?, entryAt = ? WHERE id = ? AND merchantUserId = ?',
          [input.content, tagsStr, contactsStr || null, entryAtStr, input.id, ctx.user.id]
        );
        if (input.imageUrls !== undefined) {
          await pool.execute('DELETE FROM merchantJournalImages WHERE journalId = ?', [input.id]);
          for (let i = 0; i < input.imageUrls.length; i++) {
            await pool.execute(
              'INSERT INTO merchantJournalImages (journalId, imageUrl, displayOrder) VALUES (?, ?, ?)',
              [input.id, input.imageUrls[i], i]
            );
          }
        }
        for (const name of input.contacts) {
          try {
            await pool.execute(
              'INSERT IGNORE INTO merchantJournalContacts (merchantUserId, name) VALUES (?, ?)',
              [ctx.user.id, name]
            );
          } catch { /* ignore duplicate */ }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        const [rows]: any = await pool.execute(
          'SELECT id FROM merchantJournals WHERE id = ? AND merchantUserId = ? LIMIT 1',
          [input.id, ctx.user.id]
        );
        if (!Array.isArray(rows) || rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND' });
        await pool.execute('DELETE FROM merchantJournalImages WHERE journalId = ?', [input.id]);
        await pool.execute('DELETE FROM merchantJournals WHERE id = ? AND merchantUserId = ?', [input.id, ctx.user.id]);
        return { success: true };
      }),

    listContacts: protectedProcedure.query(async ({ ctx }) => {
      const pool = await getRawPool();
      const [rows]: any = await pool.execute(
        'SELECT id, name FROM merchantJournalContacts WHERE merchantUserId = ? ORDER BY name ASC',
        [ctx.user.id]
      );
      return (Array.isArray(rows) ? rows : []).map((r: any) => ({ id: Number(r.id), name: String(r.name) }));
    }),

    addContact: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        await pool.execute(
          'INSERT IGNORE INTO merchantJournalContacts (merchantUserId, name) VALUES (?, ?)',
          [ctx.user.id, input.name.trim()]
        );
        return { success: true };
      }),

    renameContact: protectedProcedure
      .input(z.object({ oldName: z.string().min(1).max(100), newName: z.string().min(1).max(100) }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        const old = input.oldName.trim();
        const nw = input.newName.trim();
        if (old === nw) return { success: true, affected: 0 };
        await pool.execute(
          'UPDATE merchantJournalContacts SET name = ? WHERE merchantUserId = ? AND name = ?',
          [nw, ctx.user.id, old]
        );
        const [res]: any = await pool.execute(
          `UPDATE merchantJournals
           SET contacts = TRIM(BOTH ',' FROM
             REPLACE(
               REPLACE(CONCAT(',', COALESCE(contacts,''), ','), CONCAT(',', ?, ','), CONCAT(',', ?, ',')),
               ',,', ','
             ))
           WHERE merchantUserId = ? AND FIND_IN_SET(?, COALESCE(contacts,''))`,
          [old, nw, ctx.user.id, old]
        );
        return { success: true, affected: Number(res?.affectedRows ?? 0) };
      }),

    deleteContact: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        const name = input.name.trim();
        await pool.execute(
          'DELETE FROM merchantJournalContacts WHERE merchantUserId = ? AND name = ?',
          [ctx.user.id, name]
        );
        const [res]: any = await pool.execute(
          `UPDATE merchantJournals
           SET contacts = TRIM(BOTH ',' FROM
             REPLACE(
               REPLACE(CONCAT(',', COALESCE(contacts,''), ','), CONCAT(',', ?, ','), ','),
               ',,', ','
             ))
           WHERE merchantUserId = ? AND FIND_IN_SET(?, COALESCE(contacts,''))`,
          [name, ctx.user.id, name]
        );
        return { success: true, affected: Number(res?.affectedRows ?? 0) };
      }),

    uploadImage: protectedProcedure
      .input(z.object({
        imageData: z.string().max(12 * 1024 * 1024, '圖片資料過大'),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(64).default('image/jpeg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const pool = await getRawPool();
        const [appRows]: any = await pool.execute(
          "SELECT journalEnabled FROM merchantApplications WHERE userId = ? AND status = 'approved' LIMIT 1",
          [ctx.user.id]
        );
        if (!Array.isArray(appRows) || appRows.length === 0 || Number(appRows[0].journalEnabled) !== 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '日誌功能未開通' });
        }
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        const mime = (input.mimeType || 'image/jpeg').toLowerCase();
        if (!allowedMimes.includes(mime)) throw new TRPCError({ code: 'BAD_REQUEST', message: `不支援此圖片格式（${mime}）` });
        const rawBuffer = Buffer.from(input.imageData, 'base64');
        if (rawBuffer.length > 8 * 1024 * 1024) throw new TRPCError({ code: 'BAD_REQUEST', message: '圖片不可超過 8MB' });
        let outBuffer = rawBuffer;
        let outMime = mime;
        try {
          const sharpMod = (await import('sharp')).default;
          outBuffer = await sharpMod(rawBuffer, { failOn: 'none' })
            .rotate()
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();
          outMime = 'image/jpeg';
        } catch { /* keep original */ }
        const ext = outMime.split('/')[1] ?? 'jpg';
        const key = `merchant-journal/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { url } = await storagePut(key, outBuffer, outMime);
        return { url };
      }),
  }),

  auctionFbPanel: router({
    getPanel: publicProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        sort: z.enum(["new", "old"]).default("new"),
        viewerUserId: z.number().int().positive().optional(),
        createdBy: z.number().int().positive().optional(),
      }))
      .query(async ({ input, ctx }) => {
        /* ctx.user may be null in Chrome (public procedure, cookie may not be sent).
           Fall back to client-supplied viewerUserId for isMyBid display only. */
        const myUserId: number | null =
          ctx.user?.id != null ? Number(ctx.user.id)
          : input.viewerUserId != null ? Number(input.viewerUserId)
          : null;
        /* Privileged = admin or auction merchant (verified via ctx.user only, not client-supplied) */
        const isPrivilegedViewer =
          ctx.user?.role === 'admin' ||
          (input.createdBy != null && ctx.user?.id != null && Number(ctx.user.id) === Number(input.createdBy));
        const db = await getDb();
        const bidsRows: any = await db.execute(sql.raw(`
          SELECT 'bid' AS type, b.id, b.auctionId, b.userId,
            CASE WHEN b.isAnonymous=1 THEN '匿名用戶' ELSE u.name END AS userName,
            u.name AS realUserName,
            COALESCE(NULLIF(TRIM(ma.merchantIcon),''), NULLIF(TRIM(u.photoUrl),'')) AS photoUrl,
            CAST(b.bidAmount AS CHAR) AS content,
            CAST(b.bidAmount AS DECIMAL(10,2)) AS rawAmount,
            b.isAnonymous, NULL AS replyToBidId, b.createdAt
          FROM bids b
          LEFT JOIN users u ON u.id = b.userId
          LEFT JOIN merchantApplications ma ON ma.userId = b.userId AND ma.status = 'approved'
          WHERE b.auctionId = ${input.auctionId}
        `));
        const commentsRows: any = await db.execute(sql.raw(`
          SELECT 'comment' AS type, c.id, c.auctionId, c.userId,
            u.name AS userName,
            COALESCE(NULLIF(TRIM(ma.merchantIcon),''), NULLIF(TRIM(u.photoUrl),'')) AS photoUrl,
            c.content, NULL AS rawAmount,
            0 AS isAnonymous, c.replyToBidId, c.createdAt
          FROM auctionComments c
          LEFT JOIN users u ON u.id = c.userId
          LEFT JOIN merchantApplications ma ON ma.userId = c.userId AND ma.status = 'approved'
          WHERE c.auctionId = ${input.auctionId}
        `));
        const normalise = (rows: any): any[] => {
          if (Array.isArray(rows) && Array.isArray(rows[0])) return rows[0];
          if (Array.isArray(rows)) return rows;
          return [];
        };
        /* normalise createdAt: MySQL DATETIME has no timezone → append Z so client parses as UTC */
        const normDate = (v: any): string => {
          if (v instanceof Date) return v.toISOString();
          const s = String(v);
          if (s.includes('Z') || s.includes('+')) return s;
          return s.replace(' ', 'T') + 'Z';
        };
        const bidsArr = normalise(bidsRows);
        const commentsArr = normalise(commentsRows);
        const merged = [
          ...bidsArr.map((r: any) => {
            const isOwn = myUserId != null && Number(r.userId) === myUserId;
            const canSeeReal = isPrivilegedViewer || isOwn;
            return {
              type: 'bid' as const,
              id: Number(r.id),
              userId: Number(r.userId),
              userName: (r.userName as string) ?? '匿名用戶',
              /* realUserName only exposed to merchant/admin/own bid */
              realUserName: Boolean(r.isAnonymous) && canSeeReal ? (r.realUserName as string ?? null) : null,
              photoUrl: (r.photoUrl as string | null) ?? null,
              content: String(r.content ?? ''),
              rawAmount: r.rawAmount != null ? Number(r.rawAmount) : null,
              isAnonymous: Boolean(r.isAnonymous),
              /* isMyBid includes own anonymous bids */
              isMyBid: myUserId != null && Number(r.userId) === myUserId,
              replyToBidId: null as null,
              createdAt: normDate(r.createdAt),
            };
          }),
          ...commentsArr.map((r: any) => ({
            type: 'comment' as const,
            id: Number(r.id),
            userId: Number(r.userId),
            userName: (r.userName as string) ?? '用戶',
            photoUrl: (r.photoUrl as string | null) ?? null,
            content: String(r.content ?? ''),
            rawAmount: null as null,
            isAnonymous: false,
            isMyBid: false,
            replyToBidId: r.replyToBidId != null ? Number(r.replyToBidId) : null,
            createdAt: normDate(r.createdAt),
          })),
        ];
        merged.sort((a, b) => {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          if (ta !== tb) return input.sort === "new" ? tb - ta : ta - tb;
          /* Same-second tiebreak: higher id = later insertion = treat as newer */
          return input.sort === "new" ? b.id - a.id : a.id - b.id;
        });
        return { items: merged, totalBids: merged.length };
      }),

    postMerchantBroadcast: protectedProcedure
      .input(z.object({
        auctionId: z.number().int().positive(),
        content: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const aRows: any = await db.execute(sql.raw(`SELECT createdBy, title FROM auctions WHERE id = ${input.auctionId} LIMIT 1`));
        const auction = normaliseFirst(aRows);
        if (!auction) throw new TRPCError({ code: 'NOT_FOUND' });
        if (Number(auction.createdBy) !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有商戶可廣播訊息' });
        }
        await db.insert(auctionComments).values({ auctionId: input.auctionId, userId: ctx.user.id, content: input.content });
        const bidderRows: any = await db.execute(sql.raw(`SELECT DISTINCT userId FROM bids WHERE auctionId = ${input.auctionId} AND userId IS NOT NULL`));
        const bidders = normaliseArr(bidderRows);
        for (const row of bidders) {
          const uid = Number(row.userId);
          if (uid && uid !== ctx.user.id) {
            sendPushToUser(uid, {
              title: `📢 ${String(auction.title).slice(0, 40)}`,
              body: input.content.slice(0, 120),
              url: `/auctions/${input.auctionId}`,
            }).catch(() => {});
          }
        }
        return { success: true };
      }),

    merchantLikeBid: protectedProcedure
      .input(z.object({ bidId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const rows: any = await db.execute(sql.raw(`
          SELECT b.userId, b.bidAmount, b.auctionId, a.createdBy, a.title, a.id AS aId
          FROM bids b JOIN auctions a ON a.id = b.auctionId
          WHERE b.id = ${input.bidId} LIMIT 1
        `));
        const r = normaliseFirst(rows);
        if (!r) throw new TRPCError({ code: 'NOT_FOUND' });
        if (Number(r.createdBy) !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有商戶可執行此操作' });
        }
        if (r.userId) {
          await sendPushToUser(Number(r.userId), {
            title: `❤️ 多謝你的出價 HK$${Number(r.bidAmount).toLocaleString()} 有效`,
            body: String(r.title),
            url: `/auctions/${r.aId}`,
          });
        }
        return { success: true };
      }),

    merchantReplyBid: protectedProcedure
      .input(z.object({
        bidId: z.number().int().positive(),
        content: z.string().min(1).max(500),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const rows: any = await db.execute(sql.raw(`
          SELECT b.userId, b.bidAmount, b.auctionId, a.createdBy, a.title, a.id AS aId
          FROM bids b JOIN auctions a ON a.id = b.auctionId
          WHERE b.id = ${input.bidId} LIMIT 1
        `));
        const r = normaliseFirst(rows);
        if (!r) throw new TRPCError({ code: 'NOT_FOUND' });
        if (Number(r.createdBy) !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只有商戶可執行此操作' });
        }
        await db.insert(auctionComments).values({
          auctionId: Number(r.auctionId),
          userId: ctx.user.id,
          content: input.content,
          replyToBidId: input.bidId,
        });
        if (r.userId) {
          await sendPushToUser(Number(r.userId), {
            title: `💬 商戶回覆咗你`,
            body: `${String(r.title).slice(0, 40)}：${input.content.slice(0, 80)}`,
            url: `/auctions/${r.aId}`,
          });
        }
        return { success: true };
      }),
  }),

  // ─── 團購拍賣（Group Auction）────────────────────────────────────────────────
  groupAuctions: router({

    /** 工具函數：確認係 approved 商戶 */

    // ── Column Templates ────────────────────────────────────────────────────

    /** 商戶：列出自己所有欄位模板 */
    listTemplates: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只限商戶會員' });
      }
      const db = await getDb();
      const { desc } = await import('drizzle-orm');
      return db.select().from(groupAuctionColumnTemplates)
        .where(eq(groupAuctionColumnTemplates.merchantUserId, ctx.user.id))
        .orderBy(desc(groupAuctionColumnTemplates.createdAt));
    }),

    /** 商戶：儲存欄位模板 */
    saveTemplate: protectedProcedure
      .input(z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(1).max(100),
        columnsJson: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只限商戶會員' });
        }
        const db = await getDb();
        if (input.id) {
          const [existing] = await db.select().from(groupAuctionColumnTemplates)
            .where(eq(groupAuctionColumnTemplates.id, input.id)).limit(1);
          if (!existing || existing.merchantUserId !== ctx.user.id) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Template 不存在' });
          }
          await db.update(groupAuctionColumnTemplates)
            .set({ name: input.name, columnsJson: input.columnsJson })
            .where(eq(groupAuctionColumnTemplates.id, input.id));
          return { id: input.id };
        } else {
          const [result] = await db.insert(groupAuctionColumnTemplates).values({
            merchantUserId: ctx.user.id,
            name: input.name,
            columnsJson: input.columnsJson,
          });
          return { id: (result as any).insertId as number };
        }
      }),

    /** 商戶：刪除欄位模板 */
    deleteTemplate: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [existing] = await db.select().from(groupAuctionColumnTemplates)
          .where(eq(groupAuctionColumnTemplates.id, input.id)).limit(1);
        if (!existing || existing.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Template 不存在' });
        }
        await db.delete(groupAuctionColumnTemplates)
          .where(eq(groupAuctionColumnTemplates.id, input.id));
        return { success: true };
      }),

    // ── Rounds (場次) ────────────────────────────────────────────────────────

    /** 商戶：列出自己所有場次 */
    myListRounds: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只限商戶會員' });
      }
      const db = await getDb();
      const { desc } = await import('drizzle-orm');
      return db.select().from(groupAuctionRounds)
        .where(eq(groupAuctionRounds.merchantUserId, ctx.user.id))
        .orderBy(desc(groupAuctionRounds.createdAt));
    }),

    /** 商戶：取得單一場次詳情（含商品 + 圖片集） */
    getMine: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const { asc } = await import('drizzle-orm');
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        const items = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.roundId, input.id))
          .orderBy(asc(groupAuctionItems.displayOrder), asc(groupAuctionItems.id));
        const images = await db.select().from(groupAuctionImages)
          .where(eq(groupAuctionImages.roundId, input.id))
          .orderBy(asc(groupAuctionImages.displayOrder), asc(groupAuctionImages.id));
        // 每件商品加入出價計數
        const itemsWithBidCount = await Promise.all(items.map(async (item) => {
          const rows = await db.select({ cnt: sql`COUNT(*)` }).from(groupAuctionBids)
            .where(eq(groupAuctionBids.itemId, item.id));
          return { ...item, bidCount: Number((rows[0] as any)?.cnt ?? 0) };
        }));
        // 加入得標買家姓名（winnerId → winnerName）
        const winnerIds = [...new Set(itemsWithBidCount.filter(i => i.winnerId).map(i => i.winnerId as number))];
        let winnerMap: Record<number, string> = {};
        if (winnerIds.length > 0) {
          const { users: usersTable } = await import('../drizzle/schema');
          const { inArray: inArr } = await import('drizzle-orm');
          const winners = await db.select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable).where(inArr(usersTable.id, winnerIds));
          winnerMap = Object.fromEntries(winners.map(w => [w.id, w.name ?? '']));
        }
        const itemsWithWinners = itemsWithBidCount.map(item => ({
          ...item,
          winnerName: item.winnerId ? (winnerMap[item.winnerId] ?? '') : null,
        }));
        return { round, items: itemsWithWinners, images };
      }),

    /** 商戶：建立新場次 */
    createRound: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(200),
        periodNumber: z.string().max(40).optional(),
        description: z.string().optional(),
        coverImage: z.string().optional(),
        startAt: z.string().optional(),
        endAt: z.string().optional(),
        defaultBidIncrement: z.number().int().min(1).default(50),
        buyerCommissionRate: z.number().min(0).max(1).default(0),
        antiSnipeMinutes: z.number().int().min(0).default(5),
        antiSnipeExtendMinutes: z.number().int().min(0).default(5),
        antiSnipeMode: z.enum(['none', 'per_item', 'whole_round']).default('per_item'),
        displayCurrencies: z.string().max(100).default('HKD,CNY'),
        minDurationMinutes: z.number().int().min(0).default(60),
        columnsJson: z.string().optional(),
        columnTemplateId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '只限商戶會員' });
        }
        // 驗證：開拍至結拍最短時間
        if (input.minDurationMinutes > 0 && input.startAt && input.endAt) {
          const diffMs = new Date(input.endAt).getTime() - new Date(input.startAt).getTime();
          if (diffMs < input.minDurationMinutes * 60 * 1000) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `結拍時間必須比開拍時間至少遲 ${input.minDurationMinutes} 分鐘` });
          }
        }
        const db = await getDb();
        const [result] = await db.insert(groupAuctionRounds).values({
          merchantUserId: ctx.user.id,
          title: input.title,
          periodNumber: input.periodNumber ?? null,
          description: input.description ?? null,
          coverImage: input.coverImage ?? null,
          startAt: input.startAt ? new Date(input.startAt) : null,
          endAt: input.endAt ? new Date(input.endAt) : null,
          defaultBidIncrement: input.defaultBidIncrement,
          buyerCommissionRate: String(input.buyerCommissionRate),
          antiSnipeMinutes: input.antiSnipeMinutes,
          antiSnipeExtendMinutes: input.antiSnipeExtendMinutes,
          antiSnipeMode: input.antiSnipeMode,
          displayCurrencies: input.displayCurrencies,
          minDurationMinutes: input.minDurationMinutes,
          columnsJson: input.columnsJson ?? null,
          columnTemplateId: input.columnTemplateId ?? null,
        });
        return { id: (result as any).insertId as number };
      }),

    /** 商戶：更新場次設定（draft 或 published 均可改，ended 不可） */
    updateRound: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
        periodNumber: z.string().max(40).optional(),
        description: z.string().optional(),
        coverImage: z.string().nullable().optional(),
        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),
        defaultBidIncrement: z.number().int().min(1).optional(),
        buyerCommissionRate: z.number().min(0).max(1).optional(),
        antiSnipeMinutes: z.number().int().min(0).optional(),
        antiSnipeExtendMinutes: z.number().int().min(0).optional(),
        antiSnipeMode: z.enum(['none', 'per_item', 'whole_round']).optional(),
        displayCurrencies: z.string().max(100).optional(),
        minDurationMinutes: z.number().int().min(0).optional(),
        columnsJson: z.string().optional(),
        columnTemplateId: z.number().int().positive().nullable().optional(),
        promoImagesJson: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        if (round.status === 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已結拍場次不可修改' });
        }
        // 驗證：開拍至結拍最短時間
        const effectiveMin = input.minDurationMinutes ?? ((round as any).minDurationMinutes ?? 60);
        if (effectiveMin > 0) {
          const effectiveStart = input.startAt !== undefined ? (input.startAt ? new Date(input.startAt) : null) : round.startAt;
          const effectiveEnd = input.endAt !== undefined ? (input.endAt ? new Date(input.endAt) : null) : round.endAt;
          if (effectiveStart && effectiveEnd) {
            const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
            if (diffMs < effectiveMin * 60 * 1000) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `結拍時間必須比開拍時間至少遲 ${effectiveMin} 分鐘` });
            }
          }
        }
        const patch: Record<string, any> = {};
        if (input.title !== undefined) patch.title = input.title;
        if (input.periodNumber !== undefined) patch.periodNumber = input.periodNumber;
        if (input.description !== undefined) patch.description = input.description;
        if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
        if (input.startAt !== undefined) patch.startAt = input.startAt ? new Date(input.startAt) : null;
        if (input.endAt !== undefined) patch.endAt = input.endAt ? new Date(input.endAt) : null;
        if (input.defaultBidIncrement !== undefined) patch.defaultBidIncrement = input.defaultBidIncrement;
        if (input.buyerCommissionRate !== undefined) patch.buyerCommissionRate = String(input.buyerCommissionRate);
        if (input.antiSnipeMinutes !== undefined) patch.antiSnipeMinutes = input.antiSnipeMinutes;
        if (input.antiSnipeExtendMinutes !== undefined) patch.antiSnipeExtendMinutes = input.antiSnipeExtendMinutes;
        if (input.antiSnipeMode !== undefined) patch.antiSnipeMode = input.antiSnipeMode;
        if (input.displayCurrencies !== undefined) patch.displayCurrencies = input.displayCurrencies;
        if (input.minDurationMinutes !== undefined) patch.minDurationMinutes = input.minDurationMinutes;
        if (input.columnsJson !== undefined) patch.columnsJson = input.columnsJson;
        if (input.columnTemplateId !== undefined) patch.columnTemplateId = input.columnTemplateId;
        if (input.promoImagesJson !== undefined) patch.promoImagesJson = input.promoImagesJson;
        await db.update(groupAuctionRounds).set(patch).where(eq(groupAuctionRounds.id, input.id));
        return { success: true };
      }),

    /** 商戶：發布場次（draft → published） */
    publishRound: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        if (round.status !== 'draft') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有 draft 場次可以發布' });
        }
        await db.update(groupAuctionRounds)
          .set({ status: 'published' })
          .where(eq(groupAuctionRounds.id, input.id));
        return { success: true };
      }),

    /** 商戶：手動結拍 */
    endRound: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        if (round.status === 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '場次已結拍' });
        }
        await db.update(groupAuctionRounds)
          .set({ status: 'ended' })
          .where(eq(groupAuctionRounds.id, input.id));
        // 所有仍 active 商品標為 unsold 或 sold（根據有否出價）
        const items = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.roundId, input.id));
        for (const item of items) {
          if (item.status === 'active') {
            if (item.winnerId) {
              await db.update(groupAuctionItems)
                .set({ status: 'sold' })
                .where(eq(groupAuctionItems.id, item.id));
            } else {
              await db.update(groupAuctionItems)
                .set({ status: 'unsold' })
                .where(eq(groupAuctionItems.id, item.id));
            }
          }
        }
        // 扣傭金（冪等，fire-and-forget）
        autoDeductGroupAuctionCommission(input.id).catch(err =>
          console.error('[endRound] commission deduction error:', err)
        );
        return { success: true };
      }),

    /** 商戶：刪除 draft 場次 */
    deleteRound: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        if (round.status === 'published') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已發布場次不可刪除，請先手動結拍' });
        }
        await db.delete(groupAuctionBids).where(eq(groupAuctionBids.roundId, input.id));
        await db.delete(groupAuctionItems).where(eq(groupAuctionItems.roundId, input.id));
        await db.delete(groupAuctionImages).where(eq(groupAuctionImages.roundId, input.id));
        await db.delete(groupAuctionRounds).where(eq(groupAuctionRounds.id, input.id));
        return { success: true };
      }),

    archiveRound: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        if (round.status !== 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已結拍場次可以封存' });
        }
        await db.update(groupAuctionRounds)
          .set({ isArchived: 1 })
          .where(eq(groupAuctionRounds.id, input.id));
        return { success: true };
      }),

    unarchiveRound: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.id)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        await db.update(groupAuctionRounds)
          .set({ isArchived: 0 })
          .where(eq(groupAuctionRounds.id, input.id));
        return { success: true };
      }),

    // ── Images ────────────────────────────────────────────────────────────────

    /** 商戶：取得圖片上載 presigned URL */
    getImageUploadUrl: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        filename: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        const ext = input.filename.split('.').pop()?.toLowerCase() || 'jpg';
        const key = `group-auction/${input.roundId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { uploadUrl, finalUrl: publicUrl } = await storageSignPut(key, input.mimeType);
        return { uploadUrl, publicUrl, s3Key: key };
      }),

    /** 商戶：記錄已上載圖片到 DB */
    recordImage: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        s3Key: z.string(),
        url: z.string(),
        displayOrder: z.number().int().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        const [result] = await db.insert(groupAuctionImages).values({
          roundId: input.roundId,
          s3Key: input.s3Key,
          url: input.url,
          displayOrder: input.displayOrder,
        });
        return { id: (result as any).insertId as number };
      }),

    /** 商戶：刪除場次圖片 */
    deleteImage: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [img] = await db.select().from(groupAuctionImages)
          .where(eq(groupAuctionImages.id, input.id)).limit(1);
        if (!img) throw new TRPCError({ code: 'NOT_FOUND', message: '圖片不存在' });
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, img.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        await db.delete(groupAuctionImages).where(eq(groupAuctionImages.id, input.id));
        return { success: true };
      }),

    /** 商戶：更新圖片排序 */
    reorderImages: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        orderedIds: z.array(z.number().int().positive()),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        for (let i = 0; i < input.orderedIds.length; i++) {
          await db.update(groupAuctionImages)
            .set({ displayOrder: i })
            .where(eq(groupAuctionImages.id, input.orderedIds[i]));
        }
        return { success: true };
      }),

    // ── Items ────────────────────────────────────────────────────────────────

    /** 商戶：批量 import 商品（CSV parse 後呼叫） */
    importItems: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        items: z.array(z.object({
          dataJson: z.string(),
          startPrice: z.number().int().min(0),
          bidIncrement: z.number().int().min(0).default(0),
          buyNowPrice: z.number().int().positive().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        if (round.status === 'ended') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '已結拍場次不可匯入商品' });
        }
        // 取得目前最大 displayOrder
        const existingItems = await db.select({ displayOrder: groupAuctionItems.displayOrder })
          .from(groupAuctionItems).where(eq(groupAuctionItems.roundId, input.roundId));
        const maxOrder = existingItems.length > 0
          ? Math.max(...existingItems.map(i => i.displayOrder))
          : -1;
        for (let i = 0; i < input.items.length; i++) {
          const item = input.items[i];
          await db.insert(groupAuctionItems).values({
            roundId: input.roundId,
            displayOrder: maxOrder + 1 + i,
            dataJson: item.dataJson,
            startPrice: item.startPrice,
            bidIncrement: item.bidIncrement,
            buyNowPrice: item.buyNowPrice ?? null,
          });
        }
        return { imported: input.items.length };
      }),

    /** 商戶：更新單件商品（有出價時不可改價格） */
    updateItem: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        dataJson: z.string().optional(),
        startPrice: z.number().int().min(0).optional(),
        bidIncrement: z.number().int().min(0).optional(),
        buyNowPrice: z.number().int().positive().nullable().optional(),
        imageIdsJson: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [item] = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.id, input.id)).limit(1);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在' });
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, item.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        // 查詢是否有出價記錄
        const bidRows = await db.select({ cnt: sql`COUNT(*)` }).from(groupAuctionBids)
          .where(eq(groupAuctionBids.itemId, input.id));
        const hasBids = Number((bidRows[0] as any)?.cnt ?? 0) > 0;
        if (hasBids && (input.startPrice !== undefined || input.buyNowPrice !== undefined)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此商品已有出價，不能修改起拍價或封頂價' });
        }
        const patch: Record<string, any> = {};
        if (input.dataJson !== undefined) patch.dataJson = input.dataJson;
        if (!hasBids && input.startPrice !== undefined) patch.startPrice = input.startPrice;
        if (input.bidIncrement !== undefined) patch.bidIncrement = input.bidIncrement;
        if (!hasBids && input.buyNowPrice !== undefined) patch.buyNowPrice = input.buyNowPrice;
        if (input.imageIdsJson !== undefined) patch.imageIdsJson = input.imageIdsJson;
        await db.update(groupAuctionItems).set(patch).where(eq(groupAuctionItems.id, input.id));
        return { success: true, hasBids };
      }),

    /** 商戶：刪除商品 */
    deleteItem: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [item] = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.id, input.id)).limit(1);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在' });
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, item.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        await db.delete(groupAuctionBids).where(eq(groupAuctionBids.itemId, input.id));
        await db.delete(groupAuctionItems).where(eq(groupAuctionItems.id, input.id));
        return { success: true };
      }),

    /** 商戶：批量刪除商品 */
    batchDeleteItems: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        ids: z.array(z.number().int().positive()).min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        for (const id of input.ids) {
          await db.delete(groupAuctionBids).where(eq(groupAuctionBids.itemId, id));
          await db.delete(groupAuctionItems).where(
            and(eq(groupAuctionItems.id, id), eq(groupAuctionItems.roundId, input.roundId))
          );
        }
        return { deleted: input.ids.length };
      }),

    /** 商戶：更新商品排序 */
    reorderItems: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        orderedIds: z.array(z.number().int().positive()),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.merchantUserId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        for (let i = 0; i < input.orderedIds.length; i++) {
          await db.update(groupAuctionItems)
            .set({ displayOrder: i })
            .where(eq(groupAuctionItems.id, input.orderedIds[i]));
        }
        return { success: true };
      }),

    /** 商戶：將場次所有商品的每口加價重設為 0（改用場次預設值） */
    resetItemBidIncrements: protectedProcedure
      .input(z.object({ roundId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        await db.update(groupAuctionItems)
          .set({ bidIncrement: 0 })
          .where(eq(groupAuctionItems.roundId, input.roundId));
        return { success: true };
      }),

    /** 商戶：結拍後匯出結果（兩種格式） */
    exportResults: protectedProcedure
      .input(z.object({
        roundId: z.number().int().positive(),
        format: z.enum(['by_order', 'by_buyer']).default('by_order'),
        buyerId: z.number().int().positive().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const { asc } = await import('drizzle-orm');
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }
        const items = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.roundId, input.roundId))
          .orderBy(asc(groupAuctionItems.displayOrder));
        // 拉買家名字
        const winnerIds = [...new Set(items.filter(i => i.winnerId).map(i => i.winnerId as number))];
        let winnerMap: Record<number, string> = {};
        if (winnerIds.length > 0) {
          const { users } = await import('../drizzle/schema');
          const { inArray } = await import('drizzle-orm');
          const winners = await db.select({ id: users.id, name: users.name })
            .from(users).where(inArray(users.id, winnerIds));
          winnerMap = Object.fromEntries(winners.map(w => [w.id, w.name ?? '']));
        }
        const commRate = parseFloat(String(round.buyerCommissionRate));
        const rows = items.map((item, idx) => {
          const data = (() => { try { return JSON.parse(item.dataJson); } catch { return {}; } })();
          const finalPrice = item.finalPrice ?? 0;
          const commission = Math.ceil(finalPrice * commRate);
          const total = finalPrice + commission;
          const buyerName = item.winnerId ? (winnerMap[item.winnerId] ?? '') : '';
          return {
            order: idx + 1,
            ...data,
            startPrice: item.startPrice,
            finalPrice: item.status === 'sold' ? finalPrice : null,
            commissionRate: commRate > 0 ? `${(commRate * 100).toFixed(1)}%` : '',
            commission: commRate > 0 && item.status === 'sold' ? commission : null,
            total: commRate > 0 && item.status === 'sold' ? total : (item.status === 'sold' ? finalPrice : null),
            buyerName,
            status: item.status === 'sold' ? '已成交' : item.status === 'unsold' ? '流拍' : '進行中',
          };
        });
        if (input.format === 'by_buyer') {
          rows.sort((a, b) => (a.buyerName || 'zzz').localeCompare(b.buyerName || 'zzz'));
        }
        const filteredRows = input.buyerId
          ? rows.filter((_, idx) => items[idx]?.winnerId === input.buyerId)
          : rows;
        return { round, rows: filteredRows, columnsJson: round.columnsJson };
      }),

    // ── Public ────────────────────────────────────────────────────────────────

    /** 公開：拍賣主頁 Live Banner — 所有 published 且未過期嘅場次 + stats */
    getActiveLiveRounds: publicProcedure.query(async () => {
      const db = await getDb();
      const rawRows: any = await db.execute(sql`
        SELECT
          r.id, r.title, r.periodNumber, r.endAt, r.coverImage, r.promoImagesJson,
          r.merchantUserId, r.status,
          COUNT(i.id)                                                    AS totalItems,
          SUM(CASE WHEN i.status = 'sold'   THEN 1 ELSE 0 END)          AS soldItems,
          SUM(CASE WHEN i.status = 'active' THEN 1 ELSE 0 END)          AS activeItems
        FROM groupAuctionRounds r
        LEFT JOIN groupAuctionItems i ON i.roundId = r.id
        WHERE r.status = 'published'
          AND (r.endAt IS NULL OR r.endAt > NOW())
        GROUP BY r.id
        ORDER BY r.createdAt DESC
      `);
      const rows = (Array.isArray(rawRows) ? rawRows[0] : rawRows) as any[];
      return rows.map((r: any) => ({
        id:             Number(r.id),
        title:          String(r.title),
        periodNumber:   r.periodNumber  ? String(r.periodNumber)  : null,
        endAt:          r.endAt         ? new Date(r.endAt).toISOString() : null,
        coverImage:     r.coverImage    ? String(r.coverImage)    : null,
        promoImages:    (() => { try { return JSON.parse(r.promoImagesJson ?? "[]"); } catch { return []; } })(),
        merchantUserId: Number(r.merchantUserId),
        totalItems:     Number(r.totalItems  ?? 0),
        soldItems:      Number(r.soldItems   ?? 0),
        activeItems:    Number(r.activeItems ?? 0),
      }));
    }),

    /** 公開：列出某商戶進行中（published）的場次 */
    listPublicRoundsByMerchant: publicProcedure
      .input(z.object({ merchantUserId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { desc } = await import('drizzle-orm');
        return db.select({
          id: groupAuctionRounds.id,
          title: groupAuctionRounds.title,
          periodNumber: groupAuctionRounds.periodNumber,
          endAt: groupAuctionRounds.endAt,
          status: groupAuctionRounds.status,
        })
          .from(groupAuctionRounds)
          .where(and(
            eq(groupAuctionRounds.merchantUserId, input.merchantUserId),
            eq(groupAuctionRounds.status, 'published'),
          ))
          .orderBy(desc(groupAuctionRounds.createdAt));
      }),

    /** 公開：取得場次詳情 + 商品 + 每件最高出價 */
    getRound: publicProcedure
      .input(z.object({ roundId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        const { asc, desc } = await import('drizzle-orm');
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId)).limit(1);
        if (!round || round.status === 'draft') {
          throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在或未發布' });
        }
        const items = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.roundId, input.roundId))
          .orderBy(asc(groupAuctionItems.displayOrder), asc(groupAuctionItems.id));
        const images = await db.select().from(groupAuctionImages)
          .where(eq(groupAuctionImages.roundId, input.roundId))
          .orderBy(asc(groupAuctionImages.displayOrder));
        // 批量拉所有商品出價（一次 query，避免 N+1）
        if (items.length === 0) return { round, items: [], images };
        const { inArray } = await import('drizzle-orm');
        const itemIds = items.map(i => i.id);

        const allBids = await db.select().from(groupAuctionBids)
          .where(inArray(groupAuctionBids.itemId, itemIds))
          .orderBy(desc(groupAuctionBids.amount), desc(groupAuctionBids.id));

        const topBidByItem = new Map<number, typeof allBids[0]>();
        const bidCountByItem = new Map<number, number>();
        for (const bid of allBids) {
          if (!topBidByItem.has(bid.itemId)) topBidByItem.set(bid.itemId, bid);
          bidCountByItem.set(bid.itemId, (bidCountByItem.get(bid.itemId) ?? 0) + 1);
        }

        const { users } = await import('../drizzle/schema');
        const bidderUserIds = [...new Set([...topBidByItem.values()].map(b => b.userId))];
        const bidderNameById = new Map<number, string>();
        if (bidderUserIds.length > 0) {
          const bidderRows = await db.select({ id: users.id, name: users.name })
            .from(users).where(inArray(users.id, bidderUserIds));
          for (const row of bidderRows) bidderNameById.set(row.id, row.name ?? '');
        }

        const itemsWithBids = items.map(item => {
          const topBid = topBidByItem.get(item.id);
          return {
            ...item,
            currentPrice: topBid?.amount ?? item.startPrice,
            topBidderId: topBid?.userId ?? null,
            topBidderName: topBid ? (bidderNameById.get(topBid.userId) ?? null) : null,
            bidCount: bidCountByItem.get(item.id) ?? 0,
          };
        });
        return { round, items: itemsWithBids, images };
      }),

    /** 公開（需登入）：出價 */
    placeBid: protectedProcedure
      .input(z.object({
        itemId: z.number().int().positive(),
        amount: z.number().int().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        const { desc } = await import('drizzle-orm');
        const [item] = await db.select().from(groupAuctionItems)
          .where(eq(groupAuctionItems.id, input.itemId)).limit(1);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在' });
        if (item.status !== 'active') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此商品已結拍' });
        }
        const [round] = await db.select().from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, item.roundId)).limit(1);
        if (!round || round.status !== 'published') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '場次未開拍或已結拍' });
        }
        if (round.startAt && new Date() < new Date(round.startAt)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '場次尚未開拍' });
        }
        // 商戶不可為自己的場次出價
        if (round.merchantUserId === ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '商戶不可為自己的場次出價' });
        }
        // 結拍時間檢查（per item endAt 優先，否則用場次 endAt）
        const endAt = item.endAt ?? round.endAt;
        if (endAt && new Date() > new Date(endAt)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '此商品已截止出價' });
        }
        // 最高出價
        const [topBid] = await db.select().from(groupAuctionBids)
          .where(eq(groupAuctionBids.itemId, input.itemId))
          .orderBy(desc(groupAuctionBids.amount), desc(groupAuctionBids.id))
          .limit(1);
        const currentPrice = topBid?.amount ?? item.startPrice;
        const effectiveIncrement = item.bidIncrement > 0 ? item.bidIncrement : round.defaultBidIncrement;
        // startPrice=0 時第一口必須至少 effectiveIncrement（避免出價 0）
        const firstBidMin = item.startPrice > 0 ? item.startPrice : effectiveIncrement;
        const minBid = topBid ? currentPrice + effectiveIncrement : firstBidMin;
        if (input.amount < minBid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `出價最少 $${minBid}（目前 $${currentPrice} + 每口 $${effectiveIncrement}）`,
          });
        }
        // 封頂價：直接得標
        const isBuyNow = item.buyNowPrice != null && input.amount >= item.buyNowPrice;
        const finalAmount = isBuyNow ? item.buyNowPrice! : input.amount;
        // 寫出價記錄
        await db.insert(groupAuctionBids).values({
          itemId: input.itemId,
          roundId: item.roundId,
          userId: ctx.user.id,
          amount: finalAmount,
        });
        // 更新商品快取
        const itemPatch: Record<string, any> = {
          finalPrice: finalAmount,
          winnerId: ctx.user.id,
        };
        if (isBuyNow) {
          itemPatch.status = 'sold';
        }
        await db.update(groupAuctionItems).set(itemPatch).where(eq(groupAuctionItems.id, input.itemId));
        // Anti-snipe：whole_round 模式，延長場次 endAt
        if (!isBuyNow && round.antiSnipeMode === 'whole_round' && round.endAt && round.antiSnipeMinutes > 0) {
          const endMs = new Date(round.endAt).getTime();
          const nowMs = Date.now();
          const bufferMs = round.antiSnipeMinutes * 60 * 1000;
          if (endMs - nowMs < bufferMs) {
            const newEnd = new Date(nowMs + round.antiSnipeExtendMinutes * 60 * 1000);
            await db.update(groupAuctionRounds)
              .set({ endAt: newEnd })
              .where(eq(groupAuctionRounds.id, round.id));
          }
        }
        // Anti-snipe：per_item 模式，延長此商品 endAt
        if (!isBuyNow && round.antiSnipeMode === 'per_item' && round.antiSnipeMinutes > 0) {
          const itemEndAt = item.endAt ?? round.endAt;
          if (itemEndAt) {
            const endMs = new Date(itemEndAt).getTime();
            const nowMs = Date.now();
            const bufferMs = round.antiSnipeMinutes * 60 * 1000;
            if (endMs - nowMs < bufferMs) {
              const newEnd = new Date(nowMs + round.antiSnipeExtendMinutes * 60 * 1000);
              await db.update(groupAuctionItems)
                .set({ endAt: newEnd })
                .where(eq(groupAuctionItems.id, input.itemId));
            }
          }
        }
        return { success: true, isBuyNow, finalAmount };
      }),

    /** 商戶：查看場次傭金匯報（只限本人或 admin） */
    getBuyerCommissionSummary: protectedProcedure
      .input(z.object({ roundId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db
          .select({
            id: groupAuctionRounds.id,
            title: groupAuctionRounds.title,
            periodNumber: groupAuctionRounds.periodNumber,
            endAt: groupAuctionRounds.endAt,
            buyerCommissionRate: groupAuctionRounds.buyerCommissionRate,
            merchantUserId: groupAuctionRounds.merchantUserId,
            columnsJson: groupAuctionRounds.columnsJson,
          })
          .from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId))
          .limit(1);

        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }

        const items = await db
          .select({
            id: groupAuctionItems.id,
            displayOrder: groupAuctionItems.displayOrder,
            dataJson: groupAuctionItems.dataJson,
            finalPrice: groupAuctionItems.finalPrice,
            status: groupAuctionItems.status,
          })
          .from(groupAuctionItems)
          .where(
            and(
              eq(groupAuctionItems.roundId, input.roundId),
              eq(groupAuctionItems.status, 'sold')
            )
          )
          .orderBy(groupAuctionItems.displayOrder);

        const rate = parseFloat(String(round.buyerCommissionRate));

        let titleKey = '';
        try {
          const cols: any[] = JSON.parse(round.columnsJson ?? '[]');
          const titleCol = cols.find((c: any) => c.role === 'itemTitle');
          if (titleCol) titleKey = titleCol.key;
        } catch {}

        const soldItems = items.map((item) => {
          let name = `#${item.displayOrder + 1}`;
          try {
            const data: Record<string, unknown> = JSON.parse(item.dataJson ?? '{}');
            if (titleKey && data[titleKey]) {
              name = String(data[titleKey]);
            } else {
              const firstStr = Object.values(data).find(v => typeof v === 'string' && (v as string).trim());
              if (firstStr) name = String(firstStr);
            }
          } catch {}
          const finalPrice = item.finalPrice ?? 0;
          const commission = parseFloat((finalPrice * rate).toFixed(2));
          return { id: item.id, order: item.displayOrder + 1, name, finalPrice, commission };
        });

        const totalSales = soldItems.reduce((s, i) => s + i.finalPrice, 0);
        const totalCommission = parseFloat(soldItems.reduce((s, i) => s + i.commission, 0).toFixed(2));

        return {
          round: {
            id: round.id,
            title: round.title,
            periodNumber: round.periodNumber,
            endAt: round.endAt,
            commissionRate: rate,
          },
          soldItems,
          totalSales,
          totalCommission,
          soldCount: soldItems.length,
        };
      }),

    getPlatformCommissionSummary: protectedProcedure
      .input(z.object({ roundId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await getDb();
        const [round] = await db
          .select({
            id: groupAuctionRounds.id,
            title: groupAuctionRounds.title,
            periodNumber: groupAuctionRounds.periodNumber,
            endAt: groupAuctionRounds.endAt,
            merchantUserId: groupAuctionRounds.merchantUserId,
            columnsJson: groupAuctionRounds.columnsJson,
          })
          .from(groupAuctionRounds)
          .where(eq(groupAuctionRounds.id, input.roundId))
          .limit(1);

        if (!round) throw new TRPCError({ code: 'NOT_FOUND', message: '場次不存在' });
        if (round.merchantUserId !== ctx.user.id && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '不是你的場次' });
        }

        // 取平台傭金率（商戶保證金入面嘅 commissionRate）
        const deposit = await getOrCreateSellerDeposit(round.merchantUserId);
        const rate = deposit ? parseFloat(String(deposit.commissionRate)) : 0;

        const items = await db
          .select({
            id: groupAuctionItems.id,
            displayOrder: groupAuctionItems.displayOrder,
            dataJson: groupAuctionItems.dataJson,
            finalPrice: groupAuctionItems.finalPrice,
            status: groupAuctionItems.status,
          })
          .from(groupAuctionItems)
          .where(
            and(
              eq(groupAuctionItems.roundId, input.roundId),
              eq(groupAuctionItems.status, 'sold')
            )
          )
          .orderBy(groupAuctionItems.displayOrder);

        let titleKey = '';
        try {
          const cols: any[] = JSON.parse(round.columnsJson ?? '[]');
          const titleCol = cols.find((c: any) => c.role === 'itemTitle');
          if (titleCol) titleKey = titleCol.key;
        } catch {}

        const soldItems = items.map((item) => {
          let name = `#${item.displayOrder + 1}`;
          try {
            const data: Record<string, unknown> = JSON.parse(item.dataJson ?? '{}');
            if (titleKey && data[titleKey]) {
              name = String(data[titleKey]);
            } else {
              const firstStr = Object.values(data).find(v => typeof v === 'string' && (v as string).trim());
              if (firstStr) name = String(firstStr);
            }
          } catch {}
          const finalPrice = item.finalPrice ?? 0;
          const commission = parseFloat((finalPrice * rate).toFixed(2));
          return { id: item.id, order: item.displayOrder + 1, name, finalPrice, commission };
        });

        const totalSales = soldItems.reduce((s, i) => s + i.finalPrice, 0);
        const totalCommission = parseFloat(soldItems.reduce((s, i) => s + i.commission, 0).toFixed(2));

        return {
          round: {
            id: round.id,
            title: round.title,
            periodNumber: round.periodNumber,
            endAt: round.endAt,
            commissionRate: rate,
          },
          soldItems,
          totalSales,
          totalCommission,
          soldCount: soldItems.length,
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;

function normaliseArr(rows: any): any[] {
  if (Array.isArray(rows) && Array.isArray(rows[0])) return rows[0];
  if (Array.isArray(rows)) return rows;
  return [];
}
function normaliseFirst(rows: any): any | null {
  const arr = normaliseArr(rows);
  return arr[0] ?? null;
}

// ─── 藏品社區 AI 助手 helpers ─────────────────────────────────────────
async function getDbThemes(db: any): Promise<Array<{ id: string; label: string; hint: string; sortOrder: number; isSystem: boolean }>> {
  const rows: any = await db.execute(sql`SELECT id, label, hint, sortOrder, isSystem FROM communitySeederThemes ORDER BY sortOrder ASC, id ASC`);
  const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
  return list.map((r: any) => ({
    id: String(r.id),
    label: String(r.label),
    hint: String(r.hint),
    sortOrder: Number(r.sortOrder ?? 0),
    isSystem: Number(r.isSystem ?? 0) === 1,
  }));
}
async function getDbTheme(db: any, id: string): Promise<{ id: string; label: string; hint: string } | null> {
  const rows: any = await db.execute(sql`SELECT id, label, hint FROM communitySeederThemes WHERE id = ${id} LIMIT 1`);
  const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
  if (!list || list.length === 0) return null;
  return { id: String(list[0].id), label: String(list[0].label), hint: String(list[0].hint) };
}

async function getDefaultShopOwnerUserId(db: any): Promise<number | null> {
  const openId = ENV.ownerOpenId;
  if (!openId) return null;
  const rows: any = await db.execute(sql`SELECT id FROM users WHERE openId = ${openId} LIMIT 1`);
  const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
  if (!list || list.length === 0) return null;
  return Number(list[0].id);
}

async function assertEligibleAuthor(db: any, userId: number): Promise<void> {
  const rows: any = await db.execute(sql`
    SELECT u.id FROM users u
    WHERE u.id = ${userId}
      AND (u.role = 'admin' OR EXISTS (SELECT 1 FROM merchantApplications ma WHERE ma.userId = u.id AND ma.status = 'approved'))
    LIMIT 1
  `);
  const list = Array.isArray(rows) ? (rows[0] as any[]) : [];
  if (!list || list.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '指定嘅作者唔係 admin 或已批核商戶' });
  }
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

async function fetchAndMirrorCommunityImages(query: string, targetCount = 2): Promise<string[]> {
  const seen = new Set<string>();
  const candidates: Array<{ url: string; mime: string }> = [];
  try {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query + " filetype:bitmap")}&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=900&origin=*`;
    const r = await fetch(apiUrl, { headers: { "User-Agent": "hongxcollections/1.0 (https://hongxcollections.com)" } });
    if (r.ok) {
      const j: any = await r.json();
      const pages = j?.query?.pages;
      if (pages) for (const k of Object.keys(pages)) {
        const ii = pages[k]?.imageinfo?.[0];
        if (!ii) continue;
        const mime = String(ii.mime || "").toLowerCase();
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) continue;
        const url = ii.thumburl || ii.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        candidates.push({ url, mime });
      }
    }
  } catch {}
  const safeStem = query.replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 40);
  const results = await Promise.all(candidates.slice(0, targetCount * 2).map(async (c, idx) => {
    try {
      const imgResp = await fetch(c.url, { headers: { "User-Agent": "hongxcollections/1.0 (https://hongxcollections.com)" } });
      if (!imgResp.ok) return null;
      const ct = (imgResp.headers.get("content-type") || c.mime).split(";")[0].trim().toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(ct)) return null;
      const ab = await imgResp.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length < 5_000 || buf.length > 5_000_000) return null;
      const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
      const key = `community-seeder/ai-${Date.now()}-${idx}-${safeStem}.${ext}`;
      const { url } = await storagePut(key, buf, ct);
      return url;
    } catch { return null; }
  }));
  return results.filter((u): u is string => !!u).slice(0, targetCount);
}

// ─── 從外部 URL 抓 article + 圖 + 視頻（畀 admin 一鍵轉藏品社區草稿用）────────
// SSRF guard：只准 http/https + 公網 IP，blocked private/loopback/link-local
function isPrivateIp(ip: string): boolean {
  // IPv4
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [parseInt(v4[1]), parseInt(v4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6 (粗略 — block ::1, fc00::/7, fe80::/10, ::ffff:private)
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  return false;
}

async function assertPublicHost(urlStr: string): Promise<void> {
  let u: URL;
  try { u = new URL(urlStr); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "無效 URL" }); }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "只支援 http / https" });
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  // 直接 IP literal 即時檢查
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new TRPCError({ code: "BAD_REQUEST", message: "唔可以抓取內部地址" });
    return;
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "唔可以抓取內部地址" });
  }
  // DNS resolve
  try {
    const dns = await import("node:dns/promises");
    const addrs = await dns.lookup(host, { all: true });
    for (const a of addrs) {
      if (isPrivateIp(a.address)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "目標域名指向內部 IP，已拒絕" });
      }
    }
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    throw new TRPCError({ code: "BAD_REQUEST", message: "無法解析域名" });
  }
}

async function fetchWithLimit(url: string, opts: { timeoutMs: number; maxBytes: number; accept?: string }): Promise<{ buf: Buffer; contentType: string; status: number }> {
  await assertPublicHost(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    const r = await fetch(url, {
      headers: {
        // 用真實瀏覽器 UA — 部分新聞 site (Yahoo / 蘋果等) 會 block 包含 "bot" 嘅 UA
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": opts.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-HK,zh;q=0.9,zh-TW;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const contentType = (r.headers.get("content-type") || "").toLowerCase();
    const cl = r.headers.get("content-length");
    if (cl && Number(cl) > opts.maxBytes) {
      throw new Error(`回應太大 (${cl} bytes)`);
    }
    const reader = r.body?.getReader();
    if (!reader) {
      const ab = await r.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > opts.maxBytes) throw new Error("回應太大");
      return { buf, contentType, status: r.status };
    }
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new Error("回應太大");
      }
      chunks.push(Buffer.from(value));
    }
    return { buf: Buffer.concat(chunks), contentType, status: r.status };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAndExtractFromUrl(targetUrl: string): Promise<{
  title: string;
  body: string;
  tags: string[];
  images: string[];
  videos: string[];
  author: string;
}> {
  // 優先：Jina Reader (r.jina.ai) — 專為 LLM 抓 web 嘅 service，繞過 Yahoo / Cloudflare 之類 datacenter IP block
  // 失敗才 fallback 直接 fetch HTML
  try {
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    let jinaResp: Response;
    try {
      jinaResp = await fetch(jinaUrl, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "hongxcollections/1.0",
          "X-Return-Format": "markdown",
        },
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
    if (jinaResp.ok) {
      const j: any = await jinaResp.json();
      if (j?.data) {
        const d = j.data;
        const title = String(d.title || "").trim().slice(0, 250);
        const description = String(d.description || "").trim();
        const content = String(d.content || "");
        // 抽 author：Jina 有時 publish d.author，亦可能喺 metadata / publishedTime 附近
        let author = "";
        const candAuthor = (d.author || d.byline || d?.metadata?.author || d?.metadata?.byline || "");
        if (typeof candAuthor === "string") author = candAuthor.trim().slice(0, 80);
        if (!author && content) {
          // markdown 常見格式：「作者：XXX」「By XXX」「文/XXX」
          const am = content.match(/(?:^|\n)\s*(?:作者|撰文|文)\s*[：:\/]\s*([^\n]+)/);
          if (am) author = am[1].trim().slice(0, 80);
          if (!author) {
            const bm = content.match(/(?:^|\n)\s*By\s+([A-Za-z][A-Za-z0-9 .'\-]{1,60})/);
            if (bm) author = bm[1].trim().slice(0, 80);
          }
        }
        // 從 markdown content 抽 image URLs `![alt](url)` + d.images object
        const imgs = new Set<string>();
        const mdImg = /!\[[^\]]*\]\(([^)\s]+)/g;
        let m: RegExpExecArray | null;
        while ((m = mdImg.exec(content)) !== null) {
          const u = m[1];
          if (/^https?:\/\//i.test(u) && !/\.svg(\?|#|$)/i.test(u) && !/\.gif(\?|#|$)/i.test(u)) {
            imgs.add(u);
          }
        }
        if (d.images && typeof d.images === "object") {
          for (const v of Object.values(d.images)) {
            if (typeof v === "string" && /^https?:\/\//i.test(v) && !/\.svg(\?|#|$)/i.test(v)) imgs.add(v);
          }
        }
        // Video URLs (YouTube/Vimeo/Bilibili) from links + content
        const vids = new Set<string>();
        const vidRe = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?[^\s)]+|youtu\.be\/[\w-]+|vimeo\.com\/\d+|bilibili\.com\/video\/[\w-]+)/gi;
        let vm: RegExpExecArray | null;
        while ((vm = vidRe.exec(content)) !== null) vids.add(vm[0]);
        if (d.links && typeof d.links === "object") {
          for (const v of Object.values(d.links)) {
            if (typeof v === "string" && /(?:youtube\.com|youtu\.be|vimeo\.com|bilibili\.com)/i.test(v)) vids.add(v);
          }
        }
        // 清理 markdown body：去 image / link syntax，留純文字
        const cleanBody = (description ? description + "\n\n" : "") + content
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "")               // images
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")             // [text](url) → text
          .replace(/^[*\-+]\s+/gm, "")                         // list markers
          .replace(/^#{1,6}\s+/gm, "")                         // headings
          .replace(/`{1,3}[^`]*`{1,3}/g, "")                   // code
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        // 圖片 mirror 落 S3（最多 6 張）
        const candidates = Array.from(imgs).slice(0, 12);
        const safeStem = (() => { try { return new URL(targetUrl).hostname.replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 40); } catch { return "url"; } })();
        const mirrored = await Promise.all(candidates.map(async (u, idx) => {
          try {
            const { buf, contentType } = await fetchWithLimit(u, { timeoutMs: 12_000, maxBytes: 8_000_000 });
            const ct = contentType.split(";")[0].trim().toLowerCase();
            if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(ct)) return null;
            if (buf.length < 5_000) return null;
            const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
            const key = `community-seeder/url-${Date.now()}-${idx}-${safeStem}.${ext}`;
            const ctNorm = ct === "image/jpg" ? "image/jpeg" : ct;
            const { url } = await storagePut(key, buf, ctNorm);
            return url;
          } catch { return null; }
        }));
        const images = mirrored.filter((u): u is string => !!u).slice(0, 6);

        if (title || cleanBody) {
          return {
            title,
            body: cleanBody.slice(0, 4900),
            tags: [],
            images,
            videos: Array.from(vids).slice(0, 5),
            author,
          };
        }
      }
    }
    // 如 Jina 返 non-200 或冇 data，落 fallback
  } catch {
    // Jina 失敗（timeout / network），落 fallback
  }

  let html = "";
  const fetchErrors: string[] = [];

  // Fallback 2：Wayback Machine — 適用於 Yahoo HK 之類連 Jina 都被 451 嘅 site
  // 用 `id_` flag 攞 raw cached HTML（冇 wayback toolbar）
  try {
    const wbUrl = `https://web.archive.org/web/2id_/${targetUrl}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let wbResp: Response;
    try {
      wbResp = await fetch(wbUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
        redirect: "follow",
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
    if (wbResp.ok) {
      const ct = (wbResp.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("html") || ct.includes("xml") || ct === "") {
        const ab = await wbResp.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length > 1000) html = buf.toString("utf8");
      } else {
        fetchErrors.push(`Wayback non-HTML (${ct})`);
      }
    } else {
      fetchErrors.push(`Wayback HTTP ${wbResp.status}`);
    }
  } catch (e: any) {
    fetchErrors.push(`Wayback: ${e?.message || String(e)}`);
  }

  // Fallback 3：直接抓 — Wayback 都 fail 先嚟（多數係新文章未被 archive，或 article 太新）
  if (!html) {
    try {
      const { buf, contentType, status } = await fetchWithLimit(targetUrl, {
        timeoutMs: 15_000, maxBytes: 5_000_000, accept: "text/html,application/xhtml+xml",
      });
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
      if (!contentType.includes("html") && !contentType.includes("xml")) throw new Error(`Not HTML (${contentType})`);
      html = buf.toString("utf8");
    } catch (e: any) {
      if (e instanceof TRPCError) throw e;
      fetchErrors.push(`直接抓: ${e?.message || String(e)}`);
    }
  }

  if (!html) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `抓取失敗（Jina Reader / Wayback / 直接抓 都唔得）：${fetchErrors.join(" | ")}`,
    });
  }

  const base = (() => { try { return new URL(targetUrl); } catch { return null; } })();
  const resolveUrl = (u: string): string | null => {
    if (!u) return null;
    try { return new URL(u, base ?? undefined).toString(); } catch { return null; }
  };
  const decodeEntities = (s: string) => s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  const metaContent = (re: RegExp): string => {
    const m = html.match(re);
    return m ? decodeEntities(m[1]).trim() : "";
  };

  // ── Title
  let title = metaContent(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)
           || metaContent(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i)
           || metaContent(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i)
           || metaContent(/<title[^>]*>([\s\S]*?)<\/title>/i);
  title = title.replace(/\s+/g, " ").slice(0, 250);

  // ── Body：優先 og:description / description；再嘗試 <article> / <main> / 第一段 <p>
  let body = metaContent(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i)
          || metaContent(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
          || metaContent(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i)
          || "";

  const stripTags = (s: string) => decodeEntities(
    s.replace(/<script[\s\S]*?<\/script>/gi, "")
     .replace(/<style[\s\S]*?<\/style>/gi, "")
     .replace(/<[^>]+>/g, " ")
     .replace(/\s+/g, " ")
  ).trim();

  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i)
                    || html.match(/<main[\s\S]*?<\/main>/i)
                    || html.match(/<div[^>]+(?:class|id)=["'][^"']*(?:article|content|post|entry)[^"']*["'][\s\S]*?<\/div>/i);
  if (articleMatch) {
    const articleText = stripTags(articleMatch[0]);
    if (articleText.length > body.length) body = articleText;
  }
  body = body.replace(/\s+/g, " ").slice(0, 4900);

  // ── 圖片：og:image + 所有 <img src>
  const imgSet = new Set<string>();
  const og = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/gi);
  if (og) for (const tag of og) {
    const m = tag.match(/content=["']([^"']+)["']/i);
    if (m) { const u = resolveUrl(decodeEntities(m[1])); if (u) imgSet.add(u); }
  }
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(html)) !== null) {
    const u = resolveUrl(decodeEntities(im[1]));
    if (u && !/\.svg(\?|#|$)/i.test(u)) imgSet.add(u);
  }
  // data-src / data-original (lazy load)
  const lazyRe = /<img[^>]+data-(?:src|original|lazy-src)=["']([^"']+)["']/gi;
  while ((im = lazyRe.exec(html)) !== null) {
    const u = resolveUrl(decodeEntities(im[1]));
    if (u && !/\.svg(\?|#|$)/i.test(u)) imgSet.add(u);
  }

  // ── 視頻：<video src> / <source src> / iframe (YouTube / Vimeo)
  const videoSet = new Set<string>();
  const vidRe = /<(?:video|source)[^>]+src=["']([^"']+)["']/gi;
  while ((im = vidRe.exec(html)) !== null) {
    const u = resolveUrl(decodeEntities(im[1]));
    if (u) videoSet.add(u);
  }
  const iframeRe = /<iframe[^>]+src=["']([^"']+)["']/gi;
  while ((im = iframeRe.exec(html)) !== null) {
    const u = resolveUrl(decodeEntities(im[1]));
    if (u && /(youtube\.com|youtu\.be|vimeo\.com|bilibili\.com)/i.test(u)) videoSet.add(u);
  }

  // ── Tags：meta keywords
  const tags: string[] = [];
  const kw = metaContent(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
  if (kw) {
    for (const t of kw.split(/[,，;|]/).map(s => s.trim()).filter(Boolean)) {
      if (t.length <= 40) tags.push(t);
      if (tags.length >= 8) break;
    }
  }

  // ── Mirror 圖片去 S3（最多 6 張，過濾太細／太大／非 jpeg/png/webp）
  const candidates = Array.from(imgSet).slice(0, 12);
  const safeStem = (base?.hostname || "url").replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 40);
  const mirrored = await Promise.all(candidates.map(async (u, idx) => {
    try {
      const { buf, contentType } = await fetchWithLimit(u, { timeoutMs: 12_000, maxBytes: 8_000_000 });
      const ct = contentType.split(";")[0].trim().toLowerCase();
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(ct)) return null;
      if (buf.length < 5_000) return null;
      const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
      const key = `community-seeder/url-${Date.now()}-${idx}-${safeStem}.${ext}`;
      const ctNorm = ct === "image/jpg" ? "image/jpeg" : ct;
      const { url } = await storagePut(key, buf, ctNorm);
      return url;
    } catch { return null; }
  }));
  const images = mirrored.filter((u): u is string => !!u).slice(0, 6);

  // ── Author：og:author / article:author / meta name=author / itemprop=author / "byline" rel
  let author = "";
  {
    const cand = metaContent(/<meta\s+(?:property|name)=["'](?:og:author|article:author|author|byline)["']\s+content=["']([^"']+)["']/i)
              || metaContent(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:author|article:author|author|byline)["']/i)
              || metaContent(/<meta\s+itemprop=["']author["']\s+content=["']([^"']+)["']/i)
              || metaContent(/<a[^>]+rel=["']author["'][^>]*>([^<]+)<\/a>/i)
              || metaContent(/<span[^>]+class=["'][^"']*\b(?:author|byline)\b[^"']*["'][^>]*>([^<]+)<\/span>/i);
    if (cand) author = decodeEntities(cand).trim().slice(0, 80);
  }
  return { title, body, tags, images, videos: Array.from(videoSet).slice(0, 5), author };
}

// ─── Wikimedia Commons 圖片搜尋 + S3 mirror（畀每日挑戰 AI 生成用）────────────
// 為每條建議揾 2-5 張候選圖片，mirror 落 S3 畀 admin 揀
async function fetchAndMirrorChallengeImages(s: {
  country: string; year: number; category: string; titleHint: string;
}, targetCount = 4): Promise<string[]> {
  const queries: string[] = [];
  if (s.titleHint) queries.push(s.titleHint);
  queries.push(`${s.country} ${s.year} ${s.category}`);
  queries.push(`${s.year} ${s.country} coin`);
  queries.push(`${s.country} ${s.category} ${s.year}`);

  // 收集所有候選 (deduped by source URL)
  const seen = new Set<string>();
  const allCandidates: Array<{ url: string; mime: string }> = [];
  for (const q of queries) {
    if (allCandidates.length >= targetCount * 3) break;
    try {
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=800&origin=*`;
      const r = await fetch(apiUrl, {
        headers: { "User-Agent": "hongxcollections/1.0 (https://hongxcollections.com)" },
      });
      if (!r.ok) continue;
      const j: any = await r.json();
      const pages = j?.query?.pages;
      if (!pages) continue;
      for (const k of Object.keys(pages)) {
        const ii = pages[k]?.imageinfo?.[0];
        if (!ii) continue;
        const mime = String(ii.mime || "").toLowerCase();
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) continue;
        const url = ii.thumburl || ii.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        allCandidates.push({ url, mime });
      }
    } catch {}
  }

  // 並行 fetch + upload 到 S3，最多取 targetCount 個成功
  const safeStem = `${s.country}-${s.year}-${s.category}`.replace(/[^a-zA-Z0-9\-]/g, "_").slice(0, 40);
  const results = await Promise.all(allCandidates.slice(0, targetCount * 2).map(async (c, idx) => {
    try {
      const imgResp = await fetch(c.url, {
        headers: { "User-Agent": "hongxcollections/1.0 (https://hongxcollections.com)" },
      });
      if (!imgResp.ok) return null;
      const ct = (imgResp.headers.get("content-type") || c.mime).split(";")[0].trim().toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(ct)) return null;
      const ab = await imgResp.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length < 5_000 || buf.length > 5_000_000) return null;
      const ext = ct === "image/png" ? "png" : ct === "image/webp" ? "webp" : "jpg";
      const key = `daily-challenge/ai-${Date.now()}-${idx}-${safeStem}.${ext}`;
      const { url } = await storagePut(key, buf, ct);
      return url;
    } catch {
      return null;
    }
  }));
  return results.filter((u): u is string => !!u).slice(0, targetCount);
}

// ─── invokeLLM with multi-key/multi-model fallback on 429/quota errors ────────
// Tries Forge → OpenRouter → Gemini(2.5-flash key1/key2 → 2.0-flash key1/key2) → OpenAI
async function invokeLLMSafe(params: InvokeParams): Promise<InvokeResult> {
  type Cand = { url: string; key: string; model: string };
  const GG = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  const candidates: Cand[] = [];
  if (ENV.forgeApiKey) {
    const base = ENV.forgeApiUrl?.trim()
      ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
      : "https://forge.manus.im/v1/chat/completions";
    candidates.push({ url: base, key: ENV.forgeApiKey, model: "gemini-2.5-flash" });
  }
  if (ENV.openRouterApiKey) {
    candidates.push({ url: "https://openrouter.ai/api/v1/chat/completions", key: ENV.openRouterApiKey, model: "google/gemini-2.0-flash-exp:free" });
  }
  if (ENV.geminiApiKey)  candidates.push({ url: GG, key: ENV.geminiApiKey,  model: "gemini-2.5-flash" });
  if (ENV.geminiApiKey2) candidates.push({ url: GG, key: ENV.geminiApiKey2, model: "gemini-2.5-flash" });
  if (ENV.geminiApiKey)  candidates.push({ url: GG, key: ENV.geminiApiKey,  model: "gemini-2.0-flash" });
  if (ENV.geminiApiKey2) candidates.push({ url: GG, key: ENV.geminiApiKey2, model: "gemini-2.0-flash" });
  if (ENV.geminiApiKey)  candidates.push({ url: GG, key: ENV.geminiApiKey,  model: "gemini-flash-latest" });
  if (ENV.geminiApiKey2) candidates.push({ url: GG, key: ENV.geminiApiKey2, model: "gemini-flash-latest" });
  if (ENV.openAiApiKey)  candidates.push({ url: "https://api.openai.com/v1/chat/completions", key: ENV.openAiApiKey, model: "gpt-4o-mini" });

  if (candidates.length === 0) throw new Error("AI 未設定 API key");

  const messages = params.messages.map(m => {
    const c = m.content;
    if (typeof c === 'string') return { role: m.role, content: c };
    if (Array.isArray(c)) {
      const text = c.map(p => typeof p === 'string' ? p : (p as any).text || '').join('\n');
      return { role: m.role, content: text };
    }
    return { role: m.role, content: String(c) };
  });

  let lastErr: any = null;
  for (const cand of candidates) {
    try {
      const payload: Record<string, unknown> = {
        model: cand.model,
        messages,
        max_tokens: params.maxTokens ?? params.max_tokens ?? 1024,
      };
      const resp = await fetch(cand.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cand.key}` },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        const isRetryable = resp.status === 429 || resp.status === 503 || resp.status === 500 || /quota|rate.*limit|exhausted/i.test(errText);
        lastErr = new Error(`${cand.model}: ${resp.status} ${errText.slice(0, 200)}`);
        if (isRetryable) continue;
        throw lastErr;
      }
      return (await resp.json()) as InvokeResult;
    } catch (e: any) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr ?? new Error("所有 AI 模型都失敗");
}

// ─── AI rate limit (in-memory) ────────────────────────────────────────────────
const aiCounters = new Map<string, { count: number; resetAt: number }>();
function aiRateLimit(userId: number, scope: string, perHour: number): { ok: boolean; message?: string } {
  const key = `${scope}:${userId}`;
  const now = Date.now();
  const entry = aiCounters.get(key);
  if (!entry || entry.resetAt < now) {
    aiCounters.set(key, { count: 1, resetAt: now + 3600_000 });
    return { ok: true };
  }
  if (entry.count >= perHour) {
    const minLeft = Math.ceil((entry.resetAt - now) / 60000);
    return { ok: false, message: `AI 功能用得太密，請 ${minLeft} 分鐘後再試 🙏` };
  }
  entry.count += 1;
  return { ok: true };
}
const chatbotCounters = new Map<string, { count: number; resetAt: number }>();
function chatbotRateLimit(key: string, perDay: number): { ok: boolean; message?: string } {
  const now = Date.now();
  const entry = chatbotCounters.get(key);
  if (!entry || entry.resetAt < now) {
    chatbotCounters.set(key, { count: 1, resetAt: now + 86400_000 });
    return { ok: true };
  }
  if (entry.count >= perDay) {
    return { ok: false, message: `今日 AI 客服查詢次數已用完（${perDay} 次/日），請聽日再試或 WhatsApp 97927793 🙏` };
  }
  entry.count += 1;
  return { ok: true };
}

// ─── Chatbot KB loader (cached, multi-path for dev/prod compatibility) ───────
let _kbCache: string | null = null;
function loadChatbotKb(): string {
  if (_kbCache) return _kbCache;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const candidates = [
    join(__dirname, '_core', 'chatbot-kb.md'),       // dev: server/ + _core/chatbot-kb.md
    join(__dirname, 'chatbot-kb.md'),                 // dev: when running from server/_core/
    join(__dirname, '..', 'server', '_core', 'chatbot-kb.md'),
    join(process.cwd(), 'dist', '_core', 'chatbot-kb.md'),
    join(process.cwd(), 'server', '_core', 'chatbot-kb.md'),
    join(process.cwd(), '_core', 'chatbot-kb.md'),
  ];
  for (const p of candidates) {
    try {
      _kbCache = readFileSync(p, 'utf-8');
      console.log(`[Chatbot] KB loaded from: ${p}`);
      return _kbCache;
    } catch { /* try next */ }
  }
  console.error('[Chatbot] Failed to load KB. Tried:', candidates);
  _kbCache = '（知識庫載入失敗，請聯絡 WhatsApp 97927793）';
  return _kbCache;
}

// ─── Ads router helper ────────────────────────────────────────────────────────
const AD_TYPES: AdTargetType[] = ['guest', 'member', 'merchant'];
export { AD_TYPES };
