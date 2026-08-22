import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import ViewShot, { type ViewShotRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { ApiError, type WrappedDataPoint, type WrappedResponse } from "@/services/contract";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";
import { t } from "../../../i18n";

type WrappedState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: WrappedResponse };

const apiClient = new ApiClient();

export default function WrappedScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [wrappedState, setWrappedState] = useState<WrappedState>({ status: "idle" });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const viewShotRef = useRef<ViewShotRef>(null);

  const loadWrapped = useCallback(async () => {
    setWrappedState({ status: "loading" });
    try {
      const data = isGuest
        ? await apiClient.getWrapped(undefined, guestId ?? undefined)
        : await apiClient.getWrapped(accessToken);
      setWrappedState({ status: "success", data });
      // Default all toggles to OFF (opt-in model)
      setSelectedKeys(new Set());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setWrappedState({
          status: "error",
          message: err instanceof Error ? err.message : t("wrapped.errorLoad"),
        });
      }
    }
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadWrapped();
    }, [loadWrapped]),
  );

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    if (wrappedState.status !== "success") {
      return;
    }
    const allKeys = wrappedState.data.data_points.filter((d) => d.available).map((d) => d.key);
    setSelectedKeys(new Set(allKeys));
  }

  async function handleShare() {
    if (wrappedState.status !== "success") {
      return;
    }
    try {
      const uri = await viewShotRef.current?.capture();
      if (uri !== undefined && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
        return;
      }
      // Fallback: share as text
      const selected = wrappedState.data.data_points.filter((d) => selectedKeys.has(d.key));
      const lines = selected.map((d) => `${d.label}: ${d.value}`);
      const text = `My Resume Wrapped\n\n${lines.join("\n")}`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
      }
    } catch {
      Alert.alert(t("wrapped.shareError"), t("wrapped.shareErrorBody"));
    }
  }

  const filteredPoints: WrappedDataPoint[] =
    wrappedState.status === "success"
      ? wrappedState.data.data_points.filter((d) => selectedKeys.has(d.key) && d.available)
      : [];

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          eyebrow={t("wrapped.eyebrow")}
          title={t("wrapped.title")}
          subtitle={t("wrapped.subtitle")}
        />

        {wrappedState.status === "loading" && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Loading wrapped data"
          />
        )}

        {wrappedState.status === "error" && (
          <View
            style={[styles.errorCard, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.errorText, { color: colors.onDanger }]}>
              {wrappedState.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading wrapped data"
              onPress={() => void loadWrapped()}
              style={[styles.retryButton, { backgroundColor: colors.surfaceRaised }]}
            >
              <Text style={[styles.retryText, { color: colors.textPrimary }]}>
                {t("common.tryAgain")}
              </Text>
            </Pressable>
          </View>
        )}

        {wrappedState.status === "success" && (
          <>
            <View
              style={[
                styles.toggleSection,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.toggleHeader}>
                <Text style={[styles.toggleSectionTitle, { color: colors.textPrimary }]}>
                  {t("wrapped.includeSection")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.selectAll")}
                  onPress={selectAll}
                >
                  <Text style={[styles.selectAllText, { color: colors.primaryStrong }]}>
                    {t("common.selectAll")}
                  </Text>
                </Pressable>
              </View>
              {wrappedState.data.data_points.map((dp) => (
                <View key={dp.key} style={styles.toggleRow}>
                  <View style={styles.toggleLabelWrap}>
                    <Text
                      style={[
                        styles.toggleLabel,
                        { color: dp.available ? colors.textPrimary : colors.textDisabled },
                      ]}
                    >
                      {dp.label}
                    </Text>
                    {!dp.available && (
                      <Text style={[styles.unavailableText, { color: colors.textDisabled }]}>
                        {t("common.notAvailable")}
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={selectedKeys.has(dp.key)}
                    onValueChange={() => toggleKey(dp.key)}
                    disabled={!dp.available}
                    accessibilityLabel={`Include ${dp.label}`}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surface}
                  />
                </View>
              ))}
            </View>

            {wrappedState.data.achievements.length > 0 && (
              <View
                style={[
                  styles.achievementsCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.achievementsTitle, { color: colors.textPrimary }]}>
                  {t("achievements.title")}
                </Text>
                {wrappedState.data.achievements.map((ach) => (
                  <View key={ach.key} style={styles.achievementRow}>
                    <Text style={[styles.achievementName, { color: colors.textPrimary }]}>
                      {ach.earned_at ? "🏆" : "🔒"} {ach.title}
                    </Text>
                    {ach.earned_at && (
                      <Text style={[styles.achievementDate, { color: colors.textDisabled }]}>
                        {t("wrapped.earnedPrefix")} {new Date(ach.earned_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <ViewShot
              ref={viewShotRef}
              options={{ format: "png", quality: 1.0 }}
              style={styles.viewShot}
            >
              <View
                style={[
                  styles.previewCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.previewTitle, { color: colors.primaryStrong }]}>
                  {t("wrapped.previewTitle")}
                </Text>
                {filteredPoints.length === 0 && (
                  <Text style={[styles.previewEmpty, { color: colors.textDisabled }]}>
                    {t("wrapped.previewEmpty")}
                  </Text>
                )}
                {filteredPoints.map((dp) => (
                  <View key={dp.key} style={styles.previewRow}>
                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                      {dp.label}
                    </Text>
                    <Text style={[styles.previewValue, { color: colors.textPrimary }]}>
                      {dp.value}
                    </Text>
                  </View>
                ))}
              </View>
            </ViewShot>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share wrapped summary"
              onPress={() => void handleShare()}
              disabled={filteredPoints.length === 0}
              style={({ pressed }) => [
                styles.shareButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                filteredPoints.length === 0 && styles.disabled,
              ]}
            >
              <Text style={[styles.shareButtonText, { color: colors.onPrimary }]}>
                {t("wrapped.shareButton")}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 24,
  },
  title: { fontSize: 28, lineHeight: 36, fontWeight: "700", marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 16 },
  toggleSection: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleSectionTitle: { fontSize: 16, fontWeight: "700" },
  selectAllText: { fontSize: 13, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  toggleLabelWrap: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 14, fontWeight: "500" },
  unavailableText: { fontSize: 12, marginTop: 1 },
  achievementsCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  achievementsTitle: { fontSize: 16, fontWeight: "700" },
  achievementRow: { gap: 2 },
  achievementName: { fontSize: 14, fontWeight: "600" },
  achievementDate: { fontSize: 12 },
  viewShot: { marginTop: 16, borderRadius: 16, overflow: "hidden" },
  previewCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  previewTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  previewEmpty: { fontSize: 14, textAlign: "center", paddingVertical: 12 },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewLabel: { fontSize: 14, fontWeight: "500" },
  previewValue: { fontSize: 14, fontWeight: "700" },
  shareButton: { marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  shareButtonText: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  errorCard: { marginTop: 16, borderRadius: 12, padding: 16, gap: 12 },
  errorText: { fontSize: 14, lineHeight: 20 },
  retryButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  retryText: { fontSize: 14, fontWeight: "700" },
});
