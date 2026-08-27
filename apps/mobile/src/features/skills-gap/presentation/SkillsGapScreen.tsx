import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  type GapAnalysisResponse,
  type JobDescriptionResponse,
  type ResumeResponse,
} from "@/services/contract";

type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; analysis: GapAnalysisResponse };

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: GapAnalysisResponse[] };

const apiClient = new ApiClient();

export default function SkillsGapScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescriptionResponse[]>([]);
  const [jdId, setJdId] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: "idle" });
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

  const loadJobDescriptions = useCallback(async () => {
    try {
      const items = isGuest
        ? await apiClient.listJobDescriptions(undefined, guestId ?? undefined)
        : await apiClient.listJobDescriptions(accessToken);
      setJobDescriptions(items);
    } catch {
      // JD context is optional
    }
  }, [isGuest, guestId, accessToken]);

  const loadHistory = useCallback(async () => {
    setHistoryState({ status: "loading" });
    try {
      const items = isGuest
        ? await apiClient.listGapAnalyses(undefined, guestId ?? undefined)
        : await apiClient.listGapAnalyses(accessToken);
      setHistoryState({ status: "success", items });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setHistoryState({
          status: "error",
          message: err instanceof Error ? err.message : t("skillsGap.error"),
        });
      }
    }
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadResumes();
      void loadJobDescriptions();
      void loadHistory();
    }, [loadResumes, loadJobDescriptions, loadHistory]),
  );

  async function handleAnalyze() {
    if (resumeId === null || jdId === null) {
      return;
    }
    if (analysisState.status === "loading") {
      return;
    }
    setAnalysisState({ status: "loading" });
    try {
      const payload = { resume_id: resumeId, job_description_id: jdId };
      const analysis = isGuest
        ? await apiClient.analyzeSkillsGap(undefined, payload, guestId ?? undefined)
        : await apiClient.analyzeSkillsGap(accessToken, payload);
      setAnalysisState({ status: "success", analysis });
      void loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setAnalysisState({
          status: "error",
          message: err instanceof Error ? err.message : t("skillsGap.error"),
        });
      }
    }
  }

  async function handleDelete(analysisId: string) {
    if (isGuest) {
      return;
    }
    if (accessToken === undefined) {
      return;
    }
    try {
      await apiClient.deleteGapAnalysis(accessToken, analysisId);
      void loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  const hasResume = resumes.length > 0;
  const hasJob = jobDescriptions.length > 0;
  const canAnalyze = resumeId !== null && jdId !== null && analysisState.status !== "loading";

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { backgroundColor: colors.surfaceRaised }, pressed && styles.pressed]}
        >
          <Text style={[styles.backButtonText, { color: colors.primaryStrong }]}>
            {t("common.back")}
          </Text>
        </Pressable>

        <ScreenHeader
          eyebrow={t("skillsGap.eyebrow")}
          title={t("skillsGap.title")}
          subtitle={t("skillsGap.subtitle")}
        />

        {!hasResume ? (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t("skillsGap.noResume")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t("skillsGap.selectResume")}
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
                    setAnalysisState({ status: "idle" });
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

        {!hasJob ? (
          <View
            style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t("skillsGap.noJob")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t("skillsGap.selectJob")}
            </Text>
            <View style={styles.chipRow}>
              {jobDescriptions.map((jd) => (
                <Pressable
                  key={jd.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use job ${jd.title ?? jd.company ?? "description"}`}
                  accessibilityState={{ selected: jdId === jd.id }}
                  onPress={() => {
                    setJdId(jd.id);
                    setAnalysisState({ status: "idle" });
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: jdId === jd.id ? colors.primary : colors.surface,
                      borderColor: jdId === jd.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: jdId === jd.id ? colors.onPrimary : colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {jd.title ?? "Untitled role"}
                    {jd.company !== null ? ` · ${jd.company}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {analysisState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>
              {analysisState.message}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("skillsGap.analyzeButton")}
          onPress={() => void handleAnalyze()}
          disabled={!canAnalyze}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            !canAnalyze && styles.disabled,
          ]}
        >
          {analysisState.status === "loading" ? (
            <ActivityIndicator color={colors.onPrimary} accessibilityLabel={t("skillsGap.analyzing")} />
          ) : (
            <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
              {t("skillsGap.analyzeButton")}
            </Text>
          )}
        </Pressable>

        {analysisState.status === "success" && (
          <AnalysisResultView analysis={analysisState.analysis} colors={colors} />
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 32 }]}>
          {t("jobMatch.savedJobs")}
        </Text>
        {historyState.status === "loading" && (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading analyses" />
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
            {t("skillsGap.noAnalyses")}
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
                  Match {item.overall_match_percentage}% — {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.savedActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("common.delete")} analysis`}
                  onPress={() => void handleDelete(item.id)}
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

function AnalysisResultView({
  analysis,
  colors,
}: {
  analysis: GapAnalysisResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
}) {
  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
    >
      <Text style={[styles.resultLabel, { color: colors.primaryStrong }]}>
        {t("skillsGap.overallMatch")}
      </Text>
      <Text style={[styles.resultScore, { color: colors.primaryStrong }]}>
        {analysis.overall_match_percentage}%
      </Text>

      <Section title={t("skillsGap.matchedSkills")} colors={colors}>
        {analysis.matched_skills.length > 0 ? (
          <View style={styles.badgeRow}>
            {analysis.matched_skills.map((skill) => (
              <View
                key={skill}
                style={[styles.badge, { backgroundColor: colors.success }]}
              >
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>—</Text>
        )}
      </Section>

      <Section title={t("skillsGap.partialSkills")} colors={colors}>
        {analysis.partial_skills.length > 0 ? (
          <View style={styles.badgeRow}>
            {analysis.partial_skills.map((skill) => (
              <View
                key={skill}
                style={[styles.badge, { backgroundColor: colors.warning }]}
              >
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>—</Text>
        )}
      </Section>

      <Section title={t("skillsGap.missingSkills")} colors={colors}>
        {analysis.missing_skills.length > 0 ? (
          <View style={styles.badgeRow}>
            {analysis.missing_skills.map((skill) => (
              <View
                key={skill}
                style={[styles.badge, { backgroundColor: colors.danger }]}
              >
                <Text style={[styles.badgeText, { color: colors.onPrimary }]}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>—</Text>
        )}
      </Section>

      {analysis.learning_resources.length > 0 && (
        <Section title={t("skillsGap.learningResources")} colors={colors}>
          {analysis.learning_resources.map((resource, idx) => (
            <View key={`${resource.title}-${idx}`} style={styles.resourceBlock}>
              <View
                style={[
                  styles.resourceTypeBadge,
                  {
                    backgroundColor:
                      resource.type === "course"
                        ? colors.primary
                        : resource.type === "certification"
                          ? colors.warning
                          : resource.type === "article"
                            ? colors.success
                            : colors.accent,
                  },
                ]}
              >
                <Text style={[styles.resourceTypeText, { color: colors.onPrimary }]}>
                  {t(`skillsGap.${resource.type}`)}
                </Text>
              </View>
              <Text style={[styles.resourceTitle, { color: colors.textPrimary }]}>
                {resource.title}
              </Text>
              {resource.url !== null && (
                <Text style={[styles.resourceUrl, { color: colors.primaryStrong }]}>
                  {resource.url}
                </Text>
              )}
            </View>
          ))}
        </Section>
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
  backButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
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
  resultCard: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  resultScore: {
    fontSize: 44,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resourceBlock: {
    marginTop: 8,
    gap: 4,
  },
  resourceTypeBadge: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  resourceTypeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  resourceUrl: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
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
