-- Session management migration
-- Run this in Supabase SQL Editor AFTER schema.sql has been applied.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per game day
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  label        text,
  created_at   timestamptz not null default now()
);

-- Per-session attendance (replaces the global players.is_in for turnout)
create table if not exists public.session_turnout (
  session_id uuid not null references public.sessions(id)  on delete cascade,
  player_id  uuid not null references public.players(id)   on delete cascade,
  is_in      boolean not null default false,
  primary key (session_id, player_id)
);

-- Per-session team split (replaces the single-row current_split)
create table if not exists public.splits (
  session_id   uuid primary key references public.sessions(id) on delete cascade,
  team_a       uuid[] not null default '{}',
  team_b       uuid[] not null default '{}',
  generated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.sessions       enable row level security;
alter table public.session_turnout enable row level security;
alter table public.splits          enable row level security;

-- Sessions: read public, write admin
drop policy if exists sessions_select     on public.sessions;
drop policy if exists sessions_admin_all  on public.sessions;

create policy sessions_select    on public.sessions for select using (true);
create policy sessions_admin_all on public.sessions
  for all using (public.is_admin()) with check (public.is_admin());

-- Turnout: read public, admin can write any row, users use the RPC below
drop policy if exists session_turnout_select    on public.session_turnout;
drop policy if exists session_turnout_admin_all on public.session_turnout;

create policy session_turnout_select    on public.session_turnout for select using (true);
create policy session_turnout_admin_all on public.session_turnout
  for all using (public.is_admin()) with check (public.is_admin());

-- Splits: read public, write admin
drop policy if exists splits_select    on public.splits;
drop policy if exists splits_admin_all on public.splits;

create policy splits_select    on public.splits for select using (true);
create policy splits_admin_all on public.splits
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- RPC: let a signed-in member toggle only their own attendance for a session
-- ---------------------------------------------------------------------------

create or replace function public.toggle_session_in(
  p_session_id uuid,
  p_player_id  uuid,
  p_value      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.players
    where id = p_player_id and user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  insert into public.session_turnout (session_id, player_id, is_in)
  values (p_session_id, p_player_id, p_value)
  on conflict (session_id, player_id)
  do update set is_in = excluded.is_in;
end;
$$;

grant execute on function public.toggle_session_in(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_turnout;
alter publication supabase_realtime add table public.splits;
