import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const mockSignUp = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: { signUp: mockSignUp },
    from: () => ({ upsert: mockUpsert }),
  },
  supabaseConfigured: true,
}));

import { ensureGoatProfile, getDisplayName, signUpWithPassword } from "../lib/auth";

function user(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "fan@example.com",
    user_metadata: {},
    ...overrides,
  } as User;
}

describe("signUpWithPassword", () => {
  beforeEach(() => {
    mockSignUp.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates the account with the display name in user_metadata", async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: user() }, user: user() }, error: null });
    const result = await signUpWithPassword("fan@example.com", "secret123", "GoatFan");
    expect(mockSignUp).toHaveBeenCalledWith({
      email: "fan@example.com",
      password: "secret123",
      options: { data: { display_name: "GoatFan" } },
    });
    expect(result).toEqual({ needsConfirmation: false });
  });

  it("reports email confirmation when no session comes back", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: user() }, error: null });
    const result = await signUpWithPassword("fan@example.com", "secret123", "GoatFan");
    expect(result).toEqual({ needsConfirmation: true });
  });

  it("throws the Supabase message when sign-up fails", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null, user: null }, error: { message: "User already registered" } });
    await expect(signUpWithPassword("fan@example.com", "secret123", "GoatFan")).rejects.toThrow(
      "User already registered",
    );
  });
});

describe("getDisplayName", () => {
  it("prefers the chosen display name, then Google's full name", () => {
    expect(getDisplayName(user({ user_metadata: { display_name: "  GoatFan  " } }))).toBe("GoatFan");
    expect(getDisplayName(user({ user_metadata: { full_name: "Hiram Morales" } }))).toBe("Hiram Morales");
  });

  it("falls back to the email's local part, then to Fan", () => {
    expect(getDisplayName(user({ user_metadata: {} }))).toBe("fan");
    expect(getDisplayName(user({ email: undefined, user_metadata: {} }))).toBe("Fan");
    expect(getDisplayName(null)).toBe("Fan");
  });

  it("caps the name at 40 characters", () => {
    expect(getDisplayName(user({ user_metadata: { display_name: "x".repeat(50) } }))).toHaveLength(40);
  });
});

describe("ensureGoatProfile", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("upserts the fan's display name keyed by user id", async () => {
    await ensureGoatProfile(user({ user_metadata: { display_name: "GoatFan" } }));
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: "user-1", display_name: "GoatFan" },
      { onConflict: "user_id" },
    );
  });

  it("does nothing with no user", async () => {
    await ensureGoatProfile(null);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not throw when the table is not live yet", async () => {
    mockUpsert.mockRejectedValue(new Error("relation does not exist"));
    await expect(ensureGoatProfile(user())).resolves.toBeUndefined();
  });
});
