import { z } from "zod";
import { eq, and, inArray, ne, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { calculateVatSplit } from "~/server/bookkeeping/vat";
import { isBalanced } from "~/server/bookkeeping/journal";
import {
  invoices,
  processedEmails,
  contacts,
  subscription,
  invoiceUsage,
  journalEntries,
  journalEntryLines,
  ledgerAccounts,
} from "~/server/db/schema";
import { PLANS, type PlanId } from "~/lib/billing";
import type { PaymentStatus } from "~/lib/format";
import type { InvoiceData } from "~/server/email/types";

async function checkInvoiceLimit(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  userId: string,
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const sub = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  if (!sub) return;

  const plan = PLANS[sub.plan as PlanId];
  if (plan.invoiceLimit === Infinity) return;

  const usage = await db.query.invoiceUsage.findFirst({
    where: and(
      eq(invoiceUsage.userId, userId),
      eq(invoiceUsage.year, year),
      eq(invoiceUsage.month, month),
    ),
  });

  if (usage && usage.invoiceCount >= plan.invoiceLimit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Je hebt het maximum van ${plan.invoiceLimit} facturen per maand bereikt. Upgrade je plan voor meer facturen.`,
    });
  }
}

async function incrementInvoiceUsage(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  userId: string,
) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const existing = await db.query.invoiceUsage.findFirst({
    where: and(
      eq(invoiceUsage.userId, userId),
      eq(invoiceUsage.year, year),
      eq(invoiceUsage.month, month),
    ),
  });

  if (existing) {
    await db
      .update(invoiceUsage)
      .set({ invoiceCount: existing.invoiceCount + 1 })
      .where(eq(invoiceUsage.id, existing.id));
  } else {
    await db.insert(invoiceUsage).values({
      userId,
      year,
      month,
      invoiceCount: 1,
    });
  }
}

export const invoiceRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z
        .object({
          paymentStatus: z
            .enum(["nieuw", "goedgekeurd", "ingepland", "betaald"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Show all extracted invoices (processed, error, or processing — just not not_processed)
      const conditions = [ne(invoices.status, "not_processed")];

      if (input?.paymentStatus) {
        conditions.push(eq(invoices.paymentStatus, input.paymentStatus));
      }

      const rows = await ctx.db
        .select({
          id: invoices.id,
          invoiceData: invoices.invoiceData,
          invoiceNumber: invoices.invoiceNumber,
          invoiceDate: invoices.invoiceDate,
          senderCompany: invoices.senderCompany,
          totalInclVat: invoices.totalInclVat,
          paymentStatus: invoices.paymentStatus,
          contactId: invoices.contactId,
          pdfUrls: invoices.pdfUrls,
          createdAt: invoices.createdAt,
          // From processedEmails
          fromAddress: processedEmails.fromAddress,
          subject: processedEmails.subject,
          receivedAt: processedEmails.receivedAt,
          // From contacts
          contactEmail: contacts.email,
          contactCompanyName: contacts.companyName,
          contactIsWhitelisted: contacts.isWhitelisted,
        })
        .from(invoices)
        .innerJoin(
          processedEmails,
          eq(invoices.processedEmailId, processedEmails.id),
        )
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt));

      return rows.map((row) => {
        const data = row.invoiceData as InvoiceData;
        return {
          id: row.id,
          leverancier: row.senderCompany ?? data?.sender?.company ?? "Onbekend",
          leverancierEmail: row.fromAddress ?? "",
          onderwerp: row.subject ?? "",
          factuurnummer: row.invoiceNumber ?? data?.invoice_number ?? "",
          factuurdatum: row.invoiceDate ?? data?.invoice_date ?? "",
          vervaldatum: data?.due_date ?? "",
          totaal: parseFloat(row.totalInclVat ?? "0"),
          paymentStatus: row.paymentStatus as PaymentStatus,
          contactId: row.contactId,
          contact: row.contactId
            ? {
                email: row.contactEmail,
                companyName: row.contactCompanyName,
                isWhitelisted: row.contactIsWhitelisted,
              }
            : null,
          ontvangen: row.receivedAt?.toISOString() ?? row.createdAt.toISOString(),
          pdfUrls: row.pdfUrls ?? [],
        };
      });
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        paymentStatus: invoices.paymentStatus,
        totalInclVat: invoices.totalInclVat,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(ne(invoices.status, "not_processed"));

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const totaal = rows.length;
    const nieuw = rows.filter((r) => r.paymentStatus === "nieuw").length;
    const openstaand = rows
      .filter((r) => r.paymentStatus !== "betaald")
      .reduce((sum, r) => sum + parseFloat(r.totalInclVat ?? "0"), 0);
    const betaaldDezeMaand = rows
      .filter(
        (r) =>
          r.paymentStatus === "betaald" &&
          r.createdAt.toISOString().startsWith(currentMonth),
      )
      .reduce((sum, r) => sum + parseFloat(r.totalInclVat ?? "0"), 0);

    return { totaal, nieuw, openstaand, betaaldDezeMaand };
  }),

  approve: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(invoices)
        .set({ paymentStatus: "goedgekeurd" })
        .where(
          and(
            inArray(invoices.id, input.ids),
            eq(invoices.paymentStatus, "nieuw"),
          ),
        );

      return { count: input.ids.length };
    }),

  approveAndWhitelist: protectedProcedure
    .input(
      z.object({
        invoiceIds: z.array(z.string()).min(1),
        contactId: z.string().optional(),
        contactEmail: z.string().optional(),
        contactCompanyName: z.string().optional(),
        autoApprove: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        let contactId = input.contactId;

        // Create contact if it doesn't exist yet
        if (!contactId && input.contactEmail) {
          const contactEmail = input.contactEmail;
          const existing = await tx.query.contacts.findFirst({
            where: (c, { and }) =>
              and(eq(c.userId, ctx.session.user.id), eq(c.email, contactEmail)),
          });

          if (existing) {
            contactId = existing.id;
          } else {
            const [newContact] = await tx
              .insert(contacts)
              .values({
                userId: ctx.session.user.id,
                email: input.contactEmail,
                companyName: input.contactCompanyName,
              })
              .returning();
            contactId = newContact!.id;
          }

          // Link invoices to this contact
          await tx
            .update(invoices)
            .set({ contactId })
            .where(inArray(invoices.id, input.invoiceIds));
        }

        // Approve the invoices
        await tx
          .update(invoices)
          .set({ paymentStatus: "goedgekeurd" })
          .where(
            and(
              inArray(invoices.id, input.invoiceIds),
              eq(invoices.paymentStatus, "nieuw"),
            ),
          );

        // Whitelist the contact
        if (contactId) {
          await tx
            .update(contacts)
            .set({
              isWhitelisted: true,
              autoApprove: input.autoApprove,
            })
            .where(eq(contacts.id, contactId));
        }
      });

      return { count: input.invoiceIds.length };
    }),

  markPaid: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(invoices)
        .set({ paymentStatus: "betaald" })
        .where(inArray(invoices.id, input.ids));

      return { count: input.ids.length };
    }),

  // Auto-book a purchase invoice using the VAT treatment detected by Gemini.
  // Journal entry patterns:
  //   nl_standaard: DEBIT costs + DEBIT 1500 BTW / CREDIT 1100 Crediteuren (incl. BTW)
  //   nl_verlegd:   DEBIT costs + DEBIT 1500 BTW / CREDIT 1800 BTW verlegd + CREDIT 1100 Crediteuren (excl. BTW)
  //   eu_diensten:  same as nl_verlegd (reverse charge on intracommunautaire services)
  //   buiten_eu:    DEBIT costs / CREDIT 1100 Crediteuren (no VAT at all)
  autoBook: protectedProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const invoice = await ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden" });
      if (invoice.journalEntryId) throw new TRPCError({ code: "BAD_REQUEST", message: "Factuur is al geboekt" });

      const data = invoice.invoiceData as InvoiceData;
      const vatTreatment = data?.vat_treatment ?? "nl_standaard";
      const costAccountNumber = data?.cost_category ?? 4000;
      const totalInclVatCents = Math.round(parseFloat(invoice.totalInclVat ?? "0") * 100);

      // Fetch all required accounts in one go
      const [costAccount, crediteuren, btwTeVorderen, btwVerlegd] = await Promise.all([
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, costAccountNumber)),
        }),
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1100)),
        }),
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1500)),
        }),
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1800)),
        }),
      ]);

      if (!crediteuren) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Grootboekrekening 1100 niet gevonden" });
      if (!btwTeVorderen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Grootboekrekening 1500 niet gevonden" });

      // Fall back to 4000 if the suggested cost account doesn't exist yet
      const costsLedger = costAccount ?? await ctx.db.query.ledgerAccounts.findFirst({
        where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 4000)),
      });
      if (!costsLedger) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Geen kostenrekening gevonden" });

      // Determine the VAT rate from line items (take the most common/highest)
      const vatRate = data?.line_items?.[0]?.vat_rate ?? 0;
      const vatRatePercent = vatRate > 1 ? vatRate : Math.round(vatRate * 100); // handle 0.21 and 21 both
      const { exclVatCents, vatCents } = calculateVatSplit(totalInclVatCents, vatRatePercent as 0 | 9 | 21);

      type JournalLine = { accountId: string; debit: number | null; credit: number | null };
      let lines: JournalLine[];

      if (vatTreatment === "buiten_eu") {
        // No VAT — just cost vs crediteuren
        lines = [
          { accountId: costsLedger.id,   debit: totalInclVatCents, credit: null },
          { accountId: crediteuren.id,   debit: null, credit: totalInclVatCents },
        ];
      } else if (vatTreatment === "nl_verlegd" || vatTreatment === "eu_diensten") {
        if (!btwVerlegd) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Grootboekrekening 1800 niet gevonden" });
        const vatAmount = Math.round(exclVatCents * 0.21); // self-assessed at 21%
        lines = [
          { accountId: costsLedger.id,    debit: exclVatCents,  credit: null },
          { accountId: btwTeVorderen.id,  debit: vatAmount,     credit: null },
          { accountId: btwVerlegd.id,     debit: null,          credit: vatAmount },
          { accountId: crediteuren.id,    debit: null,          credit: exclVatCents },
        ];
      } else {
        // nl_standaard
        lines = [
          { accountId: costsLedger.id,   debit: exclVatCents,       credit: null },
          ...(vatCents > 0 ? [{ accountId: btwTeVorderen.id, debit: vatCents, credit: null }] : []),
          { accountId: crediteuren.id,   debit: null,               credit: totalInclVatCents },
        ];
      }

      const balanceCheck = lines.map(l => ({ debit: l.debit, credit: l.credit }));
      if (!isBalanced(balanceCheck)) throw new Error("Journaalpost klopt niet");

      await ctx.db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(journalEntries)
          .values({
            userId,
            date: new Date(),
            description: `Inkoopfactuur ${invoice.invoiceNumber ?? invoice.senderCompany ?? "onbekend"}`,
            reference: invoice.invoiceNumber ?? undefined,
            type: "purchase_invoice",
          })
          .returning();

        if (!entry) throw new Error("Journaalpost aanmaken mislukt");

        await tx.insert(journalEntryLines).values(
          lines.map((l) => ({
            journalEntryId: entry.id,
            ledgerAccountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        );

        await tx
          .update(invoices)
          .set({ journalEntryId: entry.id, paymentStatus: "goedgekeurd" })
          .where(eq(invoices.id, input.invoiceId));
      });

      return { ok: true, vatTreatment, costAccountNumber: costsLedger.number };
    }),

  // Book a purchase invoice into the ledger (double-entry).
  // Creates a journaalpost with 3 lines:
  //   DEBIT  kostenrekening     amount excl. BTW
  //   DEBIT  BTW te vorderen    BTW amount
  //   CREDIT crediteuren        total incl. BTW
  bookPurchase: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        ledgerAccountId: z.string(), // cost account chosen by user
        vatRate: z.union([z.literal(0), z.literal(9), z.literal(21)]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const invoice = await ctx.db.query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
      });
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factuur niet gevonden" });
      }
      if (invoice.journalEntryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Factuur is al geboekt" });
      }

      // Look up the required system accounts for this tenant
      const [crediteuren, btwTeVorderen] = await Promise.all([
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1100)),
        }),
        ctx.db.query.ledgerAccounts.findFirst({
          where: and(eq(ledgerAccounts.userId, userId), eq(ledgerAccounts.number, 1500)),
        }),
      ]);

      if (!crediteuren || !btwTeVorderen) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Grootboekrekeningen 1100/1500 niet gevonden. Zijn de standaardrekeningen aangemaakt?",
        });
      }

      const totalInclVatCents = Math.round(parseFloat(invoice.totalInclVat ?? "0") * 100);
      const { exclVatCents, vatCents } = calculateVatSplit(totalInclVatCents, input.vatRate);

      const lines = [
        { debit: exclVatCents, credit: null },
        ...(vatCents > 0 ? [{ debit: vatCents, credit: null }] : []),
        { debit: null, credit: totalInclVatCents },
      ];
      if (!isBalanced(lines)) {
        throw new Error(`Journaalpost klopt niet: debits en credits zijn ongelijk`);
      }

      await ctx.db.transaction(async (tx) => {
        const [entry] = await tx
          .insert(journalEntries)
          .values({
            userId,
            date: new Date(),
            description: `Inkoopfactuur ${invoice.invoiceNumber ?? invoice.senderCompany ?? "onbekend"}`,
            reference: invoice.invoiceNumber ?? undefined,
            type: "purchase_invoice",
          })
          .returning();

        if (!entry) throw new Error("Journaalpost aanmaken mislukt");

        const accountIds = [
          input.ledgerAccountId,
          ...(vatCents > 0 ? [btwTeVorderen.id] : []),
          crediteuren.id,
        ];
        await tx.insert(journalEntryLines).values(
          lines.map((line, i) => ({
            journalEntryId: entry.id,
            ledgerAccountId: accountIds[i]!,
            debit: line.debit,
            credit: line.credit,
          })),
        );

        await tx
          .update(invoices)
          .set({ journalEntryId: entry.id, paymentStatus: "goedgekeurd" })
          .where(eq(invoices.id, input.invoiceId));
      });

      return { ok: true };
    }),
});

export { checkInvoiceLimit, incrementInvoiceUsage };
