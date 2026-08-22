import type { ConfigContext, ExpoConfig } from "expo/config";

export type AppEnvironment = "dev" | "qa" | "prod";

const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? "dev") as AppEnvironment;

const profiles: Record<AppEnvironment, Partial<ExpoConfig>> = {
  dev: {
    name: "CareerOS AI (Dev)",
    slug: "careeros-ai",
    scheme: "careerosdev",
    version: "1.0.0",
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
    version: "1.0.0",
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
    version: "1.0.0",
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
    version: profile.version ?? config.version ?? "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/careerosai_icon.png",
    android: {
      ...profile.android,
      adaptiveIcon: {
        foregroundImage: "./assets/careerosai_icon.png",
        backgroundColor: "#000000",
      },
    },
    experiments: {
      typedRoutes: false,
    },
    extra: {
      eas: {
        projectId: "49fb8f3d-8cde-4870-b988-14f3b707a47c",
      },
    },
    plugins: [
      "expo-router",
      "expo-speech-recognition",
      "./plugins/withAdMobManifest",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#000000",
        },
      ],
      [
        "react-native-google-mobile-ads",
        {
          user_tracking_usage_description: "This identifier will be used to deliver personalized ads to you.",
        },
      ],
    ],
  };
};
