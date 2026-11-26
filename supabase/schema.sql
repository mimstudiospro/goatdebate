-- ============================ GOAT Debate — schema (v1) ============================
--
-- Run ONCE in the Supabase SQL editor.
-- Idempotent: safe to run again (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING).
--
-- Tables:
--   debates     — one row per GOAT debate (slug, title, sport)
--   contenders  — exactly two per debate (name, tagline, sort_order)
--   votes       — one row per browser per debate; unique (debate_id, voter_token)
--   comments    — one row per comment (no sign-in; voter_token identifies the browser)
--   admins      — one row per owner account; gates article writes (no email in code/SQL)
--   articles    — long articles and short posts (kind), draft or published
--
-- Voting goes through ONE SECURITY DEFINER RPC, cast_vote, which upserts
-- by (debate_id, voter_token) so a browser can change its vote. The RPC
-- pins SET search_path = '' and its body is fully schema-qualified
-- (public.* tables, pg_catalog builtins only) — never relax this.
--
-- RLS: public read on debates, contenders, votes, comments and
-- published articles; anon may insert votes directly (the app uses the
-- RPC; the unique constraint still enforces one vote per browser per
-- debate either way). Article writes require a row in public.admins —
-- see section 5; no email address appears in code or SQL.

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

-- 2b. Table privileges -----------------------------------------------------
-- RLS policies alone are NOT enough: the anon/authenticated roles also
-- need table-level privileges, or every app query fails with
-- "permission denied for table debates" (42501). The SQL editor runs
-- as postgres, so verification queries there pass even without these —
-- that is how this was missed the first time.
grant select on public.debates to anon, authenticated;
grant select on public.contenders to anon, authenticated;
grant select, insert on public.votes to anon, authenticated;

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

grant select, insert on public.comments to anon, authenticated;

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

-- Verification (run one at a time in the SQL editor):
-- select count(*) from public.debates;        -- expect 10
-- select count(*) from public.contenders;     -- expect 20
-- select count(*) from public.comments;       -- expect 0
-- select count(*) from public.articles;       -- expect 0 (no seed articles)
-- select count(*) from public.admins;         -- expect 0 until the owner's row is inserted
-- select proname, prosecdef, proconfig from public.pg_proc where proname = 'cast_vote';
--   -- expect prosecdef true, proconfig ["search_path=\"\""]
-- select proname, prosecdef, proconfig from public.pg_proc where proname in ('is_admin', 'set_articles_updated_at');
--   -- expect both prosecdef true, proconfig ["search_path=\"\""]

-- 5. Admins + articles (phase 3: signed-in authoring) ----------------------
-- Owner gating uses the admins table, NEVER an email address in code or
-- SQL: this repo is public, and no personal email may appear in it.
-- The owner's row is inserted later via the Supabase dashboard
-- (Authentication -> user id -> insert into public.admins). Until a row
-- exists, nobody can write articles — that is the safe default.
-- The admins table has RLS enabled with NO policies: nobody can read it
-- directly. The SECURITY DEFINER is_admin() function is the only read
-- path. This is the same content as supabase/add-articles.sql, so a
-- fresh setup gets it from this file alone.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Deliberately no policies on public.admins: direct reads are denied
-- for everyone; only public.is_admin() (security definer) reads it.

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.admins
    where public.admins.user_id = auth.uid()
  );
end;
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'article' check (kind in ('article', 'post')),
  slug text not null unique,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  excerpt text not null default '' check (char_length(excerpt) <= 300),
  body_markdown text not null default '',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_published_at_idx
  on public.articles (status, published_at desc);

create or replace function public.set_articles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at before update on public.articles
for each row execute function public.set_articles_updated_at();

alter table public.articles enable row level security;

drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read" on public.articles
  for select to anon, authenticated using (status = 'published');

drop policy if exists "articles_admin_read" on public.articles;
create policy "articles_admin_read" on public.articles
  for select to authenticated using (public.is_admin());

drop policy if exists "articles_admin_insert" on public.articles;
create policy "articles_admin_insert" on public.articles
  for insert to authenticated with check (public.is_admin());

drop policy if exists "articles_admin_update" on public.articles;
create policy "articles_admin_update" on public.articles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "articles_admin_delete" on public.articles;
create policy "articles_admin_delete" on public.articles
  for delete to authenticated using (public.is_admin());

grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;

-- No grants on public.admins: direct access stays denied for everyone.
