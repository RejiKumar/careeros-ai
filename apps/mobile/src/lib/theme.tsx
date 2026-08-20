import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

import { darkTheme, lightTheme, type ThemeTokens } from "@careeros/design-tokens";

interface ThemeContextValue {
  theme: ThemeTokens;
  colorScheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: colorScheme === "dark" ? darkTheme : lightTheme, colorScheme }),
    [colorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
