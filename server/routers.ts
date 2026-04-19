import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb, getAuctions, getAuctionById, getAuctionImages, getBidHistory, createAuction, addAuctionImage, placeBid as dbPlaceBid, getUserBids, getUserBidsGrouped, updateAuction, deleteAuction, deleteAuctionImage, getAuctionsByCreator, getDraftAuctions, getArchivedAuctions, getArchivedAuctionsFiltered, setProxyBid, getProxyBid, deactivateProxyBid, getProxyBidLogs, getAnonymousBids, closeExpiredAuctions, getDashboardStats, toggleFavorite, getUserFavorites, getFavoriteIds, getMyWonAuctions, getAllBidsForExport, getSiteSetting, setSiteSetting, getAllSiteSettings, getWonOrders, updatePaymentStatus, getAnyExistingImageUrl } from "./db";
import type { Auction } from "../drizzle/schema";
import { merchantApplications as merchantAppsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { validateBid, placeBid, getAuctionDetails, isEndingSoon, notifyEndingSoon, notifyWon, notifyMerchantWon } from "./auctions";
import { getNotificationSettings, upsertNotificationSettings, updateUserEmail, updateUserNotificationPrefs, getUserById, getUserPublicStats, getAllUsers, setUserMemberLevel, getOrCreateSellerDeposit, getAllSellerDeposits, topUpDeposit, deductCommission, refundCommission, updateSellerDepositSettings, getDepositTransactions, getAllDepositTransactions, canSellerList, adjustDeposit, getActiveSubscriptionPlans, getAllSubscriptionPlans, getSubscriptionPlanById, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, createUserSubscription, getUserActiveSubscription, getUserSubscriptions, getAllUserSubscriptions, approveSubscription, rejectSubscription, cancelSubscription, getSubscriptionStats, getAllUsersExtended, adminUpdateUser, deleteUserAndData, getWonAuctionsByUser, createMerchantApplication, getMerchantApplicationByUser, getAllMerchantApplications, reviewMerchantApplication, getWonOrdersByCreator, getMerchantSettings, upsertMerchantSettings, updateMerchantProfile, autoDeductCommissionOnAuctionEnd, getListingQuotaInfo, deductListingQuota, deductListingQuotaBulk, adminSetSubscriptionQuota, createRefundRequest, getMyRefundRequests, getAllRefundRequests, reviewRefundRequest, purgeMerchantAuctionData, createDepositTopUpRequest, getMyDepositTopUpRequests, getAllDepositTopUpRequests, reviewDepositTopUpRequest } from "./db";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

// 出價防抖 Map：鍵為 "userId:auctionId"，値為最後出價時間戳
// 防止同一用戶對同一拍賣在 3 秒內重複出價，減少平台 API 請求量
export const bidDebounceMap = new Map<string, number>();

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
        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/[^/]*$/, '') || '';
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
        const withImages = await Promise.all(
          auctionList.map(async (auction: { id: number; [key: string]: unknown }) => ({
            ...auction,
            images: await getAuctionImages(auction.id),
          }))
        );
        return withImages;
      }),

    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        // Auto-close expired auctions in background (non-blocking)
        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/[^/]*$/, '') || '';
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

    placeBid: protectedProcedure
      .input(z.object({
        auctionId: z.number(),
        bidAmount: z.number().positive(),
        origin: z.string().optional(),
        isAnonymous: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
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
          updatedList.map(async (auction: { id: number; [key: string]: unknown }) => ({
            ...auction,
            images: await getAuctionImages(auction.id),
          }))
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
          results.push({ auctionId: newAuction.id, winningPrice, title: `【測試結標】${template.title}`, winnerName });
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
        category: z.enum(["古幣", "紀念幣", "外幣", "銀幣", "金幣", "其他"]).optional(),
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
          archivedList.map(async (auction: { id: number; [key: string]: unknown }) => ({
            ...auction,
            images: await getAuctionImages(auction.id),
          }))
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
        senderName: '大BB錢幣店',
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

    // Admin: update any user's profile (name, email, phone, memberLevel)
    adminUpdate: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(20).optional(),
        memberLevel: z.enum(['bronze', 'silver', 'gold', 'vip']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const { userId, memberLevel, ...profileData } = input;
        if (Object.keys(profileData).length > 0) {
          const ok = await adminUpdateUser(userId, profileData);
          if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新用戶資料失敗' });
        }
        if (memberLevel) {
          const ok = await setUserMemberLevel(userId, memberLevel);
          if (!ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新會員等級失敗' });
        }
        return { success: true };
      }),

    // Admin: update merchant deposit settings
    adminUpdateDeposit: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        requiredDeposit: z.number().min(0).optional(),
        commissionRate: z.number().min(0).max(1).optional(),
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
        // Derive origin: prefer explicit input, then request headers, then site URL from settings
        const origin = input.origin
          || (ctx.req as any)?.headers?.origin
          || (ctx.req as any)?.headers?.referer?.replace(/\/[^/]*$/, '')
          || '';
        if (!settings?.senderEmail) {
          console.warn('[Email] resendEmail: senderEmail not configured in notification settings');
        }
        const { sendWonEmail } = await import('./email');
        const sent = await sendWonEmail({
          to: winner.email,
          senderName: settings?.senderName ?? '大BB錢幣店',
          senderEmail: settings?.senderEmail ?? 'noreply@example.com',
          userName: winner.name ?? `用戶 #${auction.highestBidderId}`,
          auctionTitle: auction.title,
          auctionId: input.auctionId,
          finalPrice: parseFloat(auction.currentPrice.toString()),
          currency: auction.currency,
          auctionUrl: origin ? `${origin}/auctions/${input.auctionId}` : `https://bbcoinshop-5iu7x8hz.manus.space/auctions/${input.auctionId}`,
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
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const ok = await updateSellerDepositSettings(input.userId, {
          requiredDeposit: input.requiredDeposit,
          warningDeposit: input.warningDeposit,
          commissionRate: input.commissionRate,
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
        amount: z.number().positive('金額必須大於 0'),
        referenceNo: z.string().min(1, '請填寫轉帳參考號').max(100),
        bank: z.string().max(100).optional(),
        note: z.string().max(500).optional(),
        receiptUrl: z.string().url().max(500).optional().or(z.literal('')),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createDepositTopUpRequest({
          userId: ctx.user.id,
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

  siteSettings: router({
    getAll: publicProcedure.query(async () => getAllSiteSettings()),
    set: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can change settings' });
        return setSiteSetting(input.key, input.value);
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
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!allowedMimes.includes(input.mimeType)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '不支援此圖片格式' });
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
          merchantIcon: input.merchantIcon ?? null,
        });
        return { success: true };
      }),

    // 快速檢查是否為商戶（不建立任何記錄）
    isMerchant: protectedProcedure.query(async ({ ctx }) => {
      const app = await getMerchantApplicationByUser(ctx.user.id);
      if (app?.status === 'approved') return true;
      // 管理員直接建立的商戶可能沒有申請記錄，改用 sellerDeposits 判斷
      const db = await (await import('./db')).getDb();
      if (!db) return false;
      const { sellerDeposits: sdTable } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const rows = await db.select({ id: sdTable.id }).from(sdTable).where(eq(sdTable.userId, ctx.user.id)).limit(1);
      return rows.length > 0;
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
      }))
      .mutation(async ({ input, ctx }) => {
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
        const buffer = Buffer.from(input.imageData, 'base64');
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
        const buffer = Buffer.from(input.imageData, 'base64');
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
        // Check + deduct listing quota (admin bypasses)
        let remainingQuota: number | null = null;
        let unlimitedQuota = false;
        if (ctx.user.role !== 'admin') {
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
          const quotaInfo = await getListingQuotaInfo(ctx.user.id);
          if (quotaInfo && !quotaInfo.unlimited && quotaInfo.remainingQuota < toPublishCount) {
            throw new TRPCError({ code: 'FORBIDDEN', message: `發佈次數不足（剩餘 ${quotaInfo.remainingQuota}，需要 ${toPublishCount}）` });
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
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        return getWonOrdersByCreator(ctx.user.id);
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
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50), offset: z.number().int().min(0).default(0) }))
      .query(async ({ input, ctx }) => {
        const app = await getMerchantApplicationByUser(ctx.user.id);
        if (app?.status !== 'approved' && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '非商戶會員' });
        }
        return getDepositTransactions(ctx.user.id, input.limit, input.offset);
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
      }))
      .mutation(async ({ input, ctx }) => {
        await upsertMerchantSettings(ctx.user.id, input.defaultEndDayOffset, input.defaultEndTime, input.defaultStartingPrice, input.defaultBidIncrement, input.defaultAntiSnipeEnabled, input.defaultAntiSnipeMinutes, input.defaultExtendMinutes);
        return { success: true };
      }),

    // ═══════════════════════════════════════════════════════
    //  商戶：發佈配額
    // ═══════════════════════════════════════════════════════

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
  }),
});
export type AppRouter = typeof appRouter;
