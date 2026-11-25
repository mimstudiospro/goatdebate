-- ============================ GOAT Debate — schema (v1) ============================
--
-- Run ONCE in the Lovable Cloud SQL editor (or ask Lovable to apply it).
-- Idempotent: safe to run again (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING).
--
-- Tables:
--   debates     — one row per GOAT debate (slug, title, sport)
--   contenders  — exactly two per debate (name, tagline, sort_order)
--   votes       — one row per browser per debate; unique (debate_id, voter_token)
--
-- Voting goes through ONE SECURITY DEFINER RPC, cast_vote, which upserts
-- by (debate_id, voter_token) so a browser can change its vote. The RPC
-- pins SET search_path = '' and its body is fully schema-qualified
-- (public.* tables, pg_catalog builtins only) — never relax this.
--
-- RLS: public read on all three tables; anon may insert votes directly
-- (the app uses the RPC; the unique constraint still enforces one vote
-- per browser per debate either way).

-- 1. Tables ---------------------------------------------------------------
create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sport text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contenders (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates (id) on delete cascade,
  name text not null,
  tagline text not null,
  sort_order integer not null default 1,
  unique (debate_id, name)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates (id) on delete cascade,
  contender_id uuid not null references public.contenders (id) on delete cascade,
  voter_token text not null,
  created_at timestamptz not null default now(),
  unique (debate_id, voter_token)
);

create index if not exists votes_debate_id_idx on public.votes (debate_id);
create index if not exists contenders_debate_id_idx on public.contenders (debate_id);

-- 2. Row level security ----------------------------------------------------
alter table public.debates enable row level security;
alter table public.contenders enable row level security;
alter table public.votes enable row level security;

drop policy if exists "debates_public_read" on public.debates;
create policy "debates_public_read" on public.debates
  for select to anon, authenticated using (true);

drop policy if exists "contenders_public_read" on public.contenders;
create policy "contenders_public_read" on public.contenders
  for select to anon, authenticated using (true);

drop policy if exists "votes_public_read" on public.votes;
create policy "votes_public_read" on public.votes
  for select to anon, authenticated using (true);

drop policy if exists "votes_anon_insert" on public.votes;
create policy "votes_anon_insert" on public.votes
  for insert to anon with check (true);

-- 3. cast_vote — the ONLY write path the app uses --------------------------
-- Upserts by (debate_id, voter_token): first vote inserts, changing a
-- vote updates the contender. Validates that the contender belongs to
-- the debate before writing.
create or replace function public.cast_vote(_debate uuid, _contender uuid, _voter text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _voter is null or length(trim(_voter)) = 0 then
    raise exception 'Missing voter token';
  end if;
  if not exists (
    select 1 from public.contenders
    where public.contenders.id = _contender
      and public.contenders.debate_id = _debate
  ) then
    raise exception 'Contender does not belong to this debate';
  end if;
  insert into public.votes (debate_id, contender_id, voter_token)
  values (_debate, _contender, _voter)
  on conflict (debate_id, voter_token)
  do update set contender_id = excluded.contender_id, created_at = now();
end;
$$;

revoke all on function public.cast_vote(uuid, uuid, text) from public, anon;
grant execute on function public.cast_vote(uuid, uuid, text) to anon, authenticated;

-- 4. Seed debates (idempotent) ---------------------------------------------
-- Fixed UUIDs match src/lib/debates.ts exactly, so the app's offline
-- fallback and the database agree. Taglines use only established
-- public facts. No athlete photos are stored or referenced.
insert into public.debates (id, slug, title, sport) values
  ('11111111-1111-4111-8111-111111111111', 'messi-vs-ronaldo', 'Messi vs Ronaldo', 'Football'),
  ('22222222-2222-4222-8222-222222222222', 'jordan-vs-lebron', 'Jordan vs LeBron', 'Basketball'),
  ('33333333-3333-4333-8333-333333333333', 'brady-vs-montana', 'Brady vs Montana', 'American Football'),
  ('44444444-4444-4444-8444-444444444444', 'ali-vs-tyson', 'Ali vs Tyson', 'Boxing'),
  ('55555555-5555-4555-8555-555555555555', 'federer-vs-nadal', 'Federer vs Nadal', 'Tennis'),
  ('66666666-6666-4666-8666-666666666666', 'serena-vs-graf', 'Serena Williams vs Steffi Graf', 'Women''s Tennis'),
  ('77777777-7777-4777-8777-777777777777', 'hamilton-vs-schumacher', 'Hamilton vs Schumacher', 'Formula 1'),
  ('88888888-8888-4888-8888-888888888888', 'woods-vs-nicklaus', 'Woods vs Nicklaus', 'Golf'),
  ('99999999-9999-4999-8999-999999999999', 'pele-vs-maradona', 'Pelé vs Maradona', 'Football')
on conflict (slug) do nothing;

insert into public.contenders (id, debate_id, name, tagline, sort_order) values
  ('11111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'Lionel Messi', '8× Ballon d''Or', 1),
  ('11111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111111', 'Cristiano Ronaldo', '5× Ballon d''Or', 2),
  ('22222222-2222-4222-8222-222222222223', '22222222-2222-4222-8222-222222222222', 'Michael Jordan', '6× NBA champion', 1),
  ('22222222-2222-4222-8222-222222222224', '22222222-2222-4222-8222-222222222222', 'LeBron James', 'NBA all-time scoring leader', 2),
  ('33333333-3333-4333-8333-333333333335', '33333333-3333-4333-8333-333333333333', 'Tom Brady', '7× Super Bowl champion', 1),
  ('33333333-3333-4333-8333-333333333336', '33333333-3333-4333-8333-333333333333', 'Joe Montana', '4× Super Bowl champion', 2),
  ('44444444-4444-4444-8444-444444444445', '44444444-4444-4444-8444-444444444444', 'Muhammad Ali', '3× heavyweight champion', 1),
  ('44444444-4444-4444-8444-444444444446', '44444444-4444-4444-8444-444444444444', 'Mike Tyson', 'Youngest heavyweight champion', 2),
  ('55555555-5555-4555-8555-555555555557', '55555555-5555-4555-8555-555555555555', 'Roger Federer', '20 Grand Slams', 1),
  ('55555555-5555-4555-8555-555555555558', '55555555-5555-4555-8555-555555555555', 'Rafael Nadal', '22 Grand Slams', 2),
  ('66666666-6666-4666-8666-666666666667', '66666666-6666-4666-8666-666666666666', 'Serena Williams', '23 Grand Slams', 1),
  ('66666666-6666-4666-8666-666666666668', '66666666-6666-4666-8666-666666666666', 'Steffi Graf', '22 Grand Slams', 2),
  ('77777777-7777-4777-8777-777777777778', '77777777-7777-4777-8777-777777777777', 'Lewis Hamilton', '7× world champion', 1),
  ('77777777-7777-4777-8777-777777777779', '77777777-7777-4777-8777-777777777777', 'Michael Schumacher', '7× world champion', 2),
  ('88888888-8888-4888-8888-888888888889', '88888888-8888-4888-8888-888888888888', 'Tiger Woods', '15 majors', 1),
  ('88888888-8888-4888-8888-88888888888a', '88888888-8888-4888-8888-888888888888', 'Jack Nicklaus', '18 majors', 2),
  ('99999999-9999-4999-8999-99999999999a', '99999999-9999-4999-8999-999999999999', 'Pelé', '3× World Cup winner', 1),
  ('99999999-9999-4999-8999-99999999999b', '99999999-9999-4999-8999-999999999999', 'Diego Maradona', '1986 World Cup winner', 2)
on conflict (id) do nothing;

-- Verification (run one at a time in the SQL editor):
-- select count(*) from public.debates;        -- expect 9
-- select count(*) from public.contenders;     -- expect 18
-- select proname, prosecdef, proconfig from public.pg_proc where proname = 'cast_vote';
--   -- expect prosecdef true, proconfig ["search_path=\"\""]
