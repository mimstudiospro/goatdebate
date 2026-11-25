import { useEffect, useState } from "react";
import { fetchAllDebates } from "./lib/api";
import type { DebateWithTally } from "./lib/api";
import { supabaseConfigured } from "./lib/supabase";
import { getVoterToken } from "./lib/votes";
import DebateCard from "./components/DebateCard";
import DebatePage from "./components/DebatePage";

function routeFromHash(): { view: "home" } | { view: "debate"; slug: string } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const match = hash.match(/^debate\/([a-z0-9-]+)$/);
  if (match) return { view: "debate", slug: match[1] };
  return { view: "home" };
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [items, setItems] = useState<DebateWithTally[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAllDebates(getVoterToken())
      .then((all) => {
        if (!cancelled) setItems(all);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load debates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-zinc-100">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="#/" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-gold">GOAT</span> DEBATE
            </span>
          </a>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:block">
            Settle it. Vote for your GOAT.
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {route.view === "debate" ? (
          <div className="pt-6">
            <DebatePage slug={route.slug} votingEnabled={supabaseConfigured} />
          </div>
        ) : (
          <>
            <section className="pb-8 pt-10 text-center sm:pt-14">
              <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
                WHO IS THE <span className="text-gold">GOAT?</span>
              </h1>
              <p className="mx-auto mt-4 max-w-md text-lg text-zinc-400">
                Settle it. Vote for your GOAT.
              </p>
              {!supabaseConfigured && (
                <p className="mx-auto mt-5 max-w-md rounded-xl border border-line bg-panel px-4 py-3 text-sm text-zinc-300">
                  Voting opens once the database is connected.
                </p>
              )}
            </section>

            {loading ? (
              <p className="py-16 text-center text-zinc-400">Loading the debates…</p>
            ) : loadError ? (
              <p role="alert" className="py-16 text-center text-red-300">
                {loadError}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <DebateCard key={item.debate.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-500 sm:flex-row">
          <span>
            <span className="font-black text-zinc-300">GOAT Debate</span> — one vote per
            browser, per debate. Change your mind anytime.
          </span>
          <span>© {new Date().getFullYear()} GOAT Debate</span>
        </div>
      </footer>
    </div>
  );
}
