import { computePercentages, formatVotes, leaderId } from "../lib/votes";
import type { DebateWithTally } from "../lib/api";

export default function DebateCard({ item }: { item: DebateWithTally }) {
  const { debate, tally } = item;
  const [a, b] = debate.contenders;
  const leader = leaderId(tally, [a.id, b.id]);
  const leaderName = leader === a.id ? a.name : leader === b.id ? b.name : null;
  const pcts = computePercentages(tally, [a.id, b.id]);

  return (
    <a
      href={`#/debate/${debate.slug}`}
      className="rise group block rounded-2xl border border-line bg-panel p-5 transition-colors hover:border-gold/60"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
          {debate.sport}
        </span>
        <span className="text-xs text-zinc-500">{formatVotes(tally.total)} votes</span>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xl font-black leading-tight tracking-tight">{a.name}</div>
          <div className="mt-1 truncate text-sm text-zinc-400">{a.tagline}</div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel-2 text-xs font-black text-gold">
          VS
        </div>
        <div className="min-w-0 text-right">
          <div className="text-xl font-black leading-tight tracking-tight">{b.name}</div>
          <div className="mt-1 truncate text-sm text-zinc-400">{b.tagline}</div>
        </div>
      </div>

      {/* Live split bar */}
      <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-panel-2">
        <div className="result-bar h-full bg-gold" style={{ width: `${pcts[0].percent}%` }} />
        <div className="result-bar h-full bg-zinc-500" style={{ width: `${pcts[1].percent}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold">
        <span className={leader === a.id ? "text-gold" : "text-zinc-500"}>
          {pcts[0].percent}% {a.name.split(" ").pop()}
        </span>
        <span className={leader === b.id ? "text-gold" : "text-zinc-500"}>
          {pcts[1].percent}% {b.name.split(" ").pop()}
        </span>
      </div>

      <div className="mt-4 border-t border-line pt-3 text-sm">
        {tally.total === 0 ? (
          <span className="text-zinc-400">No votes yet — the floor is yours. End this argument.</span>
        ) : leaderName ? (
          <span>
            <span className="font-bold text-white">{leaderName}</span> leads ·{" "}
            <span className="text-gold">Vote now →</span>
          </span>
        ) : (
          <span>
            Dead even · <span className="text-gold">Your vote breaks it →</span>
          </span>
        )}
      </div>
    </a>
  );
}
