import { useCallback, useEffect, useState } from "react";
import { fetchComments, postComment } from "../lib/api";
import {
  MAX_AUTHOR_NAME_LENGTH,
  MAX_COMMENT_LENGTH,
  formatCommentDate,
  validateComment,
} from "../lib/comments";
import type { Comment } from "../lib/comments";
import { formatVotes, getVoterToken } from "../lib/votes";

export default function DebateComments({
  debateId,
  commentsEnabled,
}: {
  debateId: string;
  commentsEnabled: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const myToken = getVoterToken();

  const load = useCallback(async () => {
    try {
      setComments(await fetchComments(debateId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [debateId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the thread fresh while the page is open.
  useEffect(() => {
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function submit() {
    if (!commentsEnabled || posting) return;
    const validation = validateComment(body, name);
    if (!validation.ok) {
      setPostError(validation.error);
      return;
    }
    setPosting(true);
    setPostError(null);
    setPosted(false);
    try {
      await postComment(debateId, validation.authorName, validation.body, myToken);
      setBody("");
      setPosted(true);
      await load();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Your comment did not go through — try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight">
          Comments{" "}
          <span className="text-base font-bold text-gold">
            ({formatVotes(comments.length)})
          </span>
        </h2>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          No sign-in · Be decent
        </span>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-400">Loading the thread…</p>
      ) : loadError ? (
        <p role="alert" className="py-8 text-center text-sm text-red-300">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">
          No comments yet — say the quiet part out loud.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-2xl border border-line bg-panel p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-white">
                  {c.author_name}
                  {c.voter_token === myToken && (
                    <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                      You
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">{formatCommentDate(c.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-8 rounded-2xl border border-line bg-panel p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400" htmlFor="comment-name">
          Name (optional)
        </label>
        <input
          id="comment-name"
          type="text"
          value={name}
          maxLength={MAX_AUTHOR_NAME_LENGTH}
          disabled={!commentsEnabled || posting}
          onChange={(e) => setName(e.target.value)}
          placeholder="Anonymous"
          className="mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400" htmlFor="comment-body">
          Your take
        </label>
        <textarea
          id="comment-body"
          value={body}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          disabled={!commentsEnabled || posting}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Settle it in the comments…"
          className="mt-2 w-full resize-y rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
        />
        <div className="mt-1 text-right text-xs text-zinc-500">
          {body.length}/{MAX_COMMENT_LENGTH}
        </div>

        {postError && (
          <p role="alert" className="mt-3 rounded-xl border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-200">
            {postError}
          </p>
        )}
        {posted && !postError && (
          <p className="mt-3 text-sm text-gold">Posted — your take is on the board.</p>
        )}

        <button
          type="submit"
          disabled={!commentsEnabled || posting}
          className="mt-4 w-full rounded-full bg-gold py-3 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          {posting ? "Posting…" : "Post comment"}
        </button>
        {!commentsEnabled && (
          <p className="mt-3 text-center text-xs text-zinc-500 sm:text-left">
            Comments open once the database is connected.
          </p>
        )}
      </form>
    </section>
  );
}
