import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";
import {
  ApiError,
  type JobDescriptionResponse,
  type ResumeResponse,
  type TailorDiff,
  type TailorHistoryItem,
} from "@/services/contract";

type TailorState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; tailor: TailorDiff; jobDescription: JobDescriptionResponse };

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: TailorHistoryItem[] };

const apiClient = new ApiClient();

export default function ResumeTailorScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescriptionResponse[]>([]);
  const [jobDescriptionId, setJobDescriptionId] = useState<string | null>(null);
  const [tailorState, setTailorState] = useState<TailorState>({ status: "idle" });
  const [historyState, setHistoryState] = useState<HistoryState>({ status: "loading" });
  const [showOriginal, setShowOriginal] = useState(false);

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
      // Job descriptions are optional
    }
  }, [isGuest, guestId, accessToken]);

  const loadHistory = useCallback(async () => {
    if (resumeId === null) {
      setHistoryState({ status: "success", items: [] });
      return;
    }
    setHistoryState({ status: "loading" });
    try {
      const items = isGuest
        ? await apiClient.getTailorHistory(undefined, resumeId, guestId ?? undefined)
        : await apiClient.getTailorHistory(accessToken, resumeId);
      setHistoryState({ status: "success", items });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setHistoryState({
          status: "error",
          message: err instanceof Error ? err.message : t("tailor.error"),
        });
      }
    }
  }, [isGuest, guestId, accessToken, resumeId, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadResumes();
      void loadJobDescriptions();
      void loadHistory();
    }, [loadResumes, loadJobDescriptions, loadHistory]),
  );

  async function handleTailor() {
    if (resumeId === null || jobDescriptionId === null) {
      return;
    }
    setTailorState({ status: "loading" });
    try {
      const result = isGuest
        ? await apiClient.tailorResume(
            undefined,
            { resume_id: resumeId, job_description_id: jobDescriptionId },
            guestId ?? undefined,
          )
        : await apiClient.tailorResume(accessToken, {
            resume_id: resumeId,
            job_description_id: jobDescriptionId,
          });
      const jd = jobDescriptions.find((j) => j.id === jobDescriptionId) ?? result.job_description;
      setTailorState({ status: "success", tailor: result.tailor, jobDescription: jd });
      setShowOriginal(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setTailorState({
          status: "error",
          message: err instanceof Error ? err.message : t("tailor.error"),
        });
      }
    }
  }

  async function handleAccept() {
    if (tailorState.status !== "success") {
      return;
    }
    try {
      if (isGuest) {
        await apiClient.acceptTailor(
          undefined,
          { tailor_id: tailorState.tailor.id },
          guestId ?? undefined,
        );
      } else {
        await apiClient.acceptTailor(accessToken, { tailor_id: tailorState.tailor.id });
      }
      setTailorState({ status: "idle" });
      void loadHistory();
      void loadResumes();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setTailorState({
          status: "error",
          message: err instanceof Error ? err.message : t("tailor.error"),
        });
      }
    }
  }

  function handleReject() {
    setTailorState({ status: "idle" });
  }

  async function handleDeleteHistory(tailorId: string) {
    if (isGuest) {
      return;
    }
    if (accessToken === undefined) {
      return;
    }
    try {
      await apiClient.deleteTailor(accessToken, tailorId);
      void loadHistory();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  const hasResume = resumes.length > 0;
  const hasJob = jobDescriptions.length > 0;
  const canTailor = resumeId !== null && jobDescriptionId !== null;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          eyebrow={t("tailor.eyebrow")}
          title={t("tailor.title")}
          subtitle={t("tailor.subtitle")}
        />

        {!hasResume && !hasJob ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {!hasResume ? t("tailor.noResume") : t("tailor.noJob")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("tailor.selectResume")}
            </Text>
            {!hasResume ? (
              <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
                {t("tailor.noResume")}
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {resumes.map((r) => (
                  <Pressable
                    key={r.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Use resume ${r.title}`}
                    accessibilityState={{ selected: resumeId === r.id }}
                    onPress={() => {
                      setResumeId(r.id);
                      setTailorState({ status: "idle" });
                      void loadHistory();
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
            )}

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("tailor.selectJob")}
            </Text>
            {!hasJob ? (
              <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
                {t("tailor.noJob")}
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {jobDescriptions.map((jd) => (
                  <Pressable
                    key={jd.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Use job ${jd.title ?? jd.company ?? "description"}`}
                    accessibilityState={{ selected: jobDescriptionId === jd.id }}
                    onPress={() => {
                      setJobDescriptionId(jd.id);
                      setTailorState({ status: "idle" });
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          jobDescriptionId === jd.id ? colors.primary : colors.surface,
                        borderColor: jobDescriptionId === jd.id ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: jobDescriptionId === jd.id ? colors.onPrimary : colors.textPrimary,
                        },
                      ]}
                    >
                      {jd.title ?? jd.company ?? "Job"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tailor.tailorButton")}
              onPress={() => void handleTailor()}
              disabled={!canTailor || tailorState.status === "loading"}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                (!canTailor || tailorState.status === "loading") && styles.disabled,
              ]}
            >
              {tailorState.status === "loading" ? (
                <ActivityIndicator
                  color={colors.onPrimary}
                  accessibilityLabel={t("tailor.tailoring")}
                />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  {t("tailor.tailorButton")}
                </Text>
              )}
            </Pressable>

            {tailorState.status === "loading" && (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t("tailor.tailoring")}
                </Text>
              </View>
            )}

            {tailorState.status === "error" && (
              <View
                style={[styles.errorCard, { backgroundColor: colors.danger }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.errorText, { color: colors.onDanger }]}>
                  {tailorState.message}
                </Text>
              </View>
            )}

            {tailorState.status === "success" && (
              <TailorResultView
                tailor={tailorState.tailor}
                jobDescription={tailorState.jobDescription}
                colors={colors}
                showOriginal={showOriginal}
                onToggleView={() => setShowOriginal((prev) => !prev)}
                onAccept={() => void handleAccept()}
                onReject={handleReject}
              />
            )}

            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 32 }]}>
              {t("tailor.history")}
            </Text>
            {historyState.status === "loading" && (
              <ActivityIndicator color={colors.primary} accessibilityLabel="Loading history" />
            )}
            {historyState.status === "error" && (
              <View
                style={[styles.errorCard, { backgroundColor: colors.danger }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.errorText, { color: colors.onDanger }]}>
                  {historyState.message}
                </Text>
              </View>
            )}
            {historyState.status === "success" && historyState.items.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
                {t("tailor.noHistory")}
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
                      {item.job_title ?? "Untitled role"}
                      {item.job_company !== null ? ` · ${item.job_company}` : ""}
                    </Text>
                    <Text style={[styles.savedText, { color: colors.textSecondary }]}>
                      {item.accepted ? t("tailor.accepted") : t("tailor.rejectButton")}
                    </Text>
                  </View>
                  {!isGuest && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t("common.delete")} tailor result`}
                      onPress={() => void handleDeleteHistory(item.id)}
                      style={[styles.smallButton, { backgroundColor: colors.danger }]}
                    >
                      <Text style={[styles.smallButtonText, { color: colors.onDanger }]}>
                        {t("common.delete")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </AppBackground>
  );
}

function TailorResultView({
  tailor,
  jobDescription,
  colors,
  showOriginal,
  onToggleView,
  onAccept,
  onReject,
}: {
  tailor: TailorDiff;
  jobDescription: JobDescriptionResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
  showOriginal: boolean;
  onToggleView: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const toggleLabel = showOriginal ? t("tailor.tailored") : t("tailor.original");

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show ${toggleLabel}`}
        onPress={onToggleView}
        style={({ pressed }) => [
          styles.toggleButton,
          { backgroundColor: colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.toggleText, { color: colors.primaryStrong }]}>
          {t("tailor.original")} / {t("tailor.tailored")}
        </Text>
        <Text style={[styles.toggleActive, { color: colors.primary }]}>
          {showOriginal ? t("tailor.original") : t("tailor.tailored")}
        </Text>
      </Pressable>

      <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
        {jobDescription.title ?? "Role"}
        {jobDescription.company !== null ? ` at ${jobDescription.company}` : ""}
      </Text>

      {showOriginal ? (
        <OriginalView tailor={tailor} colors={colors} />
      ) : (
        <TailoredView tailor={tailor} colors={colors} />
      )}

      <Text style={[styles.changesHeader, { color: colors.textPrimary }]}>
        {t("tailor.changes")}
      </Text>
      {tailor.section_diffs.map((diff, i) => (
        <View
          key={i}
          style={[
            styles.changeCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.changeSection, { color: colors.primaryStrong }]}>
            {diff.section === "summary"
              ? t("tailor.summaryChange")
              : diff.section === "skills"
                ? t("tailor.skillsChange")
                : diff.section === "experience"
                  ? t("tailor.experienceChange")
                  : diff.section}
          </Text>
          <Text style={[styles.reasoningLabel, { color: colors.textSecondary }]}>
            {t("tailor.reasoning")}
          </Text>
          <Text style={[styles.reasoningText, { color: colors.textPrimary }]}>
            {diff.reasoning}
          </Text>
        </View>
      ))}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tailor.acceptButton")}
          onPress={onAccept}
          style={({ pressed }) => [
            styles.acceptButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.acceptButtonText, { color: colors.onPrimary }]}>
            {t("tailor.acceptButton")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tailor.rejectButton")}
          onPress={onReject}
          style={({ pressed }) => [
            styles.rejectButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.rejectButtonText, { color: colors.textPrimary }]}>
            {t("tailor.rejectButton")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function OriginalView({
  tailor,
  colors,
}: {
  tailor: TailorDiff;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
}) {
  return (
    <View style={styles.contentView}>
      {tailor.original_summary !== null && (
        <View style={styles.contentBlock}>
          <Text style={[styles.contentLabel, { color: colors.primaryStrong }]}>
            {t("tailor.summaryChange")}
          </Text>
          <Text style={[styles.contentText, { color: colors.textPrimary }]}>
            {tailor.original_summary}
          </Text>
        </View>
      )}
      {tailor.original_skills.length > 0 && (
        <View style={styles.contentBlock}>
          <Text style={[styles.contentLabel, { color: colors.primaryStrong }]}>
            {t("tailor.skillsChange")}
          </Text>
          <Text style={[styles.contentText, { color: colors.textPrimary }]}>
            {tailor.original_skills.join(", ")}
          </Text>
        </View>
      )}
      {tailor.original_experience.length > 0 && (
        <View style={styles.contentBlock}>
          <Text style={[styles.contentLabel, { color: colors.primaryStrong }]}>
            {t("tailor.experienceChange")}
          </Text>
          {tailor.original_experience.map((exp, i) => (
            <Text key={i} style={[styles.contentText, { color: colors.textPrimary }]}>
              {exp.title ?? exp.organization} — {exp.bullets.join("; ")}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function TailoredView({
  tailor,
  colors,
}: {
  tailor: TailorDiff;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
}) {
  return (
    <View style={styles.contentView}>
      {tailor.tailored_summary !== null && (
        <View style={styles.contentBlock}>
          <Text style={[styles.contentLabel, { color: colors.primaryStrong }]}>
            {t("tailor.summaryChange")}
          </Text>
          <Text style={[styles.contentText, { color: colors.textPrimary }]}>
            {tailor.tailored_summary}
          </Text>
        </View>
      )}
      {tailor.tailored_skills.length > 0 && (
        <View style={styles.contentBlock}>
          <Text style={[styles.contentLabel, { color: colors.primaryStrong }]}>
            {t("tailor.skillsChange")}
          </Text>
          <Text style={[styles.contentText, { color: colors.textPrimary }]}>
            {tailor.tailored_skills.join(", ")}
          </Text>
        </View>
      )}
      {tailor.tailored_experience.length > 0 && (
        <View style={styles.contentBlock}>
          <Text style={[styles.contentLabel, { color: colors.primaryStrong }]}>
            {t("tailor.experienceChange")}
          </Text>
          {tailor.tailored_experience.map((exp, i) => (
            <Text key={i} style={[styles.contentText, { color: colors.textPrimary }]}>
              {exp.title ?? exp.organization} — {exp.bullets.join("; ")}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 24, paddingBottom: 48 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  primaryButton: { marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonText: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  loadingBlock: { marginTop: 20, alignItems: "center", gap: 8 },
  loadingText: { fontSize: 14 },
  errorCard: { marginTop: 16, borderRadius: 12, padding: 14 },
  errorText: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  resultCard: { marginTop: 20, borderRadius: 20, borderWidth: 1, padding: 20 },
  toggleButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  toggleText: { fontSize: 12, fontWeight: "600" },
  toggleActive: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  resultSubtitle: { fontSize: 14, textAlign: "center", marginBottom: 12 },
  contentView: { gap: 12 },
  contentBlock: { gap: 4 },
  contentLabel: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  contentText: { fontSize: 14, lineHeight: 20 },
  changesHeader: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  changeCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  changeSection: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  reasoningLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  reasoningText: { fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  acceptButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  acceptButtonText: { fontSize: 14, fontWeight: "700" },
  rejectButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  rejectButtonText: { fontSize: 14, fontWeight: "700" },
  savedCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  savedBody: { gap: 4 },
  savedTitle: { fontSize: 15, fontWeight: "600" },
  savedText: { fontSize: 13, lineHeight: 18 },
  smallButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  smallButtonText: { fontSize: 13, fontWeight: "700" },
});
