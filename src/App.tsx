import { useEffect, useState } from "react";
import { fetchAllDebates } from "./lib/api";
import type { DebateWithTally } from "./lib/api";
import { consumeOAuthReturn, fetchIsAdmin, getDisplayName, signOut, useSession } from "./lib/auth";
import { parseHash } from "./lib/routes";
import type { Route } from "./lib/routes";
import { supabaseConfigured } from "./lib/supabase";
import { getVoterToken } from "./lib/votes";
import DebateCard from "./components/DebateCard";
import DebatePage from "./components/DebatePage";
import SignInPage from "./components/SignInPage";
import ArticleList from "./components/ArticleList";
import ArticlePage from "./components/ArticlePage";
import ArticleEditor from "./components/ArticleEditor";
import CriteriaPage from "./components/CriteriaPage";
import { CriteriaHomeSection } from "./components/CriteriaBoard";

function routeFromHash(): Route {
  return parseHash(window.location.hash);
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [items, setItems] = useState<DebateWithTally[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { user } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

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

  // After a Google OAuth callback lands on the bare origin (no hash),
  // take the user back to the page they were on when they clicked
  // "Continue with Google" — or home when there was none. Only when
  // the URL has no hash: a stale key from an abandoned attempt must
  // not yank the user away from wherever they are.
  useEffect(() => {
    if (!user) return;
    const hash = window.location.hash;
    if (hash && hash !== "#/" && hash !== "#/signin") return;
    const backTo = consumeOAuthReturn();
    if (backTo && backTo !== hash) {
      window.location.hash = backTo;
    }
  }, [user]);

  // Admin status is a UI convenience only — RLS enforces article
  // writes server-side regardless of what the header shows.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void fetchIsAdmin(user?.id ?? null).then((admin) => {
      if (!cancelled) setIsAdmin(admin);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-canvas text-zinc-100">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
          <a href="#/" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-gold">GOAT</span> DEBATE
            </span>
          </a>
          <nav className="flex items-center gap-4 text-sm font-bold">
            <a href="#/criteria" className="text-zinc-300 hover:text-gold">
              Criteria
            </a>
            <a href="#/articles" className="text-zinc-300 hover:text-gold">
              Articles
            </a>
            {isAdmin && (
              <a href="#/write" className="text-zinc-300 hover:text-gold">
                Write
              </a>
            )}
            {user ? (
              <>
                <span className="hidden max-w-40 truncate text-xs text-zinc-500 sm:block" title={user.email}>
                  {getDisplayName(user)}
                </span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="text-zinc-300 hover:text-gold"
                >
                  Sign out
                </button>
              </>
            ) : (
              <a href="#/signin" className="text-zinc-300 hover:text-gold">
                Sign in
              </a>
            )}
          </nav>
          <span className="hidden w-full text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 lg:block">
            Settle it. Vote for your GOAT.
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {route.view === "debate" ? (
          <div className="pt-6">
            <DebatePage slug={route.slug} votingEnabled={supabaseConfigured} />
          </div>
        ) : route.view === "signin" ? (
          <SignInPage />
        ) : route.view === "criteria" ? (
          <CriteriaPage />
        ) : route.view === "articles" ? (
          <ArticleList />
        ) : route.view === "article" ? (
          <div className="pt-6">
            <ArticlePage slug={route.slug} />
          </div>
        ) : route.view === "write" || route.view === "write-edit" ? (
          <ArticleEditor
            articleId={route.view === "write-edit" ? route.id : null}
            user={user}
            isAdmin={isAdmin}
          />
        ) : (
          <>
            <section className="pb-8 pt-10 text-center sm:pt-14">
              <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
                WHO IS THE <span className="text-gold">GOAT?</span>
              </h1>
              <p className="mx-auto mt-4 max-w-md text-lg text-zinc-400">
                The Greatest GOAT Debate Website of All Time
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Ten debates. Zero mercy. One vote per browser — make it count.
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
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((item) => (
                    <DebateCard key={item.debate.id} item={item} />
                  ))}
                </div>
                <CriteriaHomeSection />
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-500 sm:flex-row">
          <span>
            <span className="font-black text-zinc-300">GOAT Debate</span> — one vote per
            browser, per debate. Change your mind anytime.
            <span className="text-zinc-400"> No refunds on bad takes.</span>
          </span>
          <span className="flex items-center gap-4">
            <a href="#/criteria" className="font-bold text-zinc-400 hover:text-gold">
              GOAT of Criteria
            </a>
            <a href="#/articles" className="font-bold text-zinc-400 hover:text-gold">
              Articles
            </a>
            <span>© {new Date().getFullYear()} GOAT Debate</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
