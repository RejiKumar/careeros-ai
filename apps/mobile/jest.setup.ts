import "@testing-library/react-native/dist/matchers/extend-expect";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaConsumer: ({ children }: { children: (insets: Record<string, number>) => React.ReactNode }) =>
    children({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  initialWindowMetrics: {
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    frame: { x: 0, y: 0, width: 390, height: 844 },
  },
}));

jest.mock("react-native-google-mobile-ads", () => {
  const mockAd = {
    load: jest.fn(),
    show: jest.fn(),
    onAdLoaded: jest.fn(),
    onAdFailedToLoad: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      initialize: jest.fn().mockResolvedValue(undefined),
      setRequestConfiguration: jest.fn().mockResolvedValue(undefined),
    },
    BannerAd: Object.assign(
      jest.fn((_props: unknown) => null),
      { displayName: "BannerAd" },
    ),
    BannerAdSize: {
      BANNER: "BANNER",
      LARGE_BANNER: "LARGE_BANNER",
      MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
      FULL_WIDTH: "FULL_WIDTH",
      ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER",
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => mockAd),
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => mockAd),
    },
    RewardedAdEventType: {
      EarnedReward: "earned_reward",
    },
    TestIds: {
      BANNER: "ca-app-pub-3940256099942544/6300978111",
      INTERSTITIAL: "ca-app-pub-3940256099942544/1033173712",
      REWARDED: "ca-app-pub-3940256099942544/5224354917",
    },
    useForeground: jest.fn(),
    useInterstitialAd: jest.fn(() => ({ isLoaded: false, show: jest.fn(), load: jest.fn() })),
    useRewardedAd: jest.fn(() => ({
      isLoaded: false,
      show: jest.fn(),
      load: jest.fn(),
      reward: null,
    })),
  };
});

jest.mock("expo-speech-recognition", () => {
  const mockListeners = new Map();
  (globalThis as { __speechListeners?: unknown }).__speechListeners = mockListeners;
  const runtime = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo;
  if (runtime !== undefined) {
    runtime.modules = runtime.modules ?? {};
    runtime.modules.ExpoSpeechRecognition = {};
  }
  return {
    ExpoSpeechRecognitionModule: {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      requestPermissionsAsync: jest.fn().mockResolvedValue(true),
      isRecognitionAvailable: jest.fn().mockResolvedValue(true),
      getSupportedLocales: jest.fn().mockResolvedValue([]),
      addListener: jest.fn((eventName: string, handler: (payload: unknown) => void) => {
        mockListeners.set(eventName, handler);
        return { remove: () => mockListeners.delete(eventName) };
      }),
    },
    useSpeechRecognitionEvent: () => undefined,
  };
});
