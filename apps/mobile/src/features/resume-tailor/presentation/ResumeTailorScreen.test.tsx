import { render, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import type { TailorResponse } from "@/services/contract";

import ResumeTailorScreen from "./ResumeTailorScreen";

const mockTailorResume = jest.fn();
const mockListResumes = jest.fn();
const mockListJobDescriptions = jest.fn();
const mockGetTailorHistory = jest.fn();
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
    guestId: null,
    handleUnauthorized: mockHandleUnauthorized,
  }),
}));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    tailorResume: (...args: unknown[]) => mockTailorResume(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    listJobDescriptions: (...args: unknown[]) => mockListJobDescriptions(...args),
    getTailorHistory: (...args: unknown[]) => mockGetTailorHistory(...args),
  })),
}));

// Exact shape returned by POST /api/v1/resume-tailor/tailor (flat, no `tailor` wrapper).
const apiResponse: TailorResponse = {
  id: "tailor-1",
  user_id: "user-1",
  resume_id: "resume-1",
  job_description_id: "jd-1",
  tailored_content: {
    contact: { full_name: "Jane", email: null, phone: null, location: null, links: [] },
    summary: "React engineer focused on dashboards.",
    skills: ["React", "Python"],
    experience: [
      {
        organization: "Acme",
        title: "Engineer",
        start_date: null,
        end_date: null,
        bullets: ["Built a React dashboard."],
      },
    ],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
  },
  diffs: [
    {
      field: "summary",
      original: "Software engineer.",
      tailored: "React engineer focused on dashboards.",
      reasoning: "Mirrors the job's React focus.",
    },
    {
      field: "experience.0.bullets.1",
      original: "Built dashboards.",
      tailored: "Built React dashboards.",
      reasoning: "Adds the keyword the job asks for.",
    },
  ],
  original_version_id: "v1",
  tailored_version_id: null,
  created_at: "2026-11-19T00:00:00Z",
  accepted: false,
};

describe("ResumeTailorScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListResumes.mockResolvedValue([{ id: "resume-1", title: "My resume" }]);
    mockListJobDescriptions.mockResolvedValue([
      { id: "jd-1", title: "React Developer", company: null },
    ]);
    mockGetTailorHistory.mockResolvedValue([]);
  });

  it("renders the API's flat tailor response without crashing", async () => {
    mockTailorResume.mockResolvedValueOnce(apiResponse);
    const screen = await render(
      <ThemeProvider>
        <ResumeTailorScreen />
      </ThemeProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("React Developer")).toBeOnTheScreen());
    await user.press(screen.getByText("React Developer"));
    await user.press(screen.getByLabelText("Tailor my resume"));

    await waitFor(() =>
      expect(screen.getByText("React engineer focused on dashboards.")).toBeOnTheScreen(),
    );
    expect(screen.getByText("Mirrors the job's React focus.")).toBeOnTheScreen();
    // Field paths from the API are shown as section names, never raw.
    expect(screen.getByText("Adds the keyword the job asks for.")).toBeOnTheScreen();
    expect(screen.queryByText("experience.0.bullets.1")).not.toBeOnTheScreen();
  });

  it("shows the original text from the diffs when toggled", async () => {
    mockTailorResume.mockResolvedValueOnce(apiResponse);
    const screen = await render(
      <ThemeProvider>
        <ResumeTailorScreen />
      </ThemeProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText("React Developer")).toBeOnTheScreen());
    await user.press(screen.getByText("React Developer"));
    await user.press(screen.getByLabelText("Tailor my resume"));
    await waitFor(() => expect(screen.getByLabelText(/^Show /)).toBeOnTheScreen());
    await user.press(screen.getByLabelText(/^Show /));

    expect(screen.getByText("Software engineer.")).toBeOnTheScreen();
  });
});
