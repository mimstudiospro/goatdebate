-- ================= GOAT Debate — GOAT of Criteria + gated comments =================
--
-- Run ONCE in the MAIN mimstudiospro project's SQL editor (Lovable Cloud:
-- Database > Manage > SQL editor). Do NOT run this on the retiring GOAT
-- project. Idempotent: safe to run again (CREATE IF NOT EXISTS,
-- ALTER ... ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE, ON CONFLICT DO NOTHING).
--
-- What this does:
--   * Public sign-up support: goat_profiles holds each fan's public
--     display name (upserted by the app on sign-in). Emails are never
--     stored here and never shown — the board and comments show display
--     names only.
--   * Comments are gated on sign-in: the anonymous insert policy is
--     replaced with an authenticated-only one (auth.uid() = user_id).
--     Anyone can still VOTE without signing in. The voter_token fix is
--     untouched: comments stay readable on the display columns only.
--   * Comment likes: comment_likes (one per fan per comment) plus
--     like_comment / unlike_comment RPCs. A like is 1 point for the
--     comment's author on the board.
--   * Votes record the fan's user id when signed in (cast_vote gains an
--     optional _user param; a forged id is dropped server-side), so a
--     vote counts 1 point per debate per month on the board. Tallies
--     never say who voted for whom.
--   * Subscriptions: one row per fan (plan monthly/yearly, status,
--     current_period_end). Written by the Stripe webhook (service role),
--     never by the browser; fans read only their own row.
--   * The board: goat_month_scores scores a "YYYY-MM" month (1 point per
--     debate voted in, 2 per comment, 1 per like received; ties break by
--     earliest scoring activity), get_leaderboard returns it filtered to
--     subscribers, get_past_winners crowns the top subscriber of each
--     past month. Months are UTC calendar months.
--
-- What this does NOT do:
--   * It does NOT create Stripe products, prices, or Payment Links —
--     those are made in the Stripe dashboard (see the build report).
--   * It does NOT deploy the Stripe webhook — that lives in the main
--     site's server code (see the build report), not in this file.
--   * No email address and no live voter_token may ever appear in it.
--
-- The statements in section 6 below are mirrored verbatim in
-- supabase/schema.sql and supabase/migrate-to-main-project.sql (the
-- repo test asserts the two files' SQL bodies are identical).
-- Every function pins SET search_path = '' and its body is fully
-- schema-qualified — never relax this.

-- 6a. Fan profiles: public display names for the leaderboard ---------------
create table if not exists public.goat_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  updated_at timestamptz not null default now(),
  constraint goat_profiles_name_nonempty check (char_length(trim(display_name)) > 0),
  constraint goat_profiles_name_max_length check (char_length(display_name) <= 40)
);

alter table public.goat_profiles enable row level security;

drop policy if exists "goat_profiles_public_read" on public.goat_profiles;
create policy "goat_profiles_public_read" on public.goat_profiles
  for select to anon, authenticated using (true);

drop policy if exists "goat_profiles_owner_insert" on public.goat_profiles;
create policy "goat_profiles_owner_insert" on public.goat_profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "goat_profiles_owner_update" on public.goat_profiles;
create policy "goat_profiles_owner_update" on public.goat_profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.goat_profiles to anon, authenticated;
grant insert, update on public.goat_profiles to authenticated;

-- 6b. Comments now belong to a signed-in fan -------------------------------
alter table public.comments add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists comments_user_id_idx on public.comments (user_id);

-- The anonymous insert path is gone: posting needs a sign-in, and the
-- server checks the row belongs to the caller. The public read policy
-- and the display-columns-only grant stay exactly as they were —
-- voter_token is still never readable.
drop policy if exists "comments_anon_insert" on public.comments;
create policy "comments_auth_insert" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);

-- 6c. Comment likes: one like per fan per comment --------------------------
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

-- No policies and no grants: likes go through like_comment /
-- unlike_comment only, so a fan can only ever like as themself.
revoke all on public.comment_likes from anon, authenticated;

-- 6d. Subscriptions: written by the Stripe webhook, never the browser ----
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text,
  plan text not null check (plan in ('monthly', 'yearly')),
  status text not null check (status in ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_owner_read" on public.subscriptions;
create policy "subscriptions_owner_read" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

grant select on public.subscriptions to authenticated;
-- Lovable Cloud grants SELECT to anon on new tables by default: revoke it
-- (same lesson as the comments table) - anon must not hold the privilege;
-- RLS plus the owner-only policy already blocks row reads, this closes the grant.
revoke select on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- 6e. Votes also record the fan, when signed in ----------------------------
alter table public.votes add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists votes_user_id_idx on public.votes (user_id);

-- 6f. cast_vote records the fan (optional _user param) ---------------------
-- The old 3-argument version must go first: CREATE OR REPLACE cannot
-- change a function's signature.
drop function if exists public.cast_vote(uuid, uuid, text);
create or replace function public.cast_vote(_debate uuid, _contender uuid, _voter text, _user uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _voter is null or length(trim(_voter)) = 0 then
    raise exception 'Missing voter token';
  end if;
  -- Only the caller's own id is ever recorded: a forged _user is dropped.
  if _user is distinct from auth.uid() then
    _user := null;
  end if;
  if not exists (
    select 1 from public.contenders
    where public.contenders.id = _contender
      and public.contenders.debate_id = _debate
  ) then
    raise exception 'Contender does not belong to this debate';
  end if;
  insert into public.votes (debate_id, contender_id, voter_token, user_id)
  values (_debate, _contender, _voter, _user)
  on conflict (debate_id, voter_token)
  do update set contender_id = excluded.contender_id,
                created_at = now(),
                user_id = coalesce(excluded.user_id, public.votes.user_id);
end;
$$;

revoke all on function public.cast_vote(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.cast_vote(uuid, uuid, text, uuid) to anon, authenticated;

-- 6g. get_comments serves likes and signed-in authorship -------------------
-- The old token-based version must go first: the signature changes.
drop function if exists public.get_comments(uuid, text);
create or replace function public.get_comments(_debate uuid)
returns table (
  id uuid,
  debate_id uuid,
  user_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  is_mine boolean,
  like_count bigint,
  liked_by_me boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    c.id,
    c.debate_id,
    c.user_id,
    c.author_name,
    c.body,
    c.created_at,
    (c.user_id is not null and c.user_id = auth.uid()) as is_mine,
    count(l.user_id)::bigint as like_count,
    coalesce(bool_or(l.user_id = auth.uid()), false) as liked_by_me
  from public.comments c
  left join public.comment_likes l on l.comment_id = c.id
  where c.debate_id = _debate
  group by c.id, c.debate_id, c.user_id, c.author_name, c.body, c.created_at
  order by c.created_at desc;
$$;

revoke all on function public.get_comments(uuid) from public, anon;
grant execute on function public.get_comments(uuid) to anon, authenticated;

-- 6h. Like / unlike a comment ----------------------------------------------
create or replace function public.like_comment(_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to like a comment';
  end if;
  if not exists (select 1 from public.comments where public.comments.id = _comment) then
    raise exception 'Comment not found';
  end if;
  insert into public.comment_likes (comment_id, user_id)
  values (_comment, auth.uid())
  on conflict do nothing;
end;
$$;

revoke all on function public.like_comment(uuid) from public, anon;
grant execute on function public.like_comment(uuid) to authenticated;

create or replace function public.unlike_comment(_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to like a comment';
  end if;
  delete from public.comment_likes
  where public.comment_likes.comment_id = _comment
    and public.comment_likes.user_id = auth.uid();
end;
$$;

revoke all on function public.unlike_comment(uuid) from public, anon;
grant execute on function public.unlike_comment(uuid) to authenticated;

-- 6i. Subscriber check (internal helper — no execute grant) ----------------
-- A fan counts as a subscriber with an active (or trialing) plan whose
-- period end is in the future (or unset), or a cancelled plan paid
-- through a future period end. Mirrors isActiveSubscription in
-- src/lib/subscriptions.ts — keep the two in sync.
create or replace function public.goat_is_subscriber(_user uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = _user
      and (
        (s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end is not null and s.current_period_end > now())
      )
  );
$$;

-- No execute grant: only the SECURITY DEFINER leaderboard functions
-- call this, as the owner. Browsers never call it directly.
revoke all on function public.goat_is_subscriber(uuid) from public, anon;

-- 6j. Monthly scoring (internal helper — no execute grant) -----------------
-- The rulebook, in SQL: 1 point per debate voted in that month,
-- 2 points per comment posted, 1 point per like received on your
-- comments. Ties break by earliest scoring activity. Mirrors
-- computeStandings in src/lib/criteria.ts — keep the two in sync.
create or replace function public.goat_month_scores(_month text)
returns table (
  user_id uuid,
  points bigint,
  votes bigint,
  comments bigint,
  likes_received bigint,
  first_scored_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with bounds as (
    select (_month || '-01')::date as start_day,
           ((_month || '-01')::date + interval '1 month')::date as end_day
  ),
  vote_points as (
    select v.user_id, count(distinct v.debate_id)::bigint as debates,
           min(v.created_at) as first_at
    from public.votes v, bounds b
    where v.user_id is not null
      and v.created_at >= b.start_day
      and v.created_at < b.end_day
    group by v.user_id
  ),
  comment_points as (
    select c.user_id, count(*)::bigint as n,
           min(c.created_at) as first_at
    from public.comments c, bounds b
    where c.user_id is not null
      and c.created_at >= b.start_day
      and c.created_at < b.end_day
    group by c.user_id
  ),
  like_points as (
    select c.user_id, count(*)::bigint as n,
           min(l.created_at) as first_at
    from public.comment_likes l
    join public.comments c on c.id = l.comment_id, bounds b
    where c.user_id is not null
      and l.created_at >= b.start_day
      and l.created_at < b.end_day
    group by c.user_id
  ),
  scored as (
    select u.user_id,
           coalesce(vp.debates, 0) as debates,
           coalesce(cp.n, 0) as comments,
           coalesce(lp.n, 0) as likes_received,
           (coalesce(vp.debates, 0)
             + coalesce(cp.n, 0) * 2
             + coalesce(lp.n, 0)) as points,
           least(
             coalesce(vp.first_at, 'infinity'::timestamptz),
             coalesce(cp.first_at, 'infinity'::timestamptz),
             coalesce(lp.first_at, 'infinity'::timestamptz)
           ) as first_at
    from (
      select user_id from vote_points
      union select user_id from comment_points
      union select user_id from like_points
    ) u
    left join vote_points vp on vp.user_id = u.user_id
    left join comment_points cp on cp.user_id = u.user_id
    left join like_points lp on lp.user_id = u.user_id
  )
  select s.user_id, s.points, s.debates, s.comments, s.likes_received, s.first_at
  from scored s;
$$;

-- No execute grant: only the SECURITY DEFINER leaderboard functions
-- call this, as the owner. Browsers never call it directly.
revoke all on function public.goat_month_scores(text) from public, anon;

-- 6k. The board for a month — subscribers only -----------------------------
create or replace function public.get_leaderboard(_month text)
returns table (
  user_id uuid,
  display_name text,
  points bigint,
  votes bigint,
  comments bigint,
  likes_received bigint,
  first_scored_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select s.user_id,
         coalesce(p.display_name, 'Fan') as display_name,
         s.points, s.votes, s.comments, s.likes_received, s.first_scored_at
  from public.goat_month_scores(_month) s
  left join public.goat_profiles p on p.user_id = s.user_id
  where public.goat_is_subscriber(s.user_id)
  order by s.points desc, s.first_scored_at asc;
$$;

revoke all on function public.get_leaderboard(text) from public, anon;
grant execute on function public.get_leaderboard(text) to anon, authenticated;

-- 6l. The signed-in fan's own subscription ---------------------------------
create or replace function public.get_my_subscription()
returns table (plan text, status text, current_period_end timestamptz)
language sql
security definer
set search_path = ''
as $$
  select s.plan, s.status, s.current_period_end
  from public.subscriptions s
  where s.user_id = auth.uid()
  order by s.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_subscription() from public, anon;
grant execute on function public.get_my_subscription() to authenticated;

-- 6m. Past months' crowned fans --------------------------------------------
create or replace function public.get_past_winners()
returns table (month text, user_id uuid, display_name text, points bigint)
language sql
security definer
set search_path = ''
as $$
  with months as (
    select distinct to_char(date_trunc('month', created_at), 'YYYY-MM') as m
    from (
      select created_at from public.votes
      union all
      select created_at from public.comments
      union all
      select created_at from public.comment_likes
    ) all_events
    where created_at < date_trunc('month', now())
  ),
  ranked as (
    select mo.m, s.user_id, s.points, s.first_scored_at,
           row_number() over (
             partition by mo.m
             order by s.points desc, s.first_scored_at asc
           ) as rn
    from months mo, lateral public.goat_month_scores(mo.m) s
    where public.goat_is_subscriber(s.user_id)
  )
  select r.m, r.user_id, coalesce(p.display_name, 'Fan'), r.points
  from ranked r
  left join public.goat_profiles p on p.user_id = r.user_id
  where r.rn = 1
  order by r.m desc;
$$;

revoke all on function public.get_past_winners() from public, anon;
grant execute on function public.get_past_winners() to anon, authenticated;

-- Verification (run one at a time in the SQL editor):
-- select table_name from information_schema.tables
--   where table_schema = 'public'
--   and table_name in ('goat_profiles', 'comment_likes', 'subscriptions');
--   -- expect 3 rows
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'comments' and column_name = 'user_id';
--   -- expect 1 row
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'votes' and column_name = 'user_id';
--   -- expect 1 row
-- select policyname from pg_catalog.pg_policies where tablename = 'comments';
--   -- expect: comments_public_read, comments_auth_insert — NO comments_anon_insert
-- select count(*) from pg_catalog.pg_policies where tablename = 'comment_likes';
--   -- expect 0: likes go through the RPCs only
-- select proname, prosecdef, proconfig from pg_catalog.pg_proc
--   where proname in ('cast_vote', 'get_comments', 'like_comment', 'unlike_comment',
--     'goat_is_subscriber', 'goat_month_scores', 'get_leaderboard',
--     'get_my_subscription', 'get_past_winners');
--   -- expect 9 rows, all prosecdef true, proconfig ["search_path=\"\""]
-- select has_table_privilege('anon', 'public.subscriptions', 'SELECT'); -- expect false
-- select has_table_privilege('anon', 'public.comment_likes', 'SELECT'); -- expect false
-- select has_column_privilege('anon', 'public.comments', 'voter_token', 'SELECT'); -- expect false
-- select has_column_privilege('anon', 'public.comments', 'body', 'SELECT'); -- expect true
-- select public.get_leaderboard(to_char(now(), 'YYYY-MM')); -- expect 0 rows until a subscriber scores
-- select public.get_past_winners(); -- expect 0 rows until a past month has a subscriber winner
