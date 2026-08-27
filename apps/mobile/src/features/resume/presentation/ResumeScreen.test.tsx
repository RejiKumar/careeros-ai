import { render, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import { ApiError, type AssessmentResponse, type ResumeImportResponse } from "@/services/contract";

import ResumeScreen from "./ResumeScreen";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockImportResume = jest.fn();
const mockCreateAssessment = jest.fn();
const mockListResumes = jest.fn();
const mockGetResume = jest.fn();
const mockGetDocumentAsync = jest.fn();
const mockHandleUnauthorized = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    handleUnauthorized: mockHandleUnauthorized,
  }),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    importResume: (...args: unknown[]) => mockImportResume(...args),
    createAssessment: (...args: unknown[]) => mockCreateAssessment(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    getResume: (...args: unknown[]) => mockGetResume(...args),
  })),
}));

const parsedResume = {
  contact: {
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    location: "London",
    links: [],
  },
  summary: "Analytical and imaginative mathematician.",
  skills: ["Mathematics", "Analytical Writing"],
  experience: [
    {
      organization: "Analytical Engines Ltd",
      title: "Mathematician",
      start_date: "1843",
      end_date: null,
      bullets: ["Authored detailed algorithm notes."],
    },
  ],
  education: [
    {
      institution: "Home studies",
      degree: null,
      field_of_study: "Mathematics",
      start_date: null,
      end_date: null,
    },
  ],
  projects: [],
  certifications: [],
  languages: [],
};

const importResponse: ResumeImportResponse = {
  resume: {
    id: "resume-1",
    title: "ada.pdf",
    status: "ready",
    current_version_id: "v1",
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
  },
  version: {
    id: "v1",
    resume_id: "resume-1",
    version: 1,
    source: "upload",
    created_at: "2026-08-16T00:00:00Z",
  },
  parsed: parsedResume,
  file_url: null,
};

const assessmentResponse: AssessmentResponse = {
  id: "assessment-1",
  resume_id: "resume-1",
  scores: [
    {
      dimension: "Impact",
      score: 70,
      explanation: "Quantified outcomes are present in some bullets.",
    },
    { dimension: "Keywords", score: 40, explanation: "A few role keywords are missing." },
  ],
  strengths: ["Clear structure"],
  gaps: [{ description: "Limited metrics", suggestion: "Add numbers to your bullets." }],
  evidence: ["Two quantified achievements found"],
  created_at: "2026-08-16T00:00:00Z",
};

type Screen = Awaited<ReturnType<typeof render>>;

async function renderResume(): Promise<Screen> {
  return render(
    <ThemeProvider>
      <ResumeScreen />
    </ThemeProvider>,
  );
}

function pickFile(
  overrides: Partial<{ name: string; size: number; uri: string; mimeType: string }> = {},
) {
  mockGetDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        name: overrides.name ?? "resume.pdf",
        size: overrides.size ?? 1000,
        uri: overrides.uri ?? "file:///cache/resume.pdf",
        mimeType: overrides.mimeType ?? "application/pdf",
      },
    ],
  });
}

describe("ResumeScreen", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
    mockImportResume.mockClear();
    mockCreateAssessment.mockClear();
    mockListResumes.mockReset();
    mockGetResume.mockReset();
    mockListResumes.mockResolvedValue([]);
    mockGetDocumentAsync.mockClear();
    mockHandleUnauthorized.mockClear();
  });

  it("restores the latest parsed resume on mount", async () => {
    mockListResumes.mockResolvedValue([
      {
        id: "resume-1",
        title: "ada.pdf",
        status: "ready",
        current_version_id: "v1",
        created_at: "2026-08-16T00:00:00Z",
        updated_at: "2026-08-16T00:00:00Z",
      },
    ]);
    mockGetResume.mockResolvedValue({
      resume: importResponse.resume,
      version: importResponse.version,
      parsed: parsedResume,
      file_url: null,
    });

    const screen = await renderResume();

    expect(await screen.findByText(/Ada Lovelace/)).toBeOnTheScreen();
    expect(mockListResumes).toHaveBeenCalledWith("test-token", undefined);
    expect(mockGetResume).toHaveBeenCalledWith("test-token", "resume-1", undefined);
    expect(screen.queryByLabelText("No resume yet")).not.toBeOnTheScreen();
  });

  it("renders the journey steps and empty state", async () => {
    const screen = await renderResume();

    expect(screen.getByText("See how healthy your resume is")).toBeOnTheScreen();
    expect(screen.getByLabelText("No resume yet")).toBeOnTheScreen();
    expect(screen.getByText("Upload your resume")).toBeOnTheScreen();
  });

  it("stays idle when the document picker is cancelled", async () => {
    mockGetDocumentAsync.mockResolvedValueOnce({ canceled: true, assets: [] });
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));

    await waitFor(() => expect(mockGetDocumentAsync).toHaveBeenCalled());
    expect(screen.getByLabelText("Import resume")).toBeOnTheScreen();
    expect(mockImportResume).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file extension", async () => {
    pickFile({ name: "resume.exe" });
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));

    expect(await screen.findByText(/Unsupported file type/i)).toBeOnTheScreen();
    expect(mockImportResume).not.toHaveBeenCalled();
  });

  it("rejects an oversized file", async () => {
    pickFile({ name: "resume.pdf", size: 11 * 1024 * 1024 });
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));

    expect(await screen.findByText(/larger than 10 MB/i)).toBeOnTheScreen();
    expect(mockImportResume).not.toHaveBeenCalled();
  });

  it("uploads the file and shows the parsed resume", async () => {
    mockImportResume.mockResolvedValueOnce(importResponse);
    pickFile();
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));

    expect(await screen.findByText(/Ada Lovelace/)).toBeOnTheScreen();
    expect(mockImportResume).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ name: "resume.pdf" }),
      undefined,
    );
    expect(screen.getByText(/AI-extracted content/i)).toBeOnTheScreen();
  });

  it("shows an upload error with a retry that re-uploads", async () => {
    mockImportResume.mockRejectedValueOnce(new Error("Parsing failed"));
    pickFile();
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));

    expect(await screen.findByText("Parsing failed")).toBeOnTheScreen();

    mockImportResume.mockResolvedValueOnce(importResponse);
    await user.press(screen.getByLabelText("Try again"));

    expect(await screen.findByText(/Ada Lovelace/)).toBeOnTheScreen();
    expect(mockImportResume).toHaveBeenCalledTimes(2);
  });

  it("requests and renders the health score", async () => {
    mockImportResume.mockResolvedValueOnce(importResponse);
    mockCreateAssessment.mockResolvedValueOnce(assessmentResponse);
    pickFile();
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));
    await screen.findByText(/Ada Lovelace/);

    await user.press(screen.getByLabelText("Get my health score"));

    expect(await screen.findByLabelText(/Overall health score 55 out of 100/)).toBeOnTheScreen();
    expect(screen.getByText("Impact")).toBeOnTheScreen();
    expect(screen.getByText("70/100")).toBeOnTheScreen();
    expect(screen.getByText(/Clear structure/)).toBeOnTheScreen();
    expect(screen.getByText(/Limited metrics/)).toBeOnTheScreen();
    expect(mockCreateAssessment).toHaveBeenCalledWith("test-token", "resume-1", undefined);
  });

  it("handles a session expiry during upload", async () => {
    mockImportResume.mockRejectedValueOnce(new ApiError(401, "Unauthorized"));
    pickFile();
    const screen = await renderResume();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Import resume"));

    await waitFor(() => expect(mockHandleUnauthorized).toHaveBeenCalled());
  });
});
