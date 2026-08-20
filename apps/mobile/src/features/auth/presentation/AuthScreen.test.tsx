import { render, userEvent, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";

import AuthScreen from "./AuthScreen";

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
}));

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    status: "signedOut",
    session: null,
    signIn: mockSignIn,
    signUp: mockSignUp,
    googleSignIn: mockGoogleSignIn,
    signOut: jest.fn(),
    handleUnauthorized: jest.fn(),
  }),
}));

type Screen = Awaited<ReturnType<typeof render>>;

async function renderAuth(): Promise<Screen> {
  return render(
    <ThemeProvider>
      <AuthScreen />
    </ThemeProvider>,
  );
}

async function submit(screen: Screen, email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.press(screen.getByLabelText("Sign in"));
}

describe("AuthScreen", () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockSignUp.mockClear();
    mockGoogleSignIn.mockClear();
    mockReplace.mockClear();
  });

  it("calls Google sign in and navigates home on success", async () => {
    mockGoogleSignIn.mockResolvedValueOnce(undefined);
    const screen = await renderAuth();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Continue with Google"));

    await waitFor(() => expect(mockGoogleSignIn).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows the Google error inline when sign in fails", async () => {
    mockGoogleSignIn.mockRejectedValueOnce(new Error("Google sign in failed"));
    const screen = await renderAuth();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Continue with Google"));

    expect(await screen.findByText("Google sign in failed")).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("rejects empty fields without calling the auth service", async () => {
    const screen = await renderAuth();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Sign in"));

    expect(await screen.findByText(/enter your email/i)).toBeOnTheScreen();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    const screen = await renderAuth();

    await submit(screen, "not-an-email", "password123");

    expect(await screen.findByText(/valid email/i)).toBeOnTheScreen();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects a short password", async () => {
    const screen = await renderAuth();

    await submit(screen, "you@example.com", "123");

    expect(await screen.findByText(/at least 6 characters/i)).toBeOnTheScreen();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("calls sign in and navigates home on success", async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const screen = await renderAuth();

    await submit(screen, "you@example.com", "password123");

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith("you@example.com", "password123"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows the auth error inline", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("Invalid login credentials"));
    const screen = await renderAuth();

    await submit(screen, "you@example.com", "wrong-password");

    expect(await screen.findByText("Invalid login credentials")).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("switches to account creation and calls sign up", async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const screen = await renderAuth();
    const user = userEvent.setup();

    await user.press(screen.getByLabelText("New here? Create an account"));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.press(screen.getByLabelText("Create account"));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123"),
    );
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});

describe("AuthScreen password visibility", () => {
  it("toggles the password field between hidden and visible", async () => {
    const screen = await renderAuth();
    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput.props.secureTextEntry).toBe(true);

    await user.press(screen.getByLabelText("Show password"));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);

    await user.press(screen.getByLabelText("Hide password"));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });
});
