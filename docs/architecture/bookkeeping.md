# Bookkeeping Architecture

## Why Double-Entry?

Single-entry bookkeeping is like a bank statement — one row per event:

```
2026-05-09 | KPN factuur | -€89.00
```

Double-entry bookkeeping records *where money flows from and to* on every transaction. Every booking touches at least two accounts — one is debited, one is credited — and the total of all debits always equals the total of all credits. This is the golden rule of accounting.

```
2026-05-09 | KPN factuur
  DEBIT   4700 Telefoon / Telecom    €73.55
  DEBIT   1500 BTW te vorderen       €15.45
  CREDIT  1100 Crediteuren           €89.00
```

We chose double-entry from the start because:

- A balance sheet falls out automatically — you don't need to build it separately.
- BTW (VAT) tracking is implicit — the BTW account accumulates what you can reclaim.
- Bank matching closes postings cleanly — when you pay KPN, you debit 1100 Crediteuren and credit 1000 Bank. The crediteuren account nets to zero.
- Building single-entry first and migrating later would require rewriting all historical data.

## The Chart of Accounts (Grootboekrekeningen)

Each user gets a seeded set of ledger accounts on signup. Accounts have four types:

| Type | Meaning | Examples |
|---|---|---|
| `activa` | Assets — things you own | Bank (1000), Debiteuren (1200), BTW te vorderen (1500) |
| `passiva` | Liabilities — things you owe | Crediteuren (1100), BTW te betalen (1510) |
| `omzet` | Revenue | Omzet (8000) |
| `kosten` | Expenses | ICT/Software (4500), Telefoon (4700) |

The numbering follows a simplified Dutch RGS (Referentie Grootboekschema) convention:
- 1xxx — Balance sheet (activa/passiva)
- 4xxx — Expenses (kosten)
- 8xxx — Revenue (omzet)

## The Default Skeleton

Every new user gets these 14 accounts automatically:

| Nr | Naam | Type |
|---|---|---|
| 1000 | Bank | activa |
| 1100 | Crediteuren | passiva |
| 1200 | Debiteuren | activa |
| 1500 | BTW te vorderen | activa |
| 1510 | BTW te betalen | passiva |
| 4000 | Inkoopkosten algemeen | kosten |
| 4100 | Personeelskosten | kosten |
| 4200 | Huisvestingskosten | kosten |
| 4300 | Vervoerskosten | kosten |
| 4400 | Kantoorkosten | kosten |
| 4500 | ICT / Software | kosten |
| 4600 | Marketing | kosten |
| 4700 | Telefoon / Telecom | kosten |
| 8000 | Omzet | omzet |

Users can add custom accounts on top of this skeleton. Account numbers must be unique per tenant.

## How the BTW Split Works

When booking a purchase invoice, the user picks:
1. A cost ledger account (e.g. 4500 ICT/Software)
2. A VAT rate (0%, 9%, or 21%)

The system then calculates in **integer cents** (to avoid floating point errors):

```
totalInclVatCents = round(totalInclVat * 100)
exclVatCents      = round(totalInclVatCents / (1 + vatRate / 100))
vatCents          = totalInclVatCents - exclVatCents
```

And creates a balanced journaalpost:

```
DEBIT  kostenrekening      exclVatCents
DEBIT  1500 BTW te vorderen vatCents       ← only if vatRate > 0
CREDIT 1100 Crediteuren     totalInclVatCents
```

Debit sum = exclVatCents + vatCents = totalInclVatCents = Credit sum. Always balanced.

## Closing a Crediteuren Posting (Bank Payment)

When a bank transaction is matched to an open invoice, a second journaalpost closes the loop:

```
DEBIT  1100 Crediteuren     totalInclVatCents  ← nets the original credit to zero
CREDIT 1000 Bank            totalInclVatCents
```

After this, the crediteuren balance for that supplier is zero — the invoice is fully settled.

> **Status:** The booking side is built. Bank matching via Plaid is schema-ready but not yet implemented.
