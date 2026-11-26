import { useState } from "react";
import { signInWithPassword } from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";

/** Email + password sign-in. The owner account is created in the
 * Supabase dashboard; there is no public sign-up here. */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (signingIn) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      setDone(true);
      window.location.hash = "#/write";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed — try again.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <section className="mx-auto max-w-md pt-10 sm:pt-14">
      <h1 className="text-center text-4xl font-black tracking-tight">
        Sign <span className="text-gold">in</span>
      </h1>
      <p className="mt-3 text-center text-sm text-zinc-400">
        Sign in to write articles and posts. Everyone else just votes.
      </p>

      <form
        className="mt-8 rounded-2xl border border-line bg-panel p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label
          className="block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400"
          htmlFor="signin-email"
        >
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          value={email}
          disabled={signingIn || !supabaseConfigured}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
        />

        <label
          className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400"
          htmlFor="signin-password"
        >
          Password
        </label>
        <input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={signingIn || !supabaseConfigured}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          className="mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
        />

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        {done && !error && <p className="mt-3 text-sm text-gold">Signed in — taking you to the editor.</p>}

        <button
          type="submit"
          disabled={signingIn || !supabaseConfigured}
          className="mt-5 w-full rounded-full bg-gold py-3 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {signingIn ? "Signing in…" : "Sign in"}
        </button>
        {!supabaseConfigured && (
          <p className="mt-3 text-center text-xs text-zinc-500">
            Sign-in opens once the database is connected.
          </p>
        )}
      </form>
    </section>
  );
}
