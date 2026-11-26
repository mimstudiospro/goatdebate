import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tallyFromCountRows } from "../lib/votes";

const apiSrc = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
const commentsSrc = readFileSync(new URL("../lib/comments.ts", import.meta.url), "utf8");
const debateCommentsSrc = readFileSync(
  new URL("../components/DebateComments.tsx", import.meta.url),
  "utf8",
);
const fixSql = readFileSync(
  new URL("../../supabase/fix-voter-token-exposure.sql", import.meta.url),
  "utf8",
);
const schemaSql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

describe("voter_token never reaches the browser", () => {
  it("the client never selects from the votes table", () => {
    expect(apiSrc).not.toMatch(/\.from\(\s*"votes"\s*\)/);
    expect(apiSrc).not.toMatch(/\.from\(\s*'votes'\s*\)/);
  });

  it("no client select list mentions voter_token", () => {
    const selects = [...apiSrc.matchAll(/\.select\(\s*"([^"]*)"/g)].map((m) => m[1]);
    expect(selects.length).toBeGreaterThan(0);
    for (const list of selects) {
      expect(list).not.toMatch(/voter_token/);
    }
  });

  it("tallies and own votes come from the RPCs, not table reads", () => {
    expect(apiSrc).toMatch(/supabase\.rpc\("get_vote_counts"\)/);
    expect(apiSrc).toMatch(/supabase\.rpc\("get_my_votes",\s*\{\s*_voter: voterToken\s*\}\)/);
    expect(apiSrc).toMatch(/supabase\.rpc\("get_comments",\s*\{/);
    expect(apiSrc).toMatch(/supabase\.rpc\("cast_vote",\s*\{/);
  });

  it("the Comment type carries is_mine instead of voter_token", () => {
    expect(commentsSrc).toMatch(/is_mine: boolean/);
    expect(commentsSrc).not.toMatch(/voter_token/);
  });

  it("the comments UI marks own comments from is_mine, never from a token", () => {
    expect(debateCommentsSrc).toMatch(/c\.is_mine/);
    expect(debateCommentsSrc).not.toMatch(/voter_token\s*===/);
    expect(debateCommentsSrc).not.toMatch(/\.voter_token\b/);
  });

  it("the only voter_token the client sends is its OWN, in a write", () => {
    // One occurrence: the insert payload in postComment. Sending the
    // visitor's own token to the server is not exposure.
    const occurrences = apiSrc.match(/voter_token/g) ?? [];
    const codeOccurrences = apiSrc
      .split("\n")
      .filter((line) => line.includes("voter_token") && !line.trim().startsWith("*") && !line.trim().startsWith("//"));
    expect(codeOccurrences).toHaveLength(1);
    expect(codeOccurrences[0]).toMatch(/\.insert\(/);
    expect(occurrences.length).toBeGreaterThanOrEqual(1);
  });
});

describe("tallyFromCountRows", () => {
  it("builds counts and a total from RPC count rows", () => {
    const tally = tallyFromCountRows([
      { contender_id: "a", votes: 3 },
      { contender_id: "b", votes: 7 },
    ]);
    expect(tally).toEqual({ counts: { a: 3, b: 7 }, total: 10 });
  });

  it("returns an empty tally for no rows", () => {
    expect(tallyFromCountRows([])).toEqual({ counts: {}, total: 0 });
  });

  it("keeps zero-vote contenders out of the counts", () => {
    const tally = tallyFromCountRows([{ contender_id: "a", votes: 0 }]);
    expect(tally.total).toBe(0);
    expect(tally.counts["a"]).toBe(0);
  });
});

describe("supabase/fix-voter-token-exposure.sql", () => {
  it("revokes direct votes access and drops the votes policies", () => {
    expect(fixSql).toMatch(/drop policy if exists "votes_public_read" on public\.votes/i);
    expect(fixSql).toMatch(/drop policy if exists "votes_anon_insert" on public\.votes/i);
    expect(fixSql).toMatch(/revoke select, insert on public\.votes from anon, authenticated/i);
  });

  it("re-grants comments reads on display columns only", () => {
    expect(fixSql).toMatch(/revoke select on public\.comments from anon, authenticated/i);
    expect(fixSql).toMatch(/grant select \(id, debate_id, author_name, body, created_at\)\s*on public\.comments to anon, authenticated/i);
    expect(fixSql).not.toMatch(/grant select, insert on public\.comments/i);
    // The insert path stays: posting your own comment is not a leak.
    expect(fixSql).not.toMatch(/revoke insert on public\.comments/i);
  });

  it("defines the three read RPCs as SECURITY DEFINER with pinned search_path", () => {
    for (const fn of ["get_vote_counts", "get_my_votes", "get_comments"]) {
      expect(fixSql).toMatch(new RegExp(`create or replace function public\\.${fn}`, "i"));
      expect(fixSql).toMatch(new RegExp(`grant execute on function public\\.${fn}`, "i"));
    }
    expect(fixSql).toMatch(/security definer/i);
    expect(fixSql).toMatch(/set search_path = ''/i);
    expect(fixSql).toMatch(/\(public\.comments\.voter_token = _voter\) as is_mine/i);
  });

  it("touches votes/comments only — never articles, admins, debates or contenders", () => {
    expect(fixSql).not.toMatch(/public\.articles/i);
    expect(fixSql).not.toMatch(/public\.admins/i);
    expect(fixSql).not.toMatch(/create table/i);
    expect(fixSql).not.toMatch(/public\.debates/i);
    expect(fixSql).not.toMatch(/public\.contenders/i);
  });

  it("is mirrored in schema.sql", () => {
    for (const fragment of [
      /revoke select, insert on public\.votes from anon, authenticated/i,
      /grant select \(id, debate_id, author_name, body, created_at\)\s*on public\.comments to anon, authenticated/i,
      /create or replace function public\.get_vote_counts\(\)/i,
      /create or replace function public\.get_my_votes\(_voter text\)/i,
      /create or replace function public\.get_comments\(_debate uuid, _voter text\)/i,
    ]) {
      expect(schemaSql).toMatch(fragment);
    }
  });
});
