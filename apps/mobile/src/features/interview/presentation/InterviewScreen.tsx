import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t } from "../../../i18n";
import { ApiClient } from "@/services/api";
import SpeechToTextButton from "@/ui/SpeechToTextButton";
import {
  ApiError,
  type InterviewAnswerResponse,
  type InterviewEvaluationResponse,
  type InterviewQuestionResponse,
  type InterviewSessionResponse,
  type ResumeResponse,
} from "@/services/contract";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";

const INTERVIEW_MODES = [
  { key: "hr", labelKey: "interview.modes.hr" as const },
  { key: "technical", labelKey: "interview.modes.technical" as const },
  { key: "behavioral", labelKey: "interview.modes.behavioral" as const },
  { key: "manager", labelKey: "interview.modes.manager" as const },
  { key: "startup", labelKey: "interview.modes.startup" as const },
  { key: "custom", labelKey: "interview.modes.custom" as const },
] as const;

type ViewMode = "setup" | "session";

type SessionDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; questions: InterviewQuestionResponse[] };

type AnswerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; evaluation: InterviewEvaluationResponse };

const apiClient = new ApiClient();

export default function InterviewScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [viewMode, setViewMode] = useState<ViewMode>("setup");
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [targetJob, setTargetJob] = useState("");
  const [targetSkills, setTargetSkills] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<InterviewSessionResponse | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetailState>({ status: "idle" });
  const [answerDraft, setAnswerDraft] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>({ status: "idle" });
  const [answers, setAnswers] = useState<Map<string, InterviewAnswerResponse>>(new Map());

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

  useFocusEffect(
    useCallback(() => {
      void loadResumes();
    }, [loadResumes]),
  );

  async function handleCreateSession() {
    if (selectedMode === null || creating) {
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: {
        mode: string;
        resume_id?: string;
        target_job?: string;
        target_skills?: string[];
      } = {
        mode: selectedMode,
      };
      if (resumeId !== null) {
        payload.resume_id = resumeId;
      }
      if (targetJob.trim() !== "") {
        payload.target_job = targetJob.trim();
      }
      if (targetSkills.trim() !== "") {
        payload.target_skills = targetSkills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const detail = isGuest
        ? await apiClient.createInterviewSession(undefined, payload, guestId ?? undefined)
        : await apiClient.createInterviewSession(accessToken, payload);
      setActiveSession(detail.session);
      setViewMode("session");
      setSessionDetail({ status: "success", questions: detail.questions });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
        return;
      }
      setCreateError(err instanceof Error ? err.message : t("interview.errorStart"));
    } finally {
      setCreating(false);
    }
  }

  async function handleSubmitAnswer() {
    if (
      activeQuestionId === null ||
      answerDraft.trim() === "" ||
      answerState.status === "loading"
    ) {
      return;
    }
    setAnswerState({ status: "loading" });
    try {
      if (activeSession === null) {
        return;
      }
      const result = isGuest
        ? await apiClient.submitInterviewAnswer(
            undefined,
            activeSession.id,
            activeQuestionId,
            answerDraft.trim(),
            guestId ?? undefined,
          )
        : await apiClient.submitInterviewAnswer(
            accessToken,
            activeSession.id,
            activeQuestionId,
            answerDraft.trim(),
          );
      setAnswerState({ status: "success", evaluation: result.evaluation });
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(activeQuestionId, {
          id: result.id,
          question_id: activeQuestionId,
          content: answerDraft.trim(),
          evaluation: result.evaluation,
          created_at: result.created_at,
        });
        return next;
      });
    } catch (err) {
      setAnswerState({
        status: "error",
        message: err instanceof Error ? err.message : t("interview.errorEvaluation"),
      });
    }
  }

  function handleSelectQuestion(questionId: string) {
    setActiveQuestionId(questionId);
    setAnswerDraft("");
    setAnswerState({ status: "idle" });
  }

  if (viewMode === "setup") {
    return (
      <AppBackground>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <ScreenHeader
              eyebrow={t("interview.eyebrow")}
              title={t("interview.title")}
              subtitle={t("interview.subtitle")}
            />

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("interview.modeSection")}
            </Text>
            <View style={styles.modeRow}>
              {INTERVIEW_MODES.map((mode) => (
                <Pressable
                  key={mode.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("interview.modeSection")}: ${t(mode.labelKey)}`}
                  accessibilityState={{ selected: selectedMode === mode.key }}
                  onPress={() => setSelectedMode(mode.key)}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor: selectedMode === mode.key ? colors.primary : colors.surface,
                      borderColor: selectedMode === mode.key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modeChipText,
                      { color: selectedMode === mode.key ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {t(mode.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {resumes.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t("interview.resumeContext")}
                </Text>
                <View style={styles.chipRow}>
                  {resumes.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Use resume ${r.title}`}
                      accessibilityState={{ selected: resumeId === r.id }}
                      onPress={() => setResumeId(r.id)}
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

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("interview.targetJob")}
            </Text>
            <TextInput
              value={targetJob}
              onChangeText={setTargetJob}
              accessibilityLabel={t("interview.targetJob")}
              placeholder={t("interview.targetJobPlaceholder")}
              placeholderTextColor={colors.textDisabled}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t("interview.targetSkills")}
            </Text>
            <TextInput
              value={targetSkills}
              onChangeText={setTargetSkills}
              accessibilityLabel={t("interview.targetSkills")}
              placeholder={t("interview.targetSkillsPlaceholder")}
              placeholderTextColor={colors.textDisabled}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />

            {createError !== null && (
              <View
                style={[styles.errorCard, { backgroundColor: colors.danger }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.errorText, { color: colors.onDanger }]}>{createError}</Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("interview.startButton")}
              onPress={() => void handleCreateSession()}
              disabled={selectedMode === null || creating}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                (selectedMode === null || creating) && styles.disabled,
              ]}
            >
              {creating ? (
                <ActivityIndicator
                  color={colors.onPrimary}
                  accessibilityLabel={t("interview.startButton")}
                />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                  {t("interview.startButton")}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </AppBackground>
    );
  }

  // Session view
  const activeQuestion =
    sessionDetail.status === "success"
      ? sessionDetail.questions.find((q) => q.id === activeQuestionId)
      : null;

  return (
    <AppBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => {
              setViewMode("setup");
              setActiveSession(null);
              setActiveQuestionId(null);
            }}
            style={[styles.backLink, { backgroundColor: colors.surfaceRaised }]}
          >
            <Text style={[styles.backLinkText, { color: colors.textPrimary }]}>
              {t("interview.newSession")}
            </Text>
          </Pressable>

          <ScreenHeader
            eyebrow={t("interview.eyebrow")}
            title={`${activeSession?.mode ?? ""} session`}
          />

          <Text style={[styles.guideDisclosure, { color: colors.textDisabled }]}>
            {t("interview.disclosure")}
          </Text>

          {sessionDetail.status === "loading" && (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              accessibilityLabel={t("common.loading")}
            />
          )}

          {sessionDetail.status === "error" && (
            <View
              style={[styles.errorCard, { backgroundColor: colors.danger }]}
              accessibilityRole="alert"
            >
              <Text style={[styles.errorText, { color: colors.onDanger }]}>
                {sessionDetail.message}
              </Text>
            </View>
          )}

          {sessionDetail.status === "success" && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t("interview.questionsSection")}
              </Text>
              {sessionDetail.questions.map((q, i) => {
                const answered = answers.has(q.id);
                return (
                  <Pressable
                    key={q.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Question ${i + 1}: ${q.question}`}
                    accessibilityState={{ selected: activeQuestionId === q.id }}
                    onPress={() => handleSelectQuestion(q.id)}
                    style={[
                      styles.questionCard,
                      {
                        backgroundColor:
                          activeQuestionId === q.id ? colors.primarySoft : colors.surface,
                        borderColor: activeQuestionId === q.id ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.questionHeader}>
                      <Text style={[styles.questionNumber, { color: colors.primaryStrong }]}>
                        {i + 1}
                      </Text>
                      <Text style={[styles.questionFocus, { color: colors.textDisabled }]}>
                        {q.focus}
                      </Text>
                      {answered && (
                        <Text style={[styles.answeredBadge, { color: colors.success }]}>✓</Text>
                      )}
                    </View>
                    <Text style={[styles.questionText, { color: colors.textPrimary }]}>
                      {q.question}
                    </Text>
                  </Pressable>
                );
              })}

              {activeQuestion !== null && (
                <View
                  style={[
                    styles.answerSection,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.answerSectionTitle, { color: colors.textPrimary }]}>
                    {t("interview.answerTitle", {
                      n: sessionDetail.questions.findIndex((q) => q.id === activeQuestionId) + 1,
                    })}
                  </Text>
                  <TextInput
                    value={answerDraft}
                    onChangeText={setAnswerDraft}
                    multiline
                    accessibilityLabel={t("interview.answerPlaceholder")}
                    placeholder={t("interview.answerPlaceholder")}
                    placeholderTextColor={colors.textDisabled}
                    style={[
                      styles.answerInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                    ]}
                  />
                  <SpeechToTextButton
                    onResult={(text) =>
                      setAnswerDraft((prev) => (prev === "" ? text : `${prev} ${text}`))
                    }
                    color={colors.textDisabled}
                    activeColor={colors.primaryStrong}
                    label={t("interview.voiceInput")}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("interview.submitAnswer")}
                    onPress={() => void handleSubmitAnswer()}
                    disabled={answerDraft.trim() === "" || answerState.status === "loading"}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: colors.primary },
                      pressed && styles.pressed,
                      (answerDraft.trim() === "" || answerState.status === "loading") &&
                        styles.disabled,
                    ]}
                  >
                    {answerState.status === "loading" ? (
                      <ActivityIndicator
                        color={colors.onPrimary}
                        accessibilityLabel={t("common.loading")}
                      />
                    ) : (
                      <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                        {t("interview.submitAnswer")}
                      </Text>
                    )}
                  </Pressable>

                  {answerState.status === "error" && (
                    <View
                      style={[styles.errorCard, { backgroundColor: colors.danger }]}
                      accessibilityRole="alert"
                    >
                      <Text style={[styles.errorText, { color: colors.onDanger }]}>
                        {answerState.message}
                      </Text>
                    </View>
                  )}

                  {answerState.status === "success" && (
                    <View
                      style={[
                        styles.evalCard,
                        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.evalTitle, { color: colors.primaryStrong }]}>
                        {t("interview.evaluation")}
                      </Text>
                      {(
                        [
                          { evalKey: "relevance", i18nKey: "interview.dimensions.relevance" },
                          { evalKey: "clarity", i18nKey: "interview.dimensions.clarity" },
                          { evalKey: "structure", i18nKey: "interview.dimensions.structure" },
                          {
                            evalKey: "technical_correctness",
                            i18nKey: "interview.dimensions.technicalCorrectness",
                          },
                          { evalKey: "completeness", i18nKey: "interview.dimensions.completeness" },
                        ] as const
                      ).map(({ evalKey, i18nKey }) => (
                        <View key={evalKey} style={styles.evalRow}>
                          <Text style={[styles.evalLabel, { color: colors.textSecondary }]}>
                            {t(i18nKey)}
                          </Text>
                          <Text style={[styles.evalScore, { color: colors.primaryStrong }]}>
                            {answerState.evaluation[evalKey]}/10
                          </Text>
                        </View>
                      ))}
                      <Text style={[styles.evalFeedback, { color: colors.textPrimary }]}>
                        {answerState.evaluation.feedback}
                      </Text>
                      {answerState.evaluation.suggested_answer !== "" && (
                        <View style={styles.suggestedBlock}>
                          <Text style={[styles.suggestedLabel, { color: colors.textSecondary }]}>
                            {t("interview.suggestedAnswer")}
                          </Text>
                          <Text style={[styles.suggestedText, { color: colors.textPrimary }]}>
                            {answerState.evaluation.suggested_answer}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },
  backLink: {
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  backLinkText: { fontSize: 13, fontWeight: "600" },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 16,
  },
  title: { fontSize: 28, lineHeight: 36, fontWeight: "700", marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 16 },
  guideDisclosure: { fontSize: 12, lineHeight: 16, fontStyle: "italic", marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeChip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  modeChipText: { fontSize: 14, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "600" },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  primaryButton: { marginTop: 20, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryButtonText: { fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  errorCard: { marginTop: 16, borderRadius: 12, padding: 14 },
  errorText: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  questionCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  questionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  questionNumber: { fontSize: 14, fontWeight: "800" },
  questionFocus: { fontSize: 12, fontWeight: "500", flex: 1 },
  answeredBadge: { fontSize: 14, fontWeight: "700" },
  questionText: { fontSize: 15, lineHeight: 21 },
  answerSection: { marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  answerSectionTitle: { fontSize: 16, fontWeight: "700" },
  answerInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  evalCard: { marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  evalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  evalRow: { flexDirection: "row", justifyContent: "space-between" },
  evalLabel: { fontSize: 14, textTransform: "capitalize" },
  evalScore: { fontSize: 14, fontWeight: "700" },
  evalFeedback: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  suggestedBlock: { marginTop: 8, gap: 4 },
  suggestedLabel: { fontSize: 12, fontWeight: "600" },
  suggestedText: { fontSize: 14, lineHeight: 20 },
});
