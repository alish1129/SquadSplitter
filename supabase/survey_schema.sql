-- ── Player surveys ───────────────────────────────────────────────────────────
-- Run in Supabase SQL Editor.

-- One survey per session (admin creates, gets a shareable link)
create table if not exists public.player_surveys (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        references public.sessions(id) on delete cascade,
  type        text        not null check (type in ('overall', 'pairwise')),
  is_open     boolean     not null default true,
  player_ids  uuid[],     -- snapshot of roster player IDs at creation time
  created_at  timestamptz not null default now()
);

-- One row per anonymous submission
create table if not exists public.survey_responses (
  id           uuid        primary key default gen_random_uuid(),
  survey_id    uuid        not null references public.player_surveys(id) on delete cascade,
  fingerprint  text,       -- casual dedup only (browser hash — easy to bypass)
  submitted_at timestamptz not null default now()
);

-- Per-player scores for 'overall' surveys (1–10)
create table if not exists public.survey_ratings (
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  score       int  not null check (score between 1 and 10),
  primary key (response_id, player_id)
);

-- Winner picks for 'pairwise' surveys
create table if not exists public.survey_picks (
  response_id  uuid not null references public.survey_responses(id) on delete cascade,
  player_a_id  uuid not null references public.players(id) on delete cascade,
  player_b_id  uuid not null references public.players(id) on delete cascade,
  winner_id    uuid not null references public.players(id) on delete cascade,
  primary key (response_id, player_a_id, player_b_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.player_surveys   enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_ratings   enable row level security;
alter table public.survey_picks     enable row level security;

-- Surveys: everyone can read; only admins can create / update / delete
create policy ps_select on public.player_surveys for select using (true);
create policy ps_insert on public.player_surveys for insert with check (public.is_admin());
create policy ps_update on public.player_surveys for update using (public.is_admin());
create policy ps_delete on public.player_surveys for delete using (public.is_admin());

-- Responses: admin can read individual rows; anyone can insert (anonymous)
create policy sr_select on public.survey_responses for select using (public.is_admin());
create policy sr_insert on public.survey_responses for insert with check (true);

-- Ratings: admin reads; anyone inserts
create policy srat_select on public.survey_ratings for select using (public.is_admin());
create policy srat_insert on public.survey_ratings for insert with check (true);

-- Picks: admin reads; anyone inserts
create policy spick_select on public.survey_picks for select using (public.is_admin());
create policy spick_insert on public.survey_picks for insert with check (true);

-- ── Table grants (Supabase anon / authenticated) ──────────────────────────────
grant select         on public.player_surveys   to anon, authenticated;
grant insert         on public.survey_responses to anon, authenticated;
grant insert         on public.survey_ratings   to anon, authenticated;
grant insert         on public.survey_picks     to anon, authenticated;
grant select         on public.survey_responses to authenticated;
grant select         on public.survey_ratings   to authenticated;
grant select         on public.survey_picks     to authenticated;

-- ── Aggregate results function (security definer — returns agg data to anyone) ─
create or replace function public.get_survey_results(p_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type   text;
  v_result jsonb;
begin
  select type into v_type from public.player_surveys where id = p_survey_id;

  if v_type = 'overall' then
    select jsonb_agg(
      jsonb_build_object(
        'player_id',   r.player_id,
        'player_name', r.player_name,
        'avg_score',   r.avg_score,
        'num_ratings', r.num_ratings
      ) order by r.avg_score desc
    )
    into v_result
    from (
      select
        pl.id::text                       as player_id,
        pl.name                           as player_name,
        round(avg(rt.score)::numeric, 1)  as avg_score,
        count(*)::int                     as num_ratings
      from public.survey_ratings rt
      join public.survey_responses resp on resp.id = rt.response_id
      join public.players pl            on pl.id   = rt.player_id
      where resp.survey_id = p_survey_id
      group by pl.id, pl.name
    ) r;

  elsif v_type = 'pairwise' then
    with app as (
      select player_id, count(*) as cnt
      from (
        select sp.player_a_id as player_id
        from   public.survey_picks sp
        join   public.survey_responses resp on resp.id = sp.response_id
        where  resp.survey_id = p_survey_id
        union all
        select sp.player_b_id
        from   public.survey_picks sp
        join   public.survey_responses resp on resp.id = sp.response_id
        where  resp.survey_id = p_survey_id
      ) sub
      group by player_id
    ),
    wins as (
      select sp.winner_id as player_id, count(*) as cnt
      from   public.survey_picks sp
      join   public.survey_responses resp on resp.id = sp.response_id
      where  resp.survey_id = p_survey_id
      group by sp.winner_id
    )
    select jsonb_agg(
      jsonb_build_object(
        'player_id',    r.player_id,
        'player_name',  r.player_name,
        'wins',         r.wins,
        'appearances',  r.appearances,
        'win_pct',      r.win_pct
      ) order by r.win_pct desc, r.wins desc
    )
    into v_result
    from (
      select
        pl.id::text                   as player_id,
        pl.name                       as player_name,
        coalesce(w.cnt, 0)::int       as wins,
        coalesce(a.cnt, 0)::int       as appearances,
        case
          when coalesce(a.cnt, 0) = 0 then 0
          else round((coalesce(w.cnt, 0)::numeric / a.cnt) * 100, 1)
        end                           as win_pct
      from app a
      join public.players pl on pl.id = a.player_id
      left join wins w       on w.player_id = a.player_id
    ) r;
  end if;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_survey_results(uuid) to anon, authenticated;
