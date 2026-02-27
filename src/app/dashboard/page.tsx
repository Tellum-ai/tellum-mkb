"use client";

import { useState } from "react";
import {
  FileText,
  Clock,
  CheckCircle2,
  Euro,
  Mail,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
  type Invoice,
  type InvoiceStatus,
  formatCurrency,
  formatDate,
} from "~/lib/mock-data";
import { api } from "~/trpc/react";

const vendorColors: Record<string, string> = {
  C: "bg-blue-100 text-blue-700",
  K: "bg-green-100 text-green-700",
  G: "bg-emerald-100 text-emerald-700",
  D: "bg-violet-100 text-violet-700",
  T: "bg-cyan-100 text-cyan-700",
  B: "bg-sky-100 text-sky-700",
  P: "bg-rose-100 text-rose-700",
  E: "bg-orange-100 text-orange-700",
  S: "bg-amber-100 text-amber-700",
};

function getVendorInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getVendorColor(name: string) {
  const firstChar = name[0]?.toUpperCase() ?? "A";
  return vendorColors[firstChar] ?? "bg-gray-100 text-gray-700";
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = {
    nieuw: {
      label: "Nieuw",
      className: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Mail,
    },
    goedgekeurd: {
      label: "Goedgekeurd",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    betaald: {
      label: "Betaald",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    },
  } as const;

  const { label, className, icon: Icon } = config[status];

  return (
    <Badge variant="outline" className={`gap-1 font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function StatsCards({
  stats,
  isLoading,
}: {
  stats?: { totaal: number; nieuw: number; openstaand: number; betaaldDezeMaand: number };
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
      description: "Deze maand ontvangen",
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

function InvoiceTable({
  invoices,
  isLoading,
  onApprove,
  mutatingId,
}: {
  invoices: Invoice[];
  isLoading: boolean;
  onApprove: (id: string, status: InvoiceStatus) => void;
  mutatingId: string | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Leverancier</TableHead>
          <TableHead>Factuurnummer</TableHead>
          <TableHead>Onderwerp</TableHead>
          <TableHead>Ontvangen</TableHead>
          <TableHead>Vervaldatum</TableHead>
          <TableHead className="text-right">Bedrag</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actie</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={8}
              className="py-12 text-center text-muted-foreground"
            >
              Geen facturen gevonden
            </TableCell>
          </TableRow>
        ) : (
          invoices.map((invoice) => {
            const isMutating = mutatingId === invoice.id;
            return (
              <TableRow key={invoice.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getVendorColor(invoice.leverancier)}`}
                    >
                      {getVendorInitials(invoice.leverancier)}
                    </div>
                    <div>
                      <div className="font-medium">{invoice.leverancier}</div>
                      <div className="text-xs text-muted-foreground">
                        {invoice.leverancierEmail}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {invoice.factuurnummer}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {invoice.onderwerp}
                </TableCell>
                <TableCell>{formatDate(invoice.ontvangen)}</TableCell>
                <TableCell>{formatDate(invoice.vervaldatum)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.totaal)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right">
                  {invoice.status === "nieuw" && (
                    <Button
                      size="sm"
                      disabled={isMutating}
                      onClick={() => onApprove(invoice.id, "goedgekeurd")}
                      className="bg-primary text-primary-foreground hover:bg-periwinkle-dark"
                    >
                      {isMutating ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : null}
                      Goedkeuren
                    </Button>
                  )}
                  {invoice.status === "goedgekeurd" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isMutating}
                      onClick={() => onApprove(invoice.id, "betaald")}
                      className="text-emerald-700 hover:bg-emerald-50"
                    >
                      {isMutating ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : null}
                      Betaald
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

const todayFormatted = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

export default function DashboardPage() {
  const utils = api.useUtils();
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const { data: invoices, isLoading: invoicesLoading } =
    api.invoice.getAll.useQuery();

  const { data: stats, isLoading: statsLoading } =
    api.invoice.getStats.useQuery();

  const updateStatus = api.invoice.updateStatus.useMutation({
    onSuccess: (_data, variables) => {
      void utils.invoice.getAll.invalidate();
      void utils.invoice.getStats.invalidate();
      setMutatingId(null);

      const invoice = allInvoices.find((i) => i.id === variables.id);
      const name = invoice?.leverancier ?? "Factuur";

      if (variables.status === "goedgekeurd") {
        toast.success(`${name} goedgekeurd`);
      } else if (variables.status === "betaald") {
        toast.success(`${name} als betaald gemarkeerd`);
      }
    },
    onError: (_error, variables) => {
      setMutatingId(null);
      const invoice = allInvoices.find((i) => i.id === variables.id);
      const name = invoice?.leverancier ?? "Factuur";
      toast.error(`Kon ${name} niet bijwerken`);
    },
  });

  const handleApprove = (id: string, status: InvoiceStatus) => {
    setMutatingId(id);
    updateStatus.mutate({ id, status });
  };

  const allInvoices = invoices ?? [];
  const filterByStatus = (status?: InvoiceStatus) =>
    status ? allInvoices.filter((i) => i.status === status) : allInvoices;

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
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

      {/* Content */}
      <div className="flex-1 space-y-6 p-6">
        <StatsCards stats={stats} isLoading={statsLoading} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Facturen</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="alle">
              <TabsList>
                <TabsTrigger value="alle">
                  Alle ({allInvoices.length})
                </TabsTrigger>
                <TabsTrigger value="nieuw">
                  Nieuw ({filterByStatus("nieuw").length})
                </TabsTrigger>
                <TabsTrigger value="goedgekeurd">
                  Goedgekeurd ({filterByStatus("goedgekeurd").length})
                </TabsTrigger>
                <TabsTrigger value="betaald">
                  Betaald ({filterByStatus("betaald").length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="alle" className="mt-4">
                <InvoiceTable
                  invoices={allInvoices}
                  isLoading={invoicesLoading}
                  onApprove={handleApprove}
                  mutatingId={mutatingId}
                />
              </TabsContent>
              <TabsContent value="nieuw" className="mt-4">
                <InvoiceTable
                  invoices={filterByStatus("nieuw")}
                  isLoading={invoicesLoading}
                  onApprove={handleApprove}
                  mutatingId={mutatingId}
                />
              </TabsContent>
              <TabsContent value="goedgekeurd" className="mt-4">
                <InvoiceTable
                  invoices={filterByStatus("goedgekeurd")}
                  isLoading={invoicesLoading}
                  onApprove={handleApprove}
                  mutatingId={mutatingId}
                />
              </TabsContent>
              <TabsContent value="betaald" className="mt-4">
                <InvoiceTable
                  invoices={filterByStatus("betaald")}
                  isLoading={invoicesLoading}
                  onApprove={handleApprove}
                  mutatingId={mutatingId}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
