import { render } from "@testing-library/react-native";

import { ThemeProvider } from "@/lib/theme";

import IconChip from "./IconChip";

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

describe("IconChip", () => {
  function iconColor(root: Awaited<ReturnType<typeof render>>): string | undefined {
    const style = root.getByTestId("icon").props.style;
    const flat = Array.isArray(style) ? style : [style];
    for (const entry of flat) {
      if (entry !== null && typeof entry === "object" && "color" in entry) {
        return (entry as { color: string }).color;
      }
    }
    return undefined;
  }

  it("uses a white icon on a gradient so the icon stays visible", async () => {
    const root = await render(
      <ThemeProvider>
        <IconChip name="document-text" size={46} gradient={["#5B5BF0", "#B34AF0"]} />
      </ThemeProvider>,
    );

    expect(iconColor(root)).toBe("#FFFFFF");
  });

  it("keeps the primary icon color on a plain chip", async () => {
    const root = await render(
      <ThemeProvider>
        <IconChip name="flag" size={36} />
      </ThemeProvider>,
    );

    expect(iconColor(root)).toBe("#5B5BF0");
  });

  it("respects an explicit icon color over the gradient default", async () => {
    const root = await render(
      <ThemeProvider>
        <IconChip name="flash" size={40} gradient={["#38BDF8", "#5B5BF0"]} color="#123456" />
      </ThemeProvider>,
    );

    expect(iconColor(root)).toBe("#123456");
  });
});
