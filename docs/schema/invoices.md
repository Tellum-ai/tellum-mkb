# Schema: Invoice Tables

## processed_emails

Idempotency table. Every Gmail message the scanner has seen is recorded here, regardless of whether it contained an invoice. This prevents the same email from being processed twice across cron runs.

```sql
processed_emails (
  id              text PRIMARY KEY,
  gmailMessageId  text NOT NULL UNIQUE,  -- RFC Message-ID, deduplication key
  imapUid         text,                  -- IMAP UID used for marking as read
  subject         text,
  fromAddress     text,
  receivedAt      timestamp,
  processedAt     timestamp NOT NULL,
  wasInvoice      text NOT NULL          -- "yes" | "no"
)
```

---

## invoices

Stores the invoice data extracted by Gemini AI from an email. One row per email that was classified as an invoice.

```sql
invoices (
  id                text PRIMARY KEY,
  processedEmailId  text NOT NULL → processed_emails.id (CASCADE DELETE),
  gmailMessageId    text NOT NULL,
  invoiceData       jsonb NOT NULL,      -- full raw Gemini extraction result
  status            text NOT NULL,       -- not_processed | processing | processed | error
  invoiceNumber     text,                -- e.g. "2026-0042"
  invoiceDate       text,                -- stored as text (extracted string from PDF)
  senderCompany     text,
  totalInclVat      text,               -- stored as text; parsed to float when booking
  pdfUrls           text[],             -- R2 URLs of attached PDFs
  contactId         text → contacts.id,
  journalEntryId    text → journal_entries.id,  -- set after the invoice is booked
  paymentStatus     text NOT NULL,      -- nieuw | goedgekeurd | ingepland | betaald
  createdAt         timestamp,
  updatedAt         timestamp
)
```

**Key decisions:**
- `invoiceData` holds the full raw JSON from Gemini so nothing is lost even if our parsing logic changes later.
- `totalInclVat` is stored as `text` because it comes directly from the AI extraction and may contain formatting. It is parsed to float (`parseFloat`) at booking time and immediately converted to integer cents.
- `journalEntryId` is `NULL` until the user books the invoice. Once set, the invoice cannot be booked again (enforced in `bookPurchase`).
- `paymentStatus` drives the UI tabs: Nieuw → Geboekt (goedgekeurd) → Ingepland → Betaald.
- `moneybirdId` column exists as a legacy artifact from the original Moneybird integration. It is no longer written to.

---

## The Email → Invoice Flow

```
1. Cron job calls scanInbox (tRPC, public procedure)
2. IMAP scanner lists unread UIDs from Gmail
3. Batch of 3 oldest unread emails fetched and parsed
4. Each email is uploaded to R2 (PDFs) then sent to Gemini
5. Gemini returns structured InvoiceData JSON
6. storeEmailResult() writes:
     - processed_emails row (always)
     - invoices row (only if Gemini classified it as an invoice)
     - contacts row (upsert by email, scoped to the inbox owner's userId)
7. Email marked as read via IMAP
```

The inbox owner is resolved by looking up `user.email == GMAIL_USER` (env var). This makes the scanner single-tenant for now — one Gmail account, one user.

---

## sales_invoices / sales_invoice_lines

Outgoing invoices (verkoopfacturen) created manually by the user. The schema mirrors the incoming invoice concept but is structured as proper line items since we're creating them, not extracting them.

```sql
sales_invoices (
  id              text PRIMARY KEY,
  userId          text NOT NULL → user.id,
  contactId       text → contacts.id,
  invoiceNumber   text NOT NULL,         -- must be unique per tenant
  invoiceDate     timestamp NOT NULL,
  dueDate         timestamp,
  status          text NOT NULL,         -- concept | verstuurd | betaald | vervallen
  notes           text,
  journalEntryId  text → journal_entries.id,
  createdAt       timestamp,
  updatedAt       timestamp
)

sales_invoice_lines (
  id               text PRIMARY KEY,
  salesInvoiceId   text NOT NULL → sales_invoices.id (CASCADE DELETE),
  description      text NOT NULL,
  quantity         integer NOT NULL,     -- whole units for v1
  unitPrice        integer NOT NULL,     -- cents excl. BTW
  vatRate          integer NOT NULL,     -- 0, 9, or 21
  ledgerAccountId  text → ledger_accounts.id  -- which revenue account (e.g. 8000 Omzet)
)
```

When a sales invoice is finalised, the booking journal entry looks like:

```
DEBIT  1200 Debiteuren     totalInclVatCents
CREDIT 1510 BTW te betalen vatCents
CREDIT 8000 Omzet          exclVatCents
```

> **Status:** Schema is in place. UI and booking logic for outgoing invoices are not yet built.
