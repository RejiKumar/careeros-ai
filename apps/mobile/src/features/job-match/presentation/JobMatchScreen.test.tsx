import { fireEvent, render, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import {
  ApiError,
  type JobDescriptionMatchResponse,
  type ResumeResponse,
} from "@/services/contract";

import JobMatchScreen from "./JobMatchScreen";

const mockCreateJobDescription = jest.fn();
const mockListResumes = jest.fn();
const mockListJobDescriptions = jest.fn();
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
    createJobDescription: (...args: unknown[]) => mockCreateJobDescription(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    listJobDescriptions: (...args: unknown[]) => mockListJobDescriptions(...args),
    runMatch: jest.fn(),
    deleteJobDescription: jest.fn(),
  })),
}));

const resume: ResumeResponse = {
  id: "r1",
  title: "My Resume",
  status: "draft",
  current_version_id: null,
  created_at: "2026-08-19T00:00:00Z",
  updated_at: "2026-08-19T00:00:00Z",
};

const matchResult: JobDescriptionMatchResponse = {
  job_description: {
    id: "jd1",
    title: "Senior Engineer",
    company: "Acme",
    raw_text: "We need a React Native engineer.",
    resume_id: "r1",
    created_at: "2026-08-19T00:00:00Z",
    updated_at: null,
  },
  match: {
    id: "match1",
    job_description_id: "jd1",
    resume_version_id: "v1",
    score: 85,
    matched_skills: ["React Native"],
    missing_skills: ["Swift"],
    strengths: ["Strong mobile experience."],
    actions: [{ title: "Add Swift", detail: "Highlight any Swift exposure." }],
    model_version: "gemini-3.6-flash",
    created_at: "2026-08-19T00:00:00Z",
  },
};

describe("JobMatchScreen", () => {
  beforeEach(() => {
    mockListResumes.mockResolvedValue([resume]);
    mockListJobDescriptions.mockResolvedValue([]);
  });

  it("renders the empty state with saved job descriptions placeholder", async () => {
    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <JobMatchScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Use resume My Resume")).toBeOnTheScreen());
    expect(getByText("No job descriptions saved yet.")).toBeOnTheScreen();
    expect(getByText(/AI-estimated compatibility/)).toBeOnTheScreen();
  });

  it("rejects an empty job description", async () => {
    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <JobMatchScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Match")).toBeOnTheScreen());
    fireEvent.press(getByLabelText("Match"));

    expect(mockCreateJobDescription).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(getByText("Paste a job description to match against.")).toBeOnTheScreen(),
    );
  });

  it("shows the match result after a successful analysis", async () => {
    mockCreateJobDescription.mockResolvedValue(matchResult);

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <JobMatchScreen />
      </ThemeProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => expect(getByLabelText("Job description")).toBeOnTheScreen());
    await user.type(getByLabelText("Job description"), "We need a React Native engineer.");
    await user.press(getByLabelText("Match"));

    await waitFor(() => expect(getByText("85%")).toBeOnTheScreen());
    expect(getByText("React Native")).toBeOnTheScreen();
    expect(getByText("Swift")).toBeOnTheScreen();
    expect(getByText("Add Swift")).toBeOnTheScreen();
  });

  it("shows the error inline when analysis fails", async () => {
    mockCreateJobDescription.mockRejectedValue(
      new ApiError(502, "AI unavailable", "ai_provider_error"),
    );

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <JobMatchScreen />
      </ThemeProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => expect(getByLabelText("Job description")).toBeOnTheScreen());
    await user.type(getByLabelText("Job description"), "Some job description text.");
    await user.press(getByLabelText("Match"));

    await waitFor(() => expect(getByText("AI unavailable")).toBeOnTheScreen());
  });
});
