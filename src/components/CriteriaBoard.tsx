import { useEffect, useState } from "react";
import { fetchLeaderboard } from "../lib/api";
import type { LeaderboardEntry } from "../lib/api";
import { SCORING_RULES, currentMonthKey, monthLabel } from "../lib/criteria";
import { formatVotes } from "../lib/votes";

/** The ranked rows — shared by the home section and the full page. */
export function CriteriaBoard({
  entries,
  compact = false,
}: {
  entries: LeaderboardEntry[];
  compact?: boolean;
}) {
  const shown = compact ? entries.slice(0, 3) : entries;
  if (shown.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-400">
        No subscribers on the board yet — be the first.
      </p>
    );
  }
  return (
    <ol className="mt-6 space-y-3">
      {shown.map((entry, i) => (
        <li
          key={entry.user_id}
          className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
              i === 0 ? "bg-gold text-black" : "bg-panel-2 text-zinc-300"
            }`}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">
              {entry.display_name}
              {i === 0 && !compact && (
                <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                  Leading
                </span>
              )}
            </span>
            <span className="block text-xs text-zinc-500">
              {formatVotes(entry.votes)} {entry.votes === 1 ? "pick" : "picks"} ·{" "}
              {formatVotes(entry.comments)} {entry.comments === 1 ? "comment" : "comments"} ·{" "}
              {formatVotes(entry.likes_received)} {entry.likes_received === 1 ? "like" : "likes"}{" "}
              received
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-lg font-black text-gold">{formatVotes(entry.points)}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {entry.points === 1 ? "point" : "points"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The scoring rulebook, in the UI's own words. */
export function HowItWorks() {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
        How the ranking works
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
        {SCORING_RULES.map((rule) => (
          <li key={rule} className="flex gap-2">
            <span className="text-gold" aria-hidden="true">
              •
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The home-page teaser: this month's top three, plus the way in.
 * Best-effort — while the criteria SQL has not run yet the fetch
 * throws, and the section shows the explainer with an honest note
 * instead of a broken board.
 */
export function CriteriaHomeSection() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [notReady, setNotReady] = useState(false);
  const month = currentMonthKey();

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(month)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setNotReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  return (
    <section className="mt-10 rounded-2xl border border-gold/40 bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-black tracking-tight">
          GOAT of <span className="text-gold">Criteria</span>
        </h2>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          {monthLabel(month)}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        The fans&apos; contest. Your picks and your arguments put you on the
        board — the top fan at the end of the month takes the crown.
      </p>
      {notReady ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          The first board opens soon — the contest tables are still being wired up.
        </p>
      ) : (
        <CriteriaBoard entries={entries} compact />
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href="#/criteria"
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep"
        >
          See the board
        </a>
        <a
          href="#/signin"
          className="rounded-full border border-line bg-panel-2 px-6 py-2.5 text-sm font-bold text-zinc-100 transition-colors hover:border-gold/60"
        >
          Join free
        </a>
      </div>
    </section>
  );
}
