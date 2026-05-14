# Schema: Bookkeeping Tables

## ledger_accounts

Stores the chart of accounts (grootboekrekeningen) per user.

```sql
ledger_accounts (
  id          text PRIMARY KEY,
  userId      text NOT NULL → user.id,
  number      integer NOT NULL,          -- e.g. 1000, 4500
  name        text NOT NULL,             -- e.g. "ICT / Software"
  type        text NOT NULL,             -- activa | passiva | omzet | kosten
  createdAt   timestamp,
  updatedAt   timestamp
)

UNIQUE (userId, number)  -- same number can't appear twice for one tenant
```

**Key decisions:**
- Per-tenant: every user has their own chart of accounts isolated by `userId`.
- Seeded on signup via `seedLedgerAccounts()` called from the better-auth `user.create.after` hook.
- Users can add custom accounts; the seed skeleton can't be deleted (no guard yet, future work).

---

## journal_entries

The header of a double-entry bookkeeping posting. One entry = one economic event.

```sql
journal_entries (
  id          text PRIMARY KEY,
  userId      text NOT NULL → user.id,
  date        timestamp NOT NULL,        -- the accounting date of the event
  description text NOT NULL,            -- human-readable, e.g. "Inkoopfactuur KPN"
  reference   text,                     -- invoice number, bank ref, etc.
  type        text NOT NULL,            -- purchase_invoice | sales_invoice | bank_payment | manual
  createdAt   timestamp,
  updatedAt   timestamp
)
```

**Key decisions:**
- `type` tells you where the entry came from, useful for filtering (e.g. show only purchase invoices).
- `reference` is free-form and not enforced — it's for human readability and search.
- The entry itself carries no amounts. All amounts are on the lines.

---

## journal_entry_lines

Each line is one side of a double-entry posting. A valid set of lines for one `journal_entry` must have `SUM(debit) == SUM(credit)`. This is enforced at the application layer, not the database layer.

```sql
journal_entry_lines (
  id               text PRIMARY KEY,
  journalEntryId   text NOT NULL → journal_entries.id (CASCADE DELETE),
  ledgerAccountId  text NOT NULL → ledger_accounts.id,
  debit            integer,    -- cents, NULL if this is a credit line
  credit           integer,    -- cents, NULL if this is a debit line
  description      text        -- optional line-level note
)
```

**Key decisions:**
- Either `debit` or `credit` is set — never both, never neither. This is an application-level convention, not a DB constraint (adding a CHECK constraint is future work).
- Amounts are in **integer cents** throughout. `€89.00` is stored as `8900`. This avoids all floating point rounding issues.
- Lines are deleted when their parent entry is deleted (`CASCADE DELETE`).

---

## Relationship

```
journal_entries  (1)
      │
      └──── journal_entry_lines  (N)
                    │
                    └──── ledger_accounts  (1)
```

A purchase invoice booking for €89 incl. 21% BTW looks like this in the database:

```
journal_entries:
  id=xyz | date=2026-05-09 | description="Inkoopfactuur KPN" | type=purchase_invoice

journal_entry_lines:
  journalEntryId=xyz | ledgerAccountId=→4700 | debit=7355  | credit=null
  journalEntryId=xyz | ledgerAccountId=→1500 | debit=1545  | credit=null
  journalEntryId=xyz | ledgerAccountId=→1100 | debit=null  | credit=8900
```

`7355 + 1545 = 8900` ✓
