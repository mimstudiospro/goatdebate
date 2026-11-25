import { useCallback, useEffect, useState } from "react";
import { castVote, fetchAllDebates } from "../lib/api";
import type { DebateWithTally } from "../lib/api";
import { computePercentages, formatVotes, getVoterToken } from "../lib/votes";
import { initials } from "../lib/debates";

export default function DebatePage({
  slug,
  votingEnabled,
}: {
  slug: string;
  votingEnabled: boolean;
}) {
  const [item, setItem] = useState<DebateWithTally | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await fetchAllDebates(getVoterToken());
      const found = all.find((d) => d.debate.slug === slug);
      setItem(found ?? null);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load this debate");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Live results: refetch every 10s while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function vote(contenderId: string) {
    if (!votingEnabled || voting || !item) return;
    setVoting(true);
    setVoteError(null);
    try {
      await castVote(item.debate.id, contenderId, getVoterToken());
      await load();
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Your vote did not go through — try again.");
    } finally {
      setVoting(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-zinc-400">Loading the debate…</p>;
  }
  if (loadError || !item) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-bold">{loadError ?? "Debate not found."}</p>
        <a href="#/" className="mt-4 inline-block text-gold underline">
          ← Back to all debates
        </a>
      </div>
    );
  }

  const { debate, tally, myVote } = item;
  const [a, b] = debate.contenders;
  const pcts = computePercentages(tally, [a.id, b.id]);
  const pctById = new Map(pcts.map((p) => [p.contenderId, p]));

  const card = (c: typeof a) => {
    const pct = pctById.get(c.id);
    const isMine = myVote === c.id;
    const other = c.id === a.id ? b : a;
    return (
      <div
        key={c.id}
        className={`rise rounded-2xl border p-6 ${
          isMine ? "border-gold bg-panel-2" : "border-line bg-panel"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-2xl font-black text-black">
            {initials(c.name)}
          </div>
          {isMine && (
            <span className="rounded-full bg-gold px-3 py-1 text-[11px] font-black uppercase tracking-wider text-black">
              Your vote
            </span>
          )}
        </div>
        <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {c.name}
        </h2>
        <p className="mt-1 text-zinc-400">{c.tagline}</p>

        <button
          type="button"
          disabled={!votingEnabled || voting}
          onClick={() => void vote(c.id)}
          className={`mt-5 w-full rounded-full py-3 text-base font-black uppercase tracking-wide transition-colors ${
            isMine
              ? "bg-zinc-700 text-zinc-300"
              : "bg-gold text-black hover:bg-gold-deep"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isMine ? "Voted — tap to switch" : voting ? "Voting…" : `Vote ${c.name.split(" ").pop()}`}
        </button>
        {isMine && (
          <p className="mt-2 text-center text-xs text-zinc-400">
            Tap {other.name.split(" ").pop()} below to switch your vote.
          </p>
        )}

        <div className="mt-6">
          <div className="flex justify-between text-sm font-bold">
            <span>{formatVotes(pct?.votes ?? 0)} votes</span>
            <span className={isMine ? "text-gold" : "text-zinc-300"}>{pct?.percent ?? 0}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-panel-2">
            <div
              className={`result-bar h-full ${isMine ? "bg-gold" : "bg-zinc-400"}`}
              style={{ width: `${pct?.percent ?? 0}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rise">
      <a href="#/" className="text-sm font-semibold text-zinc-400 hover:text-gold">
        ← All debates
      </a>

      <div className="mt-4 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          {debate.sport}
        </span>
        <h1 className="mt-2 text-4xl font-black leading-none tracking-tight sm:text-5xl">
          {debate.title}
        </h1>
        <p className="mt-3 text-zinc-400">
          {formatVotes(tally.total)} {tally.total === 1 ? "vote" : "votes"} so far
          {myVote ? " · you have voted" : " · have your say"}
        </p>
      </div>

      {!votingEnabled && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-panel px-4 py-3 text-center text-sm text-zinc-300">
          Voting opens once the database is connected.
        </p>
      )}
      {voteError && (
        <p role="alert" className="mx-auto mt-6 max-w-md rounded-xl border border-red-500/50 bg-red-950 px-4 py-3 text-center text-sm text-red-200">
          {voteError}
        </p>
      )}

      <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-gold bg-canvas text-sm font-black text-gold sm:flex">
          VS
        </div>
        {card(a)}
        {card(b)}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-full border border-line bg-panel px-6 py-3 text-sm font-bold hover:border-gold/60"
        >
          {copied ? "Link copied ✓" : "Share this debate"}
        </button>
        <a href="#/" className="text-sm font-semibold text-zinc-400 hover:text-gold">
          See all debates →
        </a>
      </div>
    </div>
  );
}
