import { eq } from "drizzle-orm";
import { ImapFlow } from "imapflow";

import { env } from "~/env.js";
import { db } from "~/server/db/index";
import { invoices, processedEmails } from "~/server/db/schema";
import type { GeminiExtractionResult, ParsedEmail } from "./types";

export async function isEmailAlreadyProcessed(
  gmailMessageId: string
): Promise<boolean> {
  const existing = await db.query.processedEmails.findFirst({
    where: eq(processedEmails.gmailMessageId, gmailMessageId),
  });
  return existing !== undefined;
}

export async function storeEmailResult(
  email: ParsedEmail,
  result: GeminiExtractionResult
): Promise<void> {
  const isInvoice = result !== null;

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
      await tx.insert(invoices).values({
        processedEmailId: insertedEmail.id,
        gmailMessageId: email.gmailMessageId,
        invoiceData: result as unknown as Record<string, unknown>,
        status: "not_processed",
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        senderCompany: inv.sender.company,
        totalInclVat: String(inv.totals.total_incl_vat),
      });
    }
  });

  console.log(
    `[store] Saved message ${email.gmailMessageId} | invoice=${isInvoice}`
  );
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
