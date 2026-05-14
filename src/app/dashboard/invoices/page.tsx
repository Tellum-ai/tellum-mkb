"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Mail,
  Clock,
  CheckCircle2,
  CalendarClock,
  Loader2,
  BookOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "~/components/ui/card";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { formatCurrency, formatDate, type PaymentStatus } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type InvoiceRow = RouterOutputs["invoice"]["getAll"][number];

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

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = {
    nieuw: {
      label: "Nieuw",
      className: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Mail,
    },
    goedgekeurd: {
      label: "Geboekt",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    ingepland: {
      label: "Ingepland",
      className: "bg-purple-50 text-purple-700 border-purple-200",
      icon: CalendarClock,
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

const VAT_RATES = [
  { value: "21", label: "21% (standaard)" },
  { value: "9", label: "9% (laag tarief)" },
  { value: "0", label: "0% (vrijgesteld)" },
] as const;

function BookingDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [ledgerAccountId, setLedgerAccountId] = useState<string>("");
  const [vatRate, setVatRate] = useState<"0" | "9" | "21">("21");

  const { data: kostenAccounts = [] } = api.ledger.getKostenAccounts.useQuery();

  const bookPurchase = api.invoice.bookPurchase.useMutation({
    onSuccess: () => {
      void utils.invoice.getAll.invalidate();
      void utils.invoice.getStats.invalidate();
      toast.success("Factuur geboekt");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const totalInclVat = parseFloat(invoice.totaal.toString());
  const rate = parseInt(vatRate) / 100;
  const exclVat = totalInclVat / (1 + rate);
  const vat = totalInclVat - exclVat;

  const canSubmit = !!ledgerAccountId && !bookPurchase.isPending;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Factuur boeken
          </DialogTitle>
          <DialogDescription>
            {invoice.leverancier} — {invoice.factuurnummer || "geen factuurnummer"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Totaal incl. BTW</span>
              <span className="font-medium">{formatCurrency(totalInclVat)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ontvangen</span>
              <span>{invoice.ontvangen ? formatDate(invoice.ontvangen) : "—"}</span>
            </div>
          </div>

          {/* Ledger account */}
          <div className="space-y-1.5">
            <Label>Grootboekrekening (kosten)</Label>
            <Select value={ledgerAccountId} onValueChange={setLedgerAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een rekening…" />
              </SelectTrigger>
              <SelectContent>
                {kostenAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.number} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* VAT rate */}
          <div className="space-y-1.5">
            <Label>BTW tarief</Label>
            <Select value={vatRate} onValueChange={(v) => setVatRate(v as typeof vatRate)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAT_RATES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Calculated split */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Journaalpost</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Debet kostenrekening
              </span>
              <span className="font-mono">{formatCurrency(exclVat)}</span>
            </div>
            {vat > 0.005 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Debet BTW te vorderen (1500)</span>
                <span className="font-mono">{formatCurrency(vat)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Credit Crediteuren (1100)</span>
              <span className="font-mono">{formatCurrency(totalInclVat)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              bookPurchase.mutate({
                invoiceId: invoice.id,
                ledgerAccountId,
                vatRate: parseInt(vatRate) as 0 | 9 | 21,
              })
            }
          >
            {bookPurchase.isPending && (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            )}
            Bevestig boeking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InvoicesPage() {
  const utils = api.useUtils();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bookingInvoice, setBookingInvoice] = useState<InvoiceRow | null>(null);

  const { data: invoicesData, isLoading } = api.invoice.getAll.useQuery();

  const resetTestData = api.email.resetTestData.useMutation({
    onSuccess: () => {
      void utils.invoice.getAll.invalidate();
      void utils.invoice.getStats.invalidate();
      toast.success("Testdata gereset — inbox kan opnieuw gescand worden");
    },
    onError: (err) => toast.error(err.message),
  });

  const scanInbox = api.email.scanInbox.useMutation({
    onSuccess: (res) => {
      void utils.invoice.getAll.invalidate();
      void utils.invoice.getStats.invalidate();
      toast.success(
        `Scan klaar — ${res.invoicesFound} factuur${res.invoicesFound !== 1 ? "en" : ""} gevonden, ${res.processed} verwerkt, ${res.remaining} resterend`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const allInvoices = useMemo(() => invoicesData ?? [], [invoicesData]);

  const filterByStatus = (status?: PaymentStatus) =>
    status ? allInvoices.filter((i) => i.paymentStatus === status) : allInvoices;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (invoiceList: InvoiceRow[]) => {
    const allSelected = invoiceList.every((i) => selectedIds.has(i.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        invoiceList.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        invoiceList.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  function renderTable(invoiceList: InvoiceRow[]) {
    if (isLoading) {
      return (
        <div className="space-y-3 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      );
    }

    const allSelected =
      invoiceList.length > 0 && invoiceList.every((i) => selectedIds.has(i.id));

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => toggleSelectAll(invoiceList)}
              />
            </TableHead>
            <TableHead>Leverancier</TableHead>
            <TableHead>Factuurnummer</TableHead>
            <TableHead>Ontvangen</TableHead>
            <TableHead>Vervaldatum</TableHead>
            <TableHead className="text-right">Bedrag</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actie</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoiceList.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-12 text-center text-muted-foreground"
              >
                Geen facturen gevonden
              </TableCell>
            </TableRow>
          ) : (
            invoiceList.map((invoice) => (
              <TableRow key={invoice.id} className="hover:bg-muted/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(invoice.id)}
                    onCheckedChange={() => toggleSelect(invoice.id)}
                  />
                </TableCell>
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
                <TableCell>
                  {invoice.ontvangen ? formatDate(invoice.ontvangen) : "—"}
                </TableCell>
                <TableCell>
                  {invoice.vervaldatum ? formatDate(invoice.vervaldatum) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.totaal)}
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={invoice.paymentStatus} />
                </TableCell>
                <TableCell className="text-right">
                  {invoice.paymentStatus === "nieuw" && (
                    <Button
                      size="sm"
                      onClick={() => setBookingInvoice(invoice)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <BookOpen className="mr-1.5 h-3 w-3" />
                      Boeken
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    );
  }

  const tabs: { value: string; label: string; status?: PaymentStatus }[] = [
    { value: "alle", label: "Alle" },
    { value: "nieuw", label: "Nieuw", status: "nieuw" },
    { value: "geboekt", label: "Geboekt", status: "goedgekeurd" },
    { value: "ingepland", label: "Ingepland", status: "ingepland" },
    { value: "betaald", label: "Betaald", status: "betaald" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-4">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Inkoopfacturen</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={resetTestData.isPending}
            onClick={() => {
              if (window.confirm("Weet je het zeker? Dit verwijdert alle facturen, boekingen en contacten.")) {
                resetTestData.mutate();
              }
            }}
          >
            {resetTestData.isPending ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3 w-3" />
            )}
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={scanInbox.isPending}
            onClick={() => scanInbox.mutate()}
          >
            {scanInbox.isPending ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3 w-3" />
            )}
            Inbox scannen
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-6">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">
              {selectedIds.size} geselecteerd
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselecteer
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="alle">
              <TabsList>
                {tabs.map((tab) => {
                  const count = filterByStatus(tab.status).length;
                  return (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label} ({count})
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-4">
                  {renderTable(filterByStatus(tab.status))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {bookingInvoice && (
        <BookingDialog
          invoice={bookingInvoice}
          onClose={() => setBookingInvoice(null)}
        />
      )}
    </div>
  );
}
