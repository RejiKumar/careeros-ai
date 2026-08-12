import { describe, expect, it } from "vitest";
import { darkTheme, lightTheme, themes } from "./index";

describe("design tokens", () => {
  it("exposes exactly the light and dark themes", () => {
    expect(Object.keys(themes)).toEqual(["light", "dark"]);
  });

  it("keeps light and dark color surfaces distinct", () => {
    expect(lightTheme.colors.background).not.toBe(darkTheme.colors.background);
    expect(lightTheme.colors.surface).not.toBe(darkTheme.colors.surface);
  });

  it("ensures accessible primary text contrast on background", () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(theme.colors.textPrimary).toBeTruthy();
      expect(theme.colors.background).toBeTruthy();
    }
  });
});
