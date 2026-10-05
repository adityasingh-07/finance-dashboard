-- Give every new user a starter set of categories so the app is usable
-- immediately after sign-up (no empty dropdowns).

create function public.create_default_categories(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, color) values
    (p_user_id, 'Groceries',     '#16A34A'),
    (p_user_id, 'Dining Out',    '#EA580C'),
    (p_user_id, 'Rent',          '#2563EB'),
    (p_user_id, 'Transport',     '#0891B2'),
    (p_user_id, 'Utilities',     '#CA8A04'),
    (p_user_id, 'Entertainment', '#DB2777'),
    (p_user_id, 'Shopping',      '#7C3AED'),
    (p_user_id, 'Health',        '#DC2626'),
    (p_user_id, 'Subscriptions', '#4F46E5'),
    (p_user_id, 'Other',         '#6B7280')
  on conflict do nothing;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_default_categories(new.id);
  return new;
end;
$$;

-- Security definer functions in the public schema are callable over the API
-- unless revoked. These are internal only.
revoke execute on function public.create_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users who signed up before this migration and have no categories.
select public.create_default_categories(u.id)
from auth.users u
where not exists (select 1 from public.categories c where c.user_id = u.id);
