-- Local development seed. Runs automatically after migrations on
-- `supabase db reset`.
--
-- The demo account and its ~3 months of data are built by
-- public.reset_demo_data() (migration 20261009000001_demo_account.sql), the
-- same function the hosted database runs nightly. Dates are relative to
-- today, so the dashboard always has a current month.
--
-- Demo login: demo@example.com / demo-password-123

select public.reset_demo_data();
