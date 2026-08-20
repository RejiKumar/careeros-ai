import { render, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import { ApiError } from "@/services/contract";

import InterviewScreen from "./InterviewScreen";

const mockListResumes = jest.fn();
const mockCreateInterviewSession = jest.fn();
const mockGetInterviewSession = jest.fn();
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
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    createInterviewSession: (...args: unknown[]) => mockCreateInterviewSession(...args),
    getInterviewSession: (...args: unknown[]) => mockGetInterviewSession(...args),
    listInterviewSessions: (...args: unknown[]) => jest.fn()(...args),
    submitInterviewAnswer: (...args: unknown[]) => jest.fn()(...args),
  })),
}));

const session = {
  id: "s1",
  mode: "hr",
  target_job: null,
  target_skills: [],
  status: "active",
  created_at: "2026-08-20T00:00:00Z",
};

const sessionDetail = {
  session,
  questions: [{ id: "q1", question: "Tell me about yourself.", focus: "Introduction" }],
};

describe("InterviewScreen", () => {
  beforeEach(() => {
    mockListResumes.mockResolvedValue([]);
    mockCreateInterviewSession.mockResolvedValue(sessionDetail);
  });

  it("shows the session-creation error message when starting fails", async () => {
    mockCreateInterviewSession.mockRejectedValue(new ApiError(502, "The interview could not be prepared right now. Please try again.", "ai_provider_error"));

    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <InterviewScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Interview mode: HR")).toBeOnTheScreen());
    const user = userEvent.setup();
    await user.press(getByLabelText("Interview mode: HR"));
    await user.press(getByLabelText("Start session"));

    await waitFor(() =>
      expect(getByText("The interview could not be prepared right now. Please try again.")).toBeOnTheScreen(),
    );
    expect(mockHandleUnauthorized).not.toHaveBeenCalled();
  });

  it("enters the session view with questions when starting succeeds", async () => {
    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <InterviewScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Interview mode: HR")).toBeOnTheScreen());
    const user = userEvent.setup();
    await user.press(getByLabelText("Interview mode: HR"));
    await user.press(getByLabelText("Start session"));

    await waitFor(() => expect(getByText("Tell me about yourself.")).toBeOnTheScreen());
  });
});
