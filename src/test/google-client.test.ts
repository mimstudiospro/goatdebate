import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.hoisted(() => vi.fn(() => ({ fake: "client" })));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

describe("supabase client (Google OAuth / PKCE)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mockCreateClient.mockClear();
  });

  it("creates the client with PKCE flow and detectSessionInUrl, so the OAuth callback arrives as ?code=", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    await import("../lib/supabase");
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test",
      { auth: { flowType: "pkce", detectSessionInUrl: true } },
    );
  });

  it("creates no client when the env vars are missing", async () => {
    await import("../lib/supabase");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
