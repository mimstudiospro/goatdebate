import { useEffect, useState } from "react";
import { fetchPublishedArticle, formatArticleDate } from "../lib/articles";
import type { ArticleRow } from "../lib/articles";
import ArticleBody from "./ArticleBody";

export default function ArticlePage({ slug }: { slug: string }) {
  const [article, setArticle] = useState<ArticleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublishedArticle(slug)
      .then((row) => {
        if (!cancelled) setArticle(row);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load the article");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <p className="py-16 text-center text-zinc-400">Loading the article…</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="py-16 text-center text-red-300">
        {loadError}
      </p>
    );
  }

  if (!article) {
    return (
      <div className="py-16 text-center">
        <p className="text-xl font-black tracking-tight text-white">No article here.</p>
        <p className="mt-2 text-sm text-zinc-400">
          It may be a draft, or the link may be wrong.
        </p>
        <a
          href="#/articles"
          className="mt-6 inline-block rounded-full border border-line px-5 py-2 text-sm font-bold text-zinc-200 hover:border-gold"
        >
          ← All articles
        </a>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl pt-10 sm:pt-14">
      <a
        href="#/articles"
        className="text-sm font-bold text-zinc-400 hover:text-gold"
      >
        ← All articles
      </a>
      <div className="mt-6 flex items-baseline justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-gold">
          {article.kind === "post" ? "Post" : "Article"}
        </span>
        <span className="shrink-0 text-xs text-zinc-500">
          {formatArticleDate(article.published_at ?? article.created_at)}
        </span>
      </div>
      <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
        {article.title}
      </h1>
      {article.excerpt && (
        <p className="mt-4 text-lg leading-relaxed text-zinc-400">{article.excerpt}</p>
      )}
      {article.cover_image_url && (
        <img
          src={article.cover_image_url}
          alt=""
          className="mt-6 w-full rounded-2xl border border-line"
        />
      )}
      <div className="mt-8 border-t border-line pt-8">
        <ArticleBody bodyMarkdown={article.body_markdown} />
      </div>
      <p className="mt-10 border-t border-line pt-6 text-center text-sm text-zinc-500">
        Written by the house.{" "}
        <a href="#/" className="font-bold text-gold hover:underline">
          Back to the debates →
        </a>
      </p>
    </article>
  );
}
