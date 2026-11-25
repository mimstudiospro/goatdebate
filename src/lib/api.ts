import { supabase, supabaseConfigured } from "./supabase";
import { SEED_DEBATES } from "./debates";
import type { Debate } from "./debates";
import { emptyTally, tallyFromVotes } from "./votes";
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

interface VoteRow {
  debate_id: string;
  contender_id: string;
  voter_token: string;
}

/**
 * Load every debate with live tallies and this browser's votes.
 * When Supabase is unconfigured, returns the seed debates with zero
 * votes and voting disabled (the caller checks supabaseConfigured).
 */
export async function fetchAllDebates(voterToken: string): Promise<DebateWithTally[]> {
  if (!supabaseConfigured || !supabase) {
    return SEED_DEBATES.map((debate) => ({ debate, tally: emptyTally(), myVote: null }));
  }

  const [{ data: debateRows, error: debateErr }, { data: contenderRows, error: contenderErr }, { data: voteRows, error: voteErr }] =
    await Promise.all([
      supabase.from("debates").select("id, slug, title, sport").order("created_at", { ascending: true }),
      supabase.from("contenders").select("id, debate_id, name, tagline, sort_order").order("sort_order", { ascending: true }),
      supabase.from("votes").select("debate_id, contender_id, voter_token"),
    ]);

  if (debateErr || contenderErr || voteErr) {
    throw new Error(debateErr?.message ?? contenderErr?.message ?? voteErr?.message ?? "Failed to load debates");
  }

  const debates = (debateRows ?? []) as DebateRow[];
  const contenders = (contenderRows ?? []) as ContenderRow[];
  const votes = (voteRows ?? []) as VoteRow[];

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
    const debateVotes = votes.filter((v) => v.debate_id === debate.id);
    const mine = debateVotes.find((v) => v.voter_token === voterToken);
    return {
      debate,
      tally: tallyFromVotes(debateVotes.map((v) => ({ contender_id: v.contender_id }))),
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
  voter_token: string;
  author_name: string;
  body: string;
  created_at: string;
}

/** Load a debate's comments, newest first. Empty when unconfigured. */
export async function fetchComments(debateId: string): Promise<Comment[]> {
  if (!supabaseConfigured || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("comments")
    .select("id, debate_id, voter_token, author_name, body, created_at")
    .eq("debate_id", debateId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentRow[];
}

/** Post a comment. The caller validates (length, filter) first. */
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
    .select("id, debate_id, voter_token, author_name, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as CommentRow;
}
