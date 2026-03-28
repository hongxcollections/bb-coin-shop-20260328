import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAuctions, getAuctionById, getAuctionImages, getBidHistory, createAuction, addAuctionImage, placeBid as dbPlaceBid, getUserBids, updateAuction, deleteAuction, deleteAuctionImage, getAuctionsByCreator } from "./db";
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
        startingPrice: z.number().positive(),
        endTime: z.date(),
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
        endTime: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update auctions' });
        }

        const auction = await getAuctionById(input.id);
        if (!auction) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Auction not found' });
        }

        const updateData: Record<string, unknown> = {};
        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.endTime !== undefined) updateData.endTime = input.endTime;

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
        const withImages = await Promise.all(
          auctionList.map(async (auction: { id: number; [key: string]: unknown }) => ({
            ...auction,
            images: await getAuctionImages(auction.id),
          }))
        );
        return withImages;
      }),
  }),
});

export type AppRouter = typeof appRouter;
