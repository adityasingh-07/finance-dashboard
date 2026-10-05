-- Data-model and RLS tests. Run with: supabase test db
-- Everything runs inside a transaction and is rolled back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Setup: two users (the signup trigger gives each 10 default categories)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.com');

select is(
  (select count(*) from public.categories where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  10::bigint,
  'signup trigger creates default categories'
);

-- Remember one of Alice's category ids for Bob's attack attempts later.
select set_config(
  'test.alice_groceries',
  (select id::text from public.categories
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and name = 'Groceries'),
  true
);

-- ---------------------------------------------------------------------------
-- As Alice
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select lives_ok(
  $$ insert into public.expenses (category_id, amount_cents, spent_on)
     values (current_setting('test.alice_groceries')::uuid, 1250, '2026-10-05') $$,
  'Alice can add an expense without sending user_id'
);

select lives_ok(
  $$ insert into public.budgets (category_id, month, limit_cents)
     values (current_setting('test.alice_groceries')::uuid, '2026-10-01', 50000) $$,
  'Alice can set a budget'
);

select is(
  (select count(*) from public.categories),
  10::bigint,
  'Alice sees only her own categories'
);

select throws_ok(
  $$ insert into public.expenses (category_id, amount_cents, spent_on)
     values (current_setting('test.alice_groceries')::uuid, 0, '2026-10-05') $$,
  '23514', null,
  'amount must be positive'
);

select throws_ok(
  $$ insert into public.budgets (category_id, month, limit_cents)
     values (current_setting('test.alice_groceries')::uuid, '2026-11-15', 1000) $$,
  '23514', null,
  'budget month must be the 1st'
);

select throws_ok(
  $$ insert into public.categories (name) values ('  groceries ') $$,
  '23505', null,
  'category names are unique per user, ignoring case and whitespace'
);

select results_eq(
  $$ select spent_cents, limit_cents, remaining_cents, pct_used
     from public.monthly_category_summary('2026-10-20') where name = 'Groceries' $$,
  $$ values (1250::bigint, 50000::bigint, 48750::bigint, 2.5::numeric) $$,
  'monthly_category_summary aggregates spend against budget'
);

select results_eq(
  $$ select count(*), max(cumulative_cents)
     from public.daily_spend('2026-10-01') $$,
  $$ values (31::bigint, 1250::bigint) $$,
  'daily_spend returns every day of the month with a running total'
);

select throws_ok(
  $$ delete from public.categories where name = 'Groceries' $$,
  '23503', null,
  'a category with expenses cannot be deleted'
);

-- ---------------------------------------------------------------------------
-- As Bob
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.expenses),
  0::bigint,
  'Bob cannot see Alice''s expenses'
);

select throws_ok(
  $$ insert into public.expenses (user_id, category_id, amount_cents, spent_on)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             current_setting('test.alice_groceries')::uuid, 100, '2026-10-05') $$,
  '42501', null,
  'Bob cannot insert rows as Alice'
);

select throws_ok(
  $$ insert into public.expenses (category_id, amount_cents, spent_on)
     values (current_setting('test.alice_groceries')::uuid, 100, '2026-10-05') $$,
  '23503', null,
  'Bob cannot attach an expense to Alice''s category (composite FK)'
);

-- Silently affects zero rows under RLS; checked from Alice's side below.
update public.expenses set amount_cents = 1;
delete from public.budgets;

select is(
  (select sum(spent_cents) from public.monthly_category_summary('2026-10-01')),
  0::numeric,
  'Bob''s summary does not include Alice''s spend'
);

-- ---------------------------------------------------------------------------
-- Back as Alice: Bob's update/delete had no effect
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

select results_eq(
  $$ select (select amount_cents from public.expenses), (select count(*) from public.budgets) $$,
  $$ values (1250::bigint, 1::bigint) $$,
  'Bob''s update and delete did not touch Alice''s rows'
);

-- ---------------------------------------------------------------------------
-- Anonymous and account deletion
-- ---------------------------------------------------------------------------

set local role anon;

select is(
  (select count(*) from public.categories),
  0::bigint,
  'anonymous requests see no data'
);

reset role;

select lives_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'deleting a user cascades through categories, expenses and budgets'
);

select * from finish();

rollback;
