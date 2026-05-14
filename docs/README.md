# Tellum MKB — Documentation

## Architecture
- [Overview](architecture/overview.md) — what it is, tech stack, high-level design, multi-tenancy
- [Bookkeeping](architecture/bookkeeping.md) — why double-entry, how the journal works, BTW split, the default chart of accounts

## Schema
- [Bookkeeping tables](schema/bookkeeping.md) — ledger_accounts, journal_entries, journal_entry_lines
- [Invoice tables](schema/invoices.md) — processed_emails, invoices, sales_invoices, the email → invoice flow
- [Contacts](schema/contacts.md) — contacts table, multi-tenancy design, whitelist/auto-approve
- [Bank tables](schema/bank.md) — bank_connections, bank_transactions, the matching flow

## Features
- [Incoming invoice booking](features/invoice-booking.md) — full end-to-end flow from email to journal entry

## Testing
- [Golden dataset](testing/golden-dataset.md) — synthetic inbox generator, IMAP append, annotation format, Phase 1 fixtures
