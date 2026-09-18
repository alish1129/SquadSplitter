-- Match details migration — run after session_schema.sql

alter table public.sessions
  add column if not exists match_time text,   -- e.g. "9:00 PM"
  add column if not exists venue_url  text;   -- Google Maps URL
