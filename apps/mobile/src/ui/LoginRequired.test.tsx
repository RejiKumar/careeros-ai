import { fireEvent, render } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";

import { LoginRequiredBanner, LoginRequiredScreen } from "./LoginRequired";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockCreateElement = require("react").createElement;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockText = require("react-native").Text;
  return {
    Ionicons: (props: { name: string; size: number; color: string }) =>
      mockCreateElement(mockText, {
        testID: "icon",
        style: { color: props.color, fontFamily: "icon", fontSize: props.size },
        children: props.name,
      }),
  };
});

describe("LoginRequired", () => {
  afterEach(() => {
    mockPush.mockReset();
  });

  it("shows the login message and sends the user to /auth", async () => {
    const root = await render(
      <ThemeProvider>
        <LoginRequiredScreen />
      </ThemeProvider>,
    );

    expect(root.getByText("Log in to use this feature")).toBeTruthy();
    expect(root.getByText("Log in")).toBeTruthy();
    fireEvent.press(root.getByText("Log in"));
    expect(mockPush).toHaveBeenCalledWith("/auth");
  });

  it("banner dismisses through the exposed callback", async () => {
    const onDismiss = jest.fn();
    const root = await render(
      <ThemeProvider>
        <LoginRequiredBanner onDismiss={onDismiss} />
      </ThemeProvider>,
    );

    expect(root.getByText("Log in to use this feature")).toBeTruthy();
    fireEvent.press(root.getByText("Not now"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});