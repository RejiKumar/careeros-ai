import { act, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";

import AuthCallbackRoute from "../../../../app/auth/callback";

const mockGetInitialURL = jest.fn<Promise<string | null>, []>();
const mockReplace = jest.fn();
let mockStatus: "restoring" | "signedOut" | "signedIn" | "guest" = "signedOut";
const mockHandleOAuthRedirect = jest.fn<Promise<void>, [url: string]>(async () => {});

jest.mock("expo-linking", () => ({
  getInitialURL: () => mockGetInitialURL(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ status: mockStatus, handleOAuthRedirect: mockHandleOAuthRedirect }),
}));

jest.mock("@/services/supabase", () => ({
  isOAuthRedirectUrl: (url: string) =>
    url.includes("code=") || url.includes("access_token=") || url.includes("token_hash="),
}));

function renderRoute() {
  return render(
    <ThemeProvider>
      <AuthCallbackRoute />
    </ThemeProvider>,
  );
}

describe("AuthCallbackRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = "signedOut";
    mockGetInitialURL.mockReset();
  });

  it("exchanges an OAuth redirect URL and does not fall back to the login screen", async () => {
    mockGetInitialURL.mockResolvedValue("careerosai://auth/callback?token_hash=th1&type=signup");

    renderRoute();

    await waitFor(() =>
      expect(mockHandleOAuthRedirect).toHaveBeenCalledWith(
        "careerosai://auth/callback?token_hash=th1&type=signup",
      ),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("falls back to the login screen when signed out and no redirect arrives", async () => {
    jest.useFakeTimers();
    mockGetInitialURL.mockResolvedValue(null);

    renderRoute();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(mockReplace).toHaveBeenCalledWith("/auth");
    expect(mockHandleOAuthRedirect).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("stays put when the auth provider completes sign in while waiting", async () => {
    jest.useFakeTimers();
    mockGetInitialURL.mockResolvedValue(null);
    mockStatus = "signedIn";

    renderRoute();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(mockReplace).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});