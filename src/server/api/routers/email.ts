import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { extractInvoiceFromEmail } from "~/server/email/processor";
import { fetchEmailsByUids, listUnreadUids } from "~/server/email/scanner";
import {
  getAlreadyProcessedIds,
  markEmailAsRead,
  storeEmailResult,
} from "~/server/email/store";
import { uploadPdfToR2 } from "~/server/r2";

const BATCH_SIZE = 3;

export const emailRouter = createTRPCRouter({
  /**
   * Correct processing order:
   *  1. List ALL unread UIDs from Gmail (lightweight — no body download).
   *  2. Bulk-check the DB to find which ones we have already processed.
   *  3. From the unprocessed set, pick the BATCH_SIZE oldest emails.
   *  4. Fetch & parse only those emails (expensive step, done once per batch).
   *  5. Run Gemini extraction, store results, mark as read.
   *
   * Successive cron runs drain the inbox BATCH_SIZE emails at a time,
   * always starting from the oldest unprocessed message.
   */
  scanInbox: publicProcedure.mutation(async () => {
    const results = {
      processed: 0,
      invoicesFound: 0,
      skipped: 0,
      remaining: 0,
    };

    // ── Step 1: get all unread UIDs + their internal dates ──────────────
    const unreadEntries = await listUnreadUids();

    if (unreadEntries.length === 0) {
      console.log("[email.scanInbox] Inbox is empty, nothing to do.");
      return results;
    }

    // ── Step 2: bulk DB check — which message-IDs are already recorded? ──
    // We use the IMAP UID as a temporary key here; the real Message-ID is
    // only available after full parsing. We therefore use the IMAP UID
    // string as a fallback key exactly as the scanner does when messageId
    // is absent. The real deduplication key is set in step 5 via storeEmailResult.
    //
    // Because we don't yet have the RFC Message-ID at this point, we fetch
    // the full envelope (from/subject/date) which is cheap — NOT the body.
    // To keep it simple and correct we just fetch the small batch and rely
    // on storeEmailResult's unique constraint as the final guard.
    //
    // Sort all unread entries oldest-first so we always drain the backlog
    // in chronological order.
    const sortedEntries = [...unreadEntries].sort(
      (a, b) => a.internalDate.getTime() - b.internalDate.getTime(),
    );

    results.skipped = 0; // no pre-filtering possible without Message-IDs yet
    results.remaining = Math.max(0, sortedEntries.length - BATCH_SIZE);

    // ── Step 3: take the BATCH_SIZE oldest UIDs ──────────────────────────
    const batchEntries = sortedEntries.slice(0, BATCH_SIZE);
    const batchUids = batchEntries.map((e) => e.uid);

    console.log(
      `[email.scanInbox] ${unreadEntries.length} unread total. ` +
        `Processing batch of ${batchUids.length} oldest (UIDs: ${batchUids.join(", ")}).`,
    );

    // ── Step 4: fetch & parse only the batch ─────────────────────────────
    const emails = await fetchEmailsByUids(batchUids);

    // ── Step 5: bulk-check DB now that we have real Message-IDs ──────────
    const messageIds = emails.map((e) => e.gmailMessageId);
    const alreadyProcessed = await getAlreadyProcessedIds(messageIds);

    // ── Step 6: process each email in the batch ───────────────────────────
    for (const email of emails) {
      if (alreadyProcessed.has(email.gmailMessageId)) {
        console.log(
          `[email.scanInbox] Skipping already-processed message ${email.gmailMessageId}`,
        );
        results.skipped++;
        // Still mark as read so it no longer shows up in future IMAP scans.
        await markEmailAsRead(email.imapUid);
        continue;
      }

      console.log(
        `[email.scanInbox] Processing message ${email.gmailMessageId} | Subject: "${email.subject}"`,
      );

      // ── Upload PDFs to R2 before Gemini extraction ──────────────────────
      // We upload all PDFs eagerly so the URLs are available regardless of
      // whether Gemini decides the email is an invoice or not. If an upload
      // fails we log a warning but continue — the r2Url will simply be
      // undefined and the base64 data is still passed to Gemini.
      for (const attachment of email.attachments) {
        try {
          attachment.r2Url = await uploadPdfToR2({
            gmailMessageId: email.gmailMessageId,
            filename: attachment.filename,
            contentBase64: attachment.contentBase64,
          });
        } catch (err) {
          console.warn(
            `[email.scanInbox] Failed to upload PDF "${attachment.filename}" for message ${email.gmailMessageId} to R2:`,
            err,
          );
        }
      }

      const result = await extractInvoiceFromEmail(email);
      await storeEmailResult(email, result);
      await markEmailAsRead(email.imapUid);

      results.processed++;

      if (result !== null) {
        results.invoicesFound++;
        console.log(
          `[email.scanInbox] Invoice extracted: ${result.invoice.invoice_number} from ${result.invoice.sender.company}`,
        );
      } else {
        console.log(
          `[email.scanInbox] Message ${email.gmailMessageId} is not an invoice, recorded and skipped.`,
        );
      }
    }

    console.log(
      `[email.scanInbox] Done. processed=${results.processed} invoices=${results.invoicesFound} skipped=${results.skipped} remaining=${results.remaining}`,
    );

    return results;
  }),
});
