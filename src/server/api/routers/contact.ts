import { z } from "zod";
import { eq, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { contacts, invoices } from "~/server/db/schema";

export const contactRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: contacts.id,
        email: contacts.email,
        companyName: contacts.companyName,
        isWhitelisted: contacts.isWhitelisted,
        autoApprove: contacts.autoApprove,
        createdAt: contacts.createdAt,
        invoiceCount: sql<number>`count(${invoices.id})::int`,
        totalAmount: sql<number>`coalesce(sum(${invoices.totalInclVat}::numeric), 0)::float`,
      })
      .from(contacts)
      .leftJoin(invoices, eq(invoices.contactId, contacts.id))
      .groupBy(contacts.id)
      .orderBy(sql`${contacts.createdAt} desc`);

    return rows;
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        isWhitelisted: z.boolean().optional(),
        autoApprove: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Turning off whitelist forces autoApprove off
      if (updates.isWhitelisted === false) {
        updates.autoApprove = false;
      }

      const [updated] = await ctx.db
        .update(contacts)
        .set(updates)
        .where(eq(contacts.id, id))
        .returning();

      return updated;
    }),
});
