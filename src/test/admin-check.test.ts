import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { rpc: mockRpc },
  supabaseConfigured: true,
}));

import { fetchIsAdmin } from "../lib/auth";

describe("fetchIsAdmin", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("uses the main project's has_role RPC, the way the main site does", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await expect(fetchIsAdmin("user-1")).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("has_role", { _user_id: "user-1", _role: "admin" });
  });

  it("returns false when has_role says the user is not an admin", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(fetchIsAdmin("user-1")).resolves.toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("falls back to is_admin() when has_role errors (still on the GOAT project)", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.has_role" },
      })
      .mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchIsAdmin("user-1")).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(1, "has_role", {
      _user_id: "user-1",
      _role: "admin",
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, "is_admin");
  });

  it("returns false when the fallback also errors", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.has_role" },
      })
      .mockResolvedValueOnce({ data: null, error: { message: "Could not find the function public.is_admin" } });
    await expect(fetchIsAdmin("user-1")).resolves.toBe(false);
  });

  it("returns false without calling anything when signed out", async () => {
    await expect(fetchIsAdmin(null)).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
