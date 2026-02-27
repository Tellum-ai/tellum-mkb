import { z } from "zod";
import { eq, and, inArray, ne, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  invoices,
  processedEmails,
  contacts,
  subscription,
  invoiceUsage,
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
          // Check if contact already exists by email
          const existing = await tx.query.contacts.findFirst({
            where: eq(contacts.email, input.contactEmail),
          });

          if (existing) {
            contactId = existing.id;
          } else {
            const [newContact] = await tx
              .insert(contacts)
              .values({
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
});

export { checkInvoiceLimit, incrementInvoiceUsage };
