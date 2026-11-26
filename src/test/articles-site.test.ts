import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every GOAT articles query must stay inside the shared main-project
 * articles table's site = 'goat' slice, and every GOAT write must set
 * it — otherwise the three sites would see each other's articles.
 * These tests record the query-builder calls against a chainable stub
 * instead of a live database.
 */
const mockState = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("../lib/supabase", () => {
  const chainable: unknown = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (typeof prop === "symbol") return undefined;
        if (prop === "then") {
          return (resolve: (value: unknown) => void) =>
            resolve({ data: [], error: null });
        }
        return (...args: unknown[]) => {
          mockState.calls.push([prop as string, ...args]);
          return chainable;
        };
      },
    },
  );
  return {
    supabase: {
      from: (...args: unknown[]) => {
        mockState.calls.push(["from", ...args]);
        return chainable;
      },
    },
    supabaseConfigured: true,
  };
});

import {
  GOAT_SITE,
  fetchAdminArticle,
  fetchAdminArticles,
  fetchPublishedArticle,
  fetchPublishedArticles,
  saveArticle,
} from "../lib/articles";

function eqPairs(): Array<[unknown, unknown]> {
  return mockState.calls
    .filter(([method]) => method === "eq")
    .map(([, column, value]) => [column, value]);
}

describe("GOAT articles stay in the site = 'goat' slice", () => {
  beforeEach(() => {
    mockState.calls.length = 0;
  });

  it("GOAT_SITE is 'goat'", () => {
    expect(GOAT_SITE).toBe("goat");
  });

  it("fetchPublishedArticles filters on site and published status", async () => {
    await fetchPublishedArticles();
    expect(mockState.calls[0]).toEqual(["from", "articles"]);
    const eqs = eqPairs();
    expect(eqs).toContainEqual(["site", "goat"]);
    expect(eqs).toContainEqual(["status", "published"]);
  });

  it("fetchPublishedArticle filters on site and slug", async () => {
    await fetchPublishedArticle("my-top-11-of-all-time");
    const eqs = eqPairs();
    expect(eqs).toContainEqual(["site", "goat"]);
    expect(eqs).toContainEqual(["slug", "my-top-11-of-all-time"]);
  });

  it("fetchAdminArticles filters on site", async () => {
    await fetchAdminArticles();
    expect(eqPairs()).toContainEqual(["site", "goat"]);
  });

  it("fetchAdminArticle filters on site and id", async () => {
    await fetchAdminArticle("article-id-1");
    const eqs = eqPairs();
    expect(eqs).toContainEqual(["site", "goat"]);
    expect(eqs).toContainEqual(["id", "article-id-1"]);
  });

  it("saveArticle writes site 'goat' on insert", async () => {
    await saveArticle(
      {
        id: null,
        kind: "article",
        slug: "my-top-11-of-all-time",
        title: "My Top 11 of all time",
        excerpt: "",
        body_markdown: "# Hello",
        cover_image_url: "",
        publish: false,
      },
      "author-1",
    );
    const insert = mockState.calls.find(([method]) => method === "insert");
    expect(insert).toBeDefined();
    const values = insert?.[1] as Record<string, unknown>;
    expect(values.site).toBe("goat");
    expect(values.slug).toBe("my-top-11-of-all-time");
    expect(values.author_id).toBe("author-1");
  });
});
