import "@testing-library/react-native/dist/matchers/extend-expect";

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
