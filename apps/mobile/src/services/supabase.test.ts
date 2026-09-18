import { exchangeOAuthCode, getOAuthRedirectUri, isOAuthRedirectUrl } from "./supabase";

const mockCreateClient = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { scheme: "careerosai" } },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

const mockAuthMethods = {
  exchangeCodeForSession: jest.fn(),
  setSession: jest.fn(),
  verifyOtp: jest.fn(),
};

describe("exchangeOAuthCode", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockAuthMethods.exchangeCodeForSession.mockReset();
    mockAuthMethods.setSession.mockReset();
    mockAuthMethods.verifyOtp.mockReset();
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

  it("verifies a token_hash from an email confirmation redirect", async () => {
    mockAuthMethods.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: "u3" } } },
      error: null,
    });

    const session = await exchangeOAuthCode(
      "careerosai://auth/callback?token_hash=th1&type=signup",
    );

    expect(mockAuthMethods.verifyOtp).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "th1",
    });
    expect(session).toEqual({ user: { id: "u3" } });
  });

  it("throws when token_hash verification fails and no session is returned", async () => {
    mockAuthMethods.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid token" },
    });

    await expect(
      exchangeOAuthCode("careerosai://auth/callback?token_hash=th2&type=email"),
    ).rejects.toThrow("invalid token");
  });
});

describe("getOAuthRedirectUri", () => {
  it("returns the app scheme with a /auth/callback path for deep link handling", () => {
    expect(getOAuthRedirectUri()).toBe("careerosai://auth/callback");
  });
});

describe("isOAuthRedirectUrl", () => {
  it("accepts PKCE, implicit and email confirmation redirect URLs", () => {
    expect(isOAuthRedirectUrl("careerosai://auth/callback?code=c1&state=s1")).toBe(true);
    expect(
      isOAuthRedirectUrl("careerosai://auth/callback#access_token=AT&refresh_token=RT"),
    ).toBe(true);
    expect(
      isOAuthRedirectUrl("careerosai://auth/callback?token_hash=th1&type=signup"),
    ).toBe(true);
  });

  it("rejects unrelated deep links", () => {
    expect(isOAuthRedirectUrl("careerosai://reset-password")).toBe(false);
    expect(isOAuthRedirectUrl("careerosai://auth")).toBe(false);
    expect(isOAuthRedirectUrl("careerosai://notifications")).toBe(false);
  });
});