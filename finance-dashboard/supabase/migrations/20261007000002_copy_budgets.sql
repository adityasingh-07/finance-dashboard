-- Copy one month's budgets into another, skipping categories that already
-- have a budget in the target month (existing values are never overwritten).
-- One statement, so it can't half-succeed, and a stale "this month is empty"
-- view in the UI can't make it fail.
--
-- SECURITY INVOKER: only the caller's budgets are visible (RLS), and inserted
-- rows get user_id from its auth.uid() default. Returns the number copied.

create function public.copy_budgets(p_from date, p_to date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_from)::date;
  v_to date := date_trunc('month', p_to)::date;
  v_copied integer;
begin
  if v_from = v_to then
    raise exception 'Source and target month are the same' using errcode = '22023';
  end if;

  insert into public.budgets (category_id, month, limit_cents)
  select b.category_id, v_to, b.limit_cents
  from public.budgets b
  where b.user_id = (select auth.uid())
    and b.month = v_from
  on conflict (user_id, month, category_id) do nothing;

  get diagnostics v_copied = row_count;
  return v_copied;
end;
$$;

revoke execute on function public.copy_budgets(date, date) from public, anon;
grant execute on function public.copy_budgets(date, date) to authenticated;
