# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal finance dashboard: users log expenses, set monthly budgets per category, and see spending charts. React 19 + TypeScript (Vite), Supabase (Postgres/Auth/RLS), Chart.js. The design, diagrams and phased roadmap are in `docs/ARCHITECTURE.md`. Check its roadmap checkboxes to see what's built, and tick them when you finish an item.

**Current state:** Phases 0–2 are done: database, auth, and CRUD pages for expenses, budgets and categories. The dashboard (`src/pages/DashboardPage.tsx`) shows summary numbers and quick-add only; charts are Phase 3.

## Repo layout quirk

The git root is the **parent** directory (`Personal Finance Dashboard/`), and this project lives in `finance-dashboard/`. Run npm and Supabase commands from `finance-dashboard/`. Git paths show up as `finance-dashboard/...`.

## Commands

```sh
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build (type-check is part of build)
npm run lint       # oxlint
```

```sh
npm test                              # Vitest, once
npm run test:watch
npx vitest run src/lib/money.test.ts  # a single file
```

Unit tests cover the pure functions in `src/lib/`. There are no component or browser tests in the repo yet (Playwright e2e is planned for Phase 4).

The Supabase CLI is a pinned dev dependency (use `npx supabase ...` for anything without a script). It needs Docker Desktop running.

```sh
npm run db:start    # local stack: db, auth, API gateway (127.0.0.1:54321); prints URL + keys
npm run db:reset    # re-apply all migrations + seed.sql
npm run db:test     # all pgTAP tests in supabase/tests/
npm run db:test -- supabase/tests/rls_test.sql   # a single test file
npm run db:types    # regenerate src/lib/database.types.ts; run after every schema change
npm run db:stop
```

The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env.local`; `.env.example` is the template. The local stack's publishable key is a fixed demo value printed by `db:start`.

There's no local `psql`, so run SQL through the DB container. To test as a real user under RLS, switch role inside a transaction:

```sh
docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) psql -U postgres -d postgres <<'EOF'
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'd0d0d0d0-0000-4000-8000-000000000001';  -- seeded demo user
select * from monthly_category_summary(current_date);
rollback;
EOF
```

The seeded demo login is `demo@example.com` / `demo-password-123`. Seed dates are relative to `current_date`, so the current month always has data.

## Architecture

**No custom backend.** The SPA calls Supabase (PostgREST + Auth) directly with the user's JWT, so **Postgres RLS is the only security boundary**. Anything that has to be trustworthy (ownership, validation, aggregation) belongs in the database, not in React.

### Database invariants. Every new user-owned table must follow these:

- `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`. The client never sends `user_id`.
- Enable RLS **in the same migration that creates the table**, with select/insert/update/delete policies `to authenticated` using `(select auth.uid()) = user_id`. Wrapping it in `select` lets Postgres evaluate it once per query instead of once per row.
- Reference categories with a **composite FK** `(category_id, user_id) → categories(id, user_id)`, never `category_id` alone. FK checks bypass RLS, so this composite key is what stops a user from linking to someone else's category.
- Use `on delete no action` (not `restrict`) where a child should block deletion of its parent. `restrict` breaks the `auth.users` delete cascade. The last test in `rls_test.sql` covers this.
- Money is `bigint` cents (`amount_cents`, `limit_cents`). Expense dates are `date` (`spent_on`), never `timestamptz`. Budget `month` is always the 1st of the month, which a CHECK constraint enforces.
- Functions use `set search_path = ''` and schema-qualify everything. Aggregate/read functions are `security invoker`, so RLS applies. Any `security definer` function must `revoke execute ... from public, anon, authenticated` unless it's meant to be called over the API.

### Aggregation layer

Charts read from SQL functions such as `monthly_category_summary(p_month)` and `daily_spend(p_month)`, which the client calls via `supabase.rpc`. They don't sum raw rows in the browser. Add new dashboard metrics as SQL functions in a new migration, with a pgTAP test.

### Migrations and tests

- Migrations are timestamped files in `supabase/migrations/`. Add a new file; don't edit one that has already been pushed to the hosted project.
- `supabase/tests/*.sql` are pgTAP. When you add or remove assertions, update that file's `select plan(N)` to match or the run fails. Tests switch users with `set local role authenticated` plus `set local request.jwt.claim.sub`.
- New users get 10 default categories from an `auth.users` insert trigger (`handle_new_user`). Tests and seed data depend on this; for example, the test asserts a count of 10.

### Front end

- Only `src/hooks/` (TanStack Query) and `src/auth/` call Supabase. Components and pages never import the Supabase client directly.
- Query keys come from `src/hooks/queryKeys.ts`. Mutations invalidate through `useInvalidate(table)`, which refetches every query that depends on that table (an expense change also refetches summaries). Add a query that reads a table → add its key prefix to `dependsOn`.
- The selected month lives in the URL (`?month=YYYY-MM`) via `useSelectedMonth()`, and the nav links carry it between pages.
- On sign-out, `AuthProvider` clears the whole query cache, so one user's data is never shown to the next.
- Postgres errors reach the UI through `friendlyError(err, overrides)` in `src/lib/dbErrors.ts`, keyed by SQLSTATE (`23505` = duplicate, `23503` = still referenced). Constraint violations come back from PostgREST as HTTP 409, so seeing a 409 in the console for an expected conflict is normal.
- Chart components take already-shaped data as props, and don't fetch or aggregate.
- Cents-to-display and date/month logic live in pure functions in `src/lib/` (`money.ts`, `dates.ts`), with tests next to them. Dates are `'YYYY-MM-DD'` strings in local time; never use `toISOString()` to get a date, because it converts to UTC.
- `monthly_category_summary` returns `limit_cents`, `remaining_cents` and `pct_used` as NULL when there's no budget, but the generated types say `number`. Use `CategorySummary` from `useMonthlySummary.ts`, which corrects this.
- DB types in `src/lib/database.types.ts` are generated (`npm run db:types`), never hand-edited. The output is unformatted; that's expected.

### TypeScript settings that affect how you write code

- `verbatimModuleSyntax`: type-only imports must use `import type`.
- `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties. Use union types or `as const` objects instead.
- `allowImportingTsExtensions`: imports include the extension (`./App.tsx`), matching the existing code.
