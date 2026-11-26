export interface Comment {
  id: string;
  debate_id: string;
  /** The author's user id (null for the old anonymous comments — there
   * are none live, but the column allows it). Never an email. */
  user_id: string | null;
  /** True when this comment was posted by the signed-in user. Computed
   * server-side by the get_comments RPC — the token itself never
   * leaves the database, so no visitor can see another browser's. */
  is_mine: boolean;
  author_name: string;
  body: string;
  created_at: string;
  /** Likes on this comment, and whether the signed-in user liked it. */
  like_count: number;
  liked_by_me: boolean;
}

export const MAX_COMMENT_LENGTH = 500;
export const MAX_AUTHOR_NAME_LENGTH = 40;
export const DEFAULT_AUTHOR_NAME = "Anonymous";

/**
 * Curated blocklist for the client-side moderation filter: strong
 * profanity and slurs. Matching is word-boundary based and
 * case-insensitive, so "class", "passionate" and "scrap" pass while
 * the standalone words (and their common inflections, e.g. "fucking",
 * "bitches") are caught. Deliberate exclusions, to avoid false
 * positives: "dick" (Dickens, the name Dick) and "cock" ("cocky")
 * are left out, and "spic" takes no -y suffix ("spicy" stays allowed).
 * This is a first line of defence only — it catches the common stuff;
 * a determined person can bypass any client-side filter. Comments now
 * need a sign-in, so abuse is tied to an account; reporting and hiding
 * are still to come.
 */
const FULL_SUFFIX_STEMS = [
  // Strong profanity
  "fuck",
  "motherfuck",
  "shit",
  "bitch",
  "bastard",
  "cunt",
  "pussy",
  "cocksucker",
  "whore",
  "slut",
  "asshole",
  "dumbass",
  // Slurs
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "dyke",
  "kike",
  "chink",
  "wetback",
  "retard",
];

// Stems that only take plain inflections — no -y / -ies ("spicy" must pass).
const PLAIN_STEMS = ["spic"];

const BLOCKED_RE = new RegExp(
  `\\b(?:(?:${FULL_SUFFIX_STEMS.join("|")})(?:s|es|ing|ed|er|ers|y|ies)?` +
    `|(?:${PLAIN_STEMS.join("|")})(?:s|es|ing|ed|er|ers)?)\\b`,
  "i",
);

/** True when the text contains a blocked word (word-boundary, case-insensitive). */
export function containsBlockedLanguage(text: string): boolean {
  return BLOCKED_RE.test(text);
}

/** Trim the display name; blank becomes "Anonymous"; capped at 40 chars. */
export function normalizeAuthorName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_AUTHOR_NAME;
  return trimmed.slice(0, MAX_AUTHOR_NAME_LENGTH);
}

export type CommentValidation =
  | { ok: true; body: string; authorName: string }
  | { ok: false; error: string };

/**
 * Validate a comment before it is submitted. Rejects empty comments,
 * anything over 500 characters, and anything tripping the profanity /
 * abuse filter — with a friendly plain-language reason.
 */
export function validateComment(body: string, authorName: string): CommentValidation {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, error: "Write something first — an empty comment settles nothing." };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Keep it to ${MAX_COMMENT_LENGTH} characters or fewer.` };
  }
  if (containsBlockedLanguage(trimmed) || containsBlockedLanguage(authorName)) {
    return {
      ok: false,
      error: "That one didn't go through — no swearing or abusive language here. Clean it up and try again.",
    };
  }
  return { ok: true, body: trimmed, authorName: normalizeAuthorName(authorName) };
}

export function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
