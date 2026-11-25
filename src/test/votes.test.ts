import { describe, expect, it } from "vitest";
import {
  computePercentages,
  emptyTally,
  leaderId,
  tallyFromVotes,
} from "../lib/votes";

describe("tallyFromVotes", () => {
  it("counts votes per contender", () => {
    const tally = tallyFromVotes([
      { contender_id: "a" },
      { contender_id: "a" },
      { contender_id: "b" },
    ]);
    expect(tally.total).toBe(3);
    expect(tally.counts).toEqual({ a: 2, b: 1 });
  });

  it("is empty with no votes", () => {
    expect(emptyTally()).toEqual({ counts: {}, total: 0 });
  });
});

describe("computePercentages", () => {
  it("is 0/0 with no votes", () => {
    expect(computePercentages(emptyTally(), ["a", "b"])).toEqual([
      { contenderId: "a", votes: 0, percent: 0 },
      { contenderId: "b", votes: 0, percent: 0 },
    ]);
  });

  it("gives 100/0 for a unanimous vote", () => {
    const tally = tallyFromVotes([{ contender_id: "a" }, { contender_id: "a" }]);
    expect(computePercentages(tally, ["a", "b"])).toEqual([
      { contenderId: "a", votes: 2, percent: 100 },
      { contenderId: "b", votes: 0, percent: 0 },
    ]);
  });

  it("splits 2:1 as 67/33 and the shares sum to 100", () => {
    const tally = tallyFromVotes([
      { contender_id: "a" },
      { contender_id: "a" },
      { contender_id: "b" },
    ]);
    const pcts = computePercentages(tally, ["a", "b"]);
    expect(pcts[0].percent).toBe(67);
    expect(pcts[1].percent).toBe(33);
    expect(pcts[0].percent + pcts[1].percent).toBe(100);
  });

  it("splits 1:1 as 50/50", () => {
    const tally = tallyFromVotes([{ contender_id: "a" }, { contender_id: "b" }]);
    const pcts = computePercentages(tally, ["a", "b"]);
    expect(pcts.map((p) => p.percent)).toEqual([50, 50]);
  });
});

describe("leaderId", () => {
  it("returns null with no votes or on a tie", () => {
    expect(leaderId(emptyTally(), ["a", "b"])).toBeNull();
    const tied = tallyFromVotes([{ contender_id: "a" }, { contender_id: "b" }]);
    expect(leaderId(tied, ["a", "b"])).toBeNull();
  });

  it("returns the leading contender", () => {
    const tally = tallyFromVotes([
      { contender_id: "a" },
      { contender_id: "b" },
      { contender_id: "b" },
    ]);
    expect(leaderId(tally, ["a", "b"])).toBe("b");
  });
});
