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

/** Cast (or change) this browser's vote. Upserted server-side by cast_vote. */
export async function castVote(debateId: string, contenderId: string, voterToken: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Voting is not connected yet");
  }
  const { error } = await supabase.rpc("cast_vote", {
    _debate: debateId,
    _contender: contenderId,
    _voter: voterToken,
  });
  if (error) throw new Error(error.message);
}

interface CommentRow {
  id: string;
  debate_id: string;
  is_mine: boolean;
  author_name: string;
  body: string;
  created_at: string;
}

/**
 * Load a debate's comments, newest first. Empty when unconfigured.
 * Served by the get_comments RPC, which returns an is_mine flag
 * computed server-side — the client never reads the comments table
 * directly, so no voter_token ever reaches the browser.
 */
export async function fetchComments(debateId: string, voterToken: string): Promise<Comment[]> {
  if (!supabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase.rpc("get_comments", {
    _debate: debateId,
    _voter: voterToken,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentRow[];
}

/**
 * Post a comment. The caller validates (length, filter) first.
 * The insert carries this browser's OWN token to the server — that is
 * not a leak — and the returned row omits voter_token entirely; the
 * comment is this browser's own, so is_mine is true.
 */
export async function postComment(
  debateId: string,
  authorName: string,
  body: string,
  voterToken: string,
): Promise<Comment> {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Comments are not connected yet");
  }
  const { data, error } = await supabase
    .from("comments")
    .insert({ debate_id: debateId, voter_token: voterToken, author_name: authorName, body })
    .select("id, debate_id, author_name, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  const row = data as Omit<CommentRow, "is_mine">;
  return { ...row, is_mine: true };
}
