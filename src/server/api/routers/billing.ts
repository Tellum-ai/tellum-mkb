import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  customer,
  subscription,
  payment,
  invoiceUsage,
} from "~/server/db/schema";
import {
  createMollieCustomer,
  createFirstPayment,
  createSubscription,
  cancelMollieSubscription,
} from "~/server/mollie/service";
import {
  PLANS,
  type PlanId,
  type BillingCycle,
  getPlanPrice,
  getMollieInterval,
} from "~/lib/billing";
import { env } from "~/env";

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

    // Get current month usage
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
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const userName = ctx.session.user.name ?? ctx.session.user.email;
      const userEmail = ctx.session.user.email;

      // Check for existing subscription
      const existingSub = await ctx.db.query.subscription.findFirst({
        where: eq(subscription.userId, userId),
      });

      if (existingSub && existingSub.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Je hebt al een abonnement.",
        });
      }

      // Get or create Mollie customer
      let cust = await ctx.db.query.customer.findFirst({
        where: eq(customer.userId, userId),
      });

      if (!cust) {
        const mollieCustomerId = await createMollieCustomer(
          userName,
          userEmail,
        );
        [cust] = await ctx.db
          .insert(customer)
          .values({ userId, mollieCustomerId })
          .returning();
      }

      // Create or update subscription record as "pending"
      if (!existingSub) {
        await ctx.db.insert(subscription).values({
          userId,
          mollieCustomerId: cust!.mollieCustomerId,
          plan: input.plan,
          billingCycle: input.billingCycle,
          status: "pending",
        });
      } else {
        await ctx.db
          .update(subscription)
          .set({ plan: input.plan, billingCycle: input.billingCycle })
          .where(eq(subscription.id, existingSub.id));
      }

      const webhookUrl = `${env.MOLLIE_WEBHOOK_URL}/api/webhooks/mollie`;
      const redirectUrl = `${env.BETTER_AUTH_URL}/payment/success`;

      const firstPayment = await createFirstPayment({
        mollieCustomerId: cust!.mollieCustomerId,
        redirectUrl,
        webhookUrl,
        description: `Tellum ${PLANS[input.plan].name} - Betaalmethode autorisatie`,
      });

      return { checkoutUrl: firstPayment.checkoutUrl };
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

      // Cancel existing Mollie subscription if active
      if (sub.mollieSubscriptionId) {
        await cancelMollieSubscription(
          sub.mollieCustomerId,
          sub.mollieSubscriptionId,
        );
      }

      // Create new Mollie subscription
      const price = getPlanPrice(input.plan, input.billingCycle);
      const interval = getMollieInterval(input.billingCycle);
      const newMollieSubId = await createSubscription({
        mollieCustomerId: sub.mollieCustomerId,
        amount: price,
        interval,
        description: `Tellum ${PLANS[input.plan].name} (${input.billingCycle === "monthly" ? "maandelijks" : "jaarlijks"})`,
        webhookUrl: `${env.MOLLIE_WEBHOOK_URL}/api/webhooks/mollie`,
      });

      const [updated] = await ctx.db
        .update(subscription)
        .set({
          plan: input.plan,
          billingCycle: input.billingCycle,
          mollieSubscriptionId: newMollieSubId,
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

    if (!sub?.mollieSubscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Geen actief abonnement om op te zeggen.",
      });
    }

    await cancelMollieSubscription(
      sub.mollieCustomerId,
      sub.mollieSubscriptionId,
    );

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

    const price = getPlanPrice(
      sub.plan as PlanId,
      sub.billingCycle as BillingCycle,
    );
    const interval = getMollieInterval(sub.billingCycle as BillingCycle);

    const newMollieSubId = await createSubscription({
      mollieCustomerId: sub.mollieCustomerId,
      amount: price,
      interval,
      description: `Tellum ${PLANS[sub.plan as PlanId].name} (${sub.billingCycle === "monthly" ? "maandelijks" : "jaarlijks"})`,
      webhookUrl: `${env.MOLLIE_WEBHOOK_URL}/api/webhooks/mollie`,
    });

    const [updated] = await ctx.db
      .update(subscription)
      .set({
        status: "active",
        mollieSubscriptionId: newMollieSubId,
        cancelledAt: null,
      })
      .where(eq(subscription.id, sub.id))
      .returning();

    return updated;
  }),
});
