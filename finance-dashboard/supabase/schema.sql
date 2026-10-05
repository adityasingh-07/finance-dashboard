create table categories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users (id) on delete cascade,

  name text not null
    check (length(trim(name)) between 1 and 40),

  color text not null default '#6B7280'
    check (color ~* '^#[0-9a-f]{6}$'),

  created_at timestamptz not null default now(),

  constraint categories_user_name_unique unique (user_id, name)
);

create index categories_user_id_idx on categories (user_id);