-- Public demo account: demo@example.com / demo-password-123.
--
-- The live site offers a one-click demo login, so the password is public by
-- design. Three safeguards follow from that:
--   1. reset_demo_data() rebuilds the demo user and ~3 months of data relative
--      to today (used by seed.sql locally, and by a nightly job).
--   2. A trigger stops anyone signed in as the demo user from changing its
--      email or password and locking other visitors out.
--   3. pg_cron runs the reset every night, so vandalised or stale demo data
--      never lasts more than a day.
-- On a database without the demo user, the trigger and job are inert until
-- reset_demo_data() first creates it.

-- ---------------------------------------------------------------------------
-- 1. Rebuild the demo account
-- ---------------------------------------------------------------------------

create function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user constant uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from auth.users where id = v_user) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      -- GoTrue fails to scan NULLs in these columns, so they must be ''.
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user,
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
      v_user,
      v_user::text,
      'email',
      jsonb_build_object('sub', v_user::text, 'email', 'demo@example.com', 'email_verified', true),
      now(), now(), now()
    );
  end if;

  -- Start from the default categories, whatever visitors did to them.
  delete from public.expenses where user_id = v_user;
  delete from public.budgets where user_id = v_user;
  delete from public.categories where user_id = v_user;
  perform public.create_default_categories(v_user);

  -- Deterministic "random" data, so screenshots are reproducible.
  perform setseed(0.42);

  with
  days as (
    select d::date as day
    from generate_series(
      (date_trunc('month', current_date) - interval '2 months')::date,
      current_date,
      interval '1 day'
    ) as d
  ),
  cats as (
    select c.id, c.name from public.categories c where c.user_id = v_user
  ),
  -- Day-to-day spending: each category has a daily chance of an expense and
  -- an amount range in cents.
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
  select v_user, r.category_id, r.amount_cents, r.day, r.note
  from (
    select category_id, day, amount_cents, note from everyday_rows where roll < chance
    union all
    select category_id, day, amount_cents, note from monthly_rows
  ) r;

  -- Budgets for each of the three months. Dining Out is deliberately tight so
  -- the dashboard shows an over-budget category.
  insert into public.budgets (user_id, category_id, month, limit_cents)
  select v_user, c.id, m.month, b.limit_cents
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
  where c.user_id = v_user;
end;
$$;

-- Maintenance only: never callable over the API.
revoke execute on function public.reset_demo_data() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Keep the demo credentials fixed
-- ---------------------------------------------------------------------------

-- Silently keeps the old email, password and phone, and discards any pending
-- email change, so "change password" or "change email" calls made while signed
-- in as the demo user have no effect. Sign-in bookkeeping (last_sign_in_at,
-- etc.) is untouched.
create function public.protect_demo_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := old.email;
  new.encrypted_password := old.encrypted_password;
  new.phone := old.phone;
  new.email_change := '';
  new.email_change_token_new := '';
  new.email_change_token_current := '';
  new.phone_change := '';
  new.phone_change_token := '';
  return new;
end;
$$;

revoke execute on function public.protect_demo_user() from public, anon, authenticated;

create trigger protect_demo_user
  before update on auth.users
  for each row
  when (old.id = 'd0d0d0d0-0000-4000-8000-000000000001'::uuid)
  execute function public.protect_demo_user();

-- ---------------------------------------------------------------------------
-- 3. Nightly reset
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

-- 18:00 UTC is early morning in Australia. cron.schedule upserts by name.
select cron.schedule('reset-demo-data', '0 18 * * *', 'select public.reset_demo_data()');
