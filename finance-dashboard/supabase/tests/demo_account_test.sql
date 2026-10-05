-- Demo account: rebuildable, credentials locked, reset not exposed.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

-- Start from a database without the demo user, as on a fresh hosted project.
delete from auth.users where id = 'd0d0d0d0-0000-4000-8000-000000000001';

select lives_ok($$ select public.reset_demo_data() $$, 'reset creates the demo user when missing');

select is(
  (select email from auth.users where id = 'd0d0d0d0-0000-4000-8000-000000000001'),
  'demo@example.com',
  'demo user exists with the public email'
);

select ok(
  (select encrypted_password = extensions.crypt('demo-password-123', encrypted_password)
   from auth.users where id = 'd0d0d0d0-0000-4000-8000-000000000001'),
  'demo password matches the public one'
);

select results_eq(
  $$ select
       (select count(*) from public.categories where user_id = 'd0d0d0d0-0000-4000-8000-000000000001'),
       (select count(*) from public.budgets where user_id = 'd0d0d0d0-0000-4000-8000-000000000001'),
       (select count(*) > 50 from public.expenses where user_id = 'd0d0d0d0-0000-4000-8000-000000000001') $$,
  $$ values (10::bigint, 27::bigint, true) $$,
  'demo data: default categories, 3 months of budgets, plenty of expenses'
);

-- Vandalise it, then reset.
delete from public.expenses where user_id = 'd0d0d0d0-0000-4000-8000-000000000001';
update public.categories set name = 'Defaced' where user_id = 'd0d0d0d0-0000-4000-8000-000000000001' and name = 'Rent';
select public.reset_demo_data();

select results_eq(
  $$ select
       (select count(*) from public.categories where user_id = 'd0d0d0d0-0000-4000-8000-000000000001' and name = 'Defaced'),
       (select count(*) > 50 from public.expenses where user_id = 'd0d0d0d0-0000-4000-8000-000000000001') $$,
  $$ values (0::bigint, true) $$,
  'reset restores vandalised demo data'
);

-- Credential changes are silently ignored.
update auth.users
set encrypted_password = extensions.crypt('hijacked', extensions.gen_salt('bf')),
    email = 'attacker@example.com',
    email_change = 'attacker@example.com',
    email_change_token_new = 'token'
where id = 'd0d0d0d0-0000-4000-8000-000000000001';

select results_eq(
  $$ select email, encrypted_password = extensions.crypt('demo-password-123', encrypted_password), email_change, email_change_token_new
     from auth.users where id = 'd0d0d0d0-0000-4000-8000-000000000001' $$,
  $$ values ('demo@example.com'::varchar, true, ''::varchar, ''::varchar) $$,
  'demo email, password and pending email change cannot be altered'
);

-- Other users are unaffected by the trigger.
insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-000000000003', 'carol@test.com');
update auth.users set email = 'carol2@test.com' where id = 'cccccccc-0000-4000-8000-000000000003';
select is(
  (select email from auth.users where id = 'cccccccc-0000-4000-8000-000000000003'),
  'carol2@test.com',
  'other users can still change their email'
);

select is(
  (select count(*) from cron.job where jobname = 'reset-demo-data' and schedule = '0 18 * * *'),
  1::bigint,
  'nightly reset is scheduled'
);

set local role authenticated;
set local request.jwt.claim.sub = 'd0d0d0d0-0000-4000-8000-000000000001';

select throws_ok(
  $$ select public.reset_demo_data() $$,
  '42501', null,
  'signed-in users cannot trigger the reset over the API'
);

select * from finish();

rollback;
