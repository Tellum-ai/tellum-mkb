"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

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
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { api, type RouterOutputs } from "~/trpc/react";

type JournalEntry = RouterOutputs["ledger"]["getJournalEntries"][number];

const TYPE_LABELS: Record<JournalEntry["type"], string> = {
  purchase_invoice: "Inkoopfactuur",
  sales_invoice: "Verkoopfactuur",
  bank_payment: "Betaling",
  manual: "Handmatig",
};

const TYPE_VARIANTS: Record<
  JournalEntry["type"],
  "default" | "secondary" | "outline"
> = {
  purchase_invoice: "default",
  sales_invoice: "secondary",
  bank_payment: "outline",
  manual: "outline",
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function EntryRow({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false);

  const totalDebit = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const balanced = totalDebit === totalCredit;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-6 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(entry.date)}
        </TableCell>
        <TableCell className="font-medium">{entry.description}</TableCell>
        <TableCell className="text-muted-foreground">
          {entry.reference ?? "—"}
        </TableCell>
        <TableCell>
          <Badge variant={TYPE_VARIANTS[entry.type]}>
            {TYPE_LABELS[entry.type]}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatCents(totalDebit)}
        </TableCell>
        <TableCell className="text-right">
          {!balanced && (
            <Badge variant="destructive" className="text-xs">
              Ongebalanceerd
            </Badge>
          )}
        </TableCell>
      </TableRow>

      {expanded &&
        entry.lines.map((line) => (
          <TableRow key={line.id} className="bg-muted/30 hover:bg-muted/40">
            <TableCell />
            <TableCell />
            <TableCell className="pl-8 text-sm text-muted-foreground">
              {line.ledgerAccount.number} — {line.ledgerAccount.name}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right font-mono text-sm">
              {line.debit != null ? formatCents(line.debit) : ""}
            </TableCell>
            <TableCell className="text-right font-mono text-sm text-muted-foreground">
              {line.credit != null ? formatCents(line.credit) : ""}
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell colSpan={7}>
        <Skeleton className="h-5 w-full" />
      </TableCell>
    </TableRow>
  ));
}

export default function LedgerPage() {
  const { data: entries, isLoading } = api.ledger.getJournalEntries.useQuery();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Journaalposten</span>
      </header>

      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>Datum</TableHead>
                  <TableHead>Omschrijving</TableHead>
                  <TableHead>Referentie</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debet</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SkeletonRows />
                ) : !entries?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      Nog geen journaalposten. Goedgekeurde facturen worden hier
                      geboekt.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
