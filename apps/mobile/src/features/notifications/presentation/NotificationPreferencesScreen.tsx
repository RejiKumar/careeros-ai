import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t } from "../../../i18n";
import { ApiClient } from "@/services/api";
import { ApiError } from "@/services/contract";
import type { NotificationPreferenceResponse } from "@/services/contract";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";

type Frequency = "instant" | "daily" | "weekly";

type PreferencesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; prefs: NotificationPreferenceResponse };

const apiClient = new ApiClient();

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [state, setState] = useState<PreferencesState>({ status: "loading" });
  const [jobAlerts, setJobAlerts] = useState(true);
  const [missionReminders, setMissionReminders] = useState(true);
  const [careerTips, setCareerTips] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("instant");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const prefs = isGuest
        ? await apiClient.getNotificationPreferences(undefined, guestId ?? undefined)
        : await apiClient.getNotificationPreferences(accessToken);
      if (prefs !== undefined) {
        setJobAlerts(prefs.job_alerts ?? true);
        setMissionReminders(prefs.mission_reminders ?? true);
        setCareerTips(prefs.career_tips ?? false);
        setFrequency((prefs.frequency as Frequency) ?? "instant");
      }
      setState({
        status: "success",
        prefs: prefs ?? {
          job_alerts: true,
          mission_reminders: true,
          career_tips: false,
          frequency: "instant",
        },
      });
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
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSave() {
    if (saving) {
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await apiClient.updateNotificationPreferences(
        accessToken,
        {
          job_alerts: jobAlerts,
          mission_reminders: missionReminders,
          career_tips: careerTips,
          frequency,
        },
        guestId ?? undefined,
      );
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        Alert.alert(t("profile.errorTitle"), t("profile.couldNotLoad"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Loading preferences"
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
          accessibilityLabel="Retry loading preferences"
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

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          eyebrow={t("notifications.eyebrow")}
          title={t("notifications.title")}
        />

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
                {t("notifications.jobAlerts")}
              </Text>
              <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                {t("notifications.jobAlertsDesc")}
              </Text>
            </View>
            <Switch
              value={jobAlerts}
              onValueChange={setJobAlerts}
              accessibilityLabel={t("notifications.jobAlerts")}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
                {t("notifications.missionReminders")}
              </Text>
              <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                {t("notifications.missionRemindersDesc")}
              </Text>
            </View>
            <Switch
              value={missionReminders}
              onValueChange={setMissionReminders}
              accessibilityLabel={t("notifications.missionReminders")}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWrap}>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
                {t("notifications.careerTips")}
              </Text>
              <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>
                {t("notifications.careerTipsDesc")}
              </Text>
            </View>
            <Switch
              value={careerTips}
              onValueChange={setCareerTips}
              accessibilityLabel={t("notifications.careerTips")}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t("notifications.frequency")}
          </Text>
          {(["instant", "daily", "weekly"] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: frequency === option }}
              accessibilityLabel={t(`notifications.${option}`)}
              onPress={() => setFrequency(option)}
              style={({ pressed }) => [
                styles.frequencyRow,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.radioOuter,
                  {
                    borderColor: frequency === option ? colors.primary : colors.border,
                  },
                ]}
              >
                {frequency === option && (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
              <Text style={[styles.frequencyLabel, { color: colors.textPrimary }]}>
                {t(`notifications.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {saved && (
          <View
            style={[styles.notice, { backgroundColor: colors.primarySoft }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.primaryStrong }]}>
              {t("notifications.saved")}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("notifications.save")}
          onPress={() => void handleSave()}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Saving" />
          ) : (
            <Text style={[styles.saveButtonLabel, { color: colors.onPrimary }]}>
              {t("notifications.save")}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.backButtonText, { color: colors.textPrimary }]}>
            {t("common.back")}
          </Text>
        </Pressable>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  toggleLabelWrap: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  toggleDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.15)",
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.0,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  frequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  frequencyLabel: {
    fontSize: 15,
    fontWeight: "500",
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
  saveButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  backButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  backButtonText: {
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
});
