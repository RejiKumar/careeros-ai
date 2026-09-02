import type { ConfigContext, ExpoConfig } from "expo/config";

export type AppEnvironment = "dev" | "prod";

const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? "dev") as AppEnvironment;

// EAS Build provides the git-ignored google-services.json via a file-type
// environment variable; fall back to the local file for local builds.
const GOOGLE_SERVICES_FILE =
  process.env.GOOGLE_SERVICES_JSON || "./google-services.json";

const ADMOB_IDS = {
  dev: {
    androidAppId: "ca-app-pub-3940256099942544~3347511713",
    iosAppId: "ca-app-pub-3940256099942544~1458002511",
    bannerUnitId: {
      android: "ca-app-pub-3940256099942544/6300978111",
      ios: "ca-app-pub-3940256099942544/2934735716",
    },
  },
  prod: {
    androidAppId: "ca-app-pub-3342123808291001~3690375670",
    iosAppId: "ca-app-pub-3342123808291001~3690375670",
    bannerUnitId: {
      android: "ca-app-pub-3342123808291001/4771523057",
      ios: "ca-app-pub-3342123808291001/4771523057",
    },
  },
} as const;

const admob = ADMOB_IDS[APP_ENV];

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
  prod: {
    name: "CareerOS AI",
    slug: "careeros-ai",
    scheme: "careerosai",
    version: "1.0.0",
    android: {
      package: "ai.careeros.app",
      versionCode: 7,
      googleServicesFile: GOOGLE_SERVICES_FILE,
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
      "./plugins/withNewArchDisabled",
      [
        "expo-notifications",
        {
          defaultChannel: "default",
        },
      ],
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
          androidAppId: admob.androidAppId,
          iosAppId: admob.iosAppId,
          user_tracking_usage_description:
            "This identifier will be used to deliver personalized ads to you.",
        },
      ],
    ],
  };
};
