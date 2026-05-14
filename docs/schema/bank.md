# Schema: Bank Tables

## bank_connections

Stores a connected bank account per user. Currently supports Plaid; the `provider` field is designed to support additional providers (e.g. Nordigen/GoCardless for broader Dutch bank coverage) without schema changes.

```sql
bank_connections (
  id                text PRIMARY KEY,
  userId            text NOT NULL → user.id,
  provider          text NOT NULL DEFAULT 'plaid',  -- plaid | nordigen
  plaidAccessToken  text,     -- encrypted in production
  plaidItemId       text,     -- Plaid item identifier
  institutionName   text,     -- e.g. "ING", "Rabobank"
  accountName       text,     -- e.g. "Zakelijke rekening"
  accountIban       text,
  lastSyncAt        timestamp,
  createdAt         timestamp,
  updatedAt         timestamp
)
```

**Plaid NL coverage:** ING, Rabobank, ABN AMRO. Other Dutch banks (Bunq, Knab, Triodos, SNS) are not confirmed supported via Plaid and may require Nordigen.

> **Important:** `plaidAccessToken` must be encrypted at rest before going to production. In sandbox/dev it can be stored as plain text.

---

## bank_transactions

One row per bank transaction imported from Plaid (or another provider). Used for matching against open crediteuren/debiteuren postings.

```sql
bank_transactions (
  id                   text PRIMARY KEY,
  userId               text NOT NULL → user.id,
  bankConnectionId     text NOT NULL → bank_connections.id (CASCADE DELETE),
  plaidTransactionId   text UNIQUE,    -- idempotency: prevents duplicate imports
  date                 timestamp NOT NULL,
  amount               integer NOT NULL,  -- cents; NEGATIVE = money leaving the account
  description          text,
  merchantName         text,
  status               text NOT NULL,    -- pending | posted
  journalEntryId       text → journal_entries.id,  -- set when matched
  createdAt            timestamp
)
```

**Amount convention:** Negative = debit from bank account (money going out), Positive = credit to bank account (money coming in). This matches how Plaid reports amounts.

---

## The Matching Flow (not yet built)

When a `bank_transaction` is matched to an open crediteuren posting:

1. User (or auto-matching logic) links a bank transaction to an invoice's journal entry.
2. A new `bank_payment` journal entry is created:
   ```
   DEBIT  1100 Crediteuren    totalInclVatCents   ← closes the original credit
   CREDIT 1000 Bank           totalInclVatCents
   ```
3. `bank_transactions.journalEntryId` is set to this new entry.
4. The invoice `paymentStatus` is updated to `betaald`.

After step 2, the crediteuren account for that supplier nets to zero — the invoice is fully settled in the ledger.

> **Status:** Schema is in place. Plaid integration, transaction import, and matching UI are not yet built.
