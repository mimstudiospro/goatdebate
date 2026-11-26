import { describe, expect, it } from "vitest";
import {
  MAX_VOTE_POINTS_PER_MONTH,
  POINTS_PER_COMMENT,
  POINTS_PER_LIKE_RECEIVED,
  POINTS_PER_VOTE_DEBATE,
  SCORING_RULES,
  computeStandings,
  currentMonthKey,
  monthKey,
  monthLabel,
} from "../lib/criteria";
import type { ScoreEvent } from "../lib/criteria";

function vote(userId: string, debateId: string, at: string): ScoreEvent {
  return { userId, displayName: `Fan-${userId}`, kind: "vote", debateId, at };
}
function comment(userId: string, at: string): ScoreEvent {
  return { userId, displayName: `Fan-${userId}`, kind: "comment", at };
}
function like(userId: string, at: string): ScoreEvent {
  return { userId, displayName: `Fan-${userId}`, kind: "like", at };
}

describe("month helpers", () => {
  it("keys a month as YYYY-MM in UTC", () => {
    expect(monthKey(new Date("2026-11-26T07:27:00Z"))).toBe("2026-11");
    expect(monthKey(new Date("2026-01-05T00:30:00Z"))).toBe("2026-01");
  });

  it("labels a month key and passes bad input through", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(monthLabel("2027-01")).toBe("January 2027");
    expect(monthLabel("garbage")).toBe("garbage");
  });

  it("currentMonthKey matches monthKey for now", () => {
    expect(currentMonthKey()).toBe(monthKey(new Date()));
  });
});

describe("computeStandings", () => {
  it("scores 1 point per debate voted in, 2 per comment, 1 per like received", () => {
    const standings = computeStandings([
      vote("a", "d1", "2026-11-02T10:00:00Z"),
      vote("a", "d2", "2026-11-02T11:00:00Z"),
      comment("a", "2026-11-03T10:00:00Z"),
      like("a", "2026-11-04T10:00:00Z"),
      like("a", "2026-11-04T11:00:00Z"),
    ]);
    expect(standings).toHaveLength(1);
    expect(standings[0]).toMatchObject({
      userId: "a",
      votes: 2,
      comments: 1,
      likesReceived: 2,
      points: 2 * POINTS_PER_VOTE_DEBATE + 1 * POINTS_PER_COMMENT + 2 * POINTS_PER_LIKE_RECEIVED,
    });
    expect(standings[0]?.points).toBe(6);
  });

  it("counts a debate once, however many times the vote changes", () => {
    const standings = computeStandings([
      vote("a", "d1", "2026-11-02T10:00:00Z"),
      vote("a", "d1", "2026-11-05T10:00:00Z"),
      vote("a", "d1", "2026-11-09T10:00:00Z"),
    ]);
    expect(standings[0]).toMatchObject({ votes: 1, points: 1 });
  });

  it("caps vote points at one per debate — ten debates, ten points max", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      vote("a", `d${i + 1}`, `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
    );
    const standings = computeStandings(events);
    expect(standings[0]?.votes).toBe(10);
    expect(standings[0]?.points).toBe(MAX_VOTE_POINTS_PER_MONTH);
  });

  it("ranks by points desc, ties by earliest scoring activity", () => {
    const standings = computeStandings([
      comment("late", "2026-11-10T10:00:00Z"),
      comment("early", "2026-11-02T10:00:00Z"),
      vote("third", "d1", "2026-11-03T10:00:00Z"),
    ]);
    expect(standings.map((s) => s.userId)).toEqual(["early", "late", "third"]);
    expect(standings[0]?.firstScoredAt).toBe("2026-11-02T10:00:00Z");
  });

  it("returns an empty board for no events", () => {
    expect(computeStandings([])).toEqual([]);
  });

  it("ignores a vote with no debate id for the count but still ranks the fan", () => {
    const standings = computeStandings([
      { userId: "a", displayName: "Fan-a", kind: "vote", at: "2026-11-02T10:00:00Z" },
      comment("a", "2026-11-03T10:00:00Z"),
    ]);
    expect(standings[0]).toMatchObject({ votes: 0, comments: 1, points: 2 });
  });
});

import { parseHash } from "../lib/routes";

describe("criteria route", () => {
  it("parses #/criteria and leaves the other routes alone", () => {
    expect(parseHash("#/criteria")).toEqual({ view: "criteria" });
    expect(parseHash("#/")).toEqual({ view: "home" });
    expect(parseHash("#/signin")).toEqual({ view: "signin" });
  });
});

describe("scoring rulebook", () => {
  it("states the 1 / 2 / 1 rule and the subscribers-only board", () => {
    const joined = SCORING_RULES.join(" ");
    expect(joined).toMatch(/1 point per debate/);
    expect(joined).toMatch(/2 points per comment/);
    expect(joined).toMatch(/1 point per like/);
    expect(joined).toMatch(/Only subscribers are ranked/);
    expect(joined).toMatch(/Ties go to whoever scored first/);
  });
});
