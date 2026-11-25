import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

describe("supabase/schema.sql", () => {
  it("creates the four tables", () => {
    expect(sql).toMatch(/create table if not exists public\.debates/i);
    expect(sql).toMatch(/create table if not exists public\.contenders/i);
    expect(sql).toMatch(/create table if not exists public\.votes/i);
    expect(sql).toMatch(/create table if not exists public\.comments/i);
  });

  it("enforces one vote per browser per debate", () => {
    expect(sql).toMatch(/unique\s*\(\s*debate_id\s*,\s*voter_token\s*\)/i);
  });

  it("enables RLS with public reads and anon vote inserts", () => {
    expect(sql).toMatch(/alter table public\.debates enable row level security/i);
    expect(sql).toMatch(/alter table public\.votes enable row level security/i);
    expect(sql).toMatch(/for insert to anon/i);
  });

  it("defines the comments table with shape checks, public read + anon insert, and grants", () => {
    expect(sql).toMatch(/create table if not exists public\.comments/i);
    expect(sql).toMatch(/debate_id uuid not null references public\.debates \(id\) on delete cascade/i);
    expect(sql).toMatch(/comments_body_max_length check \(char_length\(body\) <= 500\)/i);
    expect(sql).toMatch(/comments_body_nonempty check \(char_length\(trim\(body\)\) > 0\)/i);
    expect(sql).toMatch(/comments_author_max_length check \(char_length\(author_name\) <= 40\)/i);
    expect(sql).toMatch(/alter table public\.comments enable row level security/i);
    expect(sql).toMatch(/create policy "comments_public_read" on public\.comments/i);
    expect(sql).toMatch(/create policy "comments_anon_insert" on public\.comments/i);
    expect(sql).toMatch(/grant select, insert on public\.comments to anon, authenticated/i);
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
    expect(sql).toMatch(/on conflict do nothing/i);
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
