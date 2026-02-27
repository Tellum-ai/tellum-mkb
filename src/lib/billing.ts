export const TRIAL_DAYS = 30;

export const PLANS = {
  starter: {
    id: "starter" as const,
    name: "Starter",
    invoiceLimit: 25,
    monthlyPrice: 900, // cents
    yearlyPrice: 9000, // cents
    features: [
      "Tot 25 facturen per maand",
      "AI-factuurverwerking",
      "Automatische goedkeuring",
      "E-mail support",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    invoiceLimit: 100,
    monthlyPrice: 2400,
    yearlyPrice: 24000,
    features: [
      "Tot 100 facturen per maand",
      "AI-factuurverwerking",
      "Automatische goedkeuring",
      "Boekhoudkoppeling",
      "Prioriteit support",
    ],
  },
  unlimited: {
    id: "unlimited" as const,
    name: "Unlimited",
    invoiceLimit: Infinity,
    monthlyPrice: 4900,
    yearlyPrice: 49000,
    features: [
      "Onbeperkt facturen",
      "AI-factuurverwerking",
      "Automatische goedkeuring",
      "Boekhoudkoppeling",
      "Dedicated account manager",
      "API-toegang",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type BillingCycle = "monthly" | "yearly";

export function formatMollieAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function getMollieInterval(cycle: BillingCycle): string {
  return cycle === "monthly" ? "1 month" : "12 months";
}

export function getTrialEndDate(startDate: Date = new Date()): Date {
  const end = new Date(startDate);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

export function isTrialExpired(trialEndsAt: Date): boolean {
  return new Date() > trialEndsAt;
}

export function getPlanPrice(planId: PlanId, cycle: BillingCycle): number {
  const plan = PLANS[planId];
  return cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
