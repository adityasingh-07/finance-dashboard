-- copy_budgets(): copies missing budgets only, and only the caller's.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@test.com'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@test.com');

-- Bob has a September budget that must never be copied into Alice's account.
insert into public.budgets (user_id, category_id, month, limit_cents)
select user_id, id, '2026-09-01', 99900
from public.categories
where user_id = 'bbbbbbbb-0000-4000-8000-000000000002' and name = 'Groceries';

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.budgets (category_id, month, limit_cents)
select id, '2026-09-01', v
from public.categories
join (values ('Groceries', 40000), ('Rent', 200000), ('Transport', 15000)) as x (name, v) using (name);

-- October already has a (different) Rent budget.
insert into public.budgets (category_id, month, limit_cents)
select id, '2026-10-01', 210000 from public.categories where name = 'Rent';

select is(
  public.copy_budgets('2026-09-01', '2026-10-01'),
  2,
  'copies only the budgets missing from the target month'
);

select is(
  (select limit_cents from public.budgets b join public.categories c on c.id = b.category_id
   where c.name = 'Rent' and b.month = '2026-10-01'),
  210000::bigint,
  'does not overwrite an existing budget'
);

select results_eq(
  $$ select c.name, b.limit_cents from public.budgets b
     join public.categories c on c.id = b.category_id
     where b.month = '2026-10-01' order by c.name $$,
  $$ values ('Groceries'::text, 40000::bigint), ('Rent', 210000), ('Transport', 15000) $$,
  'target month ends up with the union, existing values kept'
);

select is(
  public.copy_budgets('2026-09-01', '2026-10-01'),
  0,
  'running it again copies nothing and does not fail'
);

select is(
  public.copy_budgets('2026-09-17', '2026-11-30'),
  3,
  'normalises both arguments to the 1st of the month'
);

select throws_ok(
  $$ select public.copy_budgets('2026-09-01', '2026-09-15') $$,
  '22023', null,
  'rejects copying a month onto itself'
);

reset role;

select is(
  (select count(*) from public.budgets
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and limit_cents = 99900),
  0::bigint,
  'never copies another user''s budgets'
);

select * from finish();

rollback;
