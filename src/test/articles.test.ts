/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  renderArticleMarkdown,
  slugify,
  validateArticle,
} from "../lib/articles";
import type { ArticleFormValues } from "../lib/articles";
import { parseHash } from "../lib/routes";

const validValues: ArticleFormValues = {
  kind: "article",
  slug: "my-top-11-of-all-time",
  title: "My Top 11 of all time",
  excerpt: "Eleven names, no mercy.",
  body_markdown: "# Hello\n\nSome **bold** text.",
  cover_image_url: "",
};

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugify("My Top 11 of All Time")).toBe("my-top-11-of-all-time");
  });

  it("strips accents and punctuation", () => {
    expect(slugify("Beyoncé vs Taylor Swift!")).toBe("beyonce-vs-taylor-swift");
  });

  it("falls back to untitled when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("")).toBe("untitled");
  });

  it("caps the slug at 80 characters without a trailing hyphen", () => {
    const slug = slugify("a ".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).not.toMatch(/-$/);
  });
});

describe("validateArticle", () => {
  it("accepts a valid article", () => {
    expect(validateArticle(validValues)).toBeNull();
  });

  it("accepts a valid post with a secure cover URL", () => {
    expect(
      validateArticle({
        ...validValues,
        kind: "post",
        cover_image_url: "https://example.com/cover.jpg",
      }),
    ).toBeNull();
  });

  it("rejects a bad slug", () => {
    expect(validateArticle({ ...validValues, slug: "My Slug!" })).not.toBeNull();
    expect(validateArticle({ ...validValues, slug: "" })).not.toBeNull();
  });

  it("rejects an empty or over-long title", () => {
    expect(validateArticle({ ...validValues, title: "  " })).not.toBeNull();
    expect(validateArticle({ ...validValues, title: "x".repeat(161) })).not.toBeNull();
  });

  it("rejects an over-long excerpt", () => {
    expect(validateArticle({ ...validValues, excerpt: "x".repeat(301) })).not.toBeNull();
  });

  it("rejects a non-https or garbage cover URL", () => {
    expect(
      validateArticle({ ...validValues, cover_image_url: "http://example.com/cover.jpg" }),
    ).not.toBeNull();
    expect(validateArticle({ ...validValues, cover_image_url: "not a url" })).not.toBeNull();
  });
});

describe("renderArticleMarkdown", () => {
  it("renders headings, bold text, and links", () => {
    const html = renderArticleMarkdown("# Title\n\nSome **bold** text and [a link](https://example.com).");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
  });

  it("strips scripts, javascript: links, and event handlers", () => {
    const html = renderArticleMarkdown(
      '<script>alert("x")</script>\n\n[click](javascript:alert(1))\n\n<img src="x" onerror="alert(2)">',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
  });
});

describe("parseHash", () => {
  it("routes home, signin, and articles", () => {
    expect(parseHash("#/")).toEqual({ view: "home" });
    expect(parseHash("")).toEqual({ view: "home" });
    expect(parseHash("#/signin")).toEqual({ view: "signin" });
    expect(parseHash("#/articles")).toEqual({ view: "articles" });
  });

  it("routes debate and article slugs", () => {
    expect(parseHash("#/debate/messi-vs-ronaldo")).toEqual({
      view: "debate",
      slug: "messi-vs-ronaldo",
    });
    expect(parseHash("#/articles/my-top-11")).toEqual({
      view: "article",
      slug: "my-top-11",
    });
  });

  it("routes the editor, new and by id", () => {
    expect(parseHash("#/write")).toEqual({ view: "write" });
    expect(parseHash("#/write/11111111-1111-4111-8111-111111111111")).toEqual({
      view: "write-edit",
      id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("falls back to home for unknown hashes", () => {
    expect(parseHash("#/nope")).toEqual({ view: "home" });
    expect(parseHash("#/write/not-a-uuid")).toEqual({ view: "home" });
    expect(parseHash("#/articles/")).toEqual({ view: "home" });
  });
});
