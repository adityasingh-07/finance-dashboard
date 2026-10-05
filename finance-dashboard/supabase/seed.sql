-- Local development seed: a demo user with ~3 months of realistic data.
-- Runs automatically after migrations on `supabase db reset`.
-- Dates are relative to today, so the dashboard always has a current month.
--
-- Demo login: demo@example.com / demo-password-123

-- ---------------------------------------------------------------------------
-- Demo user (the on_auth_user_created trigger creates its default categories)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  -- GoTrue fails to scan NULLs in these columns, so they must be ''.
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0d0d0d0-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'demo@example.com',
  extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd0d0d0d0-0000-4000-8000-000000000001',
  'd0d0d0d0-0000-4000-8000-000000000001',
  'email',
  '{"sub":"d0d0d0d0-0000-4000-8000-000000000001","email":"demo@example.com","email_verified":true}',
  now(), now(), now()
);

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

-- Deterministic "random" data, so screenshots are reproducible.
select setseed(0.42);

with
demo as (
  select 'd0d0d0d0-0000-4000-8000-000000000001'::uuid as user_id
),
days as (
  select d::date as day
  from generate_series(
    (date_trunc('month', current_date) - interval '2 months')::date,
    current_date,
    interval '1 day'
  ) as d
),
cats as (
  select c.id, c.name
  from public.categories c
  join demo using (user_id)
),

-- Day-to-day spending: each category has a daily chance of an expense
-- and an amount range in cents.
everyday (category, chance, min_cents, max_cents, notes) as (
  values
    ('Groceries',     0.30, 2500, 14000, array['Woolworths', 'Coles', 'Aldi', 'Farmers market']),
    ('Dining Out',    0.35, 1400,  7500, array['Lunch', 'Coffee + pastry', 'Dinner with friends', 'Takeaway']),
    ('Transport',     0.45,  450,  2500, array['Opal top-up', 'Uber', 'Fuel', 'Parking']),
    ('Entertainment', 0.08, 1800,  9000, array['Cinema', 'Concert tickets', 'Bowling']),
    ('Shopping',      0.07, 2500, 18000, array['Clothes', 'Homewares', 'Books']),
    ('Health',        0.04, 2000, 12000, array['Pharmacy', 'Physio', 'GP gap fee'])
),
everyday_rows as (
  select
    c.id as category_id,
    d.day,
    (e.min_cents + floor(random() * (e.max_cents - e.min_cents)))::bigint as amount_cents,
    e.notes[1 + floor(random() * array_length(e.notes, 1))::int] as note,
    random() as roll,
    e.chance
  from days d
  cross join everyday e
  join cats c on c.name = e.category
),

-- Fixed monthly bills on a given day of the month.
monthly (category, day_of_month, amount_cents, note) as (
  values
    ('Rent',           1, 230000::bigint, 'Rent'),
    ('Utilities',     12,  14250::bigint, 'Electricity'),
    ('Utilities',     20,   7999::bigint, 'Internet'),
    ('Subscriptions',  3,   2299::bigint, 'Netflix'),
    ('Subscriptions',  9,   1299::bigint, 'Spotify'),
    ('Subscriptions', 15,   4900::bigint, 'Gym membership')
),
monthly_rows as (
  select c.id as category_id, d.day, m.amount_cents, m.note
  from days d
  join monthly m on extract(day from d.day) = m.day_of_month
  join cats c on c.name = m.category
)

insert into public.expenses (user_id, category_id, amount_cents, spent_on, note)
select demo.user_id, r.category_id, r.amount_cents, r.day, r.note
from (
  select category_id, day, amount_cents, note from everyday_rows where roll < chance
  union all
  select category_id, day, amount_cents, note from monthly_rows
) r
cross join demo;

-- ---------------------------------------------------------------------------
-- Budgets for each of the three months. Dining Out is deliberately tight so
-- the dashboard shows an over-budget category.
-- ---------------------------------------------------------------------------

insert into public.budgets (user_id, category_id, month, limit_cents)
select c.user_id, c.id, m.month, b.limit_cents
from public.categories c
join (
  values
    ('Groceries',    130000::bigint),
    ('Dining Out',    30000::bigint),
    ('Rent',         230000::bigint),
    ('Transport',     25000::bigint),
    ('Utilities',     25000::bigint),
    ('Entertainment', 35000::bigint),
    ('Shopping',      50000::bigint),
    ('Health',        10000::bigint),
    ('Subscriptions', 10000::bigint)
) as b (name, limit_cents) on b.name = c.name
cross join (
  select (date_trunc('month', current_date) - make_interval(months => n))::date as month
  from generate_series(0, 2) as n
) m
where c.user_id = 'd0d0d0d0-0000-4000-8000-000000000001';
