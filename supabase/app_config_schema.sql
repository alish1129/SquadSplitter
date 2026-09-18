-- App config migration
-- Run in Supabase SQL Editor after session_schema.sql.

create table if not exists public.app_config (
  id           int primary key default 1,
  hide_ratings boolean not null default true,
  constraint app_config_single_row check (id = 1)
);

-- Seed the single config row (default: hide ratings from non-admins)
insert into public.app_config (id, hide_ratings)
values (1, true)
on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists app_config_select        on public.app_config;
drop policy if exists app_config_admin_update  on public.app_config;

-- Everyone can read (needed for non-admin clients)
create policy app_config_select on public.app_config
  for select using (true);

-- Only admins can change settings
create policy app_config_admin_update on public.app_config
  for update using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.app_config;
