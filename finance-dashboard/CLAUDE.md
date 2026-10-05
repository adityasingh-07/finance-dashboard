# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal finance dashboard: users log expenses, set monthly budgets per category, and see spending charts. React 19 + TypeScript (Vite), Supabase (Postgres/Auth/RLS), Chart.js. The design, diagrams and phased roadmap are in `docs/ARCHITECTURE.md`. Check its roadmap checkboxes to see what's built, and tick them when you finish an item.

**Current state:** Phases 0–2 are done: database, auth, and CRUD pages for expenses, budgets and categories. The dashboard (`src/pages/DashboardPage.tsx`) shows summary numbers and quick-add only; charts are Phase 3.

## Resuming work (as of 2026-10-06)

1. Start Docker Desktop, then run `npm run db:start` and `npm run dev`. The demo login is in the Commands section below.
2. Start Phase 4 (polish: responsive tweaks, Playwright e2e in the repo, deploy, README) using the roadmap in `docs/ARCHITECTURE.md`.

Known follow-ups already planned for Phase 4: the main bundle is about 690 KB and still triggers Vite's chunk-size warning (Chart.js is already split out; route-level code-splitting is next), the "move expenses and delete" controls wrap awkwardly in the Categories table on desktop.

Update or remove this section once these are done.

## Deployment

- **Live site:** https://finance-dashboard-three-virid.vercel.app (Vercel project `finance-dashboard`). `vercel.json` sets the Vite build and SPA rewrites, so deep links work.
- **Vercel builds from GitHub on every push to `main`.** The project's Root Directory must be `finance-dashboard`, because the git root is the parent folder. If it isn't, the build produces an empty site and production returns 404. Check this before pushing if deploys change.
- **Database:** hosted Supabase project `kclfdjmvjxtsdvbwnszi` (Sydney). This folder is linked, so `npx supabase ... --linked` commands target it.
- **Ship a schema change:** add a migration, test locally (`npm run db:reset`, then `npm run db:test`), then run `npx supabase db push --linked`.
- **Vercel env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD` (production and preview).
- **Roll back a bad deploy:** `npx vercel@latest promote <previous-deployment-url> --yes` (find URLs with `npx vercel@latest ls finance-dashboard`).
- **Demo account** (`demo@example.com` / `demo-password-123`, public on purpose): `reset_demo_data()` rebuilds it, pg_cron runs that nightly at 18:00 UTC, and a trigger on `auth.users` keeps its email and password from being changed. To reset it by hand, run `select public.reset_demo_data();` with `npx supabase db query --linked`.
- **When writing files from a shell command, never put backticks inside double quotes.** Bash executes them as commands. Write file content with the editor tools instead.

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
- Query keys come from `src/hooks/queryKeys.ts`. Mutations invalidate through `useInvalidate(change)`, where `dependsOn[change]` lists the query prefixes that kind of change affects (an expense change also refetches summaries; renaming a category doesn't refetch expenses, but deleting one does, via `categoryDelete`). Add a query that reads a table → add its key prefix to the relevant `dependsOn` entries.
- Multi-row writes that must be atomic, or that could hit a unique constraint, go in a SQL function called by RPC (`delete_category`, `copy_budgets`), not in client-side select-then-insert sequences.
- `useExpenses` pages through results because PostgREST caps responses at `max_rows` (1000). Any new list query that can exceed 1000 rows needs the same treatment, with a total order (end with `id`).
- Month budget arithmetic (remaining, over budget) goes through `summarizeBudgets()` in `src/lib/budgets.ts`. Spending in categories without a budget never counts as over budget.
- Form state that refers to server data (a selected category id) is derived from the current list on every render, not stored once, so a refetch can't leave it pointing at a deleted row. Default dates are computed per render for the same reason (`defaultExpenseDate()`).
- The selected month lives in the URL (`?month=YYYY-MM`) via `useSelectedMonth()`, and the nav links carry it between pages.
- On sign-out, `AuthProvider` clears the whole query cache, so one user's data is never shown to the next.
- Postgres errors reach the UI through `friendlyError(err, overrides)` in `src/lib/dbErrors.ts`, keyed by SQLSTATE (`23505` = duplicate, `23503` = still referenced). Constraint violations come back from PostgREST as HTTP 409, so seeing a 409 in the console for an expected conflict is normal.
- Chart components take already-shaped data as props, and don't fetch or aggregate. The dashboard's numbers all come from `buildDashboardView()` in `src/lib/dashboard.ts` (pure, unit-tested), fed by `useDashboardData`, which fetches the summary and daily series together. Render from `data.month`, not the selected month: on a month change the previous data is kept (`keepPreviousData`) and shown dimmed.
- Charts follow the dataviz rules: colours come from the `--chart-*` tokens in `index.css` (one yellow-on-ink palette for both modes, contrast-checked against `--panel-bg`), read on the canvas side via `useChartTheme()`. Text never uses a series colour. Every chart needs a table view (`ChartCard`'s `table` prop) and an `aria-label`. Never use a dual axis.
- Chart.js code lives only in the lazy-loaded `*Canvas.tsx` modules, each of which imports `components/charts/register.ts`. Register any new Chart.js controller or element there. Importing `chart.js` anywhere else pulls it into the main bundle.
- The hero states exact facts only (`buildHero`, with figures rounded so they never flatter via `heroAmount`). Don't add straight-line projections or pace warnings, because bills paid on one day make them misfire.
- Cents-to-display and date/month logic live in pure functions in `src/lib/` (`money.ts`, `dates.ts`), with tests next to them. Dates are `'YYYY-MM-DD'` strings in local time; never use `toISOString()` to get a date, because it converts to UTC.
- `monthly_category_summary` returns `limit_cents`, `remaining_cents` and `pct_used` as NULL when there's no budget, but the generated types say `number`. Use `CategorySummary` from `useMonthlySummary.ts`, which corrects this.
- DB types in `src/lib/database.types.ts` are generated (`npm run db:types`), never hand-edited. The output is unformatted; that's expected.

### Visual design

The UI follows cloudstudio.es's visual language, as the user asked: butter-yellow page (`#fff48d`), ink (`#0e0e0c`), cream cards with 2px ink outlines, pill buttons, ink panels holding the charts, Bricolage Grotesque set big and tight for headlines, and Geist Mono only for data (amounts, dates). Fonts are self-hosted via `@fontsource`. It borrows the look only: don't copy cloudstudio's logo, mascot or copy.

- All colours are tokens at the top of `src/index.css`, with a dark-mode block. Every text/background pair was contrast-checked (>= 4.5:1 for text), so pick an existing token rather than a new hex.
- `.chart-card` re-points `--surface`, `--text`, `--line` and friends at panel values. Anything placed inside a chart card (tables, buttons) automatically uses panel colours, so don't hard-code colours inside it.
- Charts use the `--chart-*` tokens, the same yellow-on-ink palette in both modes. Only the panel colour changes in dark mode.
- The dashboard opens with `buildHero()` (`src/lib/dashboard.ts`): the month's key fact as a giant figure plus the insight sentence. Keep that the one bold element; everything else stays quiet.

### TypeScript settings that affect how you write code

- `verbatimModuleSyntax`: type-only imports must use `import type`.
- `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties. Use union types or `as const` objects instead.
- `allowImportingTsExtensions`: imports include the extension (`./App.tsx`), matching the existing code.
