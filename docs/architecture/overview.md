# Tellum MKB — Architecture Overview

## What is Tellum MKB?

Tellum MKB is a bookkeeping platform for Dutch small businesses (MKB = midden- en kleinbedrijf). The core idea: instead of manually entering invoices into bookkeeping software, Tellum monitors a Gmail inbox, extracts invoice data using Gemini AI, and lets the user book them into a double-entry ledger with one click.

The platform is currently in a private MVP phase, being tested with a small group of close friends before broader rollout.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| API | tRPC v11 |
| Database | PostgreSQL via Drizzle ORM |
| Auth | better-auth (email + Google OAuth) |
| UI | shadcn/ui + Tailwind CSS |
| Package manager | bun |
| File storage | Cloudflare R2 (PDF attachments) |
| AI extraction | Google Gemini via Vercel AI SDK (`ai` + `@ai-sdk/google`) |
| Observability | LangWatch (OpenTelemetry-based, bootstrapped in `src/instrumentation.ts`) |
| Bank data | Plaid (sandbox for MVP) |

## High-Level Design

```
Gmail inbox
    │
    ▼
Email scanner (IMAP) ──► Gemini AI extraction
                               │
                               ▼
                        invoices table (raw extracted data)
                               │
                        User reviews in dashboard
                               │
                               ▼
                        Booking dialog (picks ledger account + VAT rate)
                               │
                               ▼
                        journal_entries + journal_entry_lines
                        (double-entry bookkeeping)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             Bank transactions      BTW overzicht
             matched via Plaid      (future)
```

## Multi-tenancy

Every user gets their own isolated data. The key design decisions:

- `contacts`, `ledger_accounts`, `journal_entries`, `sales_invoices`, `bank_connections`, and `bank_transactions` all have a `userId` foreign key.
- On signup, a `databaseHooks.user.create.after` hook in better-auth automatically seeds 14 default grootboekrekeningen for the new user.
- The Gmail inbox scanner (`scanInbox`) is currently single-tenant — it looks up the user whose email matches `GMAIL_USER` in env and attributes all processed emails to them.

## What Replaces Moneybird

The original design synced extracted invoices to Moneybird (an external bookkeeping SaaS). This was removed in favour of a self-built bookkeeping module because:

1. Easier to test viability with friends without external dependencies
2. Full control over the data model
3. Can build exactly what MKB users need, not work around Moneybird's API

The `moneybirdId` column on the `invoices` table is a legacy artifact and is no longer written to.
