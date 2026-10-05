-- Aggregation layer: the dashboard reads these instead of summing raw rows
-- in the browser. Both run as SECURITY INVOKER, so RLS still applies; the
-- explicit auth.uid() filters are there so the planner can use the indexes.

-- One row per category for the month containing p_month: spend, budget,
-- remaining and % used. Categories with a budget but no spend still appear.
create function public.monthly_category_summary(p_month date)
returns table (
  category_id uuid,
  name text,
  color text,
  spent_cents bigint,
  limit_cents bigint,
  remaining_cents bigint,
  pct_used numeric
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
  spend as (
    select e.category_id, sum(e.amount_cents)::bigint as spent_cents
    from public.expenses e
    cross join bounds b
    where e.user_id = (select auth.uid())
      and e.spent_on >= b.m_start
      and e.spent_on < b.m_end
    group by e.category_id
  )
  select
    c.id,
    c.name,
    c.color,
    coalesce(s.spent_cents, 0),
    bu.limit_cents,
    bu.limit_cents - coalesce(s.spent_cents, 0),
    case
      when bu.limit_cents > 0
        then round(100.0 * coalesce(s.spent_cents, 0) / bu.limit_cents, 1)
    end
  from public.categories c
  cross join bounds b
  left join spend s
    on s.category_id = c.id
  left join public.budgets bu
    on bu.category_id = c.id
   and bu.user_id = c.user_id
   and bu.month = b.m_start
  where c.user_id = (select auth.uid())
  order by coalesce(s.spent_cents, 0) desc, c.name;
$$;

-- One row per calendar day of the month containing p_month, including days
-- with no spend, with a running total. Feeds the "spend vs pace" line chart;
-- the client trims days after today.
create function public.daily_spend(p_month date)
returns table (
  spent_on date,
  spent_cents bigint,
  cumulative_cents bigint
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
    select e.spent_on, sum(e.amount_cents)::bigint as spent_cents
    from public.expenses e
    cross join bounds b
    where e.user_id = (select auth.uid())
      and e.spent_on >= b.m_start
      and e.spent_on < b.m_end
    group by e.spent_on
  )
  select
    d.day,
    coalesce(x.spent_cents, 0)::bigint,
    (sum(coalesce(x.spent_cents, 0)) over (order by d.day))::bigint
  from days d
  left join daily x on x.spent_on = d.day
  order by d.day;
$$;

-- Signed-in users only.
revoke execute on function public.monthly_category_summary(date) from public, anon;
revoke execute on function public.daily_spend(date) from public, anon;
grant execute on function public.monthly_category_summary(date) to authenticated;
grant execute on function public.daily_spend(date) to authenticated;
