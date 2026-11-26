import DOMPurify from "dompurify";
import { marked } from "marked";
import { supabase, supabaseConfigured } from "./supabase";

/** Long articles and short posts are one system, one editor. */
export type ArticleKind = "article" | "post";

export const ARTICLE_KINDS: ArticleKind[] = ["article", "post"];

export type ArticleRow = {
  id: string;
  kind: string;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  cover_image_url: string | null;
  status: string;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const MAX_TITLE_LENGTH = 160;
export const MAX_EXCERPT_LENGTH = 300;
export const MAX_SLUG_LENGTH = 80;

/**
 * URL slug from a title: lowercase, words joined with hyphens, nothing
 * else. Falls back to "untitled" when the title has no usable words.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

export interface ArticleFormValues {
  kind: ArticleKind;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  cover_image_url: string;
}

/** Validate editor values against the `articles` table constraints.
 * Returns the first problem, or null when the values are fine. */
export function validateArticle(values: ArticleFormValues): string | null {
  if (values.kind !== "article" && values.kind !== "post") {
    return "Pick Article or Post.";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) || values.slug.length > MAX_SLUG_LENGTH) {
    return "Use lowercase letters, numbers, and hyphens for the slug.";
  }
  const title = values.title.trim();
  if (title.length < 1 || title.length > MAX_TITLE_LENGTH) {
    return "Give it a title (up to 160 characters).";
  }
  if (values.excerpt.trim().length > MAX_EXCERPT_LENGTH) {
    return "Keep the excerpt under 300 characters.";
  }
  const cover = values.cover_image_url.trim();
  if (cover) {
    try {
      if (new URL(cover).protocol !== "https:") {
        return "Use a secure https image URL for the cover.";
      }
    } catch {
      return "That cover URL does not look like a valid link.";
    }
  }
  return null;
}

/**
 * Render article Markdown to HTML. The output ALWAYS goes through
 * DOMPurify — raw HTML in the body (script tags, javascript: links,
 * event handlers) is stripped before anything reaches the page.
 * Without a DOM (tests in a node environment) this returns "" — article
 * bodies only ever render in the browser, after the article is fetched,
 * so nothing is lost.
 */
export function renderArticleMarkdown(bodyMarkdown: string): string {
  if (typeof window === "undefined") return "";
  const raw = marked.parse(bodyMarkdown ?? "", { breaks: true });
  const html = typeof raw === "string" ? raw : "";
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/** Short date for listings: "Nov 25, 2026". */
export function formatArticleDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function requireClient() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Articles are not connected yet");
  }
  return supabase;
}

/** Published articles, newest first. Public read. */
export async function fetchPublishedArticles(): Promise<ArticleRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArticleRow[];
}

/** One published article by slug, or null. Public read. */
export async function fetchPublishedArticle(slug: string): Promise<ArticleRow | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ArticleRow | null;
}

/** Every article, drafts included, newest-edited first. Admin only —
 * the RLS policy rejects anyone else. */
export async function fetchAdminArticles(): Promise<ArticleRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("articles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ArticleRow[];
}

/** One article by id, draft or published. Admin only. */
export async function fetchAdminArticle(id: string): Promise<ArticleRow | null> {
  const client = requireClient();
  const { data, error } = await client.from("articles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ArticleRow | null;
}

export interface SaveArticleInput extends ArticleFormValues {
  /** Null for a new article; set when editing. */
  id: string | null;
  /** True when publishing now; false saves as draft. */
  publish: boolean;
}

/**
 * Insert or update an article. Publishing sets published_at (first
 * publish only); unpublishing clears it. The author is recorded from
 * the signed-in user. RLS rejects non-admins.
 */
export async function saveArticle(input: SaveArticleInput, authorId: string): Promise<ArticleRow> {
  const client = requireClient();
  const values = {
    kind: input.kind,
    slug: input.slug.trim(),
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    body_markdown: input.body_markdown,
    cover_image_url: input.cover_image_url.trim() || null,
    status: input.publish ? "published" : "draft",
    author_id: authorId,
    published_at: null as string | null,
  };
  if (input.publish) {
    if (input.id) {
      // Keep the original publish date when re-publishing an edit.
      const existing = await fetchAdminArticle(input.id);
      values.published_at = existing?.published_at ?? new Date().toISOString();
    } else {
      values.published_at = new Date().toISOString();
    }
  }
  if (input.id) {
    const { data, error } = await client
      .from("articles")
      .update(values)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as ArticleRow;
  }
  const { data, error } = await client.from("articles").insert(values).select("*").single();
  if (error) throw new Error(error.message);
  return data as ArticleRow;
}

/** Delete an article. Admin only — RLS rejects anyone else. */
export async function deleteArticle(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
