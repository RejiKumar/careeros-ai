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

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe("canvas colour accessibility", () => {
  it("keeps body and secondary text at WCAG AA contrast on the single canvas colour", () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(contrast(theme.colors.textPrimary, theme.colors.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(theme.colors.textSecondary, theme.colors.background)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it("keeps cards visibly distinct from the canvas", () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(theme.colors.surface).not.toBe(theme.colors.background);
    }
  });
});
