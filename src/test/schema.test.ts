import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

describe("supabase/schema.sql", () => {
  it("creates the four GOAT tables — and no admins or articles table", () => {
    expect(sql).toMatch(/create table if not exists public\.debates/i);
    expect(sql).toMatch(/create table if not exists public\.contenders/i);
    expect(sql).toMatch(/create table if not exists public\.votes/i);
    expect(sql).toMatch(/create table if not exists public\.comments/i);
    // Articles live in the SHARED main-project table (migration 0021),
    // not in a GOAT table: this file widens its site check to 'goat'
    // and re-asserts its policies instead of creating it. The phase-3
    // admins table / is_admin() are retired with the GOAT project.
    expect(sql).not.toMatch(/create table if not exists public\.admins/i);
    expect(sql).not.toMatch(/create table if not exists public\.articles/i);
    expect(sql).not.toMatch(/public\.is_admin\(\)/i);
    expect(sql).toMatch(/articles_site_check check \(site in \('main', 'lang', 'goat'\)\)/i);
    expect(sql).toMatch(/create policy "Admins write articles" on public\.articles/i);
    expect(sql).toMatch(/for insert to authenticated with check \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/i);
    expect(sql).toMatch(/create policy "Anyone can read published articles" on public\.articles/i);
  });

  it("enforces one vote per browser per debate", () => {
    expect(sql).toMatch(/unique\s*\(\s*debate_id\s*,\s*voter_token\s*\)/i);
  });

  it("enables RLS: public reads on debates/contenders, votes RPC-only, comments sign-in only", () => {
    expect(sql).toMatch(/alter table public\.debates enable row level security/i);
    expect(sql).toMatch(/alter table public\.votes enable row level security/i);
    expect(sql).toMatch(/alter table public\.comments enable row level security/i);
    // votes must have NO public-read or anon-insert policy: tallies and
    // writes go through the SECURITY DEFINER RPCs only.
    expect(sql).not.toMatch(/create policy "votes_public_read"/i);
    expect(sql).not.toMatch(/create policy "votes_anon_insert"/i);
    expect(sql).toMatch(/revoke select, insert on public\.votes from anon, authenticated/i);
    // Comments are gated on sign-in now: only an authenticated fan can
    // insert, and only as themself. The anonymous policy is dropped,
    // never created (the DROP line in section 6 names it to remove it).
    expect(sql).not.toMatch(/create policy "comments_anon_insert"/i);
    expect(sql).toMatch(/drop policy if exists "comments_anon_insert" on public\.comments/i);
    expect(sql).toMatch(/create policy "comments_auth_insert" on public\.comments/i);
    expect(sql).toMatch(/for insert to authenticated with check \(auth\.uid\(\) = user_id\)/i);
  });

  it("defines the comments table with shape checks, column-level read + anon insert, and grants", () => {
    expect(sql).toMatch(/create table if not exists public\.comments/i);
    expect(sql).toMatch(/debate_id uuid not null references public\.debates \(id\) on delete cascade/i);
    expect(sql).toMatch(/comments_body_max_length check \(char_length\(body\) <= 500\)/i);
    expect(sql).toMatch(/comments_body_nonempty check \(char_length\(trim\(body\)\) > 0\)/i);
    expect(sql).toMatch(/comments_author_max_length check \(char_length\(author_name\) <= 40\)/i);
    expect(sql).toMatch(/alter table public\.comments enable row level security/i);
    expect(sql).toMatch(/create policy "comments_public_read" on public\.comments/i);
    expect(sql).toMatch(/create policy "comments_auth_insert" on public\.comments/i);
    // The auth insert policy checks the row belongs to the caller.
    // Read grant covers ONLY the display columns — voter_token is excluded.
    expect(sql).toMatch(/grant select \(id, debate_id, author_name, body, created_at\)\s*on public\.comments to anon, authenticated/i);
    expect(sql).not.toMatch(/grant select, insert on public\.comments/i);
    expect(sql).toMatch(/grant insert on public\.comments to anon, authenticated/i);
  });

  it("defines cast_vote with a pinned empty search_path and a qualified body", () => {
    expect(sql).toMatch(/create or replace function public\.cast_vote/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/public\.votes/);
    expect(sql).toMatch(/on conflict \(debate_id, voter_token\)/i);
  });

  it("seeds all 10 debates idempotently", () => {
    for (const slug of [
      "messi-vs-ronaldo",
      "jordan-vs-lebron",
      "brady-vs-montana",
      "ali-vs-tyson",
      "federer-vs-nadal",
      "serena-vs-graf",
      "hamilton-vs-schumacher",
      "woods-vs-nicklaus",
      "pele-vs-maradona",
      "beyonce-vs-taylor-swift",
    ]) {
      expect(sql).toContain(slug);
    }
    expect(sql).toMatch(/on conflict \(slug\) do nothing/i);
    expect(sql).toMatch(/on conflict \(id\) do nothing/i);
  });

  it("add-debate-10.sql seeds only the 10th debate idempotently", () => {
    const add10 = readFileSync(new URL("../../supabase/add-debate-10.sql", import.meta.url), "utf8");
    expect(add10).toContain("beyonce-vs-taylor-swift");
    expect(add10).toContain("Beyoncé");
    expect(add10).toContain("Taylor Swift");
    expect(add10).toContain("35× Grammy winner");
    expect(add10).toContain("14× Grammy winner");
    expect(add10).toMatch(/on conflict \(slug\) do nothing/i);
    expect(add10).toMatch(/on conflict \(id\) do nothing/i);
    // No other debate slug may appear in the standalone file.
    for (const slug of [
      "messi-vs-ronaldo",
      "jordan-vs-lebron",
      "brady-vs-montana",
      "ali-vs-tyson",
      "federer-vs-nadal",
      "serena-vs-graf",
      "hamilton-vs-schumacher",
      "woods-vs-nicklaus",
      "pele-vs-maradona",
    ]) {
      expect(add10).not.toContain(slug);
    }
  });

  it("migrate-to-main-project.sql is the same SQL as schema.sql (bodies identical, headers differ)", () => {
    const migrate = readFileSync(
      new URL("../../supabase/migrate-to-main-project.sql", import.meta.url),
      "utf8",
    );
    // Strip comment lines: the two files differ only in their headers.
    const stripComments = (text: string): string =>
      text
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
    expect(stripComments(migrate)).toBe(stripComments(sql));
    // And the migration file carries the same key guarantees on its own.
    expect(migrate).toMatch(/create table if not exists public\.debates/i);
    expect(migrate).toMatch(/create table if not exists public\.votes/i);
    expect(migrate).toMatch(/create table if not exists public\.comments/i);
    expect(migrate).not.toMatch(/create table if not exists public\.admins/i);
    expect(migrate).not.toMatch(/create table if not exists public\.articles/i);
    expect(migrate).not.toMatch(/public\.is_admin\(\)/i);
    expect(migrate).toMatch(/articles_site_check check \(site in \('main', 'lang', 'goat'\)\)/i);
    expect(migrate).toMatch(/public\.has_role\(auth\.uid\(\), 'admin'\)/i);
    expect(migrate).toMatch(/create or replace function public\.cast_vote/i);
    for (const fn of ["get_vote_counts", "get_my_votes", "get_comments"]) {
      expect(migrate).toMatch(new RegExp(`create or replace function public\\.${fn}`, "i"));
    }
    expect(migrate).toMatch(/revoke select, insert on public\.votes from anon, authenticated/i);
    expect(migrate).toMatch(
      /grant select \(id, debate_id, author_name, body, created_at\)\s*on public\.comments to anon, authenticated/i,
    );
    expect(migrate).toMatch(/on conflict \(slug\) do nothing/i);
    // No live voter_token and no email address may ever appear in it.
    expect(migrate).not.toMatch(/@/);
  });

  it("add-articles.sql is the retired GOAT-project file (unchanged, phase-3 gating)", () => {
    const addArticles = readFileSync(new URL("../../supabase/add-articles.sql", import.meta.url), "utf8");
    expect(addArticles).toMatch(/create table if not exists public\.admins/i);
    expect(addArticles).toMatch(/user_id uuid primary key references auth\.users \(id\)/i);
    expect(addArticles).toMatch(/create table if not exists public\.articles/i);
    expect(addArticles).toMatch(/kind text not null default 'article' check \(kind in \('article', 'post'\)\)/i);
    expect(addArticles).toMatch(/status text not null default 'draft' check \(status in \('draft', 'published'\)\)/i);
    expect(addArticles).toMatch(/slug text not null unique/i);
    expect(addArticles).toMatch(/title text not null check \(char_length\(btrim\(title\)\) between 1 and 160\)/i);
    expect(addArticles).toMatch(/excerpt text not null default '' check \(char_length\(excerpt\) <= 300\)/i);
    expect(addArticles).toMatch(/create or replace function public\.is_admin\(\)/i);
    expect(addArticles).toMatch(/security definer/i);
    expect(addArticles).toMatch(/set search_path = ''/i);
    expect(addArticles).toMatch(/create policy "articles_public_read" on public\.articles/i);
    expect(addArticles).toMatch(/for select to anon, authenticated using \(status = 'published'\)/i);
    expect(addArticles).toMatch(/for insert to authenticated with check \(public\.is_admin\(\)\)/i);
    expect(addArticles).toMatch(/grant select on public\.articles to anon, authenticated/i);
    expect(addArticles).toMatch(/grant insert, update, delete on public\.articles to authenticated/i);
    expect(addArticles).toMatch(/alter table public\.admins enable row level security/i);
    // No direct access to the admins table, and no email address anywhere.
    expect(addArticles).not.toMatch(/create policy .* on public\.admins/i);
    expect(addArticles).not.toMatch(/grant .* on public\.admins/i);
    expect(addArticles).not.toMatch(/@/);
    expect(addArticles).not.toMatch(/gmail\.com|mimstudiospro\.com/i);
    // It must not touch the voting tables.
    expect(addArticles).not.toMatch(/create table if not exists public\.debates/i);
    expect(addArticles).not.toMatch(/create table if not exists public\.votes/i);
    expect(addArticles).not.toMatch(/create table if not exists public\.comments/i);
  });

  it("defines the vote/comment read RPCs with pinned empty search_paths", () => {
    for (const fn of ["get_vote_counts", "get_my_votes", "get_comments"]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${fn}`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}`, "i"));
    }
    expect(sql).toMatch(/set search_path = ''/i);
    // get_comments returns is_mine from the signed-in user id, never the token.
    expect(sql).toMatch(/\(c\.user_id is not null and c\.user_id = auth\.uid\(\)\) as is_mine/i);
    // get_my_votes only ever returns rows for the token the caller sends.
    expect(sql).toMatch(/where public\.votes\.voter_token = _voter/i);
  });

  it("add-comments.sql creates only the comments table, idempotently", () => {
    const addComments = readFileSync(new URL("../../supabase/add-comments.sql", import.meta.url), "utf8");
    expect(addComments).toMatch(/create table if not exists public\.comments/i);
    expect(addComments).toMatch(/create policy "comments_public_read" on public\.comments/i);
    expect(addComments).toMatch(/create policy "comments_anon_insert" on public\.comments/i);
    expect(addComments).toMatch(/grant select, insert on public\.comments to anon, authenticated/i);
    expect(addComments).toMatch(/comments_body_max_length check \(char_length\(body\) <= 500\)/i);
    // It must not touch the other tables.
    expect(addComments).not.toMatch(/create table if not exists public\.debates/i);
    expect(addComments).not.toMatch(/create table if not exists public\.votes/i);
    expect(addComments).not.toMatch(/create table if not exists public\.contenders/i);
  });
});

describe("supabase/add-criteria.sql — GOAT of Criteria", () => {
  const criteria = readFileSync(
    new URL("../../supabase/add-criteria.sql", import.meta.url),
    "utf8",
  );

  it("creates goat_profiles, comment_likes and subscriptions — and no new articles/admins table", () => {
    expect(criteria).toMatch(/create table if not exists public\.goat_profiles/i);
    expect(criteria).toMatch(/user_id uuid primary key references auth\.users \(id\)/i);
    expect(criteria).toMatch(/goat_profiles_name_max_length check \(char_length\(display_name\) <= 40\)/i);
    expect(criteria).toMatch(/create table if not exists public\.comment_likes/i);
    expect(criteria).toMatch(/primary key \(comment_id, user_id\)/i);
    expect(criteria).toMatch(/create table if not exists public\.subscriptions/i);
    expect(criteria).toMatch(/plan text not null check \(plan in \('monthly', 'yearly'\)\)/i);
    expect(criteria).toMatch(/unique \(user_id\)/i);
    expect(criteria).not.toMatch(/create table if not exists public\.articles/i);
    expect(criteria).not.toMatch(/create table if not exists public\.admins/i);
    // No email address and no live voter_token may ever appear in it.
    expect(criteria).not.toMatch(/@/);
  });

  it("gates comments on sign-in and records the fan on votes", () => {
    expect(criteria).toMatch(
      /alter table public\.comments add column if not exists user_id uuid references auth\.users/i,
    );
    expect(criteria).not.toMatch(/create policy "comments_anon_insert"/i);
    expect(criteria).toMatch(/create policy "comments_auth_insert" on public\.comments/i);
    expect(criteria).toMatch(
      /for insert to authenticated with check \(auth\.uid\(\) = user_id\)/i,
    );
    expect(criteria).toMatch(
      /alter table public\.votes add column if not exists user_id uuid references auth\.users/i,
    );
  });

  it("keeps likes RPC-only and subscriptions owner-read only", () => {
    expect(criteria).toMatch(/alter table public\.comment_likes enable row level security/i);
    expect(criteria).toMatch(/revoke all on public\.comment_likes from anon, authenticated/i);
    expect(criteria).not.toMatch(/create policy .* on public\.comment_likes/i);
    expect(criteria).toMatch(/create policy "subscriptions_owner_read" on public\.subscriptions/i);
    expect(criteria).toMatch(/for select to authenticated using \(auth\.uid\(\) = user_id\)/i);
    expect(criteria).toMatch(/grant select on public\.subscriptions to authenticated/i);
    expect(criteria).toMatch(
      /revoke insert, update, delete on public\.subscriptions from anon, authenticated/i,
    );
    expect(criteria).toMatch(/create policy "goat_profiles_public_read" on public\.goat_profiles/i);
  });

  it("defines the like, board and subscription RPCs as SECURITY DEFINER with pinned search_path", () => {
    for (const fn of [
      "like_comment",
      "unlike_comment",
      "get_leaderboard",
      "get_my_subscription",
      "get_past_winners",
    ]) {
      expect(criteria).toMatch(new RegExp(`create or replace function public\\.${fn}`, "i"));
      expect(criteria).toMatch(new RegExp(`grant execute on function public\\.${fn}`, "i"));
    }
    // The two internal helpers are defined but have NO execute grant:
    // only the SECURITY DEFINER board functions call them, as the owner.
    for (const fn of ["goat_is_subscriber", "goat_month_scores"]) {
      expect(criteria).toMatch(new RegExp(`create or replace function public\\.${fn}`, "i"));
      expect(criteria).not.toMatch(new RegExp(`grant execute on function public\\.${fn}`, "i"));
    }
    expect(criteria).toMatch(/security definer/i);
    expect(criteria).toMatch(/set search_path = ''/i);
  });

  it("scores a month 1 / 2 / 1 with earliest-first tie-break, subscribers only", () => {
    expect(criteria).toMatch(/count\(distinct v\.debate_id\)/i);
    expect(criteria).toMatch(/coalesce\(cp\.n, 0\) \* 2/i);
    expect(criteria).toMatch(/where public\.goat_is_subscriber\(s\.user_id\)/i);
    expect(criteria).toMatch(/order by s\.points desc, s\.first_scored_at asc/i);
    expect(criteria).toMatch(/row_number\(\) over \(/i);
    expect(criteria).toMatch(/partition by mo\.m/i);
  });

  it("cast_vote records the fan id and drops a forged one", () => {
    expect(criteria).toMatch(
      /create or replace function public\.cast_vote\(_debate uuid, _contender uuid, _voter text, _user uuid default null\)/i,
    );
    expect(criteria).toMatch(/if _user is distinct from auth\.uid\(\) then/i);
    expect(criteria).toMatch(/user_id = coalesce\(excluded\.user_id, public\.votes\.user_id\)/i);
    expect(criteria).toMatch(/on conflict \(debate_id, voter_token\)/i);
  });

  it("get_comments returns likes and is_mine from the user id, never the token", () => {
    expect(criteria).toMatch(/create or replace function public\.get_comments\(_debate uuid\)/i);
    expect(criteria).toMatch(/\(c\.user_id is not null and c\.user_id = auth\.uid\(\)\) as is_mine/i);
    expect(criteria).toMatch(/coalesce\(bool_or\(l\.user_id = auth\.uid\(\)\), false\) as liked_by_me/i);
    expect(criteria).not.toMatch(/voter_token = _voter/i);
  });

  it("is mirrored in schema.sql and migrate-to-main-project.sql (section 6 verbatim)", () => {
    const stripComments = (text: string): string =>
      text
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
    const sectionOf = (text: string): string => {
      const start = text.indexOf("-- 6a. Fan profiles");
      const endMarker = "grant execute on function public.get_past_winners() to anon, authenticated;";
      const end = text.indexOf(endMarker);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return stripComments(text.slice(start, end + endMarker.length));
    };
    const schemaSql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
    const migrate = readFileSync(
      new URL("../../supabase/migrate-to-main-project.sql", import.meta.url),
      "utf8",
    );
    expect(sectionOf(schemaSql)).toBe(sectionOf(criteria));
    expect(sectionOf(migrate)).toBe(sectionOf(criteria));
  });
});

describe("supabase/add-subscription-webhook.sql — webhook lookup column", () => {
  const webhook = readFileSync(
    new URL("../../supabase/add-subscription-webhook.sql", import.meta.url),
    "utf8",
  );

  it("adds stripe_subscription_id to subscriptions, idempotently", () => {
    expect(webhook).toMatch(
      /alter table public\.subscriptions\s+add column if not exists stripe_subscription_id text/i,
    );
    expect(webhook).toMatch(
      /create index if not exists subscriptions_stripe_subscription_id_idx\s+on public\.subscriptions \(stripe_subscription_id\)/i,
    );
    // No policy, grant, or function changes, and no email address.
    expect(webhook).not.toMatch(/create policy/i);
    expect(webhook).not.toMatch(/grant /i);
    expect(webhook).not.toMatch(/create or replace function/i);
    expect(webhook).not.toMatch(/@/);
  });

  it("is mirrored in schema.sql and migrate-to-main-project.sql (section 7 verbatim)", () => {
    const stripComments = (text: string): string =>
      text
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
    const sectionOf = (text: string): string => {
      const start = text.indexOf("-- 7a.");
      const endMarker = "on public.subscriptions (stripe_subscription_id);";
      const end = text.indexOf(endMarker);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      return stripComments(text.slice(start, end + endMarker.length));
    };
    const schemaSql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
    const migrate = readFileSync(
      new URL("../../supabase/migrate-to-main-project.sql", import.meta.url),
      "utf8",
    );
    expect(sectionOf(schemaSql)).toBe(sectionOf(webhook));
    expect(sectionOf(migrate)).toBe(sectionOf(webhook));
  });
});
