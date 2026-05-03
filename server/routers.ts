import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb, getAuctions, getAuctionById, getAuctionImages, getBidHistory, createAuction, addAuctionImage, placeBid as dbPlaceBid, getUserBids, getUserBidsGrouped, updateAuction, deleteAuction, deleteAuctionImage, getAuctionsByCreator, getDraftAuctions, getArchivedAuctions, getArchivedAuctionsFiltered, setProxyBid, getProxyBid, deactivateProxyBid, getProxyBidLogs, getAnonymousBids, closeExpiredAuctions, getDashboardStats, toggleFavorite, getUserFavorites, getFavoriteIds, getMyWonAuctions, getAllBidsForExport, getSiteSetting, setSiteSetting, getAllSiteSettings, getWonOrders, updatePaymentStatus, getAnyExistingImageUrl, getAdBanners, getAllAdBanners, upsertAdBanner, saveCoinAnalysisHistory, getUserCoinAnalysisHistory, deleteCoinAnalysisHistory, searchRelatedAuctions, setMerchantPageSizes } from "./db";
import type { AdTargetType } from "./db";
import type { Auction } from "../drizzle/schema";
import { merchantApplications as merchantAppsTable, merchantProducts as merchantProductsTable, auctions, bids } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { validateBid, placeBid, getAuctionDetails, isEndingSoon, notifyEndingSoon, notifyWon, notifyMerchantWon } from "./auctions";
import { getNotificationSettings, upsertNotificationSettings, updateUserEmail, updateUserName, updateUserPhotoUrl, updateUserNotificationPrefs, getUserById, getUserPublicStats, getAllUsers, setUserMemberLevel, getOrCreateSellerDeposit, getAllSellerDeposits, topUpDeposit, deductCommission, refundCommission, updateSellerDepositSettings, getDepositTransactions, getAllDepositTransactions, canSellerList, adjustDeposit, getActiveSubscriptionPlans, getAllSubscriptionPlans, getSubscriptionPlanById, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, createUserSubscription, getUserActiveSubscription, getUserSubscriptions, getAllUserSubscriptions, approveSubscription, rejectSubscription, cancelSubscription, getSubscriptionStats, getExpiringSoonSubscriptions, adminUpdateSubscriptionEndDate, getAllUsersExtended, adminUpdateUser, adminSetUserPassword, countMerchantVideosThisMonth, getUserMonthlyVideoQuota, getUserMaxVideoSeconds, clearMustChangePassword, deleteUserAndData, getWonAuctionsByUser, adminGetUserStats, createMerchantApplication, getMerchantApplicationByUser, getAllMerchantApplications, reviewMerchantApplication, getWonOrdersByCreator, getMerchantSettings, upsertMerchantSettings, upsertWatermarkSettings, setMerchantListingLayout, updateMerchantProfile, autoDeductCommissionOnAuctionEnd, getListingQuotaInfo, deductListingQuota, deductListingQuotaBulk, adminSetSubscriptionQuota, createRefundRequest, getMyRefundRequests, getAllRefundRequests, reviewRefundRequest, purgeMerchantAuctionData, cleanOrphanMerchantData, revokeMerchantStatus, createDepositTopUpRequest, getMyDepositTopUpRequests, getAllDepositTopUpRequests, reviewDepositTopUpRequest, listDepositTierPresets, upsertDepositTierPreset, deleteDepositTierPreset, listMerchantProducts, getMerchantProduct, createMerchantProduct, updateMerchantProduct, deleteMerchantProduct, listApprovedMerchants, exportPackagesData, importPackagesData, createProductOrder, getProductOrdersByMerchant, getProductOrdersByBuyer, getAllProductOrders, confirmProductOrder, cancelProductOrder, deleteBuyerOrder, createFeaturedListing, getActiveFeaturedListings, getMerchantFeaturedListings, getAllFeaturedListings, cancelFeaturedListing, getFeaturedSlotStatus, purgeActiveFeaturedListings, FEATURED_TIER_PRICES, FEATURED_TIER_LABELS, MAX_FEATURED_SLOTS } from "./db";
import { storagePut } from "./storage";
import { applyWatermark } from "./watermark";
import { getRawPool } from "./db";
import { TRPCError } from "@trpc/server";
import { getVapidPublicKey, savePushSubscription, removePushSubscription, sendPushToUser, sendPushToEndpoint } from "./push";
import { getLoyaltyConfig, updateLoyaltyConfig, getEarlyBirdTodayStatus, getMyLoyaltyStatus, recalculateUserLevel, runDailyLoyaltyMaintenance, getMyAutoBidStatus, enforceAutoBidLimit, enforceAnonymousBidPermission, type LoyaltyConfig } from "./loyalty";
import { ENV } from "./_core/env";
import type { IncomingMessage } from "http";

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
        bidIncrement: z.number().int().min(30).max(5000).default(30),
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
        bidIncrement: z.number().int().min(30).max(5000).optional(),
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
          await Promise.all(
            expiredIds.map((id: number) => updateAuction(id, { status: 'ended' }))
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
        bidIncrement: z.number().int().min(30).max(5000).optional(),
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
      .input(z.object({ email: z.string().email() }))
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
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { userId, memberLevel, isBanned, monthlyVideoQuota, maxVideoSeconds, ...profileData } = input;
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
          loginMethod: 'phone',
          role: input.role,
          memberLevel: input.memberLevel,
        });
        const newUserId = (result as { insertId: number }).insertId;
        if (input.isMerchant) {
          await getOrCreateSellerDeposit(newUserId);
          await createMerchantApplication({
            userId: newUserId,
            contactName: input.name,
            merchantName: input.merchantName || input.name,
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
              const settings: { requiredDeposit?: number; commissionRate?: number; productCommissionRate?: number } = {};
              const tierAmount = tier.amount ? parseFloat(String(tier.amount)) : 0;
              if (tierAmount > 0) settings.requiredDeposit = tierAmount;
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
                // 更新會員等級
                const { users: uTable } = await import('../drizzle/schema');
                const { eq: eqInner } = await import('drizzle-orm');
                await dbInner.update(uTable).set({ memberLevel: plan.memberLevel }).where(eqInner(uTable.id, newUserId));
                console.log(`[adminCreateUser] Applied subscription plan "${plan.name}" to user ${newUserId}`);
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
        return {
          id: deposit.id,
          balance: parseFloat(deposit.balance.toString()),
          requiredDeposit: parseFloat(deposit.requiredDeposit.toString()),
          commissionRate: parseFloat(deposit.commissionRate.toString()),
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
        // Verify plan exists and is active
        const plan = await getSubscriptionPlanById(input.planId);
        if (!plan || !plan.isActive) throw new TRPCError({ code: 'NOT_FOUND', message: '\u8a02\u95b1\u8a08\u5283\u4e0d\u5b58\u5728\u6216\u5df2\u505c\u7528' });
        return createUserSubscription({
          userId: ctx.user.id,
          planId: input.planId,
          billingCycle: input.billingCycle,
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
          paymentProofUrl: input.paymentProofUrl,
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
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can change settings' });
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

    // 提交申請
    submit: protectedProcedure
      .input(z.object({
        contactName: z.string().min(1).max(100),
        merchantName: z.string().min(1).max(100),
        selfIntro: z.string().min(10),
        whatsapp: z.string().min(5),
        merchantIcon: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role === 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '管理員帳號無需申請商戶' });
        }
        const existing = await getMerchantApplicationByUser(ctx.user.id);
        if (existing && existing.status === 'pending') {
          throw new TRPCError({ code: 'CONFLICT', message: '你已有一份待審申請，請耐心等候' });
        }
        await createMerchantApplication({
          userId: ctx.user.id,
          contactName: input.contactName,
          merchantName: input.merchantName,
          selfIntro: input.selfIntro,
          whatsapp: input.whatsapp,
          merchantIcon: input.merchantIcon ?? null,
          status: 'pending',
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
          merchantName: input.merchantName,
          selfIntro: input.selfIntro,
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
        await Promise.all(expiredIds.map((id: number) => updateAuction(id, { status: 'ended' })));
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

    // ═══════════════════════════════════════════════════════
    //  商戶：拍賣管理
    // ═══════════════════════════════════════════════════════

    /** 商戶建立草稿拍賣 */
    createAuction: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().default(''),
        startingPrice: z.number().min(0),
        bidIncrement: z.number().int().min(30).max(5000).default(30),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).default('HKD'),
        antiSnipeEnabled: z.number().int().min(0).max(1).default(1),
        antiSnipeMinutes: z.number().int().min(0).max(60).default(3),
        extendMinutes: z.number().int().min(1).max(60).default(3),
        category: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
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
        bidIncrement: z.number().int().min(30).max(5000).optional(),
        currency: z.enum(['HKD', 'USD', 'CNY', 'GBP', 'EUR', 'JPY']).optional(),
        antiSnipeEnabled: z.number().int().min(0).max(1).optional(),
        antiSnipeMinutes: z.number().int().min(0).max(60).optional(),
        extendMinutes: z.number().int().min(1).max(60).optional(),
        category: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
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
        await updateAuction(input.id, updateData);
        return { success: true };
      }),

    /** 商戶修改進行中拍賣（有限度：只允許標題/詳情/分類，不可改價格/時間/競標設定） */
    updateActiveAuction: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        videoUrl: z.string().nullable().optional(),
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
        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.videoUrl !== undefined) updateData.videoUrl = input.videoUrl;
        await updateAuction(input.id, updateData);
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

    /** 商戶發佈草稿拍賣 */
    publishDraft: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        endTime: z.date(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startingPrice: z.number().min(0).optional(),
        bidIncrement: z.number().int().min(30).max(5000).optional(),
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
          createdBy: ctx.user.id,
          relistSourceId: input.id,
        });
        const originalImages = await getAuctionImages(input.id);
        for (const img of originalImages) {
          await addAuctionImage({ auctionId: newAuction.id, imageUrl: img.imageUrl, displayOrder: img.displayOrder });
        }
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
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertMerchantSettings(ctx.user.id, input.defaultEndDayOffset, input.defaultEndTime, input.defaultStartingPrice, input.defaultBidIncrement, input.defaultAntiSnipeEnabled, input.defaultAntiSnipeMinutes, input.defaultExtendMinutes, input.paymentInstructions, input.deliveryInfo, input.fbShareTemplate);
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
        price: z.number().positive(),
        currency: z.string().default('HKD'),
        category: z.string().max(500).optional(),
        images: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
        stock: z.number().int().min(1).default(1),
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
        price: z.number().positive().optional(),
        currency: z.string().optional(),
        category: z.string().max(500).optional(),
        images: z.string().optional(),
        videoUrl: z.string().max(500).nullable().optional(),
        stock: z.number().int().min(0).optional(),
        status: z.enum(['active', 'sold', 'hidden']).optional(),
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
        const result = await confirmProductOrder(input.orderId, ctx.user.id, input.finalPrice);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        return { success: true };
      }),

    /** 取消訂單（買家或商戶） */
    cancel: protectedProcedure
      .input(z.object({ orderId: z.number(), reason: z.string().max(200).optional() }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user.role === 'admin';
        const result = await cancelProductOrder(input.orderId, ctx.user.id, isAdmin, input.reason);
        if (!result.ok) throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
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

    /** 買家：我的訂單 */
    myBuyerOrders: protectedProcedure
      .query(async ({ ctx }) => {
        return getProductOrdersByBuyer(ctx.user.id);
      }),

    /** 買家：永久刪除已確認／已取消的訂單紀錄 */
    deleteBuyerOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await deleteBuyerOrder(input.orderId, ctx.user.id);
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
        // 自動儲存鑑定歷史（不阻塞）
        if (ctx.user?.id) {
          saveCoinAnalysisHistory(ctx.user.id, {
            coinName: data.name ?? data.Name,
            coinType: data.type ?? data.Type,
            coinCountry: data.country ?? data.Country,
            analysisData: JSON.stringify(data),
          }).catch(() => {});
        }
        return { success: true, data, modelUsed };
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
          }));
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
          const ok = await deleteCoinAnalysisHistory(input.id, ctx.user.id);
          return { success: ok };
        }),
    }),
  }),
});
export type AppRouter = typeof appRouter;

// ─── Ads router helper ────────────────────────────────────────────────────────
const AD_TYPES: AdTargetType[] = ['guest', 'member', 'merchant'];
export { AD_TYPES };
