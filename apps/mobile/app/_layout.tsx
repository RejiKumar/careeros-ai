import { Redirect, Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth";
import { setupNotifications } from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { initAdMob } from "@/ui/AdBanner";

// The app draws edge to edge (Android 15+), so the status bar has no background
// colour to set: only the icon style follows the theme.
function ThemedStatusBar() {
  const { colorScheme } = useTheme();
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

/** Widest the app content gets; on tablets and landscape it is centred, not stretched. */
export const MAX_CONTENT_WIDTH = 720;

function RootNavigator() {
  const { theme } = useTheme();
  const { status, session, guestId } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    void setupNotifications(status, session?.access_token, guestId).then((remove) => {
      if (cancelled) {
        remove();
      } else {
        cleanup = remove;
      }
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [status, session?.access_token, guestId]);

  if (status === "restoring") {
    return <RestoringScreen />;
  }

  if (status === "signedOut" && !pathname.startsWith("/auth")) {
    return <Redirect href="/auth" />;
  }

  if (status === "signedIn" && pathname.startsWith("/auth")) {
    return <Redirect href="/" />;
  }

  return (
    <View style={[styles.canvas, { backgroundColor: theme.colors.background }]}>
      <ThemedStatusBar />
      <View style={styles.column}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void initAdMob();
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
  canvas: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: "center",
  },
  restoring: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
