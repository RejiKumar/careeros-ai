import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import { ApiError, type DashboardResponse } from "@/services/contract";

import DashboardScreen from "./DashboardScreen";

const mockPush = jest.fn();
const mockGetDashboard = jest.fn();
const mockHandleUnauthorized = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
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
    signOut: jest.fn(),
    handleUnauthorized: mockHandleUnauthorized,
  }),
}));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
  })),
}));

const dashboard: DashboardResponse = {
  health_score: 82,
  health_level: "Good",
  latest_match_score: 74,
  latest_match_jd_title: "Senior Engineer",
  total_xp: 340,
  level: 4,
  current_streak: 3,
  active_missions: [
    {
      id: "m1",
      key: "review_summary",
      title: "Improve your summary",
      description: "Tighten your opening summary.",
      xp_reward: 25,
      cadence: "daily",
      is_active: true,
    },
  ],
  recent_completions: [],
};

describe("DashboardScreen", () => {
  beforeEach(() => {
    mockGetDashboard.mockResolvedValue(dashboard);
  });

  it("renders the dashboard stats and missions", async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <DashboardScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("82")).toBeOnTheScreen());
    expect(getByText("340")).toBeOnTheScreen();
    expect(getByText("74")).toBeOnTheScreen();
    expect(getByText("3")).toBeOnTheScreen();
    expect(getByText("Improve your summary")).toBeOnTheScreen();
  });

  it("navigates to job match when the card is pressed", async () => {
    const { getByLabelText } = await render(
      <ThemeProvider>
        <DashboardScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Open Job Match")).toBeOnTheScreen());
    fireEvent.press(getByLabelText("Open Job Match"));

    expect(mockPush).toHaveBeenCalledWith("/job-match");
  });

  it("shows an error state with retry when loading fails", async () => {
    mockGetDashboard.mockRejectedValue(new ApiError(500, "Server error", null));

    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <DashboardScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText(/Could not load your dashboard/)).toBeOnTheScreen());
    expect(getByText("Server error")).toBeOnTheScreen();

    mockGetDashboard.mockResolvedValue(dashboard);
    fireEvent.press(getByLabelText("Retry loading dashboard"));

    await waitFor(() => expect(getByText("82")).toBeOnTheScreen());
  });

  it("signs out the user when the API returns 401", async () => {
    mockGetDashboard.mockRejectedValue(new ApiError(401, "Unauthorized", "unauthorized"));

    await render(
      <ThemeProvider>
        <DashboardScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(mockHandleUnauthorized).toHaveBeenCalled());
  });
});
