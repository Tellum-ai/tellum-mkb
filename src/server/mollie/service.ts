import { SequenceType } from "@mollie/api-client";
import { mollieClient } from "./client";
import { formatMollieAmount } from "~/lib/billing";

export async function createMollieCustomer(name: string, email: string) {
  const customer = await mollieClient.customers.create({ name, email });
  return customer.id;
}

export async function createFirstPayment({
  mollieCustomerId,
  redirectUrl,
  webhookUrl,
  description = "Tellum - Betaalmethode autorisatie",
}: {
  mollieCustomerId: string;
  redirectUrl: string;
  webhookUrl: string;
  description?: string;
}) {
  const payment = await mollieClient.payments.create({
    amount: { value: "0.01", currency: "EUR" },
    customerId: mollieCustomerId,
    sequenceType: SequenceType.first,
    description,
    redirectUrl,
    webhookUrl,
  });

  return {
    paymentId: payment.id,
    checkoutUrl: payment.getCheckoutUrl() as string | null,
  };
}

export async function createSubscription({
  mollieCustomerId,
  amount,
  interval,
  description,
  webhookUrl,
  startDate,
}: {
  mollieCustomerId: string;
  amount: number; // cents
  interval: string;
  description: string;
  webhookUrl: string;
  startDate?: string; // YYYY-MM-DD
}) {
  const subscription = await mollieClient.customerSubscriptions.create({
    customerId: mollieCustomerId,
    amount: { value: formatMollieAmount(amount), currency: "EUR" },
    interval,
    description,
    webhookUrl,
    ...(startDate ? { startDate } : {}),
  });

  return subscription.id;
}

export async function cancelMollieSubscription(
  mollieCustomerId: string,
  mollieSubscriptionId: string,
) {
  await mollieClient.customerSubscriptions.cancel(mollieSubscriptionId, {
    customerId: mollieCustomerId,
  });
}

export async function getPayment(paymentId: string) {
  return mollieClient.payments.get(paymentId);
}

export async function getSubscription(
  mollieCustomerId: string,
  subscriptionId: string,
) {
  return mollieClient.customerSubscriptions.get(subscriptionId, {
    customerId: mollieCustomerId,
  });
}
