import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAuctions, getAuctionById, getAuctionImages, getBidHistory, createAuction, addAuctionImage, placeBid as dbPlaceBid, getUserBids, getUserBidsGrouped, updateAuction, deleteAuction, deleteAuctionImage, getAuctionsByCreator, getDraftAuctions, getArchivedAuctions, getArchivedAuctionsFiltered, setProxyBid, getProxyBid, deactivateProxyBid, getProxyBidLogs, getAnonymousBids, closeExpiredAuctions, getDashboardStats, toggleFavorite, getUserFavorites, getFavoriteIds, getMyWonAuctions, getAllBidsForExport, getSiteSetting, setSiteSetting, getAllSiteSettings, getWonOrders, updatePaymentStatus } from "./db";
import type { Auction } from "../drizzle/schema";
import { validateBid, placeBid, getAuctionDetails, isEndingSoon, notifyEndingSoon, notifyWon } from "./auctions";
import { getNotificationSettings, upsertNotificationSettings, updateUserEmail, updateUserNotificationPrefs, getUserById, getUserPublicStats, getAllUsers, setUserMemberLevel, getOrCreateSellerDeposit, getAllSellerDeposits, topUpDeposit, deductCommission, refundCommission, updateSellerDepositSettings, getDepositTransactions, getAllDepositTransactions, canSellerList, adjustDeposit, getActiveSubscriptionPlans, getAllSubscriptionPlans, getSubscriptionPlanById, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, createUserSubscription, getUserActiveSubscription, getUserSubscriptions, getAllUserSubscriptions, approveSubscription, rejectSubscription, cancelSubscription, getSubscriptionStats, getAllUsersExtended, adminUpdateUser, deleteUserAndData, getWonAuctionsByUser } from "./db";
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
            closedIds.forEach(id => notifyWon(id, origin).catch(() => {}));
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
            closedIds.forEach(id => notifyWon(id, origin).catch(() => {}));
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
        commissionRate: z.number().min(0).max(1).optional(),
        isActive: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        const ok = await updateSellerDepositSettings(input.userId, {
          requiredDeposit: input.requiredDeposit,
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
        const url = await storagePut(key, buffer, `image/${ext}`);
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
    // 取得所有站點設定（公開，前端用）
    getAll: publicProcedure
      .query(async () => {
        return getAllSiteSettings();
      }),
    // 管理員設定值
    set: protectedProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can change settings' });
        return setSiteSetting(input.key, input.value);
      }),
  }),
});
export type AppRouter = typeof appRouter;
