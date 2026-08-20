import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import {
  ApiError,
  type MissionProgressResponse,
  type MissionResponse,
} from "@/services/contract";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";
import { t } from "../../../i18n";
import en from "../../../i18n/en";

type ProgressState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: MissionProgressResponse };

const apiClient = new ApiClient();

function levelName(level: number): string {
  const index = Math.min(Math.max(level - 1, 0), en.levels.length - 1);
  return en.levels[index] ?? en.levels[0];
}

export default function MissionsScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, handleUnauthorized } = useAuth();

  const [missions, setMissions] = useState<MissionResponse[]>([]);
  const [progressState, setProgressState] = useState<ProgressState>({ status: "loading" });
  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  const accessToken = session?.access_token;

  const load = useCallback(async () => {
    setProgressState({ status: "loading" });
    try {
      const [missionItems, progress] = await Promise.all([
        apiClient.listMissions(accessToken, guestId ?? undefined),
        apiClient.getMissionProgress(accessToken, guestId ?? undefined),
      ]);
      setMissions(missionItems);
      setProgressState({ status: "success", data: progress });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setProgressState({
          status: "error",
          message: err instanceof Error ? err.message : t("missions.couldNotLoad"),
        });
      }
    }
  }, [accessToken, guestId, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleComplete(missionKey: string) {
    if (completingKey !== null) {
      return;
    }
    setCompletingKey(missionKey);
    setCompletionMessage(null);
    try {
      const result = await apiClient.completeMission(accessToken, missionKey, guestId ?? undefined);
      setCompletionMessage(
        result.already_completed
          ? t("missions.alreadyDone")
          : t("missions.missionComplete", { n: result.xp_awarded }),
      );
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setCompletionMessage(
          err instanceof Error ? err.message : t("missions.missionFailed"),
        );
      }
    } finally {
      setCompletingKey(null);
    }
  }

  if (progressState.status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading missions" />
      </View>
    );
  }

  if (progressState.status === "error") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>{t("missions.errorTitle")}</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{progressState.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.tryAgain")}
          onPress={() => void load()}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.onPrimary }]}>{t("common.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  const { data } = progressState;
  const completedKeys = new Set(data.completions.map((completion) => completion.mission_key));

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          eyebrow={t("missions.eyebrow")}
          title={t("missions.title")}
          subtitle={t("missions.subtitle")}
        />

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primaryStrong }]}>{data.total_xp}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t("missions.totalXP")}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primaryStrong }]}>{t("missions.levelPill", { n: data.level })}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{levelName(data.level)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primaryStrong }]}>{data.current_streak}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t("missions.dayStreak")}</Text>
          </View>
        </View>

        {completionMessage !== null && (
          <View
            style={[styles.notice, { backgroundColor: colors.primarySoft }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.primaryStrong }]}>{completionMessage}</Text>
          </View>
        )}

        {missions.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("missions.empty")}
          </Text>
        )}

        {missions.map((mission) => {
          const completed = completedKeys.has(mission.key);
          return (
            <View
              key={mission.id}
              style={[
                styles.missionCard,
                { backgroundColor: colors.surface, borderColor: completed ? colors.success : colors.border },
              ]}
            >
              <View style={styles.missionBody}>
                <Text style={[styles.missionTitle, { color: colors.textPrimary }]}>{mission.title}</Text>
                {mission.description !== null && (
                  <Text style={[styles.missionDescription, { color: colors.textSecondary }]}>
                    {mission.description}
                  </Text>
                )}
                <Text style={[styles.missionCadence, { color: colors.textDisabled }]}>
                  {mission.cadence} · +{mission.xp_reward} XP
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={completed ? `${mission.title} completed` : `Complete ${mission.title}`}
                disabled={completed || completingKey === mission.key}
                onPress={() => void handleComplete(mission.key)}
                style={({ pressed }) => [
                  styles.completeButton,
                  {
                    backgroundColor: completed ? colors.success : colors.primary,
                  },
                  pressed && styles.pressed,
                  (completed || completingKey === mission.key) && styles.disabled,
                ]}
              >
                {completingKey === mission.key ? (
                  <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Completing mission" />
                ) : (
                  <Text style={[styles.completeText, { color: completed ? colors.onDanger : colors.onPrimary }]}>
                    {completed ? t("missions.complete") : t("missions.complete")}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
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
    padding: 24,
    paddingBottom: 48,
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
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
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
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  missionCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  missionBody: {
    flex: 1,
    gap: 4,
  },
  missionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  missionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  missionCadence: {
    fontSize: 12,
  },
  completeButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  completeText: {
    fontSize: 13,
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
});
