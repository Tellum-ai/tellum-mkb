import { eq, inArray } from "drizzle-orm";
import { ImapFlow } from "imapflow";

import { env } from "~/env.js";
import { db } from "~/server/db/index";
import { invoices, processedEmails, contacts } from "~/server/db/schema";
import { createMoneybirdExternalSalesInvoice } from "~/server/moneybird";
import type { GeminiExtractionResult, InvoiceData, ParsedEmail } from "./types";

/**
 * Extract a bare email address from a "Name <email>" string.
 */
function extractEmail(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  return (match?.[1] ?? from).trim().toLowerCase();
}

export async function isEmailAlreadyProcessed(
  gmailMessageId: string
): Promise<boolean> {
  const existing = await db.query.processedEmails.findFirst({
    where: eq(processedEmails.gmailMessageId, gmailMessageId),
  });
  return existing !== undefined;
}

/**
 * Bulk check: given a list of Message-IDs, returns the subset that have
 * already been recorded in the database. One query instead of N.
 */
export async function getAlreadyProcessedIds(
  gmailMessageIds: string[]
): Promise<Set<string>> {
  if (gmailMessageIds.length === 0) return new Set();

  const rows = await db
    .select({ gmailMessageId: processedEmails.gmailMessageId })
    .from(processedEmails)
    .where(inArray(processedEmails.gmailMessageId, gmailMessageIds));

  return new Set(rows.map((r) => r.gmailMessageId));
}

export async function storeEmailResult(
  email: ParsedEmail,
  result: GeminiExtractionResult
): Promise<void> {
  const isInvoice = result !== null;

  // Collect any R2 URLs that were set on the attachments before this call
  const pdfUrls = email.attachments
    .map((a) => a.r2Url)
    .filter((url): url is string => url !== undefined);

  let invoiceRowId: string | undefined;

  await db.transaction(async (tx) => {
    const [insertedEmail] = await tx
      .insert(processedEmails)
      .values({
        gmailMessageId: email.gmailMessageId,
        imapUid: String(email.imapUid),
        subject: email.subject,
        fromAddress: email.from,
        receivedAt: email.receivedAt,
        wasInvoice: isInvoice ? "yes" : "no",
      })
      .returning();

    if (!insertedEmail) {
      throw new Error(
        `Failed to insert processedEmail record for message ${email.gmailMessageId}`
      );
    }

    if (isInvoice && result.invoice) {
      const inv = result.invoice;
      const senderEmail = extractEmail(email.from);

      // Upsert contact: find by email or create
      let contact = await tx.query.contacts.findFirst({
        where: eq(contacts.email, senderEmail),
      });

      if (!contact) {
        const [newContact] = await tx
          .insert(contacts)
          .values({
            email: senderEmail,
            companyName: inv.sender.company,
          })
          .returning();
        contact = newContact;
      }

      // Auto-approve if contact is whitelisted with autoApprove
      const paymentStatus =
        contact?.isWhitelisted && contact?.autoApprove
          ? "ingepland"
          : "nieuw";

      const [insertedInvoice] = await tx
        .insert(invoices)
        .values({
          processedEmailId: insertedEmail.id,
          gmailMessageId: email.gmailMessageId,
          invoiceData: result as unknown as Record<string, unknown>,
          status: "processing",
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          senderCompany: inv.sender.company,
          totalInclVat: String(inv.totals.total_incl_vat),
          paymentStatus,
          contactId: contact?.id,
          pdfUrls,
        })
        .returning();

      if (insertedInvoice) {
        invoiceRowId = insertedInvoice.id;
      }
    }
  });

  console.log(
    `[store] Saved message ${email.gmailMessageId} | invoice=${isInvoice} | pdfs=${pdfUrls.length}`
  );

  // Push to Moneybird after the transaction has committed so a Moneybird
  // failure never rolls back the stored invoice record.
  if (invoiceRowId && isInvoice && result?.invoice) {
    await syncToMoneybird(invoiceRowId, result.invoice);
  }
}

async function syncToMoneybird(
  invoiceRowId: string,
  invoice: InvoiceData
): Promise<void> {
  try {
    const moneybirdId = await createMoneybirdExternalSalesInvoice(invoice);
    await db
      .update(invoices)
      .set({ status: "processed", moneybirdId })
      .where(eq(invoices.id, invoiceRowId));
    console.log(
      `[store] Synced invoice ${invoiceRowId} to Moneybird (id=${moneybirdId})`
    );
  } catch (err) {
    await db
      .update(invoices)
      .set({ status: "error" })
      .where(eq(invoices.id, invoiceRowId));
    console.error(
      `[store] Failed to sync invoice ${invoiceRowId} to Moneybird:`,
      err
    );
  }
}

export async function markEmailAsRead(imapUid: number): Promise<void> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
    logger: false,
  });

  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    await client.messageFlagsAdd(
      { uid: imapUid } as unknown as string,
      ["\\Seen"],
      { uid: true }
    );
    console.log(`[store] Marked IMAP UID=${imapUid} as read.`);
  } finally {
    await client.logout();
  }
}
