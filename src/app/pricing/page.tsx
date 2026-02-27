"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TellumLogo } from "~/components/tellum-logo";
import { PlanSelector } from "~/components/plan-selector";
import { Button } from "~/components/ui/button";
import { type PlanId, type BillingCycle, TRIAL_DAYS } from "~/lib/billing";
import { api } from "~/trpc/react";
import Link from "next/link";

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const createCheckout = api.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: () => {
      // User might already have a subscription
      router.push("/dashboard");
    },
  });

  const handleSelectPlan = (plan: PlanId, cycle: BillingCycle) => {
    setLoading(true);
    createCheckout.mutate({ plan, billingCycle: cycle });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <TellumLogo variant="dark" className="h-6 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Inloggen</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight">
            Kies je plan
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Start met {TRIAL_DAYS} dagen gratis. Autoriseer je betaalmethode om
            te beginnen — je betaalt pas na de proefperiode.
          </p>
        </div>

        <PlanSelector
          onSelectPlan={handleSelectPlan}
          loading={loading || createCheckout.isPending}
          ctaLabel="Start gratis proefperiode"
        />

        {/* FAQ / Trust */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Vragen? Neem contact op via{" "}
            <a
              href="mailto:support@tellum.nl"
              className="text-primary underline underline-offset-4"
            >
              support@tellum.nl
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
