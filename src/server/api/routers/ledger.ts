import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ledgerAccounts, journalEntries } from "~/server/db/schema";

export const ledgerRouter = createTRPCRouter({
  getKostenAccounts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.ledgerAccounts.findMany({
      where: and(
        eq(ledgerAccounts.userId, ctx.session.user.id),
        eq(ledgerAccounts.type, "kosten"),
      ),
      orderBy: (a, { asc }) => [asc(a.number)],
    });
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.ledgerAccounts.findMany({
      where: eq(ledgerAccounts.userId, ctx.session.user.id),
      orderBy: (a, { asc }) => [asc(a.number)],
    });
  }),

  getJournalEntries: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.journalEntries.findMany({
      where: eq(journalEntries.userId, ctx.session.user.id),
      orderBy: [desc(journalEntries.date)],
      with: {
        lines: {
          with: {
            ledgerAccount: true,
          },
        },
      },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        number: z.number().int().min(1000).max(9999),
        name: z.string().min(1),
        type: z.enum(["activa", "passiva", "omzet", "kosten"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .insert(ledgerAccounts)
        .values({ ...input, userId: ctx.session.user.id })
        .returning();
      return account!;
    }),
});
