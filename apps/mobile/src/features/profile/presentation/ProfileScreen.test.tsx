import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import { ApiError, type EntitlementResponse, type UserResponse } from "@/services/contract";

import ProfileScreen from "./ProfileScreen";

const mockGetMe = jest.fn();
const mockGetEntitlements = jest.fn();
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

describe("ProfileScreen", () => {
  beforeEach(() => {
    mockGetMe.mockResolvedValue(user);
    mockGetEntitlements.mockResolvedValue(entitlements);
  });

  it("renders the account email and entitlements", async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <ProfileScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("user@example.com")).toBeOnTheScreen());
    expect(getByText("free · active")).toBeOnTheScreen();
    expect(getByText("2 / 3")).toBeOnTheScreen();
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
