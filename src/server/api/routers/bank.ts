import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  bankConnections,
  bankTransactions,
  journalEntries,
  journalEntryLines,
  ledgerAccounts,
  invoices,
} from "~/server/db/schema";
import { isBalanced } from "~/server/bookkeeping/journal";

export const bankRouter = createTRPCRouter({
  // List all connected bank accounts for the current user
  getConnections: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bankConnections.findMany({
      where: eq(bankConnections.userId, ctx.session.user.id),
      orderBy: [desc(bankConnections.createdAt)],
    });
  }),

  // List transactions for a connection
  getTransactions: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.bankTransactions.findMany({
        where: and(
          eq(bankTransactions.bankConnectionId, input.connectionId),
          eq(bankTransactions.userId, ctx.session.user.id),
        ),
        orderBy: [desc(bankTransactions.date)],
      });
    }),

  // Seed a demo bank connection + transactions for local development
  seedTestData: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Create (or reuse) a demo connection
    let connection = await ctx.db.query.bankConnections.findFirst({
      where: and(
        eq(bankConnections.userId, userId),
        eq(bankConnections.provider, "demo"),
      ),
    });

    if (!connection) {
      const [inserted] = await ctx.db
        .insert(bankConnections)
        .values({
          userId,
          provider: "demo",
          institutionName: "Demo Bank NL",
          accountName: "Betaalrekening",
          lastSyncAt: new Date(),
        })
        .returning();
      connection = inserted!;
    }

    const today = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d;
    };

    const rows = [
      { date: daysAgo(1),  amount: -12100, description: "KPN",            merchantName: "KPN" },
      { date: daysAgo(3),  amount: -8900,  description: "Vercel",         merchantName: "Vercel" },
      { date: daysAgo(5),  amount: -24200, description: "Adobe",          merchantName: "Adobe" },
      { date: daysAgo(7),  amount: 350000, description: "Betaling klant A", merchantName: null },
      { date: daysAgo(10), amount: -4500,  description: "NS Reizen",      merchantName: "NS" },
      { date: daysAgo(12), amount: -15000, description: "Hetzner",        merchantName: "Hetzner" },
      { date: daysAgo(14), amount: 120000, description: "Betaling klant B", merchantName: null },
    ];

    let inserted = 0;
    for (const row of rows) {
      await ctx.db.insert(bankTransactions).values({
        userId,
        bankConnectionId: connection.id,
        date: row.date,
        amount: row.amount,
        description: row.description,
        merchantName: row.merchantName,
        status: "posted",
      });
      inserted++;
    }

    return { connectionId: connection.id, inserted };
  }),

  // Match a bank transaction to an open invoice and write the payment journal entry
  // DEBIT 1100 Crediteuren / CREDIT 1000 Bank
  matchToInvoice: protectedProcedure
    .input(
      z.object({
        bankTransactionId: z.string(),
        invoiceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [bankTx, invoice] = await Promise.all([
        ctx.db.query.bankTransactions.findFirst({
          where: and(
            eq(bankTransactions.id, input.bankTransactionId),
            eq(bankTransactions.userId, userId),
          ),
        }),
        ctx.db.query.invoices.findFirst({
          where: eq(invoices.id, input.invoiceId),
        }),
      ]);

      if (!bankTx) throw new TRPCError({ code: "NOT_FOUND", message: "Transactie niet gevonden" });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden" });
      if (!invoice.journalEntryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Factuur is nog niet geboekt" });
      }
      if (bankTx.journalEntryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transactie is al gekoppeld" });
      }

      const [crediteuren, bank] = await Promise.all([
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1100)),
        }),
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1000)),
        }),
      ]);

      if (!crediteuren || !bank) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Grootboekrekeningen 1100/1000 niet gevonden" });
      }

      const amountCents = Math.abs(bankTx.amount);

      const lines = [
        { debit: amountCents, credit: null },
        { debit: null, credit: amountCents },
      ];

      if (!isBalanced(lines)) throw new Error("Journaalpost klopt niet");

      await ctx.db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(journalEntries)
          .values({
            userId,
            date: bankTx.date,
            description: `Betaling ${invoice.senderCompany ?? invoice.invoiceNumber ?? "factuur"}`,
            reference: invoice.invoiceNumber ?? undefined,
            type: "bank_payment",
          })
          .returning();

        if (!entry) throw new Error("Journaalpost aanmaken mislukt");

        await tx.insert(journalEntryLines).values([
          { journalEntryId: entry.id, ledgerAccountId: crediteuren.id, debit: amountCents, credit: null },
          { journalEntryId: entry.id, ledgerAccountId: bank.id, debit: null, credit: amountCents },
        ]);

        await tx
          .update(bankTransactions)
          .set({ journalEntryId: entry.id })
          .where(eq(bankTransactions.id, bankTx.id));

        await tx
          .update(invoices)
          .set({ paymentStatus: "betaald" })
          .where(eq(invoices.id, invoice.id));
      });

      return { ok: true };
    }),
});
