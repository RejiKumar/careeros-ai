import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t } from "../../../i18n";
import { ApiClient } from "@/services/api";
import { ApiError, type EntitlementResponse, type UserResponse } from "@/services/contract";
import { getSupabaseClient } from "@/services/supabase";
import AchievementsSection from "@/features/achievements/presentation/AchievementsSection";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";

type ProfileState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; user: UserResponse; entitlements: EntitlementResponse | null };

const apiClient = new ApiClient();

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, signOut, handleUnauthorized } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      if (isGuest) {
        setState({
          status: "success",
          user: { id: guestId ?? "guest", email: "Guest User", role: "guest" },
          entitlements: null,
        });
        return;
      }
      if (accessToken === undefined) {
        void handleUnauthorized();
        return;
      }
      const [user, entitlements] = await Promise.all([
        apiClient.getMe(accessToken),
        apiClient.getEntitlements(accessToken).catch(() => null),
      ]);
      setState({ status: "success", user, entitlements });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : t("profile.couldNotLoad"),
        });
      }
    }
  }, [accessToken, guestId, isGuest, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handlePasswordReset() {
    const email = state.status === "success" ? state.user.email : null;
    if (email === null || resetting) {
      return;
    }
    setResetting(true);
    setResetMessage(null);
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: "careerosai://reset-password",
      });
      if (error) {
        setResetMessage(t("profile.resetFailed"));
      } else {
        setResetMessage(t("profile.resetSent"));
      }
    } catch {
      setResetMessage(t("profile.resetFailed"));
    } finally {
      setResetting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(t("profile.deleteTitle"), t("profile.deleteBody"), [
      { text: "Cancel", style: "cancel" },
      {
        text: t("profile.deleteAccount"),
        style: "destructive",
        onPress: () => void handleDeleteAccount(),
      },
    ]);
  }

  async function handleDeleteAccount() {
    if (isGuest) {
      await signOut();
      return;
    }
    if (accessToken === undefined || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await apiClient.deleteAccount(accessToken);
      await getSupabaseClient().auth.signOut();
      await signOut();
    } catch {
      setDeleting(false);
      Alert.alert(t("profile.deleteError"), t("profile.deleteErrorBody"));
    }
  }

  if (state.status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Loading profile"
        />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          {t("profile.errorTitle")}
        </Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{state.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading profile"
          onPress={() => void load()}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.onPrimary }]}>
            {t("common.tryAgain")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const { user, entitlements } = state;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader eyebrow={t("profile.eyebrow")} title={t("profile.title")} />

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
            {t("profile.email")}
          </Text>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{user.email ?? "—"}</Text>
          {!isGuest && (
            <>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                {t("profile.role")}
              </Text>
              <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
                {user.role ?? "member"}
              </Text>
            </>
          )}
        </View>

        {entitlements !== null && (
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
              {t("profile.plan")}
            </Text>
            <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
              {entitlements.plan} · {entitlements.status}
            </Text>
            {Object.entries(entitlements.usage).map(([feature, used]) => {
              const limit = entitlements.limits[feature] ?? null;
              return (
                <View key={feature} style={styles.usageRow}>
                  <Text style={[styles.usageLabel, { color: colors.textSecondary }]}>
                    {feature}
                  </Text>
                  <Text style={[styles.usageValue, { color: colors.textPrimary }]}>
                    {used}
                    {limit !== null ? ` / ${limit}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <AchievementsSection />

        {!isGuest && (
          <>
            {resetMessage !== null && (
              <View
                style={[styles.notice, { backgroundColor: colors.primarySoft }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.noticeText, { color: colors.primaryStrong }]}>
                  {resetMessage}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send password reset email"
              onPress={() => void handlePasswordReset()}
              disabled={resetting}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
                resetting && styles.disabled,
              ]}
            >
              {resetting ? (
                <ActivityIndicator
                  color={colors.textPrimary}
                  accessibilityLabel="Sending reset link"
                />
              ) : (
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  {t("profile.sendPasswordReset")}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={() => void signOut()}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                {t("profile.signOut")}
              </Text>
            </Pressable>
          </>
        )}

        {isGuest && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("profile.createAccount")}
            onPress={() => void signOut()}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
              {t("profile.createAccount")}
            </Text>
          </Pressable>
        )}

        {!isGuest && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            onPress={confirmDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [
              styles.dangerButton,
              { backgroundColor: colors.danger },
              pressed && styles.pressed,
              deleting && styles.disabled,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={colors.onDanger} accessibilityLabel="Deleting account" />
            ) : (
              <Text style={[styles.dangerButtonText, { color: colors.onDanger }]}>
                {t("profile.deleteAccount")}
              </Text>
            )}
          </Pressable>
        )}

        <View style={styles.legalLinks}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open Privacy Policy"
            onPress={() =>
              void Linking.openURL(
                process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://careerosai.app/privacy",
              )
            }
          >
            <Text style={[styles.legalLink, { color: colors.textSecondary }]}>
              {t("profile.privacyPolicy")}
            </Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: colors.textSecondary }]}>·</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open Terms of Service"
            onPress={() =>
              void Linking.openURL(
                process.env.EXPO_PUBLIC_TERMS_URL ?? "https://careerosai.app/terms",
              )
            }
          >
            <Text style={[styles.legalLink, { color: colors.textSecondary }]}>
              {t("profile.termsOfService")}
            </Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: colors.textSecondary }]}>·</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open Support"
            onPress={() =>
              void Linking.openURL(
                process.env.EXPO_PUBLIC_SUPPORT_URL ?? "https://careerosai.app/support",
              )
            }
          >
            <Text style={[styles.legalLink, { color: colors.textSecondary }]}>
              {t("profile.support")}
            </Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: colors.textSecondary }]}>·</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open account deletion guide"
            onPress={() => void Linking.openURL("https://careerosai.app/delete-account")}
          >
            <Text style={[styles.legalLink, { color: colors.textSecondary }]}>
              {t("profile.deleteAccountGuide")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 24,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  usageLabel: {
    fontSize: 13,
  },
  usageValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  notice: {
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  dangerButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    rowGap: 10,
    columnGap: 8,
    paddingHorizontal: 8,
  },
  legalLink: {
    fontSize: 13,
    textDecorationLine: "underline",
  },
  legalDot: {
    fontSize: 13,
  },
});
