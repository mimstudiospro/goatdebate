import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  deleteArticle,
  fetchAdminArticle,
  fetchAdminArticles,
  saveArticle,
  slugify,
  validateArticle,
} from "../lib/articles";
import type { ArticleKind, ArticleRow } from "../lib/articles";
import ArticleBody from "./ArticleBody";

const inputClass =
  "mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50";
const labelClass =
  "block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400";

/** Owner-only editor. The route is hidden from the header unless the
 * signed-in user is an admin, and the save itself is rejected by RLS
 * for anyone else — the UI gate is convenience, not the enforcement. */
export default function ArticleEditor({
  articleId,
  user,
  isAdmin,
}: {
  articleId: string | null;
  user: User | null;
  isAdmin: boolean;
}) {
  const [existing, setExisting] = useState<ArticleRow | null>(null);
  const [mine, setMine] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(articleId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<ArticleKind>("article");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [preview, setPreview] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (articleId) {
      setLoading(true);
      fetchAdminArticle(articleId)
        .then((row) => {
          if (row) {
            setExisting(row);
            setTitle(row.title);
            setSlug(row.slug);
            setSlugTouched(true);
            setKind(row.kind === "post" ? "post" : "article");
            setExcerpt(row.excerpt);
            setBody(row.body_markdown);
            setCoverUrl(row.cover_image_url ?? "");
          }
        })
        .catch((e: unknown) => {
          setLoadError(e instanceof Error ? e.message : "Failed to load the article");
        })
        .finally(() => setLoading(false));
    } else {
      fetchAdminArticles()
        .then(setMine)
        .catch(() => setMine([]));
    }
  }, [articleId, user, isAdmin]);

  if (!user) {
    return (
      <div className="py-16 text-center">
        <p className="text-xl font-black tracking-tight text-white">Sign in to write.</p>
        <p className="mt-2 text-sm text-zinc-400">Articles are written by the owner, signed in.</p>
        <a
          href="#/signin"
          className="mt-6 inline-block rounded-full bg-gold px-6 py-2 text-sm font-black uppercase tracking-wide text-black hover:bg-gold-deep"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="py-16 text-center">
        <p className="text-xl font-black tracking-tight text-white">Not your desk.</p>
        <p className="mt-2 text-sm text-zinc-400">
          Only the site owner writes articles. Everyone else just votes.
        </p>
        <a
          href="#/"
          className="mt-6 inline-block rounded-full border border-line px-5 py-2 text-sm font-bold text-zinc-200 hover:border-gold"
        >
          ← Back to the debates
        </a>
      </div>
    );
  }

  if (loading) {
    return <p className="py-16 text-center text-zinc-400">Loading the editor…</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="py-16 text-center text-red-300">
        {loadError}
      </p>
    );
  }

  if (articleId && !existing) {
    return (
      <div className="py-16 text-center">
        <p className="text-xl font-black tracking-tight text-white">No article here.</p>
        <a
          href="#/write"
          className="mt-6 inline-block rounded-full border border-line px-5 py-2 text-sm font-bold text-zinc-200 hover:border-gold"
        >
          ← Write a new one
        </a>
      </div>
    );
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
    setSaved(null);
  }

  async function save(publish: boolean) {
    if (saving || !user) return;
    const values = {
      kind,
      slug: slug.trim(),
      title,
      excerpt,
      body_markdown: body,
      cover_image_url: coverUrl,
    };
    const problem = validateArticle(values);
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(null);
    try {
      const row = await saveArticle({ ...values, id: articleId, publish }, user.id);
      setSaved(publish ? "Published — live on the site." : "Draft saved.");
      if (!articleId) {
        window.location.hash = `#/write/${row.id}`;
      } else {
        setExisting(row);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Saving failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!articleId || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteArticle(articleId);
      window.location.hash = "#/write";
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Deleting failed — try again.");
      setConfirmDelete(false);
      setDeleting(false);
    }
  }

  const isPublished = existing?.status === "published";

  return (
    <section className="mx-auto max-w-2xl pt-10 sm:pt-14">
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        {articleId ? "Edit article" : "Write something"}
      </h1>
      {existing && (
        <p className="mt-2 text-sm text-zinc-400">
          {isPublished ? (
            <>
              Published —{" "}
              <a href={`#/articles/${existing.slug}`} className="font-bold text-gold hover:underline">
                view it live
              </a>
            </>
          ) : (
            "Draft — nobody can see it yet."
          )}
        </p>
      )}

      <form
        className="mt-8 rounded-2xl border border-line bg-panel p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <label className={labelClass} htmlFor="article-title">
          Title
        </label>
        <input
          id="article-title"
          type="text"
          value={title}
          maxLength={160}
          disabled={saving}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. My Top 11 of all time"
          className={inputClass}
        />

        <label className={`${labelClass} mt-4`} htmlFor="article-slug">
          Slug
        </label>
        <input
          id="article-slug"
          type="text"
          value={slug}
          maxLength={80}
          disabled={saving}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          placeholder="my-top-11-of-all-time"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-zinc-500">The link: #/articles/{slug || "your-slug"}</p>

        <div className="mt-4 flex gap-2">
          {(["article", "post"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              disabled={saving}
              className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${
                kind === k ? "bg-gold text-black" : "border border-line text-zinc-300 hover:border-gold"
              }`}
            >
              {k === "post" ? "Post" : "Article"}
            </button>
          ))}
        </div>

        <label className={`${labelClass} mt-4`} htmlFor="article-excerpt">
          Excerpt
        </label>
        <textarea
          id="article-excerpt"
          value={excerpt}
          maxLength={300}
          rows={2}
          disabled={saving}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="One or two lines for the listing…"
          className={`${inputClass} resize-y`}
        />
        <div className="mt-1 text-right text-xs text-zinc-500">{excerpt.length}/300</div>

        <div className="mt-4 flex items-baseline justify-between">
          <label className={labelClass} htmlFor="article-body">
            Body (Markdown)
          </label>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="text-xs font-bold text-gold hover:underline"
          >
            {preview ? "Back to writing" : "Preview"}
          </button>
        </div>
        {preview ? (
          <div className="mt-2 rounded-xl border border-line bg-panel-2 px-3 py-2">
            {body.trim() ? (
              <ArticleBody bodyMarkdown={body} />
            ) : (
              <p className="text-sm text-zinc-500">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <textarea
            id="article-body"
            value={body}
            rows={14}
            disabled={saving}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(null);
            }}
            placeholder={"Write it in Markdown. # Headings, **bold**, [links](https://example.com)…"}
            className={`${inputClass} resize-y font-mono`}
          />
        )}

        <label className={`${labelClass} mt-4`} htmlFor="article-cover">
          Cover image URL (optional)
        </label>
        <input
          id="article-cover"
          type="url"
          value={coverUrl}
          disabled={saving}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
        />

        {saveError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-200"
          >
            {saveError}
          </p>
        )}
        {saved && !saveError && <p className="mt-4 text-sm text-gold">{saved}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={saving}
            className="rounded-full border border-line px-6 py-3 text-sm font-black uppercase tracking-wide text-zinc-100 transition-colors hover:border-gold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={saving}
            className="rounded-full bg-gold px-6 py-3 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep disabled:opacity-50"
          >
            {saving ? "Saving…" : isPublished ? "Save & keep published" : "Publish"}
          </button>
          {isPublished && (
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="rounded-full border border-line px-6 py-3 text-sm font-black uppercase tracking-wide text-zinc-100 transition-colors hover:border-gold disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
        </div>

        {articleId && (
          <div className="mt-6 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              className="text-sm font-bold text-red-300 hover:underline disabled:opacity-50"
            >
              {confirmDelete ? "Click again to delete for good" : "Delete this article"}
            </button>
          </div>
        )}
      </form>

      {!articleId && mine.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-black tracking-tight text-white">Your articles</h2>
          <ul className="mt-4 space-y-2">
            {mine.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3"
              >
                <a href={`#/write/${a.id}`} className="font-bold text-zinc-100 hover:text-gold">
                  {a.title || "(untitled)"}
                </a>
                <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {a.status === "published" ? "Published" : "Draft"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
