import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { type InvoiceStatus, mockInvoices } from "~/lib/mock-data";
import { subscription, invoiceUsage } from "~/server/db/schema";
import { PLANS, type PlanId } from "~/lib/billing";

// In-memory store per user (resets on server restart - fine for mock data)
const userInvoices = new Map<string, typeof mockInvoices>();

function getInvoicesForUser(userId: string) {
  if (!userInvoices.has(userId)) {
    userInvoices.set(
      userId,
      mockInvoices.map((inv) => ({ ...inv })),
    );
  }
  return userInvoices.get(userId)!;
}

/**
 * Check if a user has reached their plan's invoice limit for the current month.
 * Call this before creating a new invoice. Throws FORBIDDEN if at limit.
 */
async function checkInvoiceLimit(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  userId: string,
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  if (!sub) return; // No subscription — gated at layout level

  const plan = PLANS[sub.plan as PlanId];
  if (plan.invoiceLimit === Infinity) return;

  const usage = await db.query.invoiceUsage.findFirst({
    where: and(
      eq(invoiceUsage.userId, userId),
      eq(invoiceUsage.year, year),
      eq(invoiceUsage.month, month),
    ),
  });

  if (usage && usage.invoiceCount >= plan.invoiceLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Je hebt het maximum van ${plan.invoiceLimit} facturen per maand bereikt. Upgrade je plan voor meer facturen.`,
    });
  }
}

/**
 * Increment the invoice usage count for the current month.
 * Call this after successfully creating a new invoice.
 */
async function incrementInvoiceUsage(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  userId: string,
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const existing = await db.query.invoiceUsage.findFirst({
    where: and(
      eq(invoiceUsage.userId, userId),
      eq(invoiceUsage.year, year),
      eq(invoiceUsage.month, month),
    ),
  });

  if (existing) {
    await db
      .update(invoiceUsage)
      .set({ invoiceCount: existing.invoiceCount + 1 })
      .where(eq(invoiceUsage.id, existing.id));
  } else {
    await db.insert(invoiceUsage).values({
      userId,
      year,
      month,
      invoiceCount: 1,
    });
  }
}

export const invoiceRouter = createTRPCRouter({
  getAll: protectedProcedure.query(({ ctx }) => {
    return getInvoicesForUser(ctx.session.user.id);
  }),

  getStats: protectedProcedure.query(({ ctx }) => {
    const invoices = getInvoicesForUser(ctx.session.user.id);
    const totaal = invoices.length;
    const nieuw = invoices.filter((i) => i.status === "nieuw").length;
    const openstaand = invoices
      .filter((i) => i.status !== "betaald")
      .reduce((sum, i) => sum + i.totaal, 0);
    const betaaldDezeMaand = invoices
      .filter(
        (i) => i.status === "betaald" && i.factuurdatum.startsWith("2026-02"),
      )
      .reduce((sum, i) => sum + i.totaal, 0);

    return { totaal, nieuw, openstaand, betaaldDezeMaand };
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["nieuw", "goedgekeurd", "betaald"]),
      }),
    )
    .mutation(({ ctx, input }) => {
      const invoices = getInvoicesForUser(ctx.session.user.id);
      const invoice = invoices.find((i) => i.id === input.id);
      if (!invoice) {
        throw new Error("Factuur niet gevonden");
      }
      invoice.status = input.status as InvoiceStatus;
      return invoice;
    }),
});

// Export helpers for use when real invoice creation is implemented
export { checkInvoiceLimit, incrementInvoiceUsage };
