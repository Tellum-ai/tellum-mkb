"use client";

import { Building2, Loader2, ArrowDownLeft, FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
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
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { formatCurrency, formatDate } from "~/lib/format";

export default function BankPage() {
  const utils = api.useUtils();

  const { data: connections, isLoading: connectionsLoading } =
    api.bank.getConnections.useQuery();

  const firstConnection = connections?.[0];

  const { data: transactions, isLoading: txLoading } =
    api.bank.getTransactions.useQuery(
      { connectionId: firstConnection?.id ?? "" },
      { enabled: !!firstConnection },
    );

  const { mutate: seedTestData, isPending: isSeeding } =
    api.bank.seedTestData.useMutation({
      onSuccess: ({ inserted }) => {
        void utils.bank.getConnections.invalidate();
        void utils.bank.getTransactions.invalidate();
        toast.success(`${inserted} testtransacties aangemaakt`);
      },
      onError: () => toast.error("Seed mislukt"),
    });

  return (
    <div className="flex flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Bank</h1>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedTestData()}
            disabled={isSeeding}
          >
            {isSeeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-2 h-4 w-4" />
            )}
            Testdata laden
          </Button>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        {/* Connected accounts */}
        {connectionsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : connections && connections.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm font-medium">
                      {conn.institutionName ?? "Bank"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{conn.accountName}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {conn.lastSyncAt
                      ? `Gesynchroniseerd: ${formatDate(conn.lastSyncAt.toISOString())}`
                      : "Nog niet gesynchroniseerd"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center gap-4 py-16">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Geen bankrekening gekoppeld</p>
              <p className="text-sm text-muted-foreground">
                Laad testdata om te beginnen
              </p>
            </div>
            <Button onClick={() => seedTestData()} disabled={isSeeding}>
              {isSeeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              Testdata laden
            </Button>
          </Card>
        )}

        {/* Transactions table */}
        {firstConnection && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownLeft className="h-4 w-4" />
                Transacties
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Omschrijving</TableHead>
                      <TableHead>Bedrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gekoppeld</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {formatDate(tx.date.toISOString())}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {tx.merchantName ?? tx.description ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-sm font-medium ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {formatCurrency(tx.amount / 100)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.status === "pending" ? "secondary" : "outline"}>
                            {tx.status === "pending" ? "In behandeling" : "Verwerkt"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tx.journalEntryId ? (
                            <Badge variant="default">Geboekt</Badge>
                          ) : (
                            <Badge variant="secondary">Openstaand</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Geen transacties — klik op Testdata laden
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
