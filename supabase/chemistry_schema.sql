-- Chemistry styles migration
-- Run in Supabase SQL Editor after session_schema.sql.

alter table public.players
  add column if not exists chemistry_style text
  constraint players_chemistry_style_check check (
    chemistry_style is null or chemistry_style in (
      'Hunter','Hawk','Finisher','Deadeye','Marksman','Sniper',
      'Engine','Catalyst','Artist','Architect',
      'Shadow','Anchor','Sentinel','Guardian','Powerhouse'
    )
  );
