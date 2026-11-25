export interface Tally {
  /** Votes per contender id. */
  counts: Record<string, number>;
  total: number;
}

export interface Percentage {
  contenderId: string;
  votes: number;
  /** Whole-number percent, 0–100. Rounds so the two shares sum to 100 when total > 0. */
  percent: number;
}

export function emptyTally(): Tally {
  return { counts: {}, total: 0 };
}

export function tallyFromVotes(votes: { contender_id: string }[]): Tally {
  const counts: Record<string, number> = {};
  for (const v of votes) {
    counts[v.contender_id] = (counts[v.contender_id] ?? 0) + 1;
  }
  return { counts, total: votes.length };
}

/**
 * Percentages for exactly the given contender ids, in order.
 * With 0 votes every share is 0. Otherwise the first contender's share
 * is rounded and the second gets the remainder, so shares always sum
 * to 100 (v1 debates always have exactly two contenders).
 */
export function computePercentages(tally: Tally, contenderIds: string[]): Percentage[] {
  if (tally.total === 0) {
    return contenderIds.map((id) => ({ contenderId: id, votes: 0, percent: 0 }));
  }
  const first = Math.round(((tally.counts[contenderIds[0]] ?? 0) / tally.total) * 100);
  return contenderIds.map((id, i) => ({
    contenderId: id,
    votes: tally.counts[id] ?? 0,
    percent: i === 0 ? first : 100 - first,
  }));
}

/** Id of the leading contender, or null on a tie / no votes. */
export function leaderId(tally: Tally, contenderIds: string[]): string | null {
  if (tally.total === 0) return null;
  const a = tally.counts[contenderIds[0]] ?? 0;
  const b = tally.counts[contenderIds[1]] ?? 0;
  if (a === b) return null;
  return a > b ? contenderIds[0] : contenderIds[1];
}

const VOTER_KEY = "goatdebate:voter";

/** One random UUID per browser, stored in localStorage. One vote per browser per debate. */
export function getVoterToken(): string {
  try {
    const existing = window.localStorage.getItem(VOTER_KEY);
    if (existing) return existing;
    const token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VOTER_KEY, token);
    return token;
  } catch {
    // Private mode / storage unavailable: fall back to a session token.
    return `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function formatVotes(n: number): string {
  return n.toLocaleString("en-US");
}
