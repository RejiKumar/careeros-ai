import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
} from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth";
import { setupNotifications } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { initAdMob } from "@/ui/AdBanner";

function ThemedStatusBar() {
  const { colorScheme, theme } = useTheme();
  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setBackgroundColor(colorScheme === "dark" ? "#14181D" : theme.colors.surface);
    }
  }, [colorScheme, theme]);
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

function RestoringScreen() {
  const { theme } = useTheme();
  return (
    <View style={[styles.restoring, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel="Loading" />
    </View>
  );
}

function RootNavigator() {
  const router = useRouter();
  const { status, session, guestId } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signedOut" && pathname !== "/auth") {
      router.replace("/auth");
    }
  }, [status, pathname, router]);

  useEffect(() => {
    if (status === "restoring") {
      return;
    }
    const accessToken = session?.access_token;
    let cleanup: (() => void) | undefined;
    void setupNotifications(status, accessToken, guestId).then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [status, session, guestId]);

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initAdMob();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  restoring: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
