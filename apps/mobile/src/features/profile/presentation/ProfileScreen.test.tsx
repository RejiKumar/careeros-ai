import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import {
  ApiError,
  type AiUsageResponse,
  type EntitlementResponse,
  type UserResponse,
} from "@/services/contract";

import ProfileScreen from "./ProfileScreen";

const mockGetMe = jest.fn();
const mockGetEntitlements = jest.fn();
const mockGetAiUsage = jest.fn();
const mockSignOut = jest.fn();
const mockHandleUnauthorized = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual("react");
    React.useEffect(callback, [callback]);
  },
}));

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    status: "signedIn",
    session: { access_token: "test-token" },
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: mockSignOut,
    handleUnauthorized: mockHandleUnauthorized,
  }),
}));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    getMe: (...args: unknown[]) => mockGetMe(...args),
    getEntitlements: (...args: unknown[]) => mockGetEntitlements(...args),
    getAiUsage: (...args: unknown[]) => mockGetAiUsage(...args),
    deleteAccount: jest.fn(),
  })),
}));

jest.mock("@/services/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

const user: UserResponse = { id: "u1", email: "user@example.com", role: "authenticated" };
const entitlements: EntitlementResponse = {
  plan: "free",
  status: "active",
  usage: { resume_imports: 2 },
  limits: { resume_imports: 3 },
};

const aiUsage: AiUsageResponse = {
  used: 2,
  limit: 20,
  remaining: 18,
  resets_at: null,
  window_hours: 24,
};

describe("ProfileScreen", () => {
  beforeEach(() => {
    mockGetMe.mockResolvedValue(user);
    mockGetEntitlements.mockResolvedValue(entitlements);
    mockGetAiUsage.mockResolvedValue(aiUsage);
  });

  it("renders the account email and entitlements", async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("user@example.com")).toBeOnTheScreen());
    expect(getByText("free · active")).toBeOnTheScreen();
    expect(getByText("AI actions today")).toBeOnTheScreen();
    expect(getByText("2 / 20")).toBeOnTheScreen();
  });

  it("tells the user when the next AI action frees up once the limit is reached", async () => {
    mockGetAiUsage.mockResolvedValue({
      used: 20,
      limit: 20,
      remaining: 0,
      resets_at: "2026-11-20T09:30:00Z",
      window_hours: 24,
    });
    const { getByText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("20 / 20")).toBeOnTheScreen());
    expect(getByText(/Next one frees up at/)).toBeOnTheScreen();
  });

  it("still renders the profile when the usage call fails", async () => {
    mockGetAiUsage.mockRejectedValue(new ApiError(500, "boom", null));
    const { getByText, queryByText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("user@example.com")).toBeOnTheScreen());
    expect(queryByText("AI actions today")).not.toBeOnTheScreen();
  });

  it("does not expose the internal database role", async () => {
    const { getByText, queryByText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("user@example.com")).toBeOnTheScreen());
    expect(queryByText("authenticated")).not.toBeOnTheScreen();
  });

  it("renders the sign out button", async () => {
    const { getByLabelText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Sign out")).toBeOnTheScreen());
    expect(getByLabelText("Delete my account")).toBeOnTheScreen();
  });

  it("shows an error state when loading fails", async () => {
    mockGetMe.mockRejectedValue(new ApiError(500, "Server error", null));

    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText(/Could not load your profile/)).toBeOnTheScreen());

    mockGetMe.mockResolvedValue(user);
    fireEvent.press(getByLabelText("Retry loading profile"));

    await waitFor(() => expect(getByText("user@example.com")).toBeOnTheScreen());
  });
});
