import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import { env } from "~/env.js";
import type { ParsedAttachment, ParsedEmail } from "./types.js";

function createImapClient(): ImapFlow {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
    logger: false,
  });
}

export async function fetchUnreadEmails(): Promise<ParsedEmail[]> {
  const client = createImapClient();
  await client.connect();

  const results: ParsedEmail[] = [];

  try {
    await client.mailboxOpen("INBOX");

    // Fetch all unread UIDs — batching happens at the router level
    const uids = await client.search({ seen: false }, { uid: true });

    if (uids.length === 0) {
      console.log("[scanner] No unread emails found.");
      return [];
    }

    console.log(`[scanner] Found ${uids.length} unread email(s).`);

    for await (const message of client.fetch(
      uids,
      { source: true, uid: true },
      { uid: true }
    )) {
      try {
        const parsed = await simpleParser(message.source);

        const attachments: ParsedAttachment[] = [];

        for (const att of parsed.attachments ?? []) {
          if (att.contentType === "application/pdf") {
            attachments.push({
              filename: att.filename ?? "attachment.pdf",
              contentType: att.contentType,
              contentBase64: att.content.toString("base64"),
            });
          }
        }

        results.push({
          // Prefer RFC Message-ID (globally unique and stable) over IMAP UID
          gmailMessageId: parsed.messageId ?? String(message.uid),
          imapUid: message.uid,
          subject: parsed.subject ?? "(no subject)",
          from: parsed.from?.text ?? "(unknown sender)",
          receivedAt: parsed.date ?? new Date(),
          bodyHtml: parsed.html || "",
          bodyText: parsed.text ?? "",
          attachments,
        });
      } catch (err) {
        console.error(
          `[scanner] Failed to parse message UID=${message.uid}:`,
          err
        );
      }
    }
  } finally {
    await client.logout();
  }

  return results;
}
