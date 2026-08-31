import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { isGuestLockedRoute } from "@/lib/featureGates";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { ApiError, type DashboardResponse } from "@/services/contract";
import AppBackground from "@/ui/AppBackground";
import GlassCard from "@/ui/GlassCard";
import IconChip, { type IconName } from "@/ui/IconChip";
import { LoginRequiredBanner } from "@/ui/LoginRequired";
import ScreenHeader from "@/ui/ScreenHeader";
import ScoreRing from "@/ui/ScoreRing";
import AdBanner from "@/ui/AdBanner";
import en, { t } from "../../../i18n";

const LEVEL_NAMES = en.levels;

function levelName(level: number): string {
  const index = Math.min(Math.max(level - 1, 0), LEVEL_NAMES.length - 1);
  return LEVEL_NAMES[index] ?? en.levels[0];
}

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: DashboardResponse };

interface QuickAction {
  key: string;
  title: string;
  text: string;
  icon: IconName;
  gradient: readonly [string, string];
  route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "tools",
    title: t("tools.title"),
    text: t("dashboard.quickActions.toolsDesc"),
    icon: "apps",
    gradient: ["#38BDF8", "#16A34A"],
    route: "/tools",
  },
  {
    key: "resume",
    title: t("dashboard.quickActions.resumeHealth"),
    text: t("dashboard.quickActions.resumeHealthDesc"),
    icon: "document-text",
    gradient: ["#5B5BF0", "#B34AF0"],
    route: "/resume",
  },
  {
    key: "match",
    title: t("dashboard.quickActions.jobMatch"),
    text: t("dashboard.quickActions.jobMatchDesc"),
    icon: "flash",
    gradient: ["#38BDF8", "#5B5BF0"],
    route: "/job-match",
  },
  {
    key: "coach",
    title: t("dashboard.quickActions.aiCoach"),
    text: t("dashboard.quickActions.aiCoachDesc"),
    icon: "chatbubble-ellipses",
    gradient: ["#B34AF0", "#38BDF8"],
    route: "/coach",
  },
  {
    key: "roast",
    title: t("dashboard.quickActions.roast"),
    text: t("dashboard.quickActions.roastDesc"),
    icon: "flame",
    gradient: ["#F59E0B", "#EF4444"],
    route: "/roast",
  },
  {
    key: "wrapped",
    title: t("dashboard.quickActions.wrapped"),
    text: t("dashboard.quickActions.wrappedDesc"),
    icon: "gift",
    gradient: ["#16A34A", "#38BDF8"],
    route: "/wrapped",
  },
  {
    key: "interview",
    title: t("dashboard.quickActions.interview"),
    text: t("dashboard.quickActions.interviewDesc"),
    icon: "mic",
    gradient: ["#9333EA", "#5B5BF0"],
    route: "/interview",
  },
];

const apiClient = new ApiClient();

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const {
    session,
    guestId,
    status: authStatus,
    handleUnauthorized,
    signIn,
    migrateGuest,
  } = useAuth();

  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [lockedAction, setLockedAction] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateEmail, setMigrateEmail] = useState("");
  const [migratePassword, setMigratePassword] = useState("");
  const [migrateError, setMigrateError] = useState<string | null>(null);

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const load = useCallback(async () => {
    if (isGuest && guestId !== null) {
      setState({ status: "loading" });
      try {
        const data = await apiClient.getDashboard(undefined, guestId);
        setState({ status: "success", data });
      } catch (err) {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : t("dashboard.couldNotLoad"),
        });
      }
      return;
    }
    if (accessToken === undefined) {
      void handleUnauthorized();
      return;
    }
    setState({ status: "loading" });
    try {
      const data = await apiClient.getDashboard(accessToken);
      setState({ status: "success", data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : t("dashboard.couldNotLoad"),
        });
      }
    }
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleMigrate() {
    if (migrating || guestId === null) {
      return;
    }
    if (migrateEmail.trim() === "" || migratePassword === "") {
      setMigrateError(t("dashboard.enterCredentials"));
      return;
    }
    setMigrating(true);
    setMigrateError(null);
    try {
      await signIn(migrateEmail.trim(), migratePassword);
      await migrateGuest();
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : t("dashboard.signInFailed"));
    } finally {
      setMigrating(false);
    }
  }

  if (state.status === "loading") {
    return (
      <AppBackground>
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Loading dashboard"
          />
        </View>
      </AppBackground>
    );
  }

  if (state.status === "error") {
    return (
      <AppBackground>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textDisabled} />
          <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
            {t("dashboard.errorTitle")}
          </Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{state.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading dashboard"
            onPress={() => void load()}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.onPrimary }]}>
              {t("common.tryAgain")}
            </Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const { data } = state;

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.title")}
          subtitle={t("dashboard.subtitle")}
        />
        <Text style={[styles.disclaimer, { color: colors.textDisabled }]}>
          {t("dashboard.disclaimer")}
        </Text>

        {isGuest && (
          <GlassCard style={[styles.guestBanner, { borderColor: colors.primary }]}>
            <View style={styles.guestRow}>
              <IconChip name="person-add" size={40} gradient={theme.gradients.brand} />
              <View style={styles.guestBody}>
                <Text style={[styles.guestBannerTitle, { color: colors.textPrimary }]}>
                  {t("dashboard.guestBannerTitle")}
                </Text>
                <Text style={[styles.guestBannerText, { color: colors.textSecondary }]}>
                  {t("dashboard.guestBannerText")}
                </Text>
              </View>
            </View>
            <View style={styles.migrateForm}>
              <TextInput
                value={migrateEmail}
                onChangeText={setMigrateEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                accessibilityLabel="Email to sign in"
                placeholder={t("dashboard.emailPlaceholder")}
                placeholderTextColor={colors.textDisabled}
                style={[
                  styles.migrateInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <TextInput
                value={migratePassword}
                onChangeText={setMigratePassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                accessibilityLabel="Password to sign in"
                placeholder={t("dashboard.passwordPlaceholder")}
                placeholderTextColor={colors.textDisabled}
                style={[
                  styles.migrateInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              {migrateError !== null && (
                <Text
                  style={[styles.migrateError, { color: colors.danger }]}
                  accessibilityRole="alert"
                >
                  {migrateError}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in to save guest data"
                onPress={() => void handleMigrate()}
                disabled={migrating}
                style={({ pressed }) => [
                  styles.migrateButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                  migrating && styles.disabled,
                ]}
              >
                {migrating ? (
                  <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Signing in" />
                ) : (
                  <Text style={[styles.migrateButtonText, { color: colors.onPrimary }]}>
                    {t("dashboard.signInSave")}
                  </Text>
                )}
              </Pressable>
            </View>
          </GlassCard>
        )}

        <GlassCard elevated style={styles.heroCard}>
          <View style={styles.heroRow}>
            <ScoreRing score={data.health_score ?? 0} label={t("dashboard.resumeScore")} />
            <View style={styles.heroInfo}>
              <View style={[styles.levelPill, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="star" size={13} color={colors.primaryStrong} />
                <Text style={[styles.levelPillText, { color: colors.primaryStrong }]}>
                  {t("dashboard.levelPill", { n: data.level, levelName: levelName(data.level) })}
                </Text>
              </View>
              {data.health_level !== null && (
                <Text style={[styles.heroStat, { color: colors.textPrimary }]}>
                  {data.health_level.toUpperCase()}
                </Text>
              )}
              <View style={styles.heroMiniRow}>
                <View style={styles.heroMini}>
                  <Text style={[styles.heroMiniValue, { color: colors.textPrimary }]}>
                    {data.total_xp}
                  </Text>
                  <Text style={[styles.heroMiniLabel, { color: colors.textSecondary }]}>
                    {t("dashboard.xp")}
                  </Text>
                </View>
                <View style={styles.heroMini}>
                  <Text style={[styles.heroMiniValue, { color: colors.textPrimary }]}>
                    {data.current_streak}
                  </Text>
                  <Text style={[styles.heroMiniLabel, { color: colors.textSecondary }]}>
                    {t("dashboard.dayStreak")}
                  </Text>
                </View>
                <View style={styles.heroMini}>
                  <Text style={[styles.heroMiniValue, { color: colors.textPrimary }]}>
                    {data.latest_match_score ?? "—"}
                  </Text>
                  <Text style={[styles.heroMiniLabel, { color: colors.textSecondary }]}>
                    {t("dashboard.match")}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {data.latest_match_jd_title !== null && (
            <Text style={[styles.heroMatchTitle, { color: colors.textSecondary }]}>
              {t("dashboard.bestMatch", { title: data.latest_match_jd_title })}
            </Text>
          )}
        </GlassCard>

        {data.active_missions.length > 0 && (
          <GlassCard style={styles.missionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t("dashboard.todayMissions")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all missions"
                onPress={() => router.push("/missions")}
                style={styles.sectionLink}
              >
                <Text style={[styles.sectionLinkText, { color: colors.primaryStrong }]}>
                  {t("dashboard.viewAll")}
                </Text>
              </Pressable>
            </View>
            {data.active_missions.map((mission) => (
              <View key={mission.id} style={styles.missionRow}>
                <IconChip name="flag" size={36} />
                <View style={styles.missionBody}>
                  <Text style={[styles.missionTitle, { color: colors.textPrimary }]}>
                    {mission.title}
                  </Text>
                  {mission.description !== null && (
                    <Text style={[styles.missionDescription, { color: colors.textSecondary }]}>
                      {mission.description}
                    </Text>
                  )}
                </View>
                <Text style={[styles.missionXp, { color: colors.primaryStrong }]}>
                  +{mission.xp_reward} XP
                </Text>
              </View>
            ))}
          </GlassCard>
        )}

        <Text style={[styles.actionsTitle, { color: colors.textPrimary }]}>
          {t("dashboard.explore")}
        </Text>
        {lockedAction !== null && (
          <View style={styles.actionsNotice}>
            <LoginRequiredBanner onDismiss={() => setLockedAction(null)} />
          </View>
        )}
        <View style={styles.actions}>
          {QUICK_ACTIONS.map((action) => {
            const locked = isGuest && isGuestLockedRoute(action.route);
            return (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${action.title}${locked ? ", requires login" : ""}`}
                accessibilityState={{ disabled: locked }}
                onPress={() => {
                  if (locked) {
                    setLockedAction(action.route);
                    return;
                  }
                  router.push(action.route);
                }}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && !locked && styles.pressed,
                  locked && styles.actionCardDimmed,
                ]}
              >
                <GlassCard style={styles.actionInner}>
                  <IconChip
                    name={action.icon}
                    size={46}
                    gradient={action.gradient}
                  />
                  <View style={styles.actionBody}>
                    <Text
                      style={[
                        styles.actionTitle,
                        { color: locked ? colors.textDisabled : colors.textPrimary },
                      ]}
                    >
                      {action.title}
                    </Text>
                    <Text
                      style={[
                        styles.actionText,
                        { color: locked ? colors.textDisabled : colors.textSecondary },
                      ]}
                    >
                      {action.text}
                    </Text>
                  </View>
                  <Ionicons
                    name={locked ? "lock-closed" : "chevron-forward"}
                    size={20}
                    color={colors.textDisabled}
                  />
                </GlassCard>
              </Pressable>
            );
          })}
        </View>

        <AdBanner />
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  disclaimer: {
    fontSize: 12,
    marginBottom: 4,
  },
  heroCard: {
    marginTop: 12,
    padding: 20,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  heroInfo: {
    flex: 1,
    gap: 10,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroStat: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroMiniRow: {
    flexDirection: "row",
    gap: 16,
  },
  heroMini: {
    alignItems: "center",
    gap: 2,
  },
  heroMiniValue: {
    fontSize: 17,
    fontWeight: "800",
  },
  heroMiniLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  heroMatchTitle: {
    fontSize: 13,
    marginTop: 12,
  },
  missionCard: {
    marginTop: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionLink: {
    paddingVertical: 4,
  },
  sectionLinkText: {
    fontSize: 13,
    fontWeight: "700",
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  missionBody: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  missionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  missionXp: {
    fontSize: 14,
    fontWeight: "700",
  },
actionsTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 12,
  },
  actionsNotice: {
    marginBottom: 12,
  },
  actionCardDimmed: {},
  actions: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 20,
  },
  actionInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
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
  },
  retryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  guestBanner: {
    marginTop: 12,
    gap: 12,
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  guestBody: {
    flex: 1,
  },
  guestBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  guestBannerText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  migrateForm: {
    gap: 8,
  },
  migrateInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  migrateError: {
    fontSize: 13,
    fontWeight: "600",
  },
  migrateButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  migrateButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
