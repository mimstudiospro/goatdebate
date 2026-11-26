import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSignInWithOAuth = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { auth: { signInWithOAuth: mockSignInWithOAuth } },
  supabaseConfigured: true,
}));

import { consumeOAuthReturn, signInWithGoogle } from "../lib/auth";

const ORIGIN = "https://goatdebate.mimstudiospro.com";

/** The tests run in the node environment, so there is no window —
 * stub the two bits signInWithGoogle touches. */
function stubWindow(hash: string) {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: { location: { hash, origin: ORIGIN }, sessionStorage },
    configurable: true,
  });
  return store;
}

describe("signInWithGoogle", () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset();
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/auth" },
      error: null,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("starts Google OAuth with provider 'google' and the site origin as redirect", async () => {
    stubWindow("#/signin");
    await signInWithGoogle();
    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${ORIGIN}/` },
    });
  });

  it("remembers the page the user was on, and consumeOAuthReturn returns it once", async () => {
    const store = stubWindow("#/write");
    await signInWithGoogle();
    expect(store.get("goatdebate-oauth-return")).toBe("#/write");
    expect(consumeOAuthReturn()).toBe("#/write");
    expect(consumeOAuthReturn()).toBeNull();
  });

  it("does not remember the sign-in page itself — home is the fallback", async () => {
    const store = stubWindow("#/signin");
    await signInWithGoogle();
    expect(store.get("goatdebate-oauth-return")).toBeUndefined();
    expect(consumeOAuthReturn()).toBeNull();
  });

  it("throws the Supabase message when OAuth fails to start", async () => {
    stubWindow("#/signin");
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "Provider is not enabled" },
    });
    await expect(signInWithGoogle()).rejects.toThrow("Provider is not enabled");
  });
});
