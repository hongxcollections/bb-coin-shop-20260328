import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAuctions, getAuctionById, getAuctionImages, getBidHistory, createAuction, addAuctionImage, placeBid as dbPlaceBid, getUserBids, updateAuction, deleteAuction, deleteAuctionImage, getAuctionsByCreator, getDraftAuctions, getArchivedAuctions } from "./db";
import { validateBid, placeBid, getAuctionDetails, isEndingSoon } from "./auctions";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

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
      }))
      .query(async ({ input }) => {
        const auctionList = await getAuctions(input.limit, input.offset);
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
      .query(async ({ input }) => {
        const auction = await getAuctionById(input.id);
        if (!auction) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Auction not found' });
        }

        const images = await getAuctionImages(input.id);
        const bidHistory = await getBidHistory(input.id);

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
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          await placeBid(input.auctionId, ctx.user.id, input.bidAmount);
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to place bid';
          throw new TRPCError({ code: 'BAD_REQUEST', message });
        }
      }),

    myBids: protectedProcedure
      .query(async ({ ctx }) => {
        return getUserBids(ctx.user.id);
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
        await updateAuction(input.id, { archived: 1 });
        return { success: true };
      }),

    getArchived: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can view archived auctions' });
        }
        const archivedList = await getArchivedAuctions();
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
  }),
});

export type AppRouter = typeof appRouter;
