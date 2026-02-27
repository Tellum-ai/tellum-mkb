"use client";

import {
  FileText,
  Check,
  Euro,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/lib/format";
import { api } from "~/trpc/react";

function StatsCards({
  stats,
  isLoading,
}: {
  stats?: {
    totaal: number;
    nieuw: number;
    openstaand: number;
    betaaldDezeMaand: number;
  };
  isLoading: boolean;
}) {
  const cards = [
    {
      title: "Nieuwe facturen",
      value: stats?.nieuw.toString() ?? "0",
      description: "Wachten op goedkeuring",
      icon: AlertCircle,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      borderColor: "border-t-blue-500",
    },
    {
      title: "Totaal facturen",
      value: stats?.totaal.toString() ?? "0",
      description: "Verwerkt uit e-mail",
      icon: FileText,
      iconColor: "text-periwinkle-dark",
      iconBg: "bg-secondary",
      borderColor: "border-t-periwinkle",
    },
    {
      title: "Openstaand",
      value: formatCurrency(stats?.openstaand ?? 0),
      description: "Nog te betalen",
      icon: Euro,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      borderColor: "border-t-amber-500",
    },
    {
      title: "Betaald",
      value: formatCurrency(stats?.betaaldDezeMaand ?? 0),
      description: "Deze maand betaald",
      icon: Check,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      borderColor: "border-t-emerald-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className={`border-t-2 ${card.borderColor} transition-shadow hover:shadow-md`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${card.iconBg}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-semibold">{card.value}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const todayFormatted = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } =
    api.invoice.getStats.useQuery();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-4">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-6" />
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {todayFormatted}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-6">
        <StatsCards stats={stats} isLoading={statsLoading} />

        {!statsLoading && (stats?.nieuw ?? 0) > 0 && (
          <Card>
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="font-medium">
                  {stats!.nieuw} {stats!.nieuw === 1 ? "factuur wacht" : "facturen wachten"} op goedkeuring
                </p>
                <p className="text-sm text-muted-foreground">
                  Bekijk en keur nieuwe facturen goed
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard/invoices">
                  Bekijk facturen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
