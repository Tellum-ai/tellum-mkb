"use client";

import { Users } from "lucide-react";
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
import { Switch } from "~/components/ui/switch";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/lib/format";
import { api } from "~/trpc/react";

const avatarColors = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
];

function getColorFromString(s: string) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]!;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ContactsPage() {
  const utils = api.useUtils();
  const { data: contacts, isLoading } = api.contact.getAll.useQuery();

  const update = api.contact.update.useMutation({
    onMutate: async (input) => {
      await utils.contact.getAll.cancel();
      const prev = utils.contact.getAll.getData();
      utils.contact.getAll.setData(undefined, (old) =>
        old?.map((c) => {
          if (c.id !== input.id) return c;
          return {
            ...c,
            ...(input.isWhitelisted !== undefined && {
              isWhitelisted: input.isWhitelisted,
            }),
            ...(input.autoApprove !== undefined && {
              autoApprove: input.autoApprove,
            }),
            // Turning off whitelist forces auto-approve off
            ...(input.isWhitelisted === false && { autoApprove: false }),
          };
        }),
      );
      return { prev };
    },
    onError: (_err, _input, context) => {
      if (context?.prev) utils.contact.getAll.setData(undefined, context.prev);
      toast.error("Kon contact niet bijwerken");
    },
    onSettled: () => {
      void utils.contact.getAll.invalidate();
    },
    onSuccess: () => {
      toast.success("Contact bijgewerkt");
    },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-4 border-b px-6 py-4">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Contacten</h1>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-6">
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !contacts?.length ? (
              <div className="py-12 text-center text-muted-foreground">
                Nog geen contacten. Contacten worden automatisch aangemaakt
                wanneer facturen worden ontvangen.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bedrijf</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="text-center">Facturen</TableHead>
                    <TableHead className="text-right">Totaal</TableHead>
                    <TableHead className="text-center">Whitelist</TableHead>
                    <TableHead className="text-center">Auto-goedkeuren</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getColorFromString(contact.email)}`}
                          >
                            {getInitials(
                              contact.companyName ?? contact.email,
                            )}
                          </div>
                          <span className="font-medium">
                            {contact.companyName ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.email}
                      </TableCell>
                      <TableCell className="text-center">
                        {contact.invoiceCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(contact.totalAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={contact.isWhitelisted}
                          onCheckedChange={(checked) =>
                            update.mutate({
                              id: contact.id,
                              isWhitelisted: checked,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={contact.autoApprove}
                          disabled={!contact.isWhitelisted}
                          onCheckedChange={(checked) =>
                            update.mutate({
                              id: contact.id,
                              autoApprove: checked,
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
