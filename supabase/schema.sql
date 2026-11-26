-- ============================ GOAT Debate — schema ============================
--
-- The GOAT Debate setup for the MAIN mimstudiospro project
-- (freqksgnswajwhfbubec): GOAT signs in against the main site's account
-- system, so one login works on mimstudiospro.com and
-- goatdebate.mimstudiospro.com. Run ONCE in the main project's SQL
-- editor (Lovable Cloud: Database > Manage > SQL editor). Do NOT run
-- this on the retiring GOAT project — it already has these tables.
-- Idempotent: safe to run again (CREATE IF NOT EXISTS,
-- ON CONFLICT DO NOTHING, DROP POLICY IF EXISTS, CREATE OR REPLACE).
--
-- This file's content is identical to supabase/migrate-to-main-project.sql:
-- that file is the one to run in the main project's editor; this file is
-- the canonical copy for a fresh setup. Keep the two in sync.
--
-- What this does: it creates the four GOAT tables the main project does
-- (debates, contenders, votes, comments), the voting/comment RPCs, and
-- the idempotent debate/contender seeds. The voter_token fix is already
-- applied in this file: votes are RPC-only, comments are readable on
-- the display columns only — no visitor can read another browser's token.
--
-- What this does NOT do (read before assuming otherwise):
--   * It does NOT create an articles table. The main project ALREADY has
--     public.articles (migration 0021): one shared table serves the main
--     site, lang and GOAT, picked by the `site` column. Section 5 widens
--     that column's check to accept 'goat' and re-asserts the article
--     policies; the GOAT client reads/writes only site = 'goat' rows.
--   * It does NOT create the phase-3 admins table or is_admin(). Owner
--     gating here is the main project's own has_role(auth.uid(),
--     'admin'), exactly as the main site uses it — Hiram is already an
--     admin there. No email address appears in this file.
--   * It does NOT copy live votes or comments. The live GOAT data is
--     tiny (1 vote, 0 comments); the single live vote is copied by a
--     direct database copy at cutover time, never via a committed file —
--     no live voter_token may ever appear in this repo.
--
-- Prerequisites (must already exist in the main project — they do):
--   * public.user_roles + public.has_role (migration 0001)
--   * public.articles + its policies, grants and trigger (migration 0021)
--   * auth.users (Supabase Auth) — Hiram's account is already an admin.
--
-- Tables:
--   debates     — one row per GOAT debate (slug, title, sport)
--   contenders  — exactly two per debate (name, tagline, sort_order)
--   votes       — one row per browser per debate; unique (debate_id, voter_token)
--   comments    — one row per comment (no sign-in; voter_token identifies the browser)
--
-- Voting goes through ONE SECURITY DEFINER RPC, cast_vote, which upserts
-- by (debate_id, voter_token) so a browser can change its vote. Every
-- function pins SET search_path = '' and its body is fully
-- schema-qualified (public.* tables, pg_catalog builtins only) — never
-- relax this.
--
-- RLS: public read on debates, contenders and published articles.
-- votes has NO direct access at all (no policies, no grants): tallies
-- come from get_vote_counts, a browser's own votes from get_my_votes,
-- writes go through cast_vote only. comments are readable on the display
-- columns only (voter_token is excluded); the list is served by the
-- get_comments RPC, which returns an is_mine flag instead of the token.
-- Article writes require the admin role — see section 5.
--
-- This file's content is identical to supabase/migrate-to-main-project.sql
-- in this repo: that file is the one to run in the main project's
-- editor. Keep the two in sync.

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

-- votes is RPC-only by design (voter_token exposure fix): no policies
-- and no grants for anon/authenticated. The only paths are the SECURITY
-- DEFINER functions cast_vote (write), get_vote_counts (tallies) and
-- get_my_votes (this browser's votes). RLS stays enabled with no
-- policies, so even a future grant cannot leak rows. The revoke lines
-- keep this file idempotent on a database that still has the old grants.
drop policy if exists "votes_public_read" on public.votes;
drop policy if exists "votes_anon_insert" on public.votes;
revoke select, insert on public.votes from anon, authenticated;

-- 2b. Table privileges -----------------------------------------------------
-- RLS policies alone are NOT enough: the anon/authenticated roles also
-- need table-level privileges, or every app query fails with
-- "permission denied for table debates" (42501). The SQL editor runs
-- as postgres, so verification queries there pass even without these —
-- that is how this was missed the first time.
grant select on public.debates to anon, authenticated;
grant select on public.contenders to anon, authenticated;
-- No grant on public.votes: RPC-only (see above).

-- 2c. Comments table -------------------------------------------------------
-- No sign-in: voter_token identifies the browser (same token as votes),
-- so a browser's own comments can be recognised. No comments are seeded.
-- Moderation is client-side only in v1 (profanity/abuse filter in
-- src/lib/comments.ts); the DB enforces the shape: non-empty body,
-- max 500 chars, author name max 40 chars.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates (id) on delete cascade,
  voter_token text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_nonempty check (char_length(trim(body)) > 0),
  constraint comments_body_max_length check (char_length(body) <= 500),
  constraint comments_author_max_length check (char_length(author_name) <= 40)
);

create index if not exists comments_debate_id_idx on public.comments (debate_id);

alter table public.comments enable row level security;

drop policy if exists "comments_public_read" on public.comments;
create policy "comments_public_read" on public.comments
  for select to anon, authenticated using (true);

drop policy if exists "comments_anon_insert" on public.comments;
create policy "comments_anon_insert" on public.comments
  for insert to anon with check (true);

-- The SELECT grant covers only the display columns: voter_token is
-- deliberately excluded, so no visitor can read another browser's
-- token. The list is served by get_comments (section 3b), which returns
-- an is_mine flag computed server-side. The direct INSERT path stays:
-- a browser posts its OWN token, which is not a leak.
grant select (id, debate_id, author_name, body, created_at)
  on public.comments to anon, authenticated;
grant insert on public.comments to anon, authenticated;

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

-- 3b. Read RPCs — the only read paths for votes and comments ---------------
-- These replace the old client-side table reads, which downloaded every
-- voter_token. No response from any of these contains another browser's
-- token: tallies are bare counts, get_my_votes returns only rows for the
-- token the caller sends, and get_comments returns an is_mine flag.
create or replace function public.get_vote_counts()
returns table (debate_id uuid, contender_id uuid, votes bigint)
language sql
security definer
set search_path = ''
as $$
  select
    public.votes.debate_id,
    public.votes.contender_id,
    count(*)::bigint as vote_count
  from public.votes
  group by public.votes.debate_id, public.votes.contender_id;
$$;

revoke all on function public.get_vote_counts() from public, anon;
grant execute on function public.get_vote_counts() to anon, authenticated;

create or replace function public.get_my_votes(_voter text)
returns table (debate_id uuid, contender_id uuid)
language sql
security definer
set search_path = ''
as $$
  select public.votes.debate_id, public.votes.contender_id
  from public.votes
  where public.votes.voter_token = _voter;
$$;

revoke all on function public.get_my_votes(text) from public, anon;
grant execute on function public.get_my_votes(text) to anon, authenticated;

create or replace function public.get_comments(_debate uuid, _voter text)
returns table (
  id uuid,
  debate_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  is_mine boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    public.comments.id,
    public.comments.debate_id,
    public.comments.author_name,
    public.comments.body,
    public.comments.created_at,
    (public.comments.voter_token = _voter) as is_mine
  from public.comments
  where public.comments.debate_id = _debate
  order by public.comments.created_at desc;
$$;

revoke all on function public.get_comments(uuid, text) from public, anon;
grant execute on function public.get_comments(uuid, text) to anon, authenticated;

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
  ('99999999-9999-4999-8999-999999999999', 'pele-vs-maradona', 'Pelé vs Maradona', 'Football'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'beyonce-vs-taylor-swift', 'Beyoncé vs Taylor Swift', 'Pop Music')
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
  ('99999999-9999-4999-8999-99999999999b', '99999999-9999-4999-8999-999999999999', 'Diego Maradona', '1986 World Cup winner', 2),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Beyoncé', '35× Grammy winner', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Taylor Swift', '14× Grammy winner', 2)
on conflict (id) do nothing;

-- 5. Articles live in the SHARED main-project table (site = 'goat') --------
-- The main project already has public.articles (migration 0021): one
-- table serves the main site, lang and GOAT, picked by the `site`
-- column. This file does NOT create a second articles table and does
-- NOT create the phase-3 admins table or is_admin() — owner gating is
-- the main project's own has_role(auth.uid(), 'admin'), exactly as the
-- main site uses it. The GOAT client reads/writes only site = 'goat'
-- rows (see src/lib/articles.ts), so the three sites never see each
-- other's articles. The updated_at trigger and its function already
-- exist from migration 0021 and are left alone.
--
-- 5a. Widen the site check so 'goat' is an accepted destination.
-- Idempotent: the DO block only rewrites the constraint when 'goat'
-- is not already in it. (Postgres names the inline CHECK on the site
-- column articles_site_check.)
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.articles'::regclass
      and conname = 'articles_site_check'
      and pg_get_constraintdef(oid) not like '%goat%'
  ) then
    alter table public.articles drop constraint articles_site_check;
    alter table public.articles
      add constraint articles_site_check check (site in ('main', 'lang', 'goat'));
  end if;
end $$;

-- 5b. Re-assert the article policies (same names and bodies as the
-- main project's migration 0021). DROP + CREATE makes this a no-op
-- when they already exist, and guarantees the has_role gating even if
-- they were ever changed.
drop policy if exists "Anyone can read published articles" on public.articles;
create policy "Anyone can read published articles" on public.articles
  for select to anon, authenticated using (status = 'published');

drop policy if exists "Admins read all articles" on public.articles;
create policy "Admins read all articles" on public.articles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins write articles" on public.articles;
create policy "Admins write articles" on public.articles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins update articles" on public.articles;
create policy "Admins update articles" on public.articles
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins delete articles" on public.articles;
create policy "Admins delete articles" on public.articles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Grants on the shared table (already in place from migration 0021;
-- repeated here so this file is self-contained).
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;

-- Verification (run one at a time in the SQL editor):
-- select count(*) from public.debates;        -- expect 10
-- select count(*) from public.contenders;     -- expect 20
-- select count(*) from public.votes;          -- expect 0 until the live vote is copied at cutover
-- select count(*) from public.comments;       -- expect 0
-- select pg_get_constraintdef(oid) from pg_catalog.pg_constraint
--   where conrelid = 'public.articles'::regclass and conname = 'articles_site_check';
--   -- expect the definition to contain 'goat'
-- select policyname from pg_catalog.pg_policies where tablename = 'articles';
--   -- expect: Anyone can read published articles, Admins read all articles,
--   -- Admins write articles, Admins update articles, Admins delete articles
-- select proname, prosecdef, proconfig from pg_catalog.pg_proc
--   where proname in ('cast_vote', 'get_vote_counts', 'get_my_votes', 'get_comments');
--   -- expect all four prosecdef true, proconfig ["search_path=\"\""]
-- select has_table_privilege('anon', 'public.votes', 'SELECT');                    -- expect false
-- select has_column_privilege('anon', 'public.comments', 'voter_token', 'SELECT'); -- expect false
-- select has_column_privilege('anon', 'public.comments', 'body', 'SELECT');        -- expect true
-- Signed in as the admin: select public.has_role(auth.uid(), 'admin');             -- expect true
-- select to_regclass('public.admins');  -- expect null: no admins table in the main project
