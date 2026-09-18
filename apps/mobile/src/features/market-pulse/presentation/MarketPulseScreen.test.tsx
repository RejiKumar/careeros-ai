import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider } from "@/lib/theme";
import { ApiError, type MarketPulseResponse, type SkillTrendResponse } from "@/services/contract";

import MarketPulseScreen from "./MarketPulseScreen";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 400, height: 800 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>
        <MarketPulseScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

const mockGetMarketPulse = jest.fn();
const mockGetSkillTrends = jest.fn();
const mockHandleUnauthorized = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
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
    getMarketPulse: (...args: unknown[]) => mockGetMarketPulse(...args),
    getSkillTrends: (...args: unknown[]) => mockGetSkillTrends(...args),
  })),
}));

const pulse: MarketPulseResponse = {
  skill_demands: [
    { skill: "React Native", demand_score: 82, change_percent: 12, period: "3m", job_count: 1340 },
    { skill: "Python", demand_score: 64, change_percent: -5, period: "6m", job_count: 980 },
  ],
  salary_ranges: [
    {
      role: "Mobile Engineer",
      location: "Bangalore",
      min_salary: 600000,
      median_salary: 1400000,
      max_salary: 2200000,
      currency: "INR",
      experience_level: "mid",
    },
  ],
  top_companies: [
    {
      name: "Acme Corp",
      job_count: 220,
      tech_stack: ["React", "TypeScript"],
      location: null,
      logo_url: null,
    },
  ],
  generated_at: "2026-08-27T00:00:00+00:00",
};

const trends: SkillTrendResponse = {
  trends: [
    { skill: "Rust", direction: "rising", change_percent: 18, period: "3m" },
    { skill: "JavaScript", direction: "stable", change_percent: 1, period: "3m" },
    { skill: "Perl", direction: "declining", change_percent: -9, period: "3m" },
  ],
  recommended_skills: ["GraphQL", "Kubernetes"],
  generated_at: "2026-08-27T00:00:00+00:00",
};

describe("MarketPulseScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMarketPulse.mockResolvedValue(pulse);
    mockGetSkillTrends.mockResolvedValue(trends);
  });

  it("renders loading then the market data", async () => {
    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText("React Native")).toBeOnTheScreen());
    expect(getByText("Skill demand")).toBeOnTheScreen();
    expect(getByText("Salary ranges")).toBeOnTheScreen();
    expect(getByText("Top hiring companies")).toBeOnTheScreen();
    expect(getByText("Skill trends")).toBeOnTheScreen();
    expect(getByText("Skills to learn")).toBeOnTheScreen();
    expect(getByText("Acme Corp")).toBeOnTheScreen();
    expect(getByText("Rust")).toBeOnTheScreen();
    expect(getByText("GraphQL")).toBeOnTheScreen();
  });

  it("shows the empty state when no data is returned", async () => {
    mockGetMarketPulse.mockResolvedValue({
      ...pulse,
      skill_demands: [],
      salary_ranges: [],
      top_companies: [],
    });
    mockGetSkillTrends.mockResolvedValue({ ...trends, trends: [], recommended_skills: [] });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText("No market data available yet.")).toBeOnTheScreen());
  });

  it("shows the error state and retry on failure", async () => {
    mockGetMarketPulse.mockRejectedValue(new ApiError(502, "Market data unavailable", "upstream"));

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText("Market data unavailable")).toBeOnTheScreen());
    expect(getByText("Try again")).toBeOnTheScreen();
  });

  it("refreshes when the refresh control is triggered", async () => {
    const { getByText, getByTestId } = await renderScreen();

    await waitFor(() => expect(getByText("React Native")).toBeOnTheScreen());
    expect(mockGetMarketPulse).toHaveBeenCalledTimes(1);

    mockGetMarketPulse.mockClear();
    const scrollView = getByTestId("market-pulse-scroll");
    scrollView.props.refreshControl.props.onRefresh();
    await waitFor(() => expect(mockGetMarketPulse).toHaveBeenCalled());
  });

  it("passes the selected location to the API", async () => {
    const { getByText, getAllByText } = await renderScreen();

    await waitFor(() => expect(getByText("React Native")).toBeOnTheScreen());
    const bangaloreButtons = getAllByText("Bangalore");
    expect(bangaloreButtons.length).toBeGreaterThan(0);
    fireEvent.press(bangaloreButtons[0]!);

    await waitFor(() =>
      expect(mockGetMarketPulse).toHaveBeenCalledWith(
        "test-token",
        "Bangalore",
        undefined,
        undefined,
      ),
    );
  });
});
