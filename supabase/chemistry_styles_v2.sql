-- Chemistry styles v2 migration — only needed if you already ran chemistry_schema.sql
-- and have the old single-value chemistry_style text column.
-- Run this in Supabase SQL Editor.

-- Drop the old single-value column
alter table public.players drop column if exists chemistry_style;

-- Add the new array column (up to 3 styles per player)
alter table public.players
  add column if not exists chemistry_styles text[] not null default '{}';
