import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import { ApiError, type MissionProgressResponse, type MissionResponse } from "@/services/contract";

import MissionsScreen from "./MissionsScreen";

const mockListMissions = jest.fn();
const mockGetMissionProgress = jest.fn();
const mockCompleteMission = jest.fn();
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
    signOut: jest.fn(),
    handleUnauthorized: mockHandleUnauthorized,
  }),
}));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    listMissions: (...args: unknown[]) => mockListMissions(...args),
    getMissionProgress: (...args: unknown[]) => mockGetMissionProgress(...args),
    completeMission: (...args: unknown[]) => mockCompleteMission(...args),
  })),
}));

const missions: MissionResponse[] = [
  {
    id: "m1",
    key: "import_resume",
    title: "Import your resume",
    description: "Upload your latest resume.",
    xp_reward: 25,
    cadence: "daily",
    is_active: true,
  },
];

const progress: MissionProgressResponse = {
  total_xp: 120,
  level: 2,
  current_streak: 1,
  missions_completed: 3,
  completions: [],
};

describe("MissionsScreen", () => {
  beforeEach(() => {
    mockListMissions.mockResolvedValue(missions);
    mockGetMissionProgress.mockResolvedValue(progress);
  });

  it("renders progress stats and missions", async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <MissionsScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("120")).toBeOnTheScreen());
    expect(getByText("Import your resume")).toBeOnTheScreen();
    expect(getByText("Complete")).toBeOnTheScreen();
  });

  it("completes a mission and shows the XP message", async () => {
    mockCompleteMission.mockResolvedValue({
      mission_key: "import_resume",
      xp_awarded: 25,
      new_total_xp: 145,
      already_completed: false,
    });

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <MissionsScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Complete Import your resume")).toBeOnTheScreen());
    fireEvent.press(getByLabelText("Complete Import your resume"));

    await waitFor(() => expect(getByText(/you earned 25 XP/)).toBeOnTheScreen());
  });

  it("shows an error state when loading fails", async () => {
    mockGetMissionProgress.mockRejectedValue(new ApiError(500, "Server error", null));

    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <MissionsScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText(/Could not load missions/)).toBeOnTheScreen());

    mockGetMissionProgress.mockResolvedValue(progress);
    fireEvent.press(getByLabelText("Try again"));

    await waitFor(() => expect(getByText("120")).toBeOnTheScreen());
  });
});
