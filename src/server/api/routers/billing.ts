import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  subscription,
  payment,
  invoiceUsage,
} from "~/server/db/schema";
import {
  PLANS,
  type PlanId,
  type BillingCycle,
} from "~/lib/billing";

const planInput = z.enum(["starter", "pro", "unlimited"]);
const billingCycleInput = z.enum(["monthly", "yearly"]);

export const billingRouter = createTRPCRouter({
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const sub = await ctx.db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    if (!sub) return null;

    const now = new Date();
    const usage = await ctx.db.query.invoiceUsage.findFirst({
      where: and(
        eq(invoiceUsage.userId, userId),
        eq(invoiceUsage.year, now.getFullYear()),
        eq(invoiceUsage.month, now.getMonth() + 1),
      ),
    });

    const plan = PLANS[sub.plan as PlanId];

    return {
      ...sub,
      planDetails: plan,
      currentUsage: usage?.invoiceCount ?? 0,
    };
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: planInput,
        billingCycle: billingCycleInput,
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Betalingen worden binnenkort beschikbaar via Stripe.",
      });
    }),

  getPaymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const payments = await ctx.db.query.payment.findMany({
      where: eq(payment.userId, ctx.session.user.id),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return payments;
  }),

  changePlan: protectedProcedure
    .input(
      z.object({
        plan: planInput,
        billingCycle: billingCycleInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const sub = await ctx.db.query.subscription.findFirst({
        where: eq(subscription.userId, userId),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      });

      if (!sub || sub.status === "pending" || sub.status === "expired") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Geen actief abonnement gevonden.",
        });
      }

      const [updated] = await ctx.db
        .update(subscription)
        .set({
          plan: input.plan,
          billingCycle: input.billingCycle,
          status: "active",
        })
        .where(eq(subscription.id, sub.id))
        .returning();

      return updated;
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const sub = await ctx.db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    if (!sub || sub.status === "pending" || sub.status === "cancelled") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Geen actief abonnement om op te zeggen.",
      });
    }

    const [updated] = await ctx.db
      .update(subscription)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
      })
      .where(eq(subscription.id, sub.id))
      .returning();

    return updated;
  }),

  reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const sub = await ctx.db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    if (sub?.status !== "cancelled") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Geen geannuleerd abonnement gevonden.",
      });
    }

    const [updated] = await ctx.db
      .update(subscription)
      .set({
        status: "active",
        cancelledAt: null,
      })
      .where(eq(subscription.id, sub.id))
      .returning();

    return updated;
  }),
});
