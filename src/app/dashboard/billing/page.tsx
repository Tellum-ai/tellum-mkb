"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import {
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { PlanSelector } from "~/components/plan-selector";
import {
  PLANS,
  type PlanId,
  type BillingCycle,
  formatPrice,
  daysUntil,
} from "~/lib/billing";
import { api } from "~/trpc/react";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  trialing: { label: "Proefperiode", variant: "secondary" },
  active: { label: "Actief", variant: "default" },
  cancelled: { label: "Opgezegd", variant: "outline" },
  suspended: { label: "Opgeschort", variant: "destructive" },
  expired: { label: "Verlopen", variant: "destructive" },
};

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("expired") === "true";

  const [showPlanSelector, setShowPlanSelector] = useState(isExpired);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const {
    data: sub,
    isLoading,
    refetch,
  } = api.billing.getSubscription.useQuery();
  const { data: payments } = api.billing.getPaymentHistory.useQuery();

  const changePlan = api.billing.changePlan.useMutation({
    onSuccess: () => {
      void refetch();
      setShowPlanSelector(false);
    },
  });

  const cancelSub = api.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      void refetch();
      setCancelConfirm(false);
    },
  });

  const reactivate = api.billing.reactivateSubscription.useMutation({
    onSuccess: () => void refetch(),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub) {
    router.push("/pricing");
    return null;
  }

  const plan = PLANS[sub.plan as PlanId];
  const statusInfo = STATUS_LABELS[sub.status] ?? STATUS_LABELS.expired!;
  const isTrialing = sub.status === "trialing";
  const isActive = sub.status === "active";
  const isCancelled = sub.status === "cancelled";
  const usagePercent =
    plan.invoiceLimit === Infinity
      ? 0
      : Math.round((sub.currentUsage / plan.invoiceLimit) * 100);

  const handleChangePlan = (planId: PlanId, cycle: BillingCycle) => {
    changePlan.mutate({ plan: planId, billingCycle: cycle });
  };

  return (
    <div className="space-y-6">
      {/* Expired overlay */}
      {isExpired && (
        <Card className="border-destructive bg-red-50">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                Je toegang is verlopen
              </p>
              <p className="text-sm text-muted-foreground">
                Kies een plan hieronder om weer toegang te krijgen tot je
                dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current plan card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {plan.name}
              </CardTitle>
              <CardDescription>
                {plan.invoiceLimit === Infinity
                  ? "Onbeperkt facturen"
                  : `Tot ${plan.invoiceLimit} facturen per maand`}
              </CardDescription>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Pricing */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">
              {formatPrice(
                sub.billingCycle === "yearly"
                  ? plan.yearlyPrice / 12
                  : plan.monthlyPrice,
              )}
            </span>
            <span className="text-muted-foreground">/maand</span>
            {sub.billingCycle === "yearly" && (
              <span className="ml-2 text-sm text-muted-foreground">
                (jaarlijks gefactureerd)
              </span>
            )}
          </div>

          {/* Trial info */}
          {isTrialing && sub.trialEndsAt && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                Proefperiode eindigt over{" "}
                <strong>
                  {daysUntil(new Date(sub.trialEndsAt))} dagen
                </strong>
              </span>
            </div>
          )}

          {/* Period info */}
          {sub.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {isCancelled ? "Toegang tot" : "Volgende facturatie"}:{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Usage meter */}
          {plan.invoiceLimit !== Infinity && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Facturen deze maand
                </span>
                <span className="font-medium">
                  {sub.currentUsage} / {plan.invoiceLimit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {(isTrialing || isActive) && (
              <Button
                variant="outline"
                onClick={() => setShowPlanSelector(true)}
              >
                Plan wijzigen
              </Button>
            )}

            {isActive && (
              <>
                {!cancelConfirm ? (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setCancelConfirm(true)}
                  >
                    Opzeggen
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Weet je het zeker?
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelSub.isPending}
                      onClick={() => cancelSub.mutate()}
                    >
                      {cancelSub.isPending ? "Bezig..." : "Ja, opzeggen"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancelConfirm(false)}
                    >
                      Annuleren
                    </Button>
                  </div>
                )}
              </>
            )}

            {isCancelled && (
              <Button
                disabled={reactivate.isPending}
                onClick={() => reactivate.mutate()}
              >
                {reactivate.isPending
                  ? "Bezig..."
                  : "Abonnement heractiveren"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan selector */}
      {showPlanSelector && (
        <Card>
          <CardHeader>
            <CardTitle>Wijzig je plan</CardTitle>
            <CardDescription>
              Kies een ander plan. Je nieuwe plan gaat direct in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanSelector
              currentPlan={sub.plan as PlanId}
              onSelectPlan={handleChangePlan}
              loading={changePlan.isPending}
              ctaLabel="Overstappen"
            />
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Betalingsgeschiedenis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {p.status === "paid" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : p.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {p.description ?? "Betaling"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatPrice(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.method ?? p.sequenceType}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-muted-foreground">
          Beheer je plan, betaalmethode en facturen.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <BillingContent />
      </Suspense>
    </div>
  );
}
