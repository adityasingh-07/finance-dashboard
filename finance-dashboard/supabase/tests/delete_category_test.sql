-- delete_category(): reassign-then-delete, and its authorisation.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.com');

select set_config('test.alice_dining',
  (select id::text from public.categories
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and name = 'Dining Out'), true);
select set_config('test.alice_groceries',
  (select id::text from public.categories
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and name = 'Groceries'), true);
select set_config('test.bob_groceries',
  (select id::text from public.categories
   where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' and name = 'Groceries'), true);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.expenses (category_id, amount_cents, spent_on) values
  (current_setting('test.alice_dining')::uuid, 1500, '2026-10-01'),
  (current_setting('test.alice_dining')::uuid, 2500, '2026-10-02');

select throws_ok(
  $$ select public.delete_category(current_setting('test.alice_dining')::uuid) $$,
  '23503', null,
  'a category with expenses cannot be deleted without a reassignment target'
);

select throws_ok(
  $$ select public.delete_category(current_setting('test.alice_dining')::uuid,
                                   current_setting('test.alice_dining')::uuid) $$,
  '22023', null,
  'cannot reassign into the category being deleted'
);

select throws_ok(
  $$ select public.delete_category(current_setting('test.alice_dining')::uuid,
                                   current_setting('test.bob_groceries')::uuid) $$,
  '23503', null,
  'cannot move expenses into another user''s category'
);

select is(
  (select count(*) from public.expenses
   where category_id = current_setting('test.alice_dining')::uuid),
  2::bigint,
  'a failed delete leaves expenses where they were'
);

select lives_ok(
  $$ select public.delete_category(current_setting('test.alice_dining')::uuid,
                                   current_setting('test.alice_groceries')::uuid) $$,
  'deleting with a reassignment target succeeds'
);

select results_eq(
  $$ select
       (select count(*) from public.expenses
        where category_id = current_setting('test.alice_groceries')::uuid),
       (select count(*) from public.categories
        where id = current_setting('test.alice_dining')::uuid) $$,
  $$ values (2::bigint, 0::bigint) $$,
  'expenses moved and the category is gone'
);

select lives_ok(
  $$ select public.delete_category(
       (select id from public.categories where name = 'Health')) $$,
  'an unused category deletes without a target'
);

set local request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';

select throws_ok(
  $$ select public.delete_category(current_setting('test.alice_groceries')::uuid) $$,
  'P0002', null,
  'cannot delete another user''s category'
);

select * from finish();

rollback;
