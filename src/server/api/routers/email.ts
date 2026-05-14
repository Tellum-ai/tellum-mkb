import { eq } from "drizzle-orm";
import { getLangWatchTracer } from "langwatch";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  contacts,
  journalEntries,
  processedEmails,
} from "~/server/db/schema";
import { loadFixtureAnnotations } from "~/server/email/eval-fixtures";
import { evaluateExtraction } from "~/server/email/evaluators";
import { extractInvoiceFromEmail } from "~/server/email/processor";
import { fetchEmailsByUids, listUnreadUids } from "~/server/email/scanner";
import {
  getAlreadyProcessedIds,
  markAllInboxAsUnread,
  markEmailAsRead,
  storeEmailResult,
} from "~/server/email/store";
import { uploadPdfToR2 } from "~/server/r2";

interface ScanResults {
  processed: number;
  invoicesFound: number;
  skipped: number;
  remaining: number;
}

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
async function runInboxScan(inboxOwnerId: string): Promise<ScanResults> {
  const results: ScanResults = {
    processed: 0,
    invoicesFound: 0,
    skipped: 0,
    remaining: 0,
  };

  const unreadEntries = await listUnreadUids();

  if (unreadEntries.length === 0) {
    console.log("[email.scanInbox] Inbox is empty, nothing to do.");
    return results;
  }

  const sortedEntries = [...unreadEntries].sort(
    (a, b) => a.internalDate.getTime() - b.internalDate.getTime(),
  );

  const batchUids = sortedEntries.map((e) => e.uid);

  console.log(
    `[email.scanInbox] ${unreadEntries.length} unread total. ` +
      `Processing batch of ${batchUids.length} oldest (UIDs: ${batchUids.join(", ")}).`,
  );

  const emails = await fetchEmailsByUids(batchUids);

  const messageIds = emails.map((e) => e.gmailMessageId);
  const alreadyProcessed = await getAlreadyProcessedIds(messageIds);

  const tracer = getLangWatchTracer("tellum-mkb.email");
  const fixtureAnnotations = await loadFixtureAnnotations();

  for (const email of emails) {
    if (alreadyProcessed.has(email.gmailMessageId)) {
      console.log(
        `[email.scanInbox] Skipping already-processed message ${email.gmailMessageId}`,
      );
      results.skipped++;
      await markEmailAsRead(email.imapUid);
      continue;
    }

    // Each email gets its own root trace so the LangWatch dashboard shows one
    // entry per processed email (rather than nesting them under a single scan).
    await tracer.withActiveSpan(
      "process-email",
      {
        root: true,
        attributes: {
          userId: inboxOwnerId,
          subject: email.subject,
          from: email.from,
          attachments: email.attachments.length,
        },
      },
      async (span) => {
        console.log(
          `[email.scanInbox] Processing message ${email.gmailMessageId} | Subject: "${email.subject}"`,
        );

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
        await storeEmailResult(email, result, inboxOwnerId);
        await markEmailAsRead(email.imapUid);

        results.processed++;

        if (result !== null) {
          results.invoicesFound++;
          span.setAttribute("invoice.number", result.invoice.invoice_number);
          span.setAttribute("invoice.sender", result.invoice.sender.company);
          span.setAttribute(
            "invoice.total_incl_vat",
            result.invoice.totals.total_incl_vat,
          );
          console.log(
            `[email.scanInbox] Invoice extracted: ${result.invoice.invoice_number} from ${result.invoice.sender.company}`,
          );
        } else {
          span.setAttribute("invoice.found", false);
          console.log(
            `[email.scanInbox] Message ${email.gmailMessageId} is not an invoice, recorded and skipped.`,
          );
        }

        // If this email matches a fixture (by Message-ID), record evaluation
        // spans under the current process-email span. Real (non-fixture)
        // emails fall through. Normalize by stripping the surrounding
        // angle brackets that mailparser preserves in `messageId`.
        const normalizedMessageId = email.gmailMessageId.replace(
          /^<|>$/g,
          "",
        );
        const annotation = fixtureAnnotations.get(normalizedMessageId);
        if (!annotation) {
          console.log(
            `[email.scanInbox] No fixture annotation for Message-ID "${normalizedMessageId}" — skipping eval.`,
          );
        }
        if (annotation) {
          const evals = evaluateExtraction(result, annotation);
          span.setAttribute("eval.fixture", annotation.emailFile);
          span.setAttribute(
            "eval.passed",
            evals.filter((e) => e.passed).length,
          );
          span.setAttribute("eval.total", evals.length);

          for (const ev of evals) {
            await tracer.withActiveSpan(`eval:${ev.name}`, (evalSpan) => {
              evalSpan.setType("evaluation");
              evalSpan.setOutput("evaluation_result", {
                status: "processed",
                passed: ev.passed,
                score: ev.score,
                label: ev.name,
                details: ev.details,
              });
            });
          }

          const failed = evals.filter((e) => !e.passed);
          if (failed.length > 0) {
            console.log(
              `[email.scanInbox] Evals for ${annotation.emailFile}: ${evals.length - failed.length}/${evals.length} passed. Failed: ${failed.map((f) => `${f.name} (${f.details})`).join("; ")}`,
            );
          } else {
            console.log(
              `[email.scanInbox] Evals for ${annotation.emailFile}: ${evals.length}/${evals.length} passed ✓`,
            );
          }
        }
      },
    );
  }

  console.log(
    `[email.scanInbox] Done. processed=${results.processed} invoices=${results.invoicesFound} skipped=${results.skipped} remaining=${results.remaining}`,
  );

  return results;
}

export const emailRouter = createTRPCRouter({
  scanInbox: protectedProcedure.mutation(async ({ ctx }) => {
    return runInboxScan(ctx.session.user.id);
  }),

  resetTestData: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Delete in FK-safe order:
    // 1. journalEntries (cascades to journalEntryLines, nulls invoices.journalEntryId)
    // 2. processedEmails (cascades to invoices)
    // 3. contacts
    await db.delete(journalEntries).where(eq(journalEntries.userId, userId));
    await db.delete(processedEmails);
    await db.delete(contacts).where(eq(contacts.userId, userId));

    try {
      const unreadCount = await markAllInboxAsUnread();
      console.log(
        `[email.resetTestData] Marked ${unreadCount} Gmail message(s) as unread.`,
      );
    } catch (err) {
      console.error(
        "[email.resetTestData] Failed to mark Gmail inbox as unread:",
        err,
      );
      throw err;
    }

    console.log(`[email.resetTestData] Reset complete for user ${userId}`);
  }),
});
