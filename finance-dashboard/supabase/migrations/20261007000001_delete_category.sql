-- Delete a category, optionally moving its expenses to another category first.
-- Runs in one transaction, so a failed delete never leaves expenses half-moved.
--
-- SECURITY INVOKER: RLS and the composite FKs do the authorisation. Moving
-- expenses into another user's category fails the FK (23503), and a category
-- the caller can't see raises P0002.

create function public.delete_category(
  p_category_id uuid,
  p_reassign_to uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_reassign_to = p_category_id then
    raise exception 'Cannot move expenses into the category being deleted'
      using errcode = '22023';
  end if;

  if p_reassign_to is not null then
    update public.expenses
    set category_id = p_reassign_to
    where category_id = p_category_id;
  end if;

  -- Without a reassignment target, remaining expenses block this (23503).
  -- Budgets for the category cascade.
  delete from public.categories where id = p_category_id;

  if not found then
    raise exception 'Category not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.delete_category(uuid, uuid) from public, anon;
grant execute on function public.delete_category(uuid, uuid) to authenticated;
