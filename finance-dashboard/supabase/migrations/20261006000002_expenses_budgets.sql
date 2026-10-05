-- Expenses and monthly budgets.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  category_id uuid not null,

  -- Integer cents: exact arithmetic, formatting happens only in the UI.
  amount_cents bigint not null
    check (amount_cents > 0),

  -- A calendar day in the user's life, not an instant. No default: the
  -- server's current_date is UTC and would misfile late-night expenses.
  spent_on date not null,

  note text
    check (note is null or length(note) <= 200),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Composite FK: the category must belong to the same user. FK checks bypass
  -- RLS, so without this a user could attach expenses to a guessed category id
  -- belonging to someone else.
  --
  -- NO ACTION (the default) rather than RESTRICT: both block deleting a
  -- category that still has expenses, but NO ACTION is checked at the end of
  -- the statement, so deleting a user (which cascades to categories AND
  -- expenses) still succeeds. RESTRICT would fail mid-cascade.
  constraint expenses_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete no action
);

-- Main access pattern: this user's expenses in a date range, newest first.
create index expenses_user_spent_on_idx
  on public.expenses (user_id, spent_on desc);

-- Supports the FK check when a category is deleted.
create index expenses_category_idx
  on public.expenses (category_id, user_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "expenses_insert_own" on public.expenses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "expenses_update_own" on public.expenses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "expenses_delete_own" on public.expenses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

create table public.budgets (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  category_id uuid not null,

  -- Always the 1st of the month: one canonical value to join and index on.
  month date not null
    check (month = date_trunc('month', month)::date),

  limit_cents bigint not null
    check (limit_cents >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One budget per category per month; lets the UI upsert. Column order
  -- (user_id, month, ...) also serves "all budgets for this month" lookups.
  constraint budgets_user_month_category_unique
    unique (user_id, month, category_id),

  -- A budget has no meaning without its category, so it goes with it.
  constraint budgets_category_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
    on delete cascade
);

create index budgets_category_idx
  on public.budgets (category_id, user_id);

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

alter table public.budgets enable row level security;

create policy "budgets_select_own" on public.budgets
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "budgets_insert_own" on public.budgets
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budgets_update_own" on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budgets_delete_own" on public.budgets
  for delete to authenticated
  using ((select auth.uid()) = user_id);
