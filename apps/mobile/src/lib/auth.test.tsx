import { act, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "./auth";

const mockUrlListener = jest.fn<
  { remove: () => void },
  [eventName: string, handler: (e: { url: string }) => void]
>((_eventName, _handler) => ({ remove: jest.fn() }));
const mockGetInitialURL = jest.fn<Promise<string | null>, []>(async () => null);

jest.mock("expo-linking", () => ({
  addEventListener: (
    eventName: string,
    handler: (e: { url: string }) => void,
  ) => mockUrlListener(eventName, handler),
  getInitialURL: () => mockGetInitialURL(),
}));

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

const mockLoadSession = jest.fn<Promise<unknown>, []>(async () => null);
const mockSaveSession = jest.fn<Promise<void>, [session: unknown]>(async () => {});
const mockGetOrCreateGuestId = jest.fn<Promise<string>, []>(async () => "guest-1");

jest.mock("@/services/sessionStore", () => ({
  clearGuestId: jest.fn(async () => {}),
  clearSession: () => mockClearSession(),
  loadSession: () => mockLoadSession(),
  saveSession: (session: unknown) => mockSaveSession(session),
  getOrCreateGuestId: () => mockGetOrCreateGuestId(),
}));

jest.mock("@/lib/notifications", () => ({
  removeFCMTokenOnSignOut: jest.fn(async () => {}),
}));

jest.mock("@/services/api", () => ({
  setTokenRefresher: jest.fn(),
}));

const mockGetSupabaseClient = jest.fn<unknown, []>();
const mockGetOAuthRedirectUri = jest.fn<string, []>(() => "careerosai://auth/callback");
const mockExchangeOAuthCode = jest.fn<Promise<unknown>, [url: string]>();
const mockIsOAuthRedirectUrl = jest.fn<boolean, [url: string]>(
  (url) =>
    url.includes("code=") ||
    url.includes("access_token=") ||
    url.includes("token_hash="),
);
const mockClearSession = jest.fn<Promise<void>, []>(async () => {});

let mockAuthStateHandler: ((event: string, session: unknown) => void) | null = null;
const mockOnAuthStateChange = jest.fn<
  { data: { subscription: { unsubscribe: () => void } } },
  [handler: (event: string, session: unknown) => void]
>((handler) => {
  mockAuthStateHandler = handler;
  return { data: { subscription: { unsubscribe: jest.fn() } } };
});

jest.mock("@/services/supabase", () => ({
  exchangeOAuthCode: (url: string) => mockExchangeOAuthCode(url),
  getOAuthRedirectUri: () => mockGetOAuthRedirectUri(),
  getSupabaseClient: () => mockGetSupabaseClient(),
  isOAuthRedirectUrl: (url: string) => mockIsOAuthRedirectUrl(url),
}));

type AuthApi = ReturnType<typeof useAuth>;

function Probe({ capture }: { capture: (auth: AuthApi) => void }) {
  const auth = useAuth();
  useEffect(() => {
    capture(auth);
  }, [auth, capture]);
  return null;
}

let captured: AuthApi | null = null;

async function renderProvider() {
  captured = null;
  const capture = (auth: AuthApi) => {
    captured = auth;
  };
  render(
    <AuthProvider>
      <Probe capture={capture} />
    </AuthProvider>,
  );
  await waitFor(() => {
    expect(captured).not.toBeNull();
    expect(captured?.status).not.toBe("restoring");
  });
  return captured;
}

function urlEventHandler(): (e: { url: string }) => void {
  const handler = mockUrlListener.mock.calls[0]?.[1];
  if (handler === undefined) {
    throw new Error("Linking url listener was not registered");
  }
  return handler;
}

function emitAuthStateChange(event: string, session: unknown) {
  const handler = mockAuthStateHandler;
  if (handler === null) {
    throw new Error("onAuthStateChange handler was not registered");
  }
  handler(event, session);
}

describe("AuthProvider OAuth redirect handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStateHandler = null;
    mockGetSupabaseClient.mockReturnValue({ auth: { onAuthStateChange: mockOnAuthStateChange } });
    mockExchangeOAuthCode.mockReset();
    mockGetInitialURL.mockReset();
    mockGetInitialURL.mockResolvedValue(null);
  });

  it("exchanges a PKCE code from an auth deep link and signs the user in", async () => {
    const oauthSession = {
      access_token: "AT",
      refresh_token: "RT",
      expires_at: Date.now() / 1000 + 3600,
    };
    mockExchangeOAuthCode.mockResolvedValue(oauthSession);
    mockGetInitialURL.mockResolvedValue("careerosai://auth/callback?code=c1&state=s1");

    await renderProvider();

    await waitFor(() => {
      expect(captured?.status).toBe("signedIn");
      expect(mockExchangeOAuthCode).toHaveBeenCalledWith(
        "careerosai://auth/callback?code=c1&state=s1",
      );
      expect(mockSaveSession).toHaveBeenCalledWith(oauthSession);
    });
  });

  it("handles an OAuth URL arriving via the url event", async () => {
    await renderProvider();

    const oauthSession = {
      access_token: "AT2",
      refresh_token: "RT2",
      expires_at: Date.now() / 1000 + 3600,
    };
    mockExchangeOAuthCode.mockResolvedValue(oauthSession);

    const eventHandler = urlEventHandler();
    await act(async () => {
      eventHandler({ url: "careerosai://auth/callback?code=c2&state=s2" });
    });

    await waitFor(() => {
      expect(captured?.status).toBe("signedIn");
      expect(mockExchangeOAuthCode).toHaveBeenCalledWith(
        "careerosai://auth/callback?code=c2&state=s2",
      );
    });
  });

  it("is idempotent for the same redirect URL", async () => {
    await renderProvider();

    const deferred: { resolve: () => void } = { resolve: () => {} };
    let exchangeCalls = 0;
    mockExchangeOAuthCode.mockImplementation(
      () =>
        new Promise((resolve) => {
          exchangeCalls += 1;
          deferred.resolve = () =>
            resolve({
              access_token: "AT3",
              refresh_token: "RT3",
              expires_at: Date.now() / 1000 + 3600,
            });
        }),
    );

    const eventHandler = urlEventHandler();
    const url = "careerosai://auth/callback?code=c3&state=s3";

    await act(async () => {
      eventHandler({ url });
      eventHandler({ url });
    });

    await act(async () => {
      deferred.resolve();
    });

    await waitFor(() => expect(captured?.status).toBe("signedIn"));
    expect(exchangeCalls).toBe(1);
  });

  it("ignores deep links that are not OAuth redirects", async () => {
    await renderProvider();

    const eventHandler = urlEventHandler();
    await act(async () => {
      eventHandler({ url: "careerosai://notifications" });
    });

    await waitFor(() => expect(captured?.status).toBe("signedOut"));
    expect(mockExchangeOAuthCode).not.toHaveBeenCalled();
  });

  it("restores the guest identity but stays signed out on a fresh launch", async () => {
    mockLoadSession.mockResolvedValue(null);

    await renderProvider();

    expect(captured?.status).toBe("signedOut");
    expect(captured?.guestId).toBe("guest-1");
    expect(mockGetOrCreateGuestId).toHaveBeenCalled();
  });

  it("passes an emailRedirectTo deep link when signing up", async () => {
    const mockSignUp = jest.fn().mockResolvedValue({ data: { session: null }, error: null });
    mockGetSupabaseClient.mockReturnValue({
      auth: {
        signUp: mockSignUp,
        onAuthStateChange: mockOnAuthStateChange,
      },
    });

    await renderProvider();

    await act(async () => {
      await captured?.signUp("new@example.com", "password123").catch(() => {});
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "careerosai://auth/callback",
      },
    });
  });

  it("handles a token_hash email confirmation deep link via the url event", async () => {
    await renderProvider();

    const session = {
      access_token: "AT_TH",
      refresh_token: "RT_TH",
      expires_at: Date.now() / 1000 + 3600,
    };
    mockExchangeOAuthCode.mockResolvedValue(session);

    const eventHandler = urlEventHandler();
    await act(async () => {
      eventHandler({
        url: "careerosai://auth/callback?token_hash=th1&type=signup",
      });
    });

    await waitFor(() => {
      expect(captured?.status).toBe("signedIn");
      expect(mockExchangeOAuthCode).toHaveBeenCalledWith(
        "careerosai://auth/callback?token_hash=th1&type=signup",
      );
    });
  });

  it("sets signedIn when onAuthStateChange fires SIGNED_IN outside the normal redirect flow", async () => {
    await renderProvider();

    expect(captured?.status).toBe("signedOut");

    const session = {
      access_token: "AT_ONCHANGE",
      refresh_token: "RT_ONCHANGE",
      expires_at: Date.now() / 1000 + 3600,
    };
    await act(async () => {
      emitAuthStateChange("SIGNED_IN", session);
    });

    await waitFor(() => {
      expect(captured?.status).toBe("signedIn");
      expect(captured?.session).toEqual(session);
      expect(mockSaveSession).toHaveBeenCalledWith(session);
    });
  });
});