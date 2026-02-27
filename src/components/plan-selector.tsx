"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  PLANS,
  type PlanId,
  type BillingCycle,
  formatPrice,
} from "~/lib/billing";
import { cn } from "~/lib/utils";

interface PlanSelectorProps {
  currentPlan?: PlanId | null;
  onSelectPlan: (plan: PlanId, cycle: BillingCycle) => void;
  loading?: boolean;
  ctaLabel?: string;
}

export function PlanSelector({
  currentPlan,
  onSelectPlan,
  loading,
  ctaLabel = "Selecteer",
}: PlanSelectorProps) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const plans = Object.values(PLANS);

  return (
    <div className="space-y-8">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setCycle("monthly")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            cycle === "monthly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Maandelijks
        </button>
        <button
          onClick={() => setCycle("yearly")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            cycle === "yearly"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Jaarlijks
          <span className="ml-1.5 text-xs opacity-75">-17%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price =
            cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const monthlyEquivalent =
            cycle === "yearly" ? plan.yearlyPrice / 12 : plan.monthlyPrice;
          const isCurrent = currentPlan === plan.id;
          const isPopular = plan.id === "pro";

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col",
                isPopular && "border-primary shadow-md",
                isCurrent && "border-primary/50 bg-primary/5",
              )}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Populair
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.invoiceLimit === Infinity
                    ? "Onbeperkt facturen"
                    : `Tot ${plan.invoiceLimit} facturen/maand`}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-3xl font-bold">
                    {formatPrice(monthlyEquivalent)}
                  </span>
                  <span className="text-muted-foreground">/maand</span>
                  {cycle === "yearly" && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatPrice(price)} per jaar
                    </p>
                  )}
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  disabled={isCurrent || loading}
                  onClick={() => onSelectPlan(plan.id, cycle)}
                >
                  {isCurrent ? "Huidig plan" : ctaLabel}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
