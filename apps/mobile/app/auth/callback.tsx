import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { isOAuthRedirectUrl } from "@/services/supabase";
import AppBackground from "@/ui/AppBackground";
import GradientButton from "@/ui/GradientButton";
import { t } from "@/i18n";

export default function AuthCallbackRoute() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const { status, handleOAuthRedirect } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (cancelled) {
          return;
        }
        if (initialUrl !== null && isOAuthRedirectUrl(initialUrl)) {
          await handleOAuthRedirect(initialUrl);
          return;
        }
        // Warm resume: the redirect is usually already being handled by the
        // auth provider's Linking listener (e.g. implicit-flow tokens in the
        // URL hash, which are not visible to this route). Wait briefly for it,
        // then fall back to the login screen only if still signed out.
        await new Promise((resolveWait) => setTimeout(resolveWait, 1500));
        if (cancelled) {
          return;
        }
        if (statusRef.current === "signedOut") {
          router.replace("/auth");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("auth.confirmFailed"));
        }
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [router, handleOAuthRedirect]);

  return (
    <AppBackground>
      <View style={styles.container}>
        {error === null ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Signing in" />
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t("auth.confirming")}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t("auth.confirmFailed")}
            </Text>
            <Text style={[styles.detail, { color: colors.textSecondary }]}>{error}</Text>
            <GradientButton
              label={t("auth.retry")}
              accessibilityLabel={t("auth.retry")}
              onPress={() => router.replace("/auth")}
              style={styles.button}
            />
          </>
        )}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    textAlign: "center",
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    minWidth: 200,
  },
});