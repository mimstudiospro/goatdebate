/**
 * GOAT of Criteria — the fans' contest. A monthly leaderboard that ranks
 * signed-in fans by their picks and arguments. The scoring below is the
 * whole rulebook, and it is mirrored by the SQL in
 * supabase/add-criteria.sql (goat_month_scores) — keep the two in sync:
 *   1 point per debate voted in that month (at most 10 — one per debate)
 *   2 points per comment posted that month
 *   1 point per like received on your comments that month
 * Ties break by earliest scoring activity. Only paying subscribers are
 * ranked — the server filters the board to subscribers; this module
 * scores whatever events it is given, so it stays testable in isolation.
 *
 * Months are UTC calendar months ("YYYY-MM"), matching date_trunc('month')
 * on timestamptz in the database.
 */

export const POINTS_PER_VOTE_DEBATE = 1;
export const POINTS_PER_COMMENT = 2;
export const POINTS_PER_LIKE_RECEIVED = 1;
/** One point per debate, ten debates — the most vote points in a month. */
export const MAX_VOTE_POINTS_PER_MONTH = 10;

export type ScoreEventKind = "vote" | "comment" | "like";

export interface ScoreEvent {
  userId: string;
  displayName: string;
  kind: ScoreEventKind;
  /** Debate id, for votes — one point per distinct debate, not per vote. */
  debateId?: string;
  /** ISO timestamp of the event. */
  at: string;
}

export interface Standing {
  userId: string;
  displayName: string;
  points: number;
  /** Distinct debates voted in. */
  votes: number;
  comments: number;
  likesReceived: number;
  /** ISO timestamp of the fan's earliest scoring event this month. */
  firstScoredAt: string;
}

/** "YYYY-MM" for a date, in UTC (matching the database's month buckets). */
export function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** The current month's key, e.g. "2026-11". */
export function currentMonthKey(now = new Date()): string {
  return monthKey(now);
}

/** "November 2026" for a "YYYY-MM" key; the key itself back on bad input. */
export function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Rank fans from their scoring events. Votes count once per distinct
 * debate; comments and likes count per event. Sorted by points desc,
 * then earliest first scoring event. Fans with no scoring events do
 * not appear.
 */
export function computeStandings(events: ScoreEvent[]): Standing[] {
  const byUser = new Map<
    string,
    {
      displayName: string;
      debates: Set<string>;
      comments: number;
      likes: number;
      firstAt: string;
    }
  >();
  for (const event of events) {
    let row = byUser.get(event.userId);
    if (!row) {
      row = {
        displayName: event.displayName,
        debates: new Set<string>(),
        comments: 0,
        likes: 0,
        firstAt: event.at,
      };
      byUser.set(event.userId, row);
    }
    if (event.at < row.firstAt) row.firstAt = event.at;
    if (event.kind === "vote") {
      if (event.debateId) row.debates.add(event.debateId);
    } else if (event.kind === "comment") {
      row.comments += 1;
    } else if (event.kind === "like") {
      row.likes += 1;
    }
  }
  return [...byUser.entries()]
    .map(([userId, row]) => ({
      userId,
      displayName: row.displayName,
      votes: row.debates.size,
      comments: row.comments,
      likesReceived: row.likes,
      points:
        row.debates.size * POINTS_PER_VOTE_DEBATE +
        row.comments * POINTS_PER_COMMENT +
        row.likes * POINTS_PER_LIKE_RECEIVED,
      firstScoredAt: row.firstAt,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        (a.firstScoredAt < b.firstScoredAt
          ? -1
          : a.firstScoredAt > b.firstScoredAt
            ? 1
            : 0),
    );
}

/** The scoring rulebook, in the exact words the UI shows. */
export const SCORING_RULES: string[] = [
  `${POINTS_PER_VOTE_DEBATE} point per debate you vote in — up to ${MAX_VOTE_POINTS_PER_MONTH} a month, one per debate.`,
  `${POINTS_PER_COMMENT} points per comment you post.`,
  `${POINTS_PER_LIKE_RECEIVED} point per like your comments get from other fans.`,
  "Ties go to whoever scored first.",
  "Only subscribers are ranked — the contest is the subscription.",
];
