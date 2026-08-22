import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface SpeechToTextButtonProps {
  onResult: (text: string) => void;
  color: string;
  activeColor: string;
  size?: number;
  label?: string;
}

type SpeechModule = typeof import("expo-speech-recognition");

interface Listener {
  remove: () => void;
}

export default function SpeechToTextButton({
  onResult,
  color,
  activeColor,
  size = 20,
  label = "Voice input",
}: SpeechToTextButtonProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moduleRef = useRef<SpeechModule | null>(null);
  const listenersRef = useRef<Listener[]>([]);

  function getModule(): SpeechModule | null {
    if (moduleRef.current !== null) {
      return moduleRef.current;
    }
    const runtimeModules = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo
      ?.modules;
    if (runtimeModules?.["ExpoSpeechRecognition"] === undefined) {
      moduleRef.current = null;
      return null;
    }
    try {
      // Lazy require keeps Expo Go working (the native module only exists in dev builds).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      moduleRef.current = require("expo-speech-recognition") as SpeechModule;
    } catch {
      moduleRef.current = null;
    }
    return moduleRef.current;
  }

  useEffect(
    () => () => {
      for (const listener of listenersRef.current) {
        listener.remove();
      }
      listenersRef.current = [];
    },
    [],
  );

  async function handlePress() {
    const mod = getModule();
    if (mod === null) {
      setError("Voice input is not available in this build.");
      return;
    }
    const api = mod.ExpoSpeechRecognitionModule;
    if (listening) {
      await api.stop();
      return;
    }
    setError(null);
    try {
      if (!(await api.isRecognitionAvailable())) {
        setError("Speech recognition is not available on this device.");
        return;
      }
      const granted = await api.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone permission is required for voice input.");
        return;
      }
      for (const listener of listenersRef.current) {
        listener.remove();
      }
      listenersRef.current = [
        api.addListener("start", () => {
          setListening(true);
          setError(null);
        }),
        api.addListener("end", () => setListening(false)),
        api.addListener("result", (event: { results: { transcript?: string }[] }) => {
          const transcript = event.results[0]?.transcript;
          if (transcript !== undefined && transcript !== "") {
            onResult(transcript);
          }
        }),
        api.addListener("error", (event: { message?: string; error?: string }) => {
          setListening(false);
          setError(event.message || event.error || "Voice input failed.");
        }),
      ];
      await api.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
        addsPunctuation: false,
        requiresOnDeviceRecognition: false,
      });
    } catch {
      setError("Voice input could not start right now.");
    }
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: listening }}
        onPress={() => void handlePress()}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: listening ? activeColor : "transparent" },
          pressed && styles.pressed,
        ]}
      >
        {listening ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="mic-outline" size={size} color={color} />
        )}
      </Pressable>
      {listening && <Text style={[styles.hint, { color: activeColor }]}>Listening\u2026</Text>}
      {error !== null && !listening && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  hint: {
    position: "absolute",
    top: 40,
    right: 0,
    fontSize: 12,
  },
  error: {
    position: "absolute",
    top: 40,
    right: 0,
    fontSize: 10,
    color: "#D93025",
    maxWidth: 180,
  },
});
