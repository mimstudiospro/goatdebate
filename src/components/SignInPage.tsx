import { useState } from "react";
import {
  consumeOAuthReturn,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "../lib/auth";
import { supabaseConfigured } from "../lib/supabase";
import { MAX_AUTHOR_NAME_LENGTH, normalizeAuthorName } from "../lib/comments";

/** Google "G" mark for the Continue with Google button. */
function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/**
 * Sign in or create a free fan account. A free account lets fans
 * comment and enter the GOAT of Criteria contest — voting stays open
 * to everyone, signed in or not. Writing articles stays owner-only:
 * the Write link only appears for the admin, and the server enforces
 * it regardless of what the UI shows.
 */
export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function goHome() {
    window.location.hash = consumeOAuthReturn() ?? "#/";
  }

  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup") {
      const name = normalizeAuthorName(displayName);
      if (name === "Anonymous") {
        setError("Pick a display name — that's how the leaderboard knows you.");
        return;
      }
      if (password.length < 6) {
        setError("Your password needs at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("The two passwords don't match.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUpWithPassword(
          email.trim(),
          password,
          normalizeAuthorName(displayName),
        );
        if (needsConfirmation) {
          setNotice(
            "You're in — check your email and click the confirmation link to finish creating your account.",
          );
        } else {
          goHome();
        }
      } else {
        await signInWithPassword(email.trim(), password);
        goHome();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (googleBusy) return;
    setGoogleBusy(true);
    setError(null);
    try {
      // On success the browser leaves for Google; nothing runs after.
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed — try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <section className="mx-auto max-w-md pt-10 sm:pt-14">
      <h1 className="text-center text-4xl font-black tracking-tight">
        {isSignup ? (
          <>
            Join the <span className="text-gold">argument</span>
          </>
        ) : (
          <>
            Sign <span className="text-gold">in</span>
          </>
        )}
      </h1>
      <p className="mt-3 text-center text-sm text-zinc-400">
        {isSignup
          ? "A free account lets you comment and enter the GOAT of Criteria contest. Voting stays open to everyone."
          : "Sign in to comment and join the GOAT of Criteria contest. Everyone else just votes."}
      </p>

      <button
        type="button"
        onClick={() => void google()}
        disabled={googleBusy || busy || !supabaseConfigured}
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-panel-2 py-3 text-sm font-bold text-zinc-100 transition-colors hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleMark />
        {googleBusy ? "Opening Google…" : "Continue with Google"}
      </button>

      <div className="mt-5 flex items-center gap-3 text-xs text-zinc-500" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span>or {isSignup ? "create an account with email" : "sign in with email"}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        className="mt-5 rounded-2xl border border-line bg-panel p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {isSignup && (
          <>
            <label
              className="block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400"
              htmlFor="signup-name"
            >
              Display name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="nickname"
              value={displayName}
              maxLength={MAX_AUTHOR_NAME_LENGTH}
              disabled={busy || !supabaseConfigured}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How the leaderboard knows you"
              className="mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
            />
          </>
        )}

        <label
          className={`block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400 ${isSignup ? "mt-4" : ""}`}
          htmlFor="signin-email"
        >
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          value={email}
          disabled={busy || !supabaseConfigured}
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
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          disabled={busy || !supabaseConfigured}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? "At least 6 characters" : "Your password"}
          className="mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
        />

        {isSignup && (
          <>
            <label
              className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-zinc-400"
              htmlFor="signup-password-confirm"
            >
              Confirm password
            </label>
            <input
              id="signup-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              disabled={busy || !supabaseConfigured}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="mt-2 w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold focus:outline-none disabled:opacity-50"
            />
          </>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-500/50 bg-red-950 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mt-3 rounded-xl border border-gold/50 bg-panel-2 px-3 py-2 text-sm text-gold">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !supabaseConfigured}
          className="mt-5 w-full rounded-full bg-gold py-3 text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Hold on…" : isSignup ? "Create account" : "Sign in"}
        </button>
        {!supabaseConfigured && (
          <p className="mt-3 text-center text-xs text-zinc-500">
            Sign-in opens once the database is connected.
          </p>
        )}
      </form>

      <p className="mt-5 text-center text-sm text-zinc-400">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              className="font-bold text-gold hover:underline"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New here?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setNotice(null);
              }}
              className="font-bold text-gold hover:underline"
            >
              Create a free account
            </button>
          </>
        )}
      </p>
    </section>
  );
}
