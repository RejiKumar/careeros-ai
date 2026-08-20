import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";

function ThemedStatusBar() {
  const { colorScheme } = useTheme();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

function RestoringScreen() {
  return (
    <View style={styles.restoring}>
      <ActivityIndicator size="large" color="#26CBF0" accessibilityLabel="Loading" />
    </View>
  );
}

function RootNavigator() {
  const router = useRouter();
  const { status } = useAuth();
  const pathname = usePathname();

  // Navigate imperatively so the Stack stays mounted; a render-time <Redirect>
  // in place of the Stack unmounts the navigator mid-navigation and can loop.
  useEffect(() => {
    if (status === "signedOut" && pathname !== "/auth") {
      router.replace("/auth");
    }
  }, [status, pathname, router]);

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
    backgroundColor: "#000000",
  },
});
