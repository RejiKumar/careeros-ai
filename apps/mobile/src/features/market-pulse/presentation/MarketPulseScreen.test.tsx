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
  location: "All India",
  role: null,
  skill_demand: [
    { skill: "React Native", demand_score: 82, change_pct: 12, job_count: 1340 },
    { skill: "Python", demand_score: 64, change_pct: -5, job_count: 980 },
  ],
  salary_ranges: [
    { role: "Mobile Engineer", location: "Bangalore", min: 600000, max: 2200000, median: 1400000 },
  ],
  top_companies: [{ name: "Acme Corp", job_count: 220, tech_stack: ["React", "TypeScript"] }],
  recommended_skills: ["GraphQL", "Kubernetes"],
};

const trends: SkillTrendResponse = {
  period: "30d",
  trends: [
    { skill: "Rust", trend: "rising", change_pct: 18 },
    { skill: "JavaScript", trend: "stable", change_pct: 1 },
    { skill: "Perl", trend: "declining", change_pct: -9 },
  ],
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
      skill_demand: [],
      salary_ranges: [],
      top_companies: [],
      recommended_skills: [],
    });
    mockGetSkillTrends.mockResolvedValue({ ...trends, trends: [] });

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
