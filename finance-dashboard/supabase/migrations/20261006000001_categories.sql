-- Categories: user-defined buckets for expenses and budgets.

create table public.categories (
  id uuid primary key default gen_random_uuid(),

  -- Defaults to the caller, so the client never sends (or spoofs) user_id.
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  name text not null
    check (length(trim(name)) between 1 and 40),

  color text not null default '#6B7280'
    check (color ~* '^#[0-9a-f]{6}$'),

  created_at timestamptz not null default now(),

  -- Target for composite FKs from expenses/budgets: a child row can only
  -- reference a category owned by the same user.
  constraint categories_id_user_unique unique (id, user_id)
);

-- "Food" and " food" are the same category. The leading user_id column also
-- serves "all categories for this user" lookups, so no separate index needed.
create unique index categories_user_name_unique
  on public.categories (user_id, lower(trim(name)));

-- RLS is the security boundary: the SPA talks to PostgREST directly.
alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "categories_update_own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using ((select auth.uid()) = user_id);
