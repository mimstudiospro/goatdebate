import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

describe("supabase/schema.sql", () => {
  it("creates the three tables", () => {
    expect(sql).toMatch(/create table if not exists public\.debates/i);
    expect(sql).toMatch(/create table if not exists public\.contenders/i);
    expect(sql).toMatch(/create table if not exists public\.votes/i);
  });

  it("enforces one vote per browser per debate", () => {
    expect(sql).toMatch(/unique\s*\(\s*debate_id\s*,\s*voter_token\s*\)/i);
  });

  it("enables RLS with public reads and anon vote inserts", () => {
    expect(sql).toMatch(/alter table public\.debates enable row level security/i);
    expect(sql).toMatch(/alter table public\.votes enable row level security/i);
    expect(sql).toMatch(/for insert to anon/i);
  });

  it("defines cast_vote with a pinned empty search_path and a qualified body", () => {
    expect(sql).toMatch(/create or replace function public\.cast_vote/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/public\.votes/);
    expect(sql).toMatch(/on conflict \(debate_id, voter_token\)/i);
  });

  it("seeds all 9 debates idempotently", () => {
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
      expect(sql).toContain(slug);
    }
    expect(sql).toMatch(/on conflict do nothing/i);
  });
});
