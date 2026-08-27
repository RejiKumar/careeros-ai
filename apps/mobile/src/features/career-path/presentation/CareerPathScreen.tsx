import { useFocusEffect } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";
import {
  ApiError,
  type CareerPathResponse,
  type ResumeResponse,
  type SavedCareerPathResponse,
} from "@/services/contract";

type PathState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; path: CareerPathResponse };

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: SavedCareerPathResponse[] };

const apiClient = new ApiClient();

export default function CareerPathScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [pathState, setPathState] = useState<PathState>({ status: "idle" });
  const [historyState, setHistoryState] = useState<HistoryState>({ status: "loading" });

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
      // Resume context is optional
    }
  }, [isGuest, guestId, accessToken, resumeId]);

  const loadHistory = useCallback(async () => {
    setHistoryState({ status: "loading" });
    try {
      const items = isGuest
        ? await apiClient.listCareerPaths(undefined, guestId ?? undefined)
        : await apiClient.listCareerPaths(accessToken);
      setHistoryState({ status: "success", items });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setHistoryState({
          status: "error",
          message: err instanceof Error ? err.message : t("careerPath.error"),
        });
      }
    }
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadResumes();
      void loadHistory();
    }, [loadResumes, loadHistory]),
  );

  async function handleGenerate() {
    if (resumeId === null) {
      return;
    }
    setPathState({ status: "loading" });
    try {
      const payload: { resume_id: string; target_role?: string } = { resume_id: resumeId };
      if (targetRole.trim() !== "") {
        payload.target_role = targetRole.trim();
      }
      const path = isGuest
        ? await apiClient.generateCareerPath(undefined, payload, guestId ?? undefined)
        : await apiClient.generateCareerPath(accessToken, payload);
      setPathState({ status: "success", path });
      void loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setPathState({
          status: "error",
          message: err instanceof Error ? err.message : t("careerPath.error"),
        });
      }
    }
  }

  async function handleDelete(pathId: string) {
    if (isGuest) {
      return;
    }
    if (accessToken === undefined) {
      return;
    }
    try {
      await apiClient.deleteCareerPath(accessToken, pathId);
      void loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  const hasResume = resumes.length > 0;
  const canGenerate = resumeId !== null && pathState.status !== "loading";

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow={t("careerPath.eyebrow")}
          title={t("careerPath.title")}
          subtitle={t("careerPath.subtitle")}
        />

        {!hasResume ? (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t("careerPath.noResume")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t("careerPath.selectResume")}
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
                    setPathState({ status: "idle" });
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
          </>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("careerPath.targetRole")}
        </Text>
        <TextInput
          value={targetRole}
          onChangeText={setTargetRole}
          accessibilityLabel={t("careerPath.targetRole")}
          placeholder={t("careerPath.targetRole")}
          placeholderTextColor={colors.textDisabled}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />

        {pathState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>
              {pathState.message}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("careerPath.generate")}
          onPress={() => void handleGenerate()}
          disabled={!canGenerate}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            !canGenerate && styles.disabled,
          ]}
        >
          {pathState.status === "loading" ? (
            <ActivityIndicator color={colors.onPrimary} accessibilityLabel={t("careerPath.generating")} />
          ) : (
            <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
              {t("careerPath.generate")}
            </Text>
          )}
        </Pressable>

        {pathState.status === "success" && (
          <CareerPathResultView path={pathState.path} colors={colors} />
        )}

        {pathState.status === "idle" && (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.textDisabled, marginTop: 24 }]}>
              {t("careerPath.noData")}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 32 }]}>
          {t("careerPath.history")}
        </Text>
        {historyState.status === "loading" && (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading history" />
        )}
        {historyState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{historyState.message}</Text>
          </View>
        )}
        {historyState.status === "success" && historyState.items.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("careerPath.noData")}
          </Text>
        )}
        {historyState.status === "success" &&
          historyState.items.map((item) => (
            <View
              key={item.id}
              style={[
                styles.savedCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.savedBody}>
                <Text style={[styles.savedTitle, { color: colors.textPrimary }]}>
                  {item.target_role ?? "Career Path"} — {new Date(item.saved_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.savedActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("common.delete")} career path`}
                  onPress={() => void handleDelete(item.path_id)}
                  style={[styles.smallButton, { backgroundColor: colors.danger }]}
                >
                  <Text style={[styles.smallButtonText, { color: colors.onDanger }]}>
                    {t("common.delete")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
      </ScrollView>
    </AppBackground>
  );
}

function CareerPathResultView({
  path,
  colors,
}: {
  path: CareerPathResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
}) {
  return (
    <View
      style={[styles.resultCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
    >
      {path.timeline_estimate !== null && (
        <View style={styles.timelineRow}>
          <Text style={[styles.timelineLabel, { color: colors.textSecondary }]}>{t("careerPath.timeline")}</Text>
          <Text style={[styles.timelineValue, { color: colors.primaryStrong }]}>
            {path.timeline_estimate}
          </Text>
        </View>
      )}

      {path.stages.map((stage, idx) => (
        <View
          key={idx}
          style={[
            styles.stageCard,
            {
              backgroundColor: stage.is_current ? colors.primarySoft : colors.surface,
              borderColor: stage.is_current ? colors.primary : colors.border,
            },
          ]}
        >
          <View style={styles.stageHeader}>
            <View
              style={[
                styles.stageIndicator,
                { backgroundColor: stage.is_current ? colors.primary : colors.border },
              ]}
            />
            <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>{stage.title}</Text>
            {stage.is_current && (
              <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.currentBadgeText, { color: colors.onPrimary }]}>
                  {t("careerPath.currentStage")}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.stageDesc, { color: colors.textSecondary }]}>{stage.description}</Text>

          {stage.required_skills.length > 0 && (
            <View style={styles.stageSection}>
              <Text style={[styles.stageSectionLabel, { color: colors.textPrimary }]}>
                {t("careerPath.requiredSkills")}
              </Text>
              <View style={styles.badgeRow}>
                {stage.required_skills.map((skill) => (
                  <View key={skill} style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.badgeText, { color: colors.primaryStrong }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {stage.recommended_actions.length > 0 && (
            <View style={styles.stageSection}>
              <Text style={[styles.stageSectionLabel, { color: colors.textPrimary }]}>
                {t("careerPath.recommendedActions")}
              </Text>
              {stage.recommended_actions.map((action, idx) => (
                <Text key={idx} style={[styles.bullet, { color: colors.textSecondary }]}>
                  • {action}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}

      {path.gap_analysis.length > 0 && (
        <View style={styles.gapSection}>
          <Section title={t("careerPath.gapAnalysis")} colors={colors}>
            {path.gap_analysis.map((gap, idx) => (
              <Text key={idx} style={[styles.bullet, { color: colors.textSecondary }]}>
                • {gap}
              </Text>
            ))}
          </Section>
        </View>
      )}
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 12,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  notice: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  resultCard: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  timelineValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  stageCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 12,
    gap: 8,
  },
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stageIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stageTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  currentBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  stageDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  stageSection: {
    marginTop: 4,
    gap: 4,
  },
  stageSectionLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  gapSection: {
    marginTop: 16,
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  savedCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  savedBody: {
    gap: 4,
  },
  savedTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  savedActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
