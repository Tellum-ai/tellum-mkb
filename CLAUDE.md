# Tellum MKB — Claude Notes

## Documentation hygiene
After completing any meaningful task — new feature, architectural decision, new script, key design choice — update the relevant files before considering the task done:
- `docs/` — add or update the relevant doc page
- `docs/README.md` — add a pointer if a new doc was created
- `CLAUDE.md` — add any new commands, rules, or conventions that future sessions need to know
- Memory files in `~/.claude/projects/.../memory/` — save anything non-obvious that should persist across sessions (decisions, plans, feedback)

## Git — READ THIS FIRST
**Check `git status` at the very start of every session.** If the working tree has more than ~5 modified files or untracked features that look like completed work, surface it to the user immediately before starting the new task:

> "Heads up — there's a pile of uncommitted work already in the tree from prior sessions (X modified, Y untracked, including <list of obvious features>). Want me to commit/push that first so we start clean, or carry on?"

The pile-up problem is real and has burned this repo before. Catching it at session-start is cheap; catching it after another session of work makes the commit messy and harder to split.

### Commit cadence
- Commit after every completed feature or meaningful milestone. Do not let work pile up uncommitted.
- Ask the user before committing if it's unclear whether a feature is "done".
- If a session adds multiple distinct features without committing, pause and offer to commit before adding the next one. Don't let one session create the next pile-up.

### Push cadence
- When a meaningful new feature has just been committed, proactively suggest pushing to the GitHub remote (e.g. "Want me to push this to `origin/main`?"). Don't push without confirmation, but don't let shippable work sit only locally either.
- Skip the push prompt for trivial commits (typo fixes, doc tweaks, WIP).

### Splitting retroactively
- Splitting a large uncommitted diff into clean per-feature commits is only realistic when changes don't interlock. If they do (e.g. one feature removes code that another feature replaces), say so plainly — don't fake granularity by producing intermediate commits that can't build.

## Package manager
- Use `bun` (not npm or yarn).

## Database
- Use `bun run db:push` to apply schema changes. Never generate or run migrations.

## Documentation
- Project documentation lives in `docs/`. Read the relevant doc before working on a feature.
- `docs/README.md` is the index — start there.

## LLM extraction
- Gemini is called via the Vercel AI SDK (`ai` package + `@ai-sdk/google`), not the raw `@google/generative-ai` client.
- Use `generateObject` with a Zod schema for structured output. The Google provider supports only a subset of OpenAPI 3.0 — no `z.union` / discriminated unions; use a flag + nullable payload envelope instead (see `src/server/email/processor.ts`).
- Retries are handled by the AI SDK via the `maxRetries` option on `generateObject` (exponential backoff on transient errors). Do not add a hand-rolled retry loop on top.

## Evals
- Fixtures live under `scripts/generate-inbox/output/` as `.eml` + `.json` pairs (ground truth annotations). The doc is `docs/testing/golden-dataset.md`.
- When the inbox scanner processes an email whose Message-ID matches a fixture (`src/server/email/eval-fixtures.ts` indexes by Message-ID), `src/server/email/evaluators.ts` compares the Gemini output to the annotation and emits one `eval:<name>` child span per check under `process-email`. Each is a LangWatch evaluation span (`setType("evaluation")` + `setOutput("evaluation_result", ...)`), so they aggregate in the dashboard.
- Real (non-fixture) emails fall through cleanly — no eval spans. There is no separate "test runner" — the Inbox scannen button IS the eval entrypoint while we're in test-data mode.

## Observability (LangWatch)
- Tracing is via LangWatch over OpenTelemetry. Bootstrapped in `src/instrumentation.ts` (Next.js auto-loads this).
- Per-call LLM tracing: pass `experimental_telemetry: { isEnabled: true, functionId, metadata }` to AI SDK calls. Do not write manual spans around the LLM call — the SDK emits them.
- Higher-level traces (e.g. inbox scan): wrap with `getLangWatchTracer("...").withActiveSpan("name", { attributes }, async (span) => { ... })`. Child LLM spans roll up automatically via OTel context.
- For batch operations where each item should be its own trace in the dashboard (e.g. per-email in inbox scan), pass `{ root: true, ... }` to `withActiveSpan` — otherwise everything nests under the tRPC route's span and the dashboard shows one trace with garbled trace-level input/output.
- Required env: `LANGWATCH_API_KEY`. No Langfuse anywhere.

## Email scanning
- `email.scanInbox` is a `protectedProcedure` — invoices are assigned to the logged-in user (`ctx.session.user.id`), not looked up by `GMAIL_USER`.
- The "Inbox scannen" button on `/dashboard/invoices` is the manual trigger. A cron job will replace this later.
- `email.resetTestData` wipes `processed_emails`, `invoices`, `journal_entries` (+ lines), and `contacts` for the logged-in user. Does NOT touch `ledger_accounts`.

## Bookkeeping rules
- All monetary amounts are stored as **integer cents** (€89.00 = 8900). Never store floats.
- Every journal entry must balance: `SUM(debit lines) == SUM(credit lines)`. Enforced at application level.
- Never book an invoice that already has a `journalEntryId` set — it means it's already been posted.
- Ledger accounts 1100 (Crediteuren) and 1500 (BTW te vorderen) are system accounts that must exist for every user. They are seeded on signup.
