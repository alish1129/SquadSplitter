-- Squad Split — Supabase schema
-- Run this once in your project's SQL Editor (Supabase dashboard -> SQL Editor -> New query).
-- Safe to re-run: drops/recreates policies and functions, but never drops your data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  positions text[] not null default '{FLEX}',
  rating int not null default 50 check (rating between 1 and 100),
  is_in boolean not null default false,
  created_at timestamptz not null default now(),
  constraint players_positions_count check (
    array_length(positions, 1) between 1 and 2
  )
);

create table if not exists public.current_split (
  id smallint primary key default 1 check (id = 1),
  team_a uuid[] not null default '{}',
  team_b uuid[] not null default '{}',
  generated_at timestamptz
);
insert into public.current_split (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: is the calling user an admin? (security definer avoids RLS
-- recursion when policies below call this function)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- New-user trigger: every signup gets a profile row AND a linked player row
-- (so they show up in the roster and can mark themselves IN immediately).
-- Pass { data: { name } } to supabase.auth.signInWithOtp() to set their
-- display name; otherwise it falls back to the part of their email before
-- the @.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do nothing;

  insert into public.players (user_id, name, positions, rating, is_in)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    '{FLEX}',
    50,
    false
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: let a signed-in member toggle ONLY their own is_in column. Runs as
-- security definer so it can bypass the admin-only table policy below, but
-- the WHERE clause hard-codes auth.uid() so nobody can touch another row or
-- another column through it.
-- ---------------------------------------------------------------------------

create or replace function public.toggle_my_in(target_player_id uuid, new_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.players
  set is_in = new_value
  where id = target_player_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.toggle_my_in(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.current_split enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select using (true); -- roster + ratings are publicly viewable, like a team sheet

drop policy if exists players_admin_all on public.players;
create policy players_admin_all on public.players
  for all using (public.is_admin()) with check (public.is_admin());
  -- covers insert/update/delete of any row & column for admins, including
  -- adding roster entries for people who haven't signed up (user_id null)

drop policy if exists current_split_select on public.current_split;
create policy current_split_select on public.current_split
  for select using (true);

drop policy if exists current_split_admin_all on public.current_split;
create policy current_split_admin_all on public.current_split
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime: let the app subscribe to live changes
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.current_split;

-- ---------------------------------------------------------------------------
-- BOOTSTRAP THE FIRST ADMIN
-- ---------------------------------------------------------------------------
-- 1. Sign up / sign in once in the running app with the email you want to be
--    admin.
-- 2. Come back here and run (with your real email):
--
--    update public.profiles set is_admin = true where email = 'you@example.com';
--
-- After that you can promote/demote other admins from inside the app itself.
