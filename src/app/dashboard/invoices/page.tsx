"use client";

import { useState } from "react";
import {
  FileText,
  Mail,
  Clock,
  CheckCircle2,
  CalendarClock,
  Loader2,
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
      label: "Goedgekeurd",
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

export default function InvoicesPage() {
  const utils = api.useUtils();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [whitelistDialog, setWhitelistDialog] = useState<{
    invoice: InvoiceRow;
    autoApprove: boolean;
  } | null>(null);

  const { data: invoices, isLoading } = api.invoice.getAll.useQuery();

  const approve = api.invoice.approve.useMutation({
    onSuccess: () => {
      void utils.invoice.getAll.invalidate();
      void utils.invoice.getStats.invalidate();
      setSelectedIds(new Set());
      setMutatingId(null);
      toast.success("Facturen goedgekeurd");
    },
    onError: () => {
      setMutatingId(null);
      toast.error("Kon facturen niet goedkeuren");
    },
  });

  const approveAndWhitelist = api.invoice.approveAndWhitelist.useMutation({
    onSuccess: () => {
      void utils.invoice.getAll.invalidate();
      void utils.invoice.getStats.invalidate();
      void utils.contact.getAll.invalidate();
      setSelectedIds(new Set());
      setWhitelistDialog(null);
      toast.success("Factuur goedgekeurd en contact op whitelist gezet");
    },
    onError: () => toast.error("Kon factuur niet goedkeuren"),
  });


  const allInvoices = invoices ?? [];

  const filterByStatus = (status?: PaymentStatus) =>
    status
      ? allInvoices.filter((i) => i.paymentStatus === status)
      : allInvoices;

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

  const handleSingleApprove = (invoice: InvoiceRow) => {
    // If contact is already whitelisted, approve directly
    if (invoice.contact?.isWhitelisted) {
      setMutatingId(invoice.id);
      approve.mutate({ ids: [invoice.id] });
      return;
    }
    // Otherwise show whitelist dialog (works with or without existing contact)
    setWhitelistDialog({ invoice, autoApprove: false });
  };

  const handleBulkApprove = () => {
    const ids = allInvoices
      .filter((i) => selectedIds.has(i.id) && i.paymentStatus === "nieuw")
      .map((i) => i.id);
    if (ids.length > 0) approve.mutate({ ids });
  };

  const isBulkMutating =
    approve.isPending || approveAndWhitelist.isPending;

  const selectedNieuwCount = allInvoices.filter(
    (i) => selectedIds.has(i.id) && i.paymentStatus === "nieuw",
  ).length;

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
      invoiceList.length > 0 &&
      invoiceList.every((i) => selectedIds.has(i.id));

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
                      disabled={mutatingId === invoice.id}
                      onClick={() => handleSingleApprove(invoice)}
                      className="bg-primary text-primary-foreground hover:bg-periwinkle-dark"
                    >
                      {mutatingId === invoice.id ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : null}
                      Goedkeuren
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
    { value: "goedgekeurd", label: "Goedgekeurd", status: "goedgekeurd" },
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
          <h1 className="text-xl font-semibold">Facturen</h1>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-6">
        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            <span className="text-sm font-medium">
              {selectedIds.size} geselecteerd
            </span>
            <Separator orientation="vertical" className="h-5" />
            {selectedNieuwCount > 0 && (
              <Button
                size="sm"
                disabled={isBulkMutating}
                onClick={handleBulkApprove}
              >
                {approve.isPending && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Goedkeuren ({selectedNieuwCount})
              </Button>
            )}
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

      {/* Whitelist prompt dialog */}
      <AlertDialog
        open={!!whitelistDialog}
        onOpenChange={(open) => {
          if (!open) setWhitelistDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contact op whitelist zetten?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <strong>{whitelistDialog?.invoice.leverancier}</strong> (
                {whitelistDialog?.invoice.leverancierEmail}) staat nog niet op de
                whitelist. Wil je dit contact toevoegen zodat toekomstige facturen
                sneller verwerkt worden?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="auto-approve"
              checked={whitelistDialog?.autoApprove ?? false}
              onCheckedChange={(checked) =>
                setWhitelistDialog((prev) =>
                  prev ? { ...prev, autoApprove: !!checked } : null,
                )
              }
            />
            <label htmlFor="auto-approve" className="text-sm">
              Automatisch goedkeuren voor toekomstige facturen
            </label>
          </div>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const inv = whitelistDialog?.invoice;
                setWhitelistDialog(null);
                if (inv) {
                  approve.mutate({ ids: [inv.id] });
                }
              }}
            >
              Alleen goedkeuren
            </Button>
            <Button
              onClick={() => {
                const inv = whitelistDialog?.invoice;
                const autoApprove = whitelistDialog?.autoApprove ?? false;
                setWhitelistDialog(null);
                if (inv) {
                  approveAndWhitelist.mutate({
                    invoiceIds: [inv.id],
                    contactId: inv.contactId ?? undefined,
                    contactEmail: inv.leverancierEmail,
                    contactCompanyName: inv.leverancier,
                    autoApprove,
                  });
                }
              }}
            >
              Whitelist + goedkeuren
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
