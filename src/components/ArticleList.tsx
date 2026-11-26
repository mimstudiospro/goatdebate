import { useEffect, useState } from "react";
import { fetchPublishedArticles, formatArticleDate } from "../lib/articles";
import type { ArticleKind, ArticleRow } from "../lib/articles";

type Filter = "all" | ArticleKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "article", label: "Articles" },
  { key: "post", label: "Posts" },
];

export default function ArticleList() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    fetchPublishedArticles()
      .then((rows) => {
        if (!cancelled) setArticles(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load articles");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = filter === "all" ? articles : articles.filter((a) => a.kind === filter);

  return (
    <section className="pt-10 sm:pt-14">
      <h1 className="text-center text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
        From the <span className="text-gold">studio</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-center text-sm text-zinc-400">
        Debate analysis, Top 11s, and the occasional strong opinion. Written by the
        house, not the crowd.
      </p>

      <div className="mt-8 flex justify-center gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${
              filter === key
                ? "bg-gold text-black"
                : "border border-line bg-panel text-zinc-300 hover:border-gold"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-zinc-400">Loading the articles…</p>
      ) : loadError ? (
        <p role="alert" className="py-16 text-center text-red-300">
          {loadError}
        </p>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-400">
          No {filter === "all" ? "articles" : filter === "article" ? "articles" : "posts"} yet —
          check back soon.
        </p>
      ) : (
        <ul className="mx-auto mt-8 max-w-2xl space-y-4">
          {shown.map((article) => (
            <li key={article.id}>
              <a
                href={`#/articles/${article.slug}`}
                className="block rounded-2xl border border-line bg-panel p-5 transition-colors hover:border-gold"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-gold">
                    {article.kind === "post" ? "Post" : "Article"}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatArticleDate(article.published_at ?? article.created_at)}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                  {article.title}
                </h2>
                {article.excerpt && (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{article.excerpt}</p>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
