-- ================= GOAT Debate — fix voter_token exposure =================
--
-- Run ONCE in the Supabase SQL editor on the project that hosts the GOAT
-- tables (after schema.sql v1 / add-comments.sql). As of this writing
-- that is the GOAT project (kawpqwfucxubjtpsgfcq), but the GOAT tables
-- are scheduled to migrate into the main mimstudiospro project
-- (freqksgnswajwhfbubec) — run this file THERE once the migration lands,
-- not on the retiring GOAT project. Idempotent: safe to run again
-- (CREATE OR REPLACE for functions, DROP POLICY IF EXISTS, REVOKE before GRANT).
--
-- The problem: anon had a table-level GRANT SELECT on votes and comments,
-- and the client downloaded every voter_token to count votes and mark
-- "You" comments. Any visitor could read every browser's token, and a
-- token lets someone switch that browser's vote via cast_vote.
--
-- The fix:
--   * votes: NO direct access at all. SELECT and INSERT revoked for anon
--     and authenticated, and both votes policies dropped. The ONLY paths
--     are the SECURITY DEFINER RPCs: cast_vote (write), get_vote_counts
--     (tallies), get_my_votes (this browser's votes). RLS stays enabled
--     with no policies, so even a future grant cannot leak rows.
--   * comments: SELECT re-granted on ONLY the display columns
--     (id, debate_id, author_name, body, created_at) — voter_token is
--     not among them. The direct INSERT path stays (a browser posts its
--     OWN token; that is not a leak). The list is served by the
--     SECURITY DEFINER get_comments RPC, which returns an is_mine flag
--     computed server-side instead of the token.
--   * No API response to an anonymous visitor contains any other
--     browser's voter_token. Sending the visitor's OWN token to the
--     server as an RPC argument (as cast_vote already does) is fine.
--
-- Independent of supabase/add-articles.sql (phase 3): this file touches
-- votes/comments only and does not assume the articles tables exist.
--
-- Verification (run one at a time in the SQL editor, as postgres):
--   select has_table_privilege('anon', 'public.votes', 'SELECT');                    -- expect false
--   select has_table_privilege('anon', 'public.votes', 'INSERT');                    -- expect false
--   select has_table_privilege('authenticated', 'public.votes', 'SELECT');           -- expect false
--   select has_column_privilege('anon', 'public.comments', 'voter_token', 'SELECT'); -- expect false
--   select has_column_privilege('anon', 'public.comments', 'body', 'SELECT');        -- expect true
--   select proname, prosecdef, proconfig from pg_proc
--     where proname in ('get_vote_counts', 'get_my_votes', 'get_comments');
--     -- expect all three prosecdef true, proconfig ["search_path=\"\""]
--   select count(*) from public.votes;    -- expect the live count, unchanged
--   select count(*) from public.comments; -- expect the live count, unchanged
-- To prove the leak is closed the way a visitor would see it, call the
-- REST endpoint with the anon key: GET /rest/v1/votes?select=voter_token
-- must now fail, and GET /rest/v1/comments?select=voter_token must fail,
-- while GET /rest/v1/comments?select=id,author_name,body still works.

-- 1. votes: RPC-only --------------------------------------------------------
-- Drop the public policies first, then revoke the grants. RLS stays
-- enabled on the table with no policies: no direct access for anyone.
drop policy if exists "votes_public_read" on public.votes;
drop policy if exists "votes_anon_insert" on public.votes;
revoke select, insert on public.votes from anon, authenticated;

-- 2. comments: column-level read only --------------------------------------
-- Revoke the table-level SELECT, then re-grant only the display columns.
-- voter_token is deliberately not among them. The insert policy and
-- insert grant stay as they are: a browser posts its OWN token.
revoke select on public.comments from anon, authenticated;
grant select (id, debate_id, author_name, body, created_at)
  on public.comments to anon, authenticated;

-- 3. get_vote_counts — tallies for every debate ----------------------------
-- One call serves the home page and every debate page; no token involved.
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

-- 4. get_my_votes — this browser's votes only ------------------------------
-- Returns only rows whose voter_token matches the token the caller sends,
-- so a visitor can only ever see their own vote. No other token is
-- involved in the response.
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

-- 5. get_comments — a debate's comments, newest first -----------------------
-- Returns the display columns plus is_mine, computed server-side from
-- the caller's own token. No voter_token ever leaves the database.
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
