import type { ConfigContext, ExpoConfig } from "expo/config";

export type AppEnvironment = "dev" | "qa" | "prod";

const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? "dev") as AppEnvironment;

const profiles: Record<AppEnvironment, Partial<ExpoConfig>> = {
  dev: {
    name: "CareerOS AI (Dev)",
    slug: "careeros-ai",
    scheme: "careerosdev",
    version: "0.1.0",
    android: {
      package: "ai.careeros.app.dev",
      versionCode: 1,
    },
    ios: {
      bundleIdentifier: "ai.careeros.app.dev",
      supportsTablet: false,
    },
  },
  qa: {
    name: "CareerOS AI (QA)",
    slug: "careeros-ai",
    scheme: "careerosqa",
    version: "0.1.0",
    android: {
      package: "ai.careeros.app.qa",
      versionCode: 1,
    },
    ios: {
      bundleIdentifier: "ai.careeros.app.qa",
      supportsTablet: false,
    },
  },
  prod: {
    name: "CareerOS AI",
    slug: "careeros-ai",
    scheme: "careerosai",
    version: "0.1.0",
    android: {
      package: "ai.careeros.app",
      versionCode: 1,
    },
    ios: {
      bundleIdentifier: "ai.careeros.app",
      supportsTablet: false,
    },
  },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = profiles[APP_ENV];

  return {
    ...config,
    ...profile,
    name: profile.name ?? config.name ?? "CareerOS AI",
    slug: profile.slug ?? config.slug ?? "careeros-ai",
    version: profile.version ?? config.version ?? "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/icon.png",
    android: {
      ...profile.android,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000",
      },
    },
    experiments: {
      typedRoutes: false,
    },
    plugins: [
      "expo-router",
      "expo-speech-recognition",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#000000",
        },
      ],
    ],
  };
};
