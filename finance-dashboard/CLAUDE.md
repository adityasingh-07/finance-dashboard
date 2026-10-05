# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal finance dashboard: users log expenses, set monthly budgets per category, and see spending charts. React 19 + TypeScript (Vite), Supabase (Postgres/Auth/RLS), Chart.js. The design, diagrams and phased roadmap are in `docs/ARCHITECTURE.md`. Check its roadmap checkboxes to see what's built, and tick them when you finish an item.

**Current state:** the database layer (Phase 1) is done and tested. The front end is still an empty scaffold: `src/App.tsx` is a placeholder, and Supabase, Chart.js, TanStack Query and the router aren't installed yet.

## Repo layout quirk

The git root is the **parent** directory (`Personal Finance Dashboard/`), and this project lives in `finance-dashboard/`. Run npm and Supabase commands from `finance-dashboard/`. Git paths show up as `finance-dashboard/...`.

## Commands

```sh
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build (type-check is part of build)
npm run lint       # oxlint
```

There's no JS test runner yet (Vitest is planned).

The Supabase CLI isn't installed globally or in package.json, so use `npx -y supabase@latest`. It needs Docker Desktop running.

```sh
# Start a minimal local stack (db + auth only); applies migrations + seed on first start
npx -y supabase@latest start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit,kong,postgrest

npx -y supabase@latest db reset                               # re-apply all migrations + seed.sql
npx -y supabase@latest test db                                # all pgTAP tests in supabase/tests/
npx -y supabase@latest test db supabase/tests/rls_test.sql    # a single test file
npx -y supabase@latest stop
```

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
- `supabase/tests/rls_test.sql` is pgTAP. When you add or remove assertions, update `select plan(N)` to match or the run fails. Tests switch users with `set local role authenticated` plus `set local request.jwt.claim.sub`.
- New users get 10 default categories from an `auth.users` insert trigger (`handle_new_user`). Tests and seed data depend on this; for example, the test asserts a count of 10.

### Front end (planned layering, from docs/ARCHITECTURE.md)

- Only query hooks (TanStack Query) in `src/hooks/` call Supabase. Components and pages never import the Supabase client directly.
- Chart components take already-shaped data as props, and don't fetch or aggregate.
- Cents-to-display and date/month logic live in pure functions in `src/lib/` (`money.ts`, `dates.ts`).
- DB types are generated with `supabase gen types typescript`, not hand-written.

### TypeScript settings that affect how you write code

- `verbatimModuleSyntax`: type-only imports must use `import type`.
- `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties. Use union types or `as const` objects instead.
- `allowImportingTsExtensions`: imports include the extension (`./App.tsx`), matching the existing code.
