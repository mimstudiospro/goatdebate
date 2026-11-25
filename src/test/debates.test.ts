import { describe, expect, it } from "vitest";
import { SEED_DEBATES } from "../lib/debates";

const EXPECTED_SLUGS = [
  "messi-vs-ronaldo",
  "jordan-vs-lebron",
  "brady-vs-montana",
  "ali-vs-tyson",
  "federer-vs-nadal",
  "serena-vs-graf",
  "hamilton-vs-schumacher",
  "woods-vs-nicklaus",
  "pele-vs-maradona",
];

describe("seed debates", () => {
  it("has exactly the 9 launch debates", () => {
    expect(SEED_DEBATES).toHaveLength(9);
    expect(SEED_DEBATES.map((d) => d.slug)).toEqual(EXPECTED_SLUGS);
  });

  it("has unique slugs matching the slug pattern", () => {
    const slugs = SEED_DEBATES.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("gives every debate exactly two contenders with taglines", () => {
    for (const debate of SEED_DEBATES) {
      expect(debate.contenders).toHaveLength(2);
      expect(debate.title).toBeTruthy();
      expect(debate.sport).toBeTruthy();
      for (const c of debate.contenders) {
        expect(c.name).toBeTruthy();
        expect(c.tagline).toBeTruthy();
        expect(c.debate_id).toBe(debate.id);
      }
      const orders = debate.contenders.map((c) => c.sort_order);
      expect(orders).toEqual([1, 2]);
    }
  });

  it("uses only the approved taglines", () => {
    const taglines = SEED_DEBATES.flatMap((d) => d.contenders.map((c) => c.tagline));
    expect(taglines).toContain("8× Ballon d'Or");
    expect(taglines).toContain("5× Ballon d'Or");
    expect(taglines).toContain("6× NBA champion");
    expect(taglines).toContain("NBA all-time scoring leader");
    expect(taglines).toContain("7× Super Bowl champion");
    expect(taglines).toContain("3× heavyweight champion");
    expect(taglines).toContain("22 Grand Slams");
    expect(taglines).toContain("7× world champion");
    expect(taglines).toContain("18 majors");
    expect(taglines).toContain("3× World Cup winner");
    expect(taglines).toContain("1986 World Cup winner");
  });
});
