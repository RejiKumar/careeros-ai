import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";
import { ApiError, type RoastResponse, type ResumeResponse } from "@/services/contract";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";

const ROAST_MODES = [
  { key: "friendly_mentor", labelKey: "roast.modes.friendlyMentor", emoji: "😊" },
  { key: "professional_hr", labelKey: "roast.modes.professionalHR", emoji: "👔" },
  { key: "brutal_hr", labelKey: "roast.modes.brutalHR", emoji: "🔥" },
  { key: "funny_roast", labelKey: "roast.modes.funnyRoast", emoji: "😂" },
  { key: "robot_recruiter", labelKey: "roast.modes.robotRecruiter", emoji: "🤖" },
] as const;

type RoastState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: RoastResponse };

const apiClient = new ApiClient();

export default function RoastScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [roastState, setRoastState] = useState<RoastState>({ status: "idle" });

  const loadResumes = useCallback(async () => {
    try {
      const items = isGuest
        ? await apiClient.listResumes(undefined, guestId ?? undefined)
        : await apiClient.listResumes(accessToken);
      setResumes(items);
      if (resumeId === null && items.length > 0) {
        setResumeId(items[0]?.id ?? null);
      }
    } catch {
      // Resume context is optional; ignore failure
    }
  }, [isGuest, guestId, accessToken, resumeId]);

  useFocusEffect(
    useCallback(() => {
      void loadResumes();
    }, [loadResumes]),
  );

  async function handleGenerateRoast() {
    if (resumeId === null || selectedMode === null) {
      return;
    }
    if (roastState.status === "loading") {
      return;
    }
    setRoastState({ status: "loading" });
    try {
      const data = isGuest
        ? await apiClient.createRoast(
            undefined,
            { resume_id: resumeId, mode: selectedMode },
            guestId ?? undefined,
          )
        : await apiClient.createRoast(accessToken, { resume_id: resumeId, mode: selectedMode });
      setRoastState({ status: "success", data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setRoastState({
          status: "error",
          message: err instanceof Error ? err.message : t("roast.errorGenerate"),
        });
      }
    }
  }

  const hasResume = resumes.length > 0;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          eyebrow={t("roast.eyebrow")}
          title={t("roast.title")}
          subtitle={t("roast.subtitle")}
        />

        {!hasResume ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t("roast.noResume")}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t("roast.noResumeDesc")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("roast.chooseResume")}
            </Text>
            <View style={styles.chipRow}>
              {resumes.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use resume ${r.title}`}
                  accessibilityState={{ selected: resumeId === r.id }}
                  onPress={() => {
                    setResumeId(r.id);
                    setRoastState({ status: "idle" });
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: resumeId === r.id ? colors.primary : colors.surface,
                      borderColor: resumeId === r.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: resumeId === r.id ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {r.title}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("roast.pickMode")}
            </Text>
            <View style={styles.modeGrid}>
              {ROAST_MODES.map((mode) => (
                <Pressable
                  key={mode.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("roast.pickMode")}: ${t(mode.labelKey)}`}
                  accessibilityState={{ selected: selectedMode === mode.key }}
                  onPress={() => {
                    setSelectedMode(mode.key);
                    setRoastState({ status: "idle" });
                  }}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor:
                        selectedMode === mode.key ? colors.primarySoft : colors.surface,
                      borderColor: selectedMode === mode.key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                  <Text
                    style={[
                      styles.modeLabel,
                      {
                        color:
                          selectedMode === mode.key ? colors.primaryStrong : colors.textPrimary,
                      },
                    ]}
                  >
                    {t(mode.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("roast.generateButton")}
              onPress={() => void handleGenerateRoast()}
              disabled={
                resumeId === null || selectedMode === null || roastState.status === "loading"
              }
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                (resumeId === null || selectedMode === null || roastState.status === "loading") &&
                  styles.disabled,
              ]}
            >
              {roastState.status === "loading" ? (
                <ActivityIndicator
                  color={colors.onPrimary}
                  accessibilityLabel={t("roast.generateButton")}
                />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  {t("roast.generateButton")}
                </Text>
              )}
            </Pressable>

            {roastState.status === "error" && (
              <View
                style={[styles.errorCard, { backgroundColor: colors.danger }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.errorText, { color: colors.onDanger }]}>
                  {roastState.message}
                </Text>
              </View>
            )}

            {roastState.status === "success" && (
              <View
                style={[
                  styles.roastResult,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {roastState.data.sections.map((section, i) => (
                  <View key={i} style={styles.roastSection}>
                    <Text style={[styles.roastSectionTitle, { color: colors.primaryStrong }]}>
                      {section.title}
                    </Text>
                    <Text style={[styles.roastSectionContent, { color: colors.textPrimary }]}>
                      {section.content}
                    </Text>
                  </View>
                ))}

                {roastState.data.improvements.length > 0 && (
                  <View style={styles.improvementsBlock}>
                    <Text style={[styles.improvementsTitle, { color: colors.textPrimary }]}>
                      {t("roast.improvementsHeader")}
                    </Text>
                    {roastState.data.improvements.map((tip, i) => (
                      <View key={i} style={styles.improvementRow}>
                        <Text style={[styles.improvementBullet, { color: colors.primary }]}>•</Text>
                        <Text style={[styles.improvementText, { color: colors.textSecondary }]}>
                          {tip}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
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
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    width: "48%",
    marginBottom: 4,
  },
  modeEmoji: { fontSize: 28, marginBottom: 6 },
  modeLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  primaryButton: { marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonText: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  errorCard: { marginTop: 16, borderRadius: 12, padding: 14 },
  errorText: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  roastResult: { marginTop: 20, borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  roastSection: { gap: 4 },
  roastSectionTitle: { fontSize: 16, fontWeight: "700" },
  roastSectionContent: { fontSize: 15, lineHeight: 22 },
  improvementsBlock: { marginTop: 4, gap: 8 },
  improvementsTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  improvementRow: { flexDirection: "row", gap: 8 },
  improvementBullet: { fontSize: 16, fontWeight: "700", marginTop: 1 },
  improvementText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
