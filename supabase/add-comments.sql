-- ================= GOAT Debate — add comments table ======================
--
-- Run ONCE in the Supabase SQL editor on a database that already has
-- the other tables (schema.sql v1). Idempotent: safe to run again
-- (CREATE IF NOT EXISTS, DROP POLICY IF EXISTS).
--
-- Adds: public.comments — one row per comment (no sign-in; voter_token
-- identifies the browser, same token as votes). No comments are seeded.
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

-- Verification (run one at a time in the SQL editor):
-- select count(*) from public.comments;   -- expect 0
-- select * from public.comments limit 1; -- expect 0 rows
