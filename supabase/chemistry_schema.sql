-- Chemistry styles migration (v2 — array, up to 3 per player)
-- Run in Supabase SQL Editor after session_schema.sql.
-- If you already ran an earlier version of this file see chemistry_styles_v2.sql.

alter table public.players
  add column if not exists chemistry_styles text[] not null default '{}';
