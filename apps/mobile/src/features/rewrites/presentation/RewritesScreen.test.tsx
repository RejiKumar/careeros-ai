import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import {
  ApiError,
  type ResumeDetailResponse,
  type RewriteBatchResponse,
} from "@/services/contract";

import RewritesScreen from "./RewritesScreen";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockGetResume = jest.fn();
const mockCreateRewriteBatch = jest.fn();
const mockAcceptRewriteBatch = jest.fn();
const mockHandleUnauthorized = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ resumeId: "r1" }),
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
    getResume: (...args: unknown[]) => mockGetResume(...args),
    createRewriteBatch: (...args: unknown[]) => mockCreateRewriteBatch(...args),
    acceptRewriteBatch: (...args: unknown[]) => mockAcceptRewriteBatch(...args),
    listRewriteBatches: jest.fn(),
  })),
}));

const detail: ResumeDetailResponse = {
  resume: {
    id: "r1",
    title: "My Resume",
    status: "draft",
    current_version_id: null,
    created_at: "2026-08-19T00:00:00Z",
    updated_at: "2026-08-19T00:00:00Z",
  },
  version: null,
  parsed: {
    contact: {
      full_name: "Jane Doe",
      email: null,
      phone: null,
      location: null,
      links: [],
    },
    summary: "A software engineer with experience.",
    skills: ["React Native"],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
  },
  file_url: null,
};

const batch: RewriteBatchResponse = {
  id: "rw1",
  resume_id: "r1",
  status: "pending",
  suggestions: [
    {
      id: "s1",
      section: "Summary",
      original: "A software engineer with experience.",
      rewritten: "A product-minded software engineer delivering measurable impact.",
      rationale: "Adds impact focus without inventing facts.",
    },
  ],
  resume_version_id: "v1",
  source_version_number: 1,
  accepted_version_id: null,
  model_version: "gemini-3.6-flash",
  created_at: "2026-08-19T00:00:00Z",
};

describe("RewritesScreen", () => {
  beforeEach(() => {
    mockGetResume.mockResolvedValue(detail);
  });

  it("renders the generate button for a parsed resume", async () => {
    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <RewritesScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("Resume Improvements")).toBeOnTheScreen());
    expect(getByLabelText("Generate improvement suggestions")).toBeOnTheScreen();
  });

  it("generates and shows the suggestions", async () => {
    mockCreateRewriteBatch.mockResolvedValue(batch);

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <RewritesScreen />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(getByLabelText("Generate improvement suggestions")).toBeOnTheScreen(),
    );
    fireEvent.press(getByLabelText("Generate improvement suggestions"));

    await waitFor(() => expect(getByText("Summary")).toBeOnTheScreen());
    expect(
      getByText("A product-minded software engineer delivering measurable impact."),
    ).toBeOnTheScreen();
  });

  it("shows an explicit empty state when the batch has no suggestions", async () => {
    mockCreateRewriteBatch.mockResolvedValue({ ...batch, suggestions: [] });

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <RewritesScreen />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(getByLabelText("Generate improvement suggestions")).toBeOnTheScreen(),
    );
    fireEvent.press(getByLabelText("Generate improvement suggestions"));

    await waitFor(() =>
      expect(getByText("No improvements to suggest for this resume right now.")).toBeOnTheScreen(),
    );
    expect(getByLabelText("Try generating suggestions again")).toBeOnTheScreen();
  });

  it("accepts a suggestion and shows the new version message", async () => {
    mockCreateRewriteBatch.mockResolvedValue(batch);
    mockAcceptRewriteBatch.mockResolvedValue({
      resume_id: "r1",
      version: 2,
      version_id: "v2",
      status: "accepted",
    });

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <RewritesScreen />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(getByLabelText("Generate improvement suggestions")).toBeOnTheScreen(),
    );
    fireEvent.press(getByLabelText("Generate improvement suggestions"));
    await waitFor(() => expect(getByLabelText("Accept suggestion for Summary")).toBeOnTheScreen());
    fireEvent.press(getByLabelText("Accept suggestion for Summary"));

    await waitFor(() => expect(getByText("Saved as version 2.")).toBeOnTheScreen());
  });

  it("shows an error state when the resume fails to load", async () => {
    mockGetResume.mockRejectedValue(new ApiError(404, "Resume not found", "not_found"));

    const { getByText } = await render(
      <ThemeProvider>
        <RewritesScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("Resume not found")).toBeOnTheScreen());
  });
});
