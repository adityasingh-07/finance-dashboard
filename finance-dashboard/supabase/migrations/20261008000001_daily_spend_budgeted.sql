-- daily_spend now also reports spending in categories that have a budget
-- that month. The dashboard's pace chart compares budgeted spending against
-- the budget, so spending in unbudgeted categories never reads as "over",
-- matching summarizeBudgets() in the app.
--
-- The return type changes, so the function is dropped and recreated (which
-- also drops its grants; they are re-applied below).

drop function public.daily_spend(date);

create function public.daily_spend(p_month date)
returns table (
  spent_on date,
  spent_cents bigint,
  cumulative_cents bigint,
  budgeted_spent_cents bigint,
  budgeted_cumulative_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as m_start,
      (date_trunc('month', p_month) + interval '1 month')::date as m_end
  ),
  days as (
    select d::date as day
    from bounds b
    cross join generate_series(b.m_start, b.m_end - 1, interval '1 day') as d
  ),
  daily as (
    select
      e.spent_on,
      sum(e.amount_cents)::bigint as spent_cents,
      coalesce(sum(e.amount_cents) filter (where bu.id is not null), 0)::bigint as budgeted_cents
    from public.expenses e
    cross join bounds b
    left join public.budgets bu
      on bu.category_id = e.category_id
     and bu.user_id = e.user_id
     and bu.month = b.m_start
    where e.user_id = (select auth.uid())
      and e.spent_on >= b.m_start
      and e.spent_on < b.m_end
    group by e.spent_on
  )
  select
    d.day,
    coalesce(x.spent_cents, 0)::bigint,
    (sum(coalesce(x.spent_cents, 0)) over (order by d.day))::bigint,
    coalesce(x.budgeted_cents, 0)::bigint,
    (sum(coalesce(x.budgeted_cents, 0)) over (order by d.day))::bigint
  from days d
  left join daily x on x.spent_on = d.day
  order by d.day;
$$;

revoke execute on function public.daily_spend(date) from public, anon;
grant execute on function public.daily_spend(date) to authenticated;
