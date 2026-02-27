import { createTRPCRouter, publicProcedure } from "~/server/api/trpc.js";
import { extractInvoiceFromEmail } from "~/server/email/processor.js";
import { fetchUnreadEmails } from "~/server/email/scanner.js";
import {
  isEmailAlreadyProcessed,
  markEmailAsRead,
  storeEmailResult,
} from "~/server/email/store.js";

const BATCH_SIZE = 3;

export const emailRouter = createTRPCRouter({
  /**
   * Fetches all unread emails from Gmail, skips already-processed ones,
   * and processes at most BATCH_SIZE new emails per call.
   *
   * Successive cron runs drain the inbox BATCH_SIZE emails at a time.
   */
  scanInbox: publicProcedure.mutation(async () => {
    const allEmails = await fetchUnreadEmails();

    const results = {
      processed: 0,
      invoicesFound: 0,
      skipped: 0,
      remaining: 0,
    };

    let batchCount = 0;

    for (const email of allEmails) {
      const alreadyProcessed = await isEmailAlreadyProcessed(
        email.gmailMessageId
      );

      if (alreadyProcessed) {
        results.skipped++;
        continue;
      }

      if (batchCount >= BATCH_SIZE) {
        results.remaining++;
        continue;
      }

      console.log(
        `[email.scanInbox] Processing message ${email.gmailMessageId} | Subject: "${email.subject}"`
      );

      const result = await extractInvoiceFromEmail(email);
      await storeEmailResult(email, result);
      await markEmailAsRead(email.imapUid);

      batchCount++;
      results.processed++;

      if (result !== null) {
        results.invoicesFound++;
        console.log(
          `[email.scanInbox] Invoice extracted: ${result.invoice.invoice_number} from ${result.invoice.sender.company}`
        );
      } else {
        console.log(
          `[email.scanInbox] Message ${email.gmailMessageId} is not an invoice, recorded and skipped.`
        );
      }
    }

    console.log(
      `[email.scanInbox] Done. processed=${results.processed} invoices=${results.invoicesFound} skipped=${results.skipped} remaining=${results.remaining}`
    );

    return results;
  }),
});
