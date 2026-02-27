import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { PaymentStatus, SequenceType } from "@mollie/api-client";

import { db } from "~/server/db";
import { customer, subscription, payment } from "~/server/db/schema";
import { getPayment, createSubscription } from "~/server/mollie/service";
import {
  PLANS,
  type PlanId,
  type BillingCycle,
  getPlanPrice,
  getMollieInterval,
  getTrialEndDate,
} from "~/lib/billing";
import { env } from "~/env";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const paymentId = formData.get("id") as string;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing payment ID" },
        { status: 400 },
      );
    }

    // Always fetch the full payment from Mollie — never trust webhook data
    const molliePayment = await getPayment(paymentId);

    const mollieCustomerId = molliePayment.customerId;
    if (!mollieCustomerId) {
      return NextResponse.json({ status: "ok" });
    }

    // Find the customer in our DB
    const cust = await db.query.customer.findFirst({
      where: eq(customer.mollieCustomerId, mollieCustomerId),
    });

    if (!cust) {
      console.error(`Webhook: unknown Mollie customer ${mollieCustomerId}`);
      return NextResponse.json({ status: "ok" });
    }

    const userId = cust.userId;
    const amountCents = Math.round(
      parseFloat(molliePayment.amount.value) * 100,
    );
    const isFirstPayment = molliePayment.sequenceType === SequenceType.first;
    const isRecurring = molliePayment.sequenceType === SequenceType.recurring;

    // Idempotency: check if we already processed this payment in the same state
    const existingPayment = await db.query.payment.findFirst({
      where: eq(payment.molliePaymentId, molliePayment.id),
    });

    if (existingPayment?.status === molliePayment.status) {
      return NextResponse.json({ status: "ok" });
    }

    // Upsert payment record
    await db
      .insert(payment)
      .values({
        userId,
        molliePaymentId: molliePayment.id,
        mollieSubscriptionId: molliePayment.subscriptionId ?? null,
        amount: amountCents,
        currency: molliePayment.amount.currency,
        status: molliePayment.status,
        description: molliePayment.description ?? null,
        method: (molliePayment.method as string) ?? null,
        sequenceType: molliePayment.sequenceType ?? SequenceType.first,
        paidAt: molliePayment.paidAt ? new Date(molliePayment.paidAt) : null,
      })
      .onConflictDoUpdate({
        target: payment.molliePaymentId,
        set: {
          status: molliePayment.status,
          method: (molliePayment.method as string) ?? null,
          paidAt: molliePayment.paidAt ? new Date(molliePayment.paidAt) : null,
        },
      });

    // Get the user's subscription
    const sub = await db.query.subscription.findFirst({
      where: eq(subscription.userId, userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    if (!sub) {
      console.error(`Webhook: no subscription for user ${userId}`);
      return NextResponse.json({ status: "ok" });
    }

    if (isFirstPayment && molliePayment.status === PaymentStatus.paid) {
      // Guard: only transition from pending (prevent duplicate processing)
      if (sub.status !== "pending") {
        return NextResponse.json({ status: "ok" });
      }

      // First payment succeeded (€0.01 authorization) → start trial period
      const now = new Date();
      const trialEnd = getTrialEndDate(now);

      // Schedule the real subscription to start after trial
      const price = getPlanPrice(
        sub.plan as PlanId,
        sub.billingCycle as BillingCycle,
      );
      const interval = getMollieInterval(sub.billingCycle as BillingCycle);
      const plan = PLANS[sub.plan as PlanId];
      const startDate = trialEnd.toISOString().split("T")[0]!;

      const mollieSubId = await createSubscription({
        mollieCustomerId,
        amount: price,
        interval,
        description: `Tellum ${plan.name} (${sub.billingCycle === "monthly" ? "maandelijks" : "jaarlijks"})`,
        webhookUrl: `${env.MOLLIE_WEBHOOK_URL}/api/webhooks/mollie`,
        startDate,
      });

      await db
        .update(subscription)
        .set({
          status: "trialing",
          mollieSubscriptionId: mollieSubId,
          trialStartedAt: now,
          trialEndsAt: trialEnd,
        })
        .where(eq(subscription.id, sub.id));
    } else if (
      isFirstPayment &&
      (molliePayment.status === PaymentStatus.failed ||
        molliePayment.status === PaymentStatus.expired ||
        molliePayment.status === PaymentStatus.canceled)
    ) {
      // First payment failed/expired/canceled — reset to pending so user can retry
      await db
        .update(subscription)
        .set({ status: "pending" })
        .where(eq(subscription.id, sub.id));
    } else if (isRecurring && molliePayment.status === PaymentStatus.paid) {
      // Recurring payment succeeded → active
      const now = new Date();
      const periodEnd = new Date(now);
      if (sub.billingCycle === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      await db
        .update(subscription)
        .set({
          status: "active",
          activatedAt: sub.activatedAt ?? now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .where(eq(subscription.id, sub.id));
    } else if (isRecurring && molliePayment.status === PaymentStatus.failed) {
      // Recurring payment failed → suspended
      await db
        .update(subscription)
        .set({ status: "suspended" })
        .where(eq(subscription.id, sub.id));
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Mollie webhook error:", error);
    // Return 500 so Mollie retries the webhook
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
