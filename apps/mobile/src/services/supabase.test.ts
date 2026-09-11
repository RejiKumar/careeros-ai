import { exchangeOAuthCode } from "./supabase";

const mockCreateClient = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const mockAuthMethods = {
  exchangeCodeForSession: jest.fn(),
  setSession: jest.fn(),
};

describe("exchangeOAuthCode", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockAuthMethods.exchangeCodeForSession.mockReset();
    mockAuthMethods.setSession.mockReset();
    mockCreateClient.mockReset();
    mockCreateClient.mockReturnValue({ auth: mockAuthMethods });
  });

  it("uses exchangeCodeForSession when the redirect URL carries a PKCE code", async () => {
    mockAuthMethods.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null,
    });

    const session = await exchangeOAuthCode("careerosai://auth?code=c1&state=s1");

    expect(mockAuthMethods.exchangeCodeForSession).toHaveBeenCalledWith(
      "careerosai://auth?code=c1&state=s1",
    );
    expect(mockAuthMethods.setSession).not.toHaveBeenCalled();
    expect(session).toEqual({ user: { id: "u1" } });
  });

  it("uses setSession for an implicit-flow redirect carrying tokens in the hash fragment", async () => {
    mockAuthMethods.setSession.mockResolvedValue({
      data: { session: { user: { id: "u2" } } },
      error: null,
    });

    const session = await exchangeOAuthCode("careerosai://#access_token=AT&refresh_token=RT");

    expect(mockAuthMethods.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockAuthMethods.setSession).toHaveBeenCalledWith({
      access_token: "AT",
      refresh_token: "RT",
    });
    expect(session).toEqual({ user: { id: "u2" } });
  });

  it("throws when an implicit-flow redirect lacks tokens", async () => {
    await expect(exchangeOAuthCode("careerosai://#error=access_denied")).rejects.toThrow(
      "valid tokens",
    );
  });

  it("throws when the PKCE code exchange fails", async () => {
    mockAuthMethods.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid code" },
    });

    await expect(exchangeOAuthCode("careerosai://?code=c1")).rejects.toThrow("invalid code");
  });
});