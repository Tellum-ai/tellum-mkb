# Golden Dataset — Synthetic Inbox Generator

A CLI tool that generates a synthetic Dutch MKB Gmail inbox for testing the IMAP scanner and Gemini invoice extraction pipeline.

## Location

```
scripts/generate-inbox/
  types.ts                        — shared types and CUSTOMER constant
  suppliers/dutch.ts              — Dutch supplier profiles (KPN, TransIP, Eneco)
  suppliers/saas.ts               — International SaaS profiles (Vercel, GitHub)
  generators/invoice-pdf.ts      — PDF generator (pdf-lib, fully local)
  generators/email-builder.ts    — .eml builder (MIME multipart)
  generators/noise-email.ts      — Noise email templates
  index.ts                        — CLI entry point + Phase 1 scenarios
  append-to-inbox.ts             — IMAP APPEND into Gmail
  output/                         — generated files (gitignored)
  fixtures/                       — reviewed, committed .eml + .json pairs
```

## Commands

```bash
bun run inbox:generate          # generate batch to ./output/
bun run inbox:fixture           # generate + copy to ./fixtures/
bun run inbox:append            # IMAP APPEND ./fixtures/ into Gmail
```

For `inbox:append`, set environment variables:
```
GMAIL_USER=tellumfinance@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Gmail App Password, not your regular password
```

Both are already set in `.env`.

## How it works

1. `index.ts` generates `.eml` + annotation `.json` pairs into `output/`
2. `append-to-inbox.ts` uses IMAP APPEND to inject `.eml` files directly into the Gmail inbox — no sending required, emails appear as unread with their original timestamps
3. The scanner picks them up exactly like real emails

## Annotation format

Each `.eml` has a companion `.json` with the ground truth for the eval runner:

```json
{
  "emailFile": "001-kpn-april.eml",
  "wasInvoice": true,
  "supplier": "KPN B.V.",
  "invoiceNumber": "KPN-2026-04-001234",
  "invoiceDate": "2026-04-01",
  "totalInclVat": "54.45",
  "totalExclVat": "45.00",
  "vatAmount": "9.45",
  "vatRate": 21,
  "vatType": "standard",
  "currency": "EUR",
  "language": "nl"
}
```

Noise emails have `{ "wasInvoice": false }`.

## Phase 1 — current fixtures

| ID | Type | Supplier | Edge case |
|---|---|---|---|
| 001-kpn-april | invoice | KPN B.V. | Dutch, 21% BTW, dutch-text date |
| 002-transip-maart | invoice | TransIP B.V. | Dutch, 2 line items, dutch-numeric date |
| 003-vercel-april | invoice | Vercel | USD, BTW verlegd, us-text date |
| 004-github-maart | invoice | GitHub | USD, BTW verlegd, us-slash date (ambiguous) |
| 005-eneco-februari | invoice | Eneco | Dutch, 4 line items, larger amount |
| 006-ing-balance | noise | ING | Bank balance notification |
| 007-kpn-payment-confirm | noise | KPN | Payment confirmation (not an invoice) |
| 008-newsletter-rvo | noise | RVO | Government newsletter |

## Expanding the dataset

To add a new supplier, add a profile to `suppliers/dutch.ts` or `suppliers/saas.ts` and add a new scenario to the `INVOICE_SCENARIOS` array in `index.ts`.

To add a new noise email, add a `NoiseScenario` to `NOISE_SCENARIOS` in `generators/noise-email.ts`.

### Planned edge cases (not yet implemented)

- `€1.234,56` large Dutch amount with thousands separator
- Only excl. BTW stated — Gemini must calculate incl. total
- Multi-rate invoice (9% + 21% on same PDF)
- `BTW vrijgesteld` (exempt)
- Dutch date `9 mei 2026` vs ambiguous `05/09/2026`
- Messy/plain-text layout (no table structure)
- Non-sequential or unusual invoice number formats (`20260042`, `2026/042`)
- Belgian French-language supplier
- Credit note (creditnota)

## Privacy note

All generation is fully local. No data leaves the machine during generation. PDFs are built with `pdf-lib`. Only the finished `.eml` files are injected into Gmail via IMAP.
