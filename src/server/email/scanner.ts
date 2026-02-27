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

export interface UnreadUidEntry {
  uid: number;
  /** IMAP INTERNALDATE — used to sort oldest-first before batching */
  internalDate: Date;
}

/**
 * Lightweight step 1: connect to Gmail and return the UID + internal date of
 * every unread message without downloading the message bodies.
 */
export async function listUnreadUids(): Promise<UnreadUidEntry[]> {
  const client = createImapClient();
  await client.connect();

  const entries: UnreadUidEntry[] = [];

  try {
    await client.mailboxOpen("INBOX");

    const uids = await client.search({ seen: false }, { uid: true });

    if (!uids || uids.length === 0) {
      console.log("[scanner] No unread emails found.");
      return [];
    }

    console.log(`[scanner] Found ${uids.length} unread email(s).`);

    // Fetch only envelope data (internalDate) — no body download yet.
    for await (const msg of client.fetch(
      uids,
      { internalDate: true, uid: true },
      { uid: true },
    )) {
      entries.push({
        uid: msg.uid,
        internalDate:
          msg.internalDate instanceof Date
            ? msg.internalDate
            : new Date(msg.internalDate ?? 0),
      });
    }
  } finally {
    await client.logout();
  }

  return entries;
}

/**
 * Expensive step 2: download and parse the full source of the given UIDs.
 * Only call this for the small batch we actually intend to process.
 */
export async function fetchEmailsByUids(uids: number[]): Promise<ParsedEmail[]> {
  if (uids.length === 0) return [];

  const client = createImapClient();
  await client.connect();

  const results: ParsedEmail[] = [];

  try {
    await client.mailboxOpen("INBOX");

    for await (const message of client.fetch(
      uids,
      { source: true, uid: true },
      { uid: true },
    )) {
      try {
        if (!message.source) continue;
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
          err,
        );
      }
    }
  } finally {
    await client.logout();
  }

  return results;
}
