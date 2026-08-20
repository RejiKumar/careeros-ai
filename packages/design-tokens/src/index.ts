export const spacing = {
  "space-1": 4,
  "space-2": 8,
  "space-3": 12,
  "space-4": 16,
  "space-5": 20,
  "space-6": 24,
  "space-8": 32,
  "space-10": 40,
  "space-12": 48,
  "space-16": 64,
} as const;

export type SpacingToken = keyof typeof spacing;

export const radius = {
  "radius-sm": 8,
  "radius-md": 12,
  "radius-lg": 16,
  "radius-xl": 24,
  "radius-full": 9999,
} as const;

export type RadiusToken = keyof typeof radius;

export const typography = {
  fontFamily: {
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
  fontSize: {
    "text-xs": 12,
    "text-sm": 14,
    "text-base": 16,
    "text-lg": 18,
    "text-xl": 20,
    "text-2xl": 24,
    "text-3xl": 30,
    "text-4xl": 36,
  },
  lineHeight: {
    "text-xs": 16,
    "text-sm": 20,
    "text-base": 24,
    "text-lg": 28,
    "text-xl": 28,
    "text-2xl": 32,
    "text-3xl": 40,
    "text-4xl": 48,
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  } as const,
} as const;

export const motion = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  reducedMotionDuration: {
    fast: 0,
    normal: 0,
    slow: 150,
  },
} as const;

export const gradients = {
  brand: ["#5B5BF0", "#B34AF0"] as const,
  hero: ["#4F46E5", "#9333EA", "#38BDF8"] as const,
  success: ["#16A34A", "#22C55E"] as const,
  accent: ["#38BDF8", "#5B5BF0"] as const,
  subtle: ["rgba(91, 91, 240, 0.10)", "rgba(179, 74, 240, 0.08)"] as const,
  glass: ["rgba(255, 255, 255, 0.55)", "rgba(255, 255, 255, 0.25)"] as const,
} as const;

export const shadows = {
  card: {
    shadowColor: "#14181D",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  } as const,
  elevated: {
    shadowColor: "#14181D",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  } as const,
  floating: {
    shadowColor: "#14181D",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as const,
} as const;

export type GradientToken = keyof typeof gradients;

export const colorPalette = {
  primary: "#5B5BF0",
  "primary-strong": "#3E3ED8",
  "primary-soft": "#E8E8FD",
  secondary: "#B34AF0",
  accent: "#38BDF8",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  neutral: {
    "0": "#FFFFFF",
    "50": "#F7F8FA",
    "100": "#EEF0F4",
    "200": "#DFE3EA",
    "300": "#C3C9D4",
    "400": "#98A1B0",
    "500": "#6B7585",
    "600": "#4B5563",
    "700": "#38414E",
    "800": "#232A33",
    "900": "#14181D",
  },
  aurora: {
    violet: "rgba(91, 91, 240, 0.55)",
    magenta: "rgba(179, 74, 240, 0.45)",
    cyan: "rgba(56, 189, 248, 0.45)",
  },
} as const;

export interface ThemeTokens {
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    textPrimary: string;
    textSecondary: string;
    textDisabled: string;
    border: string;
    primary: string;
    primaryStrong: string;
    primarySoft: string;
    onPrimary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    onDanger: string;
    aurora: typeof colorPalette.aurora;
  };
  gradients: typeof gradients;
  shadows: typeof shadows;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
}

export const lightTheme: ThemeTokens = {
  colors: {
    background: colorPalette.neutral["50"],
    surface: colorPalette.neutral["0"],
    surfaceRaised: colorPalette.neutral["100"],
    textPrimary: colorPalette.neutral["900"],
    textSecondary: colorPalette.neutral["600"],
    textDisabled: colorPalette.neutral["500"],
    border: colorPalette.neutral["200"],
    primary: colorPalette.primary,
    primaryStrong: colorPalette["primary-strong"],
    primarySoft: colorPalette["primary-soft"],
    onPrimary: colorPalette.neutral["0"],
    secondary: colorPalette.secondary,
    accent: colorPalette.accent,
    success: colorPalette.success,
    warning: colorPalette.warning,
    danger: colorPalette.danger,
    onDanger: colorPalette.neutral["0"],
    aurora: colorPalette.aurora,
  },
  gradients,
  shadows,
  spacing,
  radius,
  typography,
  motion,
};

export const darkTheme: ThemeTokens = {
  colors: {
    background: colorPalette.neutral["900"],
    surface: colorPalette.neutral["800"],
    surfaceRaised: colorPalette.neutral["700"],
    textPrimary: colorPalette.neutral["50"],
    textSecondary: colorPalette.neutral["300"],
    textDisabled: colorPalette.neutral["400"],
    border: colorPalette.neutral["700"],
    primary: colorPalette.primary,
    primaryStrong: colorPalette["primary-strong"],
    primarySoft: "rgba(91, 91, 240, 0.18)",
    onPrimary: colorPalette.neutral["0"],
    secondary: colorPalette.secondary,
    accent: colorPalette.accent,
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    onDanger: colorPalette.neutral["900"],
    aurora: colorPalette.aurora,
  },
  gradients,
  shadows,
  spacing,
  radius,
  typography,
  motion,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export type ThemeName = keyof typeof themes;
