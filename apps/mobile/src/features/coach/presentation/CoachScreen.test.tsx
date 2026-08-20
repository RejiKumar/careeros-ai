import { fireEvent, render, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";
import { ApiError, type CoachThreadResponse } from "@/services/contract";

import CoachScreen from "./CoachScreen";

const mockListCoachThreads = jest.fn();
const mockListResumes = jest.fn();
const mockCreateCoachThread = jest.fn();
const mockGetCoachThread = jest.fn();
const mockSendCoachMessage = jest.fn();
const mockDeleteCoachThread = jest.fn();
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
    listCoachThreads: (...args: unknown[]) => mockListCoachThreads(...args),
    listResumes: (...args: unknown[]) => mockListResumes(...args),
    createCoachThread: (...args: unknown[]) => mockCreateCoachThread(...args),
    getCoachThread: (...args: unknown[]) => mockGetCoachThread(...args),
    sendCoachMessage: (...args: unknown[]) => mockSendCoachMessage(...args),
    deleteCoachThread: (...args: unknown[]) => mockDeleteCoachThread(...args),
  })),
}));

const thread: CoachThreadResponse = {
  id: "t1",
  title: "Career switch advice",
  resume_id: "r1",
  job_description_id: null,
  created_at: "2026-08-19T00:00:00Z",
  updated_at: "2026-08-19T00:00:00Z",
};

describe("CoachScreen", () => {
  beforeEach(() => {
    mockListCoachThreads.mockResolvedValue([thread]);
    mockListResumes.mockResolvedValue([]);
  });

  it("renders the conversation list", async () => {
    const { getByText } = await render(
      <ThemeProvider>
        <CoachScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("Career switch advice")).toBeOnTheScreen());
    expect(getByText("New conversation")).toBeOnTheScreen();
  });

  it("shows the empty state when there are no conversations", async () => {
    mockListCoachThreads.mockResolvedValue([]);

    const { getByText } = await render(
      <ThemeProvider>
        <CoachScreen />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(getByText(/No conversations yet/)).toBeOnTheScreen(),
    );
  });

  it("shows an error with retry when loading conversations fails", async () => {
    mockListCoachThreads.mockRejectedValue(new ApiError(500, "Server error", null));

    const { getByText, getByLabelText } = await render(
      <ThemeProvider>
        <CoachScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByText("Server error")).toBeOnTheScreen());

    mockListCoachThreads.mockResolvedValue([thread]);
    fireEvent.press(getByLabelText("Try again"));

    await waitFor(() => expect(getByText("Career switch advice")).toBeOnTheScreen());
  });

  it("opens a thread and shows the conversation messages", async () => {
    mockGetCoachThread.mockResolvedValue({
      thread,
      messages: [
        { id: "m1", thread_id: "t1", role: "user", content: "Should I switch to AI?", created_at: "2026-08-19T00:00:00Z" },
        { id: "m2", thread_id: "t1", role: "assistant", content: "It depends on your goals.", created_at: "2026-08-19T00:00:00Z" },
      ],
    });

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <CoachScreen />
      </ThemeProvider>,
    );

    await waitFor(() => expect(getByLabelText("Open conversation Career switch advice")).toBeOnTheScreen());
    fireEvent.press(getByLabelText("Open conversation Career switch advice"));

    await waitFor(() => expect(getByText("Should I switch to AI?")).toBeOnTheScreen());
    expect(getByText("It depends on your goals.")).toBeOnTheScreen();
  });

  it("sends a message and appends the coach reply", async () => {
    mockGetCoachThread.mockResolvedValue({ thread, messages: [] });
    mockSendCoachMessage.mockResolvedValue({
      user_message: { id: "u1", thread_id: "t1", role: "user", content: "What is a good next step?", created_at: "2026-08-19T00:00:00Z" },
      assistant_message: { id: "a1", thread_id: "t1", role: "assistant", content: "Focus on measurable achievements.", created_at: "2026-08-19T00:00:00Z" },
    });

    const { getByLabelText, getByText } = await render(
      <ThemeProvider>
        <CoachScreen />
      </ThemeProvider>,
    );
    const user = userEvent.setup();

    await waitFor(() => expect(getByLabelText("Open conversation Career switch advice")).toBeOnTheScreen());
    await user.press(getByLabelText("Open conversation Career switch advice"));
    await waitFor(() => expect(getByLabelText("Ask your career question\u2026")).toBeOnTheScreen());

    await user.type(getByLabelText("Ask your career question\u2026"), "What is a good next step?");
    await user.press(getByLabelText("Send"));

    await waitFor(() => expect(getByText("Focus on measurable achievements.")).toBeOnTheScreen());
  });
});
