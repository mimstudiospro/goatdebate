import { describe, expect, it } from "vitest";
import {
  MAX_COMMENT_LENGTH,
  containsBlockedLanguage,
  formatCommentDate,
  normalizeAuthorName,
  validateComment,
} from "../lib/comments";

describe("comment filter", () => {
  it("lets clean comments through", () => {
    expect(containsBlockedLanguage("Messi, and it is not close.")).toBe(false);
    expect(containsBlockedLanguage("Taylor Swift's eras are unmatched.")).toBe(false);
    expect(containsBlockedLanguage("Great debate — both are legends.")).toBe(false);
  });

  it("blocks strong profanity, case-insensitive and inflected", () => {
    expect(containsBlockedLanguage("That take is shit.")).toBe(true);
    expect(containsBlockedLanguage("SHUT UP, THAT IS FUCKING WRONG")).toBe(true);
    expect(containsBlockedLanguage("what a bitch of a call")).toBe(true);
    expect(containsBlockedLanguage("you bastard")).toBe(true);
  });

  it("blocks slurs", () => {
    expect(containsBlockedLanguage("you faggot")).toBe(true);
    expect(containsBlockedLanguage("nigger")).toBe(true);
    expect(containsBlockedLanguage("what a retard")).toBe(true);
  });

  it("does not false-positive on innocent substrings (word-boundary matching)", () => {
    // "class" contains "ass", "passionate" contains "ass", "scrap" contains "crap"-like runs,
    // "assessment" contains "ass" — none is the standalone word.
    expect(containsBlockedLanguage("This is a class debate.")).toBe(false);
    expect(containsBlockedLanguage("I am passionate about this.")).toBe(false);
    expect(containsBlockedLanguage("Scrap the whole argument.")).toBe(false);
    expect(containsBlockedLanguage("My assessment: Jordan wins.")).toBe(false);
    // Deliberate exclusions: "dick" and "cock" are not blocked, so names
    // and ordinary adjectives stay allowed.
    expect(containsBlockedLanguage("Dickens is my favourite author.")).toBe(false);
    expect(containsBlockedLanguage("That was a spicy finish.")).toBe(false);
    expect(containsBlockedLanguage("Messi is cocky and I love it.")).toBe(false);
  });

  it("also checks the display name", () => {
    expect(validateComment("Fair point.", "shit poster").ok).toBe(false);
    expect(validateComment("Fair point.", "GoatFan99").ok).toBe(true);
    // Word-boundary design: a compound with no boundary ("shitposter")
    // is not caught — the trade-off for never flagging innocent words.
    expect(validateComment("Fair point.", "shitposter").ok).toBe(true);
  });
});

describe("comment validation", () => {
  it("accepts a normal comment and defaults a blank name to Anonymous", () => {
    const result = validateComment("  Messi, and it is not close. ", "  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toBe("Messi, and it is not close.");
      expect(result.authorName).toBe("Anonymous");
    }
  });

  it("rejects an empty comment", () => {
    const result = validateComment("   ", "Fan");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Write something first/);
  });

  it("rejects comments over 500 characters and accepts exactly 500", () => {
    expect(validateComment("x".repeat(MAX_COMMENT_LENGTH + 1), "Fan").ok).toBe(false);
    const exact = validateComment("x".repeat(MAX_COMMENT_LENGTH), "Fan");
    expect(exact.ok).toBe(true);
  });

  it("rejects a comment that trips the filter with a friendly message", () => {
    const result = validateComment("This is shit.", "Fan");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/didn't go through/);
      expect(result.error).toMatch(/no swearing or abusive language/);
    }
  });
});

describe("author names", () => {
  it("trims names and caps them at 40 characters", () => {
    expect(normalizeAuthorName("  GoatFan  ")).toBe("GoatFan");
    expect(normalizeAuthorName("x".repeat(50))).toHaveLength(40);
    expect(normalizeAuthorName("")).toBe("Anonymous");
  });
});

describe("comment dates", () => {
  it("formats an ISO date and returns empty for garbage", () => {
    expect(formatCommentDate("2026-11-25T12:00:00.000Z")).toBe("Nov 25, 2026");
    expect(formatCommentDate("not a date")).toBe("");
  });
});
