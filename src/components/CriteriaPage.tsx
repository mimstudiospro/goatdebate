import { useEffect, useState } from "react";
import { fetchLeaderboard, fetchPastWinners } from "../lib/api";
import type { LeaderboardEntry, PastWinner } from "../lib/api";
import { useSession } from "../lib/auth";
import { currentMonthKey, monthLabel } from "../lib/criteria";
import { fetchMySubscription } from "../lib/subscriptions";
import type { Subscription } from "../lib/subscriptions";
import { CriteriaBoard, HowItWorks } from "./CriteriaBoard";
import SubscribeSection from "./SubscribeSection";

/**
 * The GOAT of Criteria page: this month's subscriber board, the
 * scoring rulebook, past months' crowned fans, and the subscribe
 * cards. The board itself is visible to everyone — logged out, free
 * fan, or subscriber — but only subscribers are ranked on it.
 */
export default function CriteriaPage() {
  const { user } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [winners, setWinners] = useState<PastWinner[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const month = currentMonthKey();

  useEffect(() => {
    let cancelled = false;
    // Loading starts true (initial state); a month change mid-session
    // just refreshes the rows without flashing a spinner.
    Promise.all([fetchLeaderboard(month), fetchPastWinners()])
      .then(([rows, past]) => {
        if (cancelled) return;
        setEntries(rows);
        setWinners(past);
        setNotReady(false);
      })
      .catch(() => {
        if (!cancelled) setNotReady(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    // fetchMySubscription returns null when signed out (or before the
    // criteria SQL runs), so no separate signed-out branch is needed.
    void fetchMySubscription().then((sub) => {
      if (!cancelled) setSubscription(sub);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="pt-10 sm:pt-14">
      <section className="text-center">
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
          GOAT of <span className="text-gold">Criteria</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-zinc-400">
          The fans&apos; contest. Your picks and your arguments decide who
          takes the crown.
        </p>
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-gold">
          {monthLabel(month)}
        </p>
      </section>

      {loading ? (
        <p className="py-16 text-center text-zinc-400">Loading the board…</p>
      ) : notReady ? (
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-line bg-panel p-5 text-center">
          <p className="font-bold text-zinc-100">The first board opens soon</p>
          <p className="mt-1 text-sm text-zinc-400">
            The contest tables are still being wired up. Check back once
            subscriptions open.
          </p>
          <HowItWorks />
        </div>
      ) : (
        <>
          <div className="mx-auto mt-10 max-w-2xl">
            <CriteriaBoard entries={entries} />
            {!user && (
              <div className="mt-6 rounded-2xl border border-line bg-panel p-4 text-center">
                <p className="text-sm font-bold text-zinc-100">
                  Sign in to see where you stand
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  A free account lets you vote, comment, and climb — subscribe
                  to be ranked.
                </p>
                <a
                  href="#/signin"
                  className="mt-4 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep"
                >
                  Join free
                </a>
              </div>
            )}
            {user && <SubscribeSection subscription={subscription} userId={user.id} />}
          </div>

          <div className="mx-auto mt-8 max-w-2xl">
            <HowItWorks />
          </div>

          {winners.length > 0 && (
            <section className="mx-auto mt-10 max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight">Past crowns</h2>
              <ul className="mt-4 space-y-3">
                {winners.map((w) => (
                  <li
                    key={w.month}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3"
                  >
                    <span>
                      <span className="block text-sm font-bold text-white">
                        {w.display_name}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {monthLabel(w.month)}
                      </span>
                    </span>
                    <span className="text-sm font-black text-gold">
                      {w.points} {w.points === 1 ? "point" : "points"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
