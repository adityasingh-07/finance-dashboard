-- Hosted Supabase projects ship public.rls_auto_enable(): a SECURITY DEFINER
-- event-trigger function behind the `ensure_rls` event trigger, which turns
-- on RLS for every new table. Because it lives in `public`, PostgREST exposes
-- it at /rest/v1/rpc/rls_auto_enable and Supabase's security advisor flags it.
--
-- Event triggers don't check EXECUTE when they fire, so revoking API access
-- keeps the safety net working (verified: a table created after the revoke
-- still gets RLS enabled). Does nothing where the function doesn't exist,
-- such as the local stack.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
