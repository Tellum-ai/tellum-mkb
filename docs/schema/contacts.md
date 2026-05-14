# Schema: Contacts

## contacts

Stores suppliers (crediteuren) and customers (debiteuren) per user. Also used by the email processing pipeline to track whitelist/auto-approve settings.

```sql
contacts (
  id            text PRIMARY KEY,
  userId        text NOT NULL → user.id,   -- tenant owner
  email         text NOT NULL,
  companyName   text,
  -- bookkeeping identity
  type          text NOT NULL DEFAULT 'crediteur',  -- debiteur | crediteur | beide
  kvkNumber     text,                       -- KvK-nummer
  vatNumber     text,                       -- BTW-nummer, e.g. NL123456789B01
  iban          text,
  -- address
  street        text,
  city          text,
  postalCode    text,
  country       text DEFAULT 'NL',
  -- email processing
  isWhitelisted boolean NOT NULL DEFAULT false,
  autoApprove   boolean NOT NULL DEFAULT false,
  createdAt     timestamp,
  updatedAt     timestamp
)

UNIQUE (userId, email)  -- same email can exist for different tenants
```

---

## Multi-tenancy Design

Contacts were originally a global table (no `userId`) used only for the email whitelist. When the bookkeeping module was introduced, `userId` was added to make contacts tenant-scoped.

The unique constraint changed from `UNIQUE(email)` to `UNIQUE(userId, email)` — two different users can have a contact with the same email address (e.g. both use the same supplier).

All queries must filter by `userId`. The tRPC procedures enforce this via `ctx.session.user.id`.

---

## Contact Types

| Type | Meaning | Linked to |
|---|---|---|
| `crediteur` | Supplier — you owe them money | incoming invoices |
| `debiteur` | Customer — they owe you money | outgoing invoices |
| `beide` | Both supplier and customer | either |

The default type is `crediteur` because contacts are currently created from incoming email invoices (i.e. suppliers).

---

## Auto-creation from Email

When the email scanner processes an invoice, it upserts a contact for the sender:

```typescript
// find by (userId, email) or create
contact = findFirst({ userId, email: senderEmail }) 
       ?? insert({ userId, email: senderEmail, companyName })
```

This means a supplier's contact record is created automatically the first time their invoice arrives. The user can then enrich it (add KvK, IBAN, etc.) from the contacts page.

---

## Whitelist / Auto-approve

These two fields are used by the email processing pipeline:

- `isWhitelisted` — the user has explicitly recognised this contact as trusted.
- `autoApprove` — invoices from this contact should be automatically moved to `ingepland` status without manual review.

These were part of the original design and remain useful for the email workflow even as bookkeeping features are added.
