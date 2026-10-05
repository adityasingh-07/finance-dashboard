-- daily_spend(): every day of the month, running totals, budgeted split.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.com');

-- Bob's spending must never show up in Alice's numbers.
insert into public.expenses (user_id, category_id, amount_cents, spent_on)
select user_id, id, 77700, '2026-02-10'
from public.categories
where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' and name = 'Groceries';

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

-- Groceries has a February budget; Rent does not.
insert into public.budgets (category_id, month, limit_cents)
select id, '2026-02-01', 40000 from public.categories where name = 'Groceries';

insert into public.expenses (category_id, amount_cents, spent_on)
select c.id, x.amount, x.day::date
from (values
  ('Groceries', 1000, '2026-02-01'),
  ('Rent',      5000, '2026-02-01'),
  ('Groceries', 2500, '2026-02-03'),
  ('Groceries',  999, '2026-01-31'),  -- previous month: excluded
  ('Groceries',  888, '2026-03-01')   -- next month: excluded
) as x (name, amount, day)
join public.categories c on c.name = x.name;

select is(
  (select count(*) from public.daily_spend('2026-02-14')),
  28::bigint,
  'one row per day of February 2026'
);

select results_eq(
  $$ select spent_cents, cumulative_cents, budgeted_spent_cents, budgeted_cumulative_cents
     from public.daily_spend('2026-02-01') where spent_on = '2026-02-01' $$,
  $$ values (6000::bigint, 6000::bigint, 1000::bigint, 1000::bigint) $$,
  'splits a day''s spend into total and budgeted'
);

select results_eq(
  $$ select spent_cents, cumulative_cents, budgeted_spent_cents, budgeted_cumulative_cents
     from public.daily_spend('2026-02-01') where spent_on = '2026-02-02' $$,
  $$ values (0::bigint, 6000::bigint, 0::bigint, 1000::bigint) $$,
  'days without spending carry the running totals forward'
);

select results_eq(
  $$ select max(cumulative_cents), max(budgeted_cumulative_cents)
     from public.daily_spend('2026-02-01') $$,
  $$ values (8500::bigint, 3500::bigint) $$,
  'month totals exclude other months and other users'
);

select is(
  (select count(*) from public.daily_spend('2024-02-01')),
  29::bigint,
  'handles leap years'
);

set local role anon;

select throws_ok(
  $$ select * from public.daily_spend('2026-02-01') $$,
  '42501', null,
  'anonymous callers cannot execute it'
);

select * from finish();

rollback;
