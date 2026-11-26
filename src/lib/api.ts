import { supabase, supabaseConfigured } from "./supabase";
import { SEED_DEBATES } from "./debates";
import type { Debate } from "./debates";
import { emptyTally, tallyFromCountRows } from "./votes";
import type { Tally } from "./votes";
import type { Comment } from "./comments";

export interface DebateWithTally {
  debate: Debate;
  tally: Tally;
  /** The contender id this browser voted for, or null. */
  myVote: string | null;
}

interface DebateRow {
  id: string;
  slug: string;
  title: string;
  sport: string;
}

interface ContenderRow {
  id: string;
  debate_id: string;
  name: string;
  tagline: string;
  sort_order: number;
}

interface CountRow {
  debate_id: string;
  contender_id: string;
  votes: number;
}

interface MyVoteRow {
  debate_id: string;
  contender_id: string;
}

/**
 * Load every debate with live tallies and this browser's votes.
 * When Supabase is unconfigured, returns the seed debates with zero
 * votes and voting disabled (the caller checks supabaseConfigured).
 *
 * Tallies come from the get_vote_counts RPC and this browser's votes
 * from get_my_votes — the client never reads the votes table directly,
 * so no voter_token ever reaches the browser.
 */
export async function fetchAllDebates(voterToken: string): Promise<DebateWithTally[]> {
  if (!supabaseConfigured || !supabase) {
    return SEED_DEBATES.map((debate) => ({ debate, tally: emptyTally(), myVote: null }));
  }

  const [
    { data: debateRows, error: debateErr },
    { data: contenderRows, error: contenderErr },
    { data: countRows, error: countErr },
    { data: myVoteRows, error: myVoteErr },
  ] = await Promise.all([
    supabase.from("debates").select("id, slug, title, sport").order("created_at", { ascending: true }),
    supabase.from("contenders").select("id, debate_id, name, tagline, sort_order").order("sort_order", { ascending: true }),
    supabase.rpc("get_vote_counts"),
    supabase.rpc("get_my_votes", { _voter: voterToken }),
  ]);

  if (debateErr || contenderErr || countErr || myVoteErr) {
    throw new Error(
      debateErr?.message ?? contenderErr?.message ?? countErr?.message ?? myVoteErr?.message ?? "Failed to load debates",
    );
  }

  const debates = (debateRows ?? []) as DebateRow[];
  const contenders = (contenderRows ?? []) as ContenderRow[];
  const counts = (countRows ?? []) as CountRow[];
  const myVotes = (myVoteRows ?? []) as MyVoteRow[];

  // Fall back to the seed debates if the database has none yet (schema applied, seeds not run).
  const source: Debate[] =
    debates.length === 0
      ? SEED_DEBATES
      : debates.map((d) => ({
          id: d.id,
          slug: d.slug,
          title: d.title,
          sport: d.sport,
          contenders: contenders
            .filter((c) => c.debate_id === d.id)
            .map((c) => ({ id: c.id, debate_id: c.debate_id, name: c.name, tagline: c.tagline, sort_order: c.sort_order })),
        }));

  return source.map((debate) => {
    const mine = myVotes.find((v) => v.debate_id === debate.id);
    return {
      debate,
      tally: tallyFromCountRows(counts.filter((c) => c.debate_id === debate.id)),
      myVote: mine ? mine.contender_id : null,
    };
  });
}

/** Cast (or change) this browser's vote. Upserted server-side by cast_vote.
 * Voting stays open to everyone — no sign-in. When signed in, the user
 * id is recorded too, so the vote can count toward the GOAT of Criteria
 * board (1 point per debate per month). The vote itself stays anonymous
 * in the UI: tallies never say who voted for whom, and the leaderboard
 * RPC only ever returns point totals. */
export async function castVote(
  debateId: string,
  contenderId: string,
  voterToken: string,
  userId?: string | null,
): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Voting is not connected yet");
  }
  const { error } = await supabase.rpc("cast_vote", {
    _debate: debateId,
    _contender: contenderId,
    _voter: voterToken,
    _user: userId ?? null,
  });
  if (error) throw new Error(error.message);
}

interface CommentRow {
  id: string;
  debate_id: string;
  user_id: string | null;
  is_mine: boolean;
  author_name: string;
  body: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
}

/**
 * Load a debate's comments, newest first. Empty when unconfigured.
 * Served by the get_comments RPC, which returns an is_mine flag plus
 * like counts computed server-side — the client never reads the
 * comments table directly, so no voter_token ever reaches the browser.
 */
export async function fetchComments(debateId: string): Promise<Comment[]> {
  if (!supabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc("get_comments", {
    _debate: debateId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentRow[];
}

/**
 * Post a comment. The caller validates (length, filter) first, and the
 * user must be signed in — comments are gated on sign-in, while voting
 * stays open to everyone. The insert carries this browser's OWN token
 * to the server — that is not a leak — and the returned row omits
 * voter_token entirely; the comment is the signed-in user's own, so
 * is_mine is true. The server enforces auth.uid() = user_id.
 */
export async function postComment(
  debateId: string,
  authorName: string,
  body: string,
  voterToken: string,
  userId: string,
): Promise<Comment> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Comments are not connected yet");
  }
  const { data, error } = await supabase
    .from("comments")
    .insert({ debate_id: debateId, voter_token: voterToken, author_name: authorName, body, user_id: userId })
    .select("id, debate_id, author_name, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  const row = data as Omit<CommentRow, "is_mine" | "user_id" | "like_count" | "liked_by_me">;
  return { ...row, user_id: userId, is_mine: true, like_count: 0, liked_by_me: false };
}

/**
 * Like another fan's comment — one like per user per comment, and the
 * like counts toward the author's GOAT of Criteria points. Signed-in
 * users only; the server enforces it. Throws with the server message.
 */
export async function likeComment(commentId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Sign in to like a comment");
  }
  const { error } = await supabase.rpc("like_comment", { _comment: commentId });
  if (error) throw new Error(error.message);
}

/** Remove your like from a comment. Signed-in users only. */
export async function unlikeComment(commentId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Sign in to like a comment");
  }
  const { error } = await supabase.rpc("unlike_comment", { _comment: commentId });
  if (error) throw new Error(error.message);
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  points: number;
  votes: number;
  comments: number;
  likes_received: number;
  first_scored_at: string;
}

/**
 * The GOAT of Criteria board for a "YYYY-MM" month — subscribers only,
 * ranked by points (see src/lib/criteria.ts for the rulebook). Served
 * by the get_leaderboard RPC. Empty when unconfigured; throws when the
 * criteria SQL has not run yet, so callers can show an honest "opening
 * soon" state instead of a fake empty board.
 */
export async function fetchLeaderboard(month: string): Promise<LeaderboardEntry[]> {
  if (!supabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc("get_leaderboard", { _month: month });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardEntry[];
}

export interface PastWinner {
  month: string;
  user_id: string;
  display_name: string;
  points: number;
}

/**
 * The crowned GOAT of Criteria for each past month — the top subscriber
 * of that month's board. Newest month first. Served by the
 * get_past_winners RPC; empty when unconfigured.
 */
export async function fetchPastWinners(): Promise<PastWinner[]> {
  if (!supabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc("get_past_winners");
  if (error) throw new Error(error.message);
  return (data ?? []) as PastWinner[];
}
