# Feature: Incoming Invoice Booking

This is the first complete end-to-end flow in the bookkeeping module. It covers the journey from an email arriving in the Gmail inbox to a balanced journal entry in the ledger.

## Full Flow

```
1. Supplier sends invoice to the monitored Gmail inbox
2. Cron job triggers scanInbox (tRPC public procedure)
3. IMAP scanner picks up the email (batch of 3, oldest first)
4. PDF attachments uploaded to Cloudflare R2
5. Gemini AI extracts structured invoice data (supplier, amount, date, VAT, etc.)
6. Invoice stored in DB with status "nieuw"
7. Contact auto-created or matched by email address
8. User opens Inkoopfacturen page in dashboard
9. User clicks "Boeken" on a nieuw invoice
10. Booking dialog opens:
    - User selects cost account (e.g. 4500 ICT/Software)
    - User selects VAT rate (21%, 9%, or 0%)
    - Dialog previews the journaalpost split
11. User confirms → bookPurchase mutation runs:
    - Calculates amounts in integer cents
    - Creates journal_entry (type: purchase_invoice)
    - Creates 3 journal_entry_lines (debit kosten, debit BTW, credit crediteuren)
    - Sets invoice.journalEntryId and invoice.paymentStatus = "goedgekeurd"
12. Invoice now appears in the "Geboekt" tab
```

## The Booking Dialog

The dialog intentionally shows the user exactly what will be written to the ledger before they confirm:

```
Factuur boeken
─────────────────────────────────
KPN — 2026-0042

Totaal incl. BTW          €89.00
Ontvangen              09-05-2026

Grootboekrekening: [ 4700 Telefoon / Telecom ▼ ]
BTW tarief:        [ 21% (standaard)          ▼ ]

Journaalpost:
  Debet 4700 Telefoon          €73.55
  Debet 1500 BTW te vorderen   €15.45
  ─────────────────────────────────────
  Credit 1100 Crediteuren      €89.00

          [ Annuleren ]  [ Bevestig boeking ]
```

This transparency is intentional — the user learns what double-entry means by seeing it every time they book an invoice.

## The bookPurchase Mutation

Located in `src/server/api/routers/invoice.ts`.

**Input:**
```typescript
{
  invoiceId: string
  ledgerAccountId: string   // the cost account chosen by the user
  vatRate: 0 | 9 | 21
}
```

**Guards:**
- Invoice must exist
- Invoice must not already have a `journalEntryId` (can't book twice)
- Ledger accounts 1100 (Crediteuren) and 1500 (BTW te vorderen) must exist for the user

**Amount calculation:**
```typescript
totalInclVatCents = round(parseFloat(invoice.totalInclVat) * 100)
exclVatCents      = round(totalInclVatCents / (1 + vatRate / 100))
vatCents          = totalInclVatCents - exclVatCents
```

All three operations happen inside a single database transaction — if any step fails, nothing is written.

## What Happens Next (not yet built)

After booking, the invoice is in `paymentStatus: "goedgekeurd"` and has an open crediteuren posting in the ledger. The next steps in the lifecycle are:

1. **Bank import** — Plaid imports bank transactions
2. **Matching** — the bank transaction for the KPN payment is matched to this posting
3. **Closing entry** — a `bank_payment` journal entry debits 1100 Crediteuren and credits 1000 Bank
4. **Invoice status** — updated to `betaald`

At that point the invoice is fully settled: zero open crediteuren balance, bank account reduced by the correct amount.

## Files Involved

| File | Role |
|---|---|
| `src/server/api/routers/invoice.ts` | `bookPurchase` mutation |
| `src/server/api/routers/ledger.ts` | `getKostenAccounts` query used by the dialog |
| `src/server/bookkeeping/seed-ledger.ts` | Seeds default accounts on signup |
| `src/server/better-auth/config.ts` | Calls `seedLedgerAccounts` in `user.create.after` hook |
| `src/app/dashboard/invoices/page.tsx` | Invoices table + BookingDialog component |
| `src/server/db/schema.ts` | All relevant table definitions |
