import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { ApiError, type AchievementResponse } from "@/services/contract";
import { t } from "../../../i18n";

type AchievementsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: AchievementResponse[] };

const apiClient = new ApiClient();

export default function AchievementsSection() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, handleUnauthorized } = useAuth();

  const accessToken = session?.access_token;
  const [state, setState] = useState<AchievementsState>({ status: "loading" });

  const load = useCallback(async () => {
    if (accessToken === undefined) {
      void handleUnauthorized();
      return;
    }
    setState({ status: "loading" });
    try {
      const items = await apiClient.getAchievements(accessToken);
      setState({ status: "success", items });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Could not load achievements.",
        });
      }
    }
  }, [accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (state.status === "loading") {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Loading achievements" />
      </View>
    );
  }

  if (state.status === "error") {
    return null; // Non-critical section; fail silently
  }

  const earned = state.items.filter((a) => a.earned_at !== null);
  const unearned = state.items.filter((a) => a.earned_at === null);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t("achievements.title")}</Text>
      {state.items.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textDisabled }]}>{t("achievements.empty")}</Text>
      ) : (
        <>
          {earned.length > 0 && (
            <View style={styles.grid}>
              {earned.map((a) => (
                <View key={a.key} style={[styles.achievementCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                  <Text style={styles.achievementEmoji}>🏆</Text>
                  <Text style={[styles.achievementTitle, { color: colors.primaryStrong }]}>{a.title}</Text>
                  <Text style={[styles.achievementDate, { color: colors.textSecondary }]}>
                    {new Date(a.earned_at!).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {unearned.length > 0 && (
            <View style={styles.grid}>
              {unearned.map((a) => (
                <View key={a.key} style={[styles.achievementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={styles.achievementEmoji}>🔒</Text>
                  <Text style={[styles.achievementTitle, { color: colors.textSecondary }]}>{a.title}</Text>
                  <Text style={[styles.achievementCondition, { color: colors.textDisabled }]}>{a.condition}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16, gap: 10 },
  loadingWrap: { marginTop: 16, alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    width: "47%",
  },
  achievementEmoji: { fontSize: 24, marginBottom: 4 },
  achievementTitle: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  achievementDate: { fontSize: 11, marginTop: 2 },
  achievementCondition: { fontSize: 11, marginTop: 2, textAlign: "center" },
});
