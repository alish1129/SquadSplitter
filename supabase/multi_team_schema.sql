-- Multi-team support — run after session_schema.sql

alter table public.splits
  add column if not exists teams     jsonb,              -- [[id,...], [id,...], ...]
  add column if not exists num_teams int not null default 2;
