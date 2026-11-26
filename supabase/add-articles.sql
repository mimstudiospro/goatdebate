-- ==================== GOAT Debate — admins + articles (phase 3) ====================
--
-- Run ONCE in the Supabase SQL editor (after the base schema.sql).
-- Idempotent: safe to run again (CREATE IF NOT EXISTS, DROP POLICY IF
-- EXISTS, CREATE OR REPLACE FUNCTION).
--
-- Tables:
--   admins    — one row per owner account (user_id -> auth.users). NO rows
--               are seeded here: the owner's row is inserted later via the
--               Supabase dashboard (Authentication -> user id -> insert
--               into public.admins). Until a row exists, nobody can write
--               articles — that is the safe default.
--   articles  — long articles and short posts, one system. kind is
--               'article' or 'post'; status is 'draft' or 'published'.
--
-- Owner gating uses the admins table, NEVER an email address in code or
-- SQL: this repo is public, and no personal email may appear in it.
-- Writes are gated twice: RLS policies call public.is_admin(), and the
-- UI hides the editor unless is_admin() returns true for the signed-in
-- user. RLS is the enforcement; the UI check is convenience only.
--
-- The admins table has RLS enabled with NO policies: nobody can read it
-- directly (not even to learn which user ids are admins). The SECURITY
-- DEFINER is_admin() function bypasses RLS and is the only read path.

-- 1. Admins table ----------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Deliberately no policies on public.admins: direct reads are denied
-- for everyone; only public.is_admin() (security definer) reads it.

-- 2. is_admin() — the owner check -----------------------------------------
-- SECURITY DEFINER, pinned empty search_path, fully schema-qualified
-- body — same hardening as cast_vote. Never relax this.
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

-- 3. Articles table --------------------------------------------------------
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

-- Keep updated_at honest on every edit, even if a client forgets it.
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

-- 4. Row level security ----------------------------------------------------
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

-- 5. Table privileges ------------------------------------------------------
-- RLS policies alone are NOT enough: the anon/authenticated roles also
-- need table-level privileges, or every app query fails with
-- "permission denied for table articles" (42501). The SQL editor runs
-- as postgres, so verification queries there pass even without these.
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;

-- No grants on public.admins: direct access stays denied for everyone.

-- Verification (run one at a time in the SQL editor):
-- select count(*) from public.articles;        -- expect 0 (no seed articles)
-- select count(*) from public.admins;          -- expect 0 until the owner's row is inserted
-- select proname, prosecdef, proconfig from public.pg_proc where proname in ('is_admin', 'set_articles_updated_at');
--   -- expect both prosecdef true, proconfig ["search_path=\"\""]
-- After inserting the owner's row into public.admins and signing in as
-- the owner: select public.is_admin();          -- expect true
