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

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";
import SpeechToTextButton from "@/ui/SpeechToTextButton";
import {
  ApiError,
  type JobDescriptionResponse,
  type MatchResponse,
  type ResumeResponse,
} from "@/services/contract";

const MAX_JD_CHARS = 50_000;

type MatchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; match: MatchResponse; jobDescription: JobDescriptionResponse };

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: JobDescriptionResponse[] };

const apiClient = new ApiClient();

export default function JobMatchScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, handleUnauthorized } = useAuth();

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [rawText, setRawText] = useState("");
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState>({ status: "idle" });
  const [listState, setListState] = useState<ListState>({ status: "loading" });

  const accessToken = session?.access_token;

  const loadResumes = useCallback(async () => {
    if (accessToken === undefined) {
      void handleUnauthorized();
      return;
    }
    try {
      const items = await apiClient.listResumes(accessToken);
      setResumes(items);
      if (resumeId === null && items.length > 0) {
        setResumeId(items[0]?.id ?? null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }, [accessToken, handleUnauthorized, resumeId]);

  const loadList = useCallback(async () => {
    if (accessToken === undefined) {
      void handleUnauthorized();
      return;
    }
    setListState({ status: "loading" });
    try {
      const items = await apiClient.listJobDescriptions(accessToken);
      setListState({ status: "success", items });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setListState({
          status: "error",
          message: err instanceof Error ? err.message : t("jobMatch.errorJobs"),
        });
      }
    }
  }, [accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadResumes();
      void loadList();
    }, [loadResumes, loadList]),
  );

  function validate(): string | null {
    if (resumeId === null) {
      return t("jobMatch.noResumeError");
    }
    if (rawText.trim() === "") {
      return t("jobMatch.noJdError");
    }
    if (rawText.length > MAX_JD_CHARS) {
      return t("jobMatch.jdTooLong", { max: MAX_JD_CHARS });
    }
    return null;
  }

  async function handleMatch() {
    if (accessToken === undefined || resumeId === null) {
      void handleUnauthorized();
      return;
    }
    const validationError = validate();
    if (validationError !== null) {
      setMatchState({ status: "error", message: validationError });
      return;
    }
    setMatchState({ status: "loading" });
    try {
      const payload: {
        title?: string;
        company?: string;
        raw_text: string;
        resume_id: string;
      } = { raw_text: rawText.trim(), resume_id: resumeId };
      if (title.trim() !== "") {
        payload.title = title.trim();
      }
      if (company.trim() !== "") {
        payload.company = company.trim();
      }
      const result = await apiClient.createJobDescription(accessToken, payload);
      setMatchState({
        status: "success",
        match: result.match,
        jobDescription: result.job_description,
      });
      setTitle("");
      setCompany("");
      setRawText("");
      void loadList();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setMatchState({
          status: "error",
          message: err instanceof Error ? err.message : t("jobMatch.errorMatch"),
        });
      }
    }
  }

  async function handleRerun(jobDescriptionId: string) {
    if (accessToken === undefined || resumeId === null) {
      return;
    }
    setMatchState({ status: "loading" });
    try {
      const match = await apiClient.runMatch(accessToken, jobDescriptionId, {
        resume_id: resumeId,
      });
      const jobDescription =
        listState.status === "success"
          ? (listState.items.find((item) => item.id === jobDescriptionId) ?? null)
          : null;
      if (jobDescription === null) {
        setMatchState({ status: "error", message: t("jobMatch.errorReload") });
        return;
      }
      setMatchState({ status: "success", match, jobDescription });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setMatchState({
          status: "error",
          message: err instanceof Error ? err.message : t("jobMatch.errorMatch"),
        });
      }
    }
  }

  async function handleDelete(jobDescriptionId: string) {
    if (accessToken === undefined) {
      return;
    }
    try {
      await apiClient.deleteJobDescription(accessToken, jobDescriptionId);
      void loadList();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>
          {t("jobMatch.eyebrow")}
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t("jobMatch.title")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("jobMatch.subtitle")}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("jobMatch.resumeLabel")}
        </Text>
        {resumes.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            No resume imported yet — import one from the Resume tab first.
          </Text>
        ) : (
          <View style={styles.chipRow}>
            {resumes.map((resume) => (
              <Pressable
                key={resume.id}
                accessibilityRole="button"
                accessibilityLabel={`Use resume ${resume.title}`}
                accessibilityState={{ selected: resumeId === resume.id }}
                onPress={() => setResumeId(resume.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: resumeId === resume.id ? colors.primary : colors.surface,
                    borderColor: resumeId === resume.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: resumeId === resume.id ? colors.onPrimary : colors.textPrimary },
                  ]}
                >
                  {resume.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("jobMatch.jobTitle")}
        </Text>
        <View style={styles.fieldRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            accessibilityLabel={t("jobMatch.jobTitle")}
            placeholder={t("jobMatch.jobTitlePlaceholder")}
            placeholderTextColor={colors.textDisabled}
            style={[
              styles.input,
              styles.inputWithMic,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <SpeechToTextButton
            onResult={(text) => setTitle((prev) => (prev === "" ? text : `${prev} ${text}`))}
            color={colors.textDisabled}
            activeColor={colors.primaryStrong}
            label={t("jobMatch.voiceInput")}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("jobMatch.company")}</Text>
        <View style={styles.fieldRow}>
          <TextInput
            value={company}
            onChangeText={setCompany}
            accessibilityLabel={t("jobMatch.company")}
            placeholder={t("jobMatch.companyPlaceholder")}
            placeholderTextColor={colors.textDisabled}
            style={[
              styles.input,
              styles.inputWithMic,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <SpeechToTextButton
            onResult={(text) => setCompany((prev) => (prev === "" ? text : `${prev} ${text}`))}
            color={colors.textDisabled}
            activeColor={colors.primaryStrong}
            label={t("jobMatch.voiceInput")}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("jobMatch.jobDescription")}
        </Text>
        <View style={styles.fieldRow}>
          <TextInput
            value={rawText}
            onChangeText={setRawText}
            accessibilityLabel={t("jobMatch.jobDescription")}
            placeholder={t("jobMatch.jobDescriptionPlaceholder")}
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={6}
            style={[
              styles.input,
              styles.jdInput,
              styles.inputWithMic,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <SpeechToTextButton
            onResult={(text) => setRawText((prev) => (prev === "" ? text : `${prev} ${text}`))}
            color={colors.textDisabled}
            activeColor={colors.primaryStrong}
            label={t("jobMatch.voiceInput")}
          />
        </View>

        {matchState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>
              {matchState.message}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("jobMatch.match")}
          onPress={() => void handleMatch()}
          disabled={matchState.status === "loading"}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            matchState.status === "loading" && styles.disabled,
          ]}
        >
          {matchState.status === "loading" ? (
            <ActivityIndicator color={colors.onPrimary} accessibilityLabel={t("jobMatch.match")} />
          ) : (
            <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
              {t("jobMatch.match")}
            </Text>
          )}
        </Pressable>

        {matchState.status === "success" && (
          <MatchResultView
            match={matchState.match}
            jobDescription={matchState.jobDescription}
            colors={colors}
            onRerun={() => void handleRerun(matchState.jobDescription.id)}
          />
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 32 }]}>
          {t("jobMatch.savedJobs")}
        </Text>
        {listState.status === "loading" && (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading job descriptions" />
        )}
        {listState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{listState.message}</Text>
          </View>
        )}
        {listState.status === "success" && listState.items.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("jobMatch.noSavedJobs")}
          </Text>
        )}
        {listState.status === "success" &&
          listState.items.map((item) => (
            <View
              key={item.id}
              style={[
                styles.savedCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.savedBody}>
                <Text style={[styles.savedTitle, { color: colors.textPrimary }]}>
                  {item.title ?? t("jobMatch.untitledRole")}
                  {item.company !== null ? ` · ${item.company}` : ""}
                </Text>
                <Text numberOfLines={2} style={[styles.savedText, { color: colors.textSecondary }]}>
                  {item.raw_text}
                </Text>
              </View>
              <View style={styles.savedActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("jobMatch.match")} ${item.title ?? t("jobMatch.thisRole")}`}
                  onPress={() => void handleRerun(item.id)}
                  style={[styles.smallButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.smallButtonText, { color: colors.onPrimary }]}>
                    {t("jobMatch.match")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t("common.delete")} ${item.title ?? t("jobMatch.untitledRole")}`}
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
    </View>
  );
}

function MatchResultView({
  match,
  jobDescription,
  colors,
  onRerun,
}: {
  match: MatchResponse;
  jobDescription: JobDescriptionResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
  onRerun: () => void;
}) {
  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
    >
      <Text style={[styles.resultLabel, { color: colors.primaryStrong }]}>
        {t("jobMatch.resultLabel")}
      </Text>
      <Text style={[styles.resultScore, { color: colors.primaryStrong }]}>{match.score}%</Text>
      <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>
        {jobDescription.title ?? t("jobMatch.thisRole")}
        {jobDescription.company !== null ? ` at ${jobDescription.company}` : ""}
      </Text>

      <Section title={t("jobMatch.matchedSkills")} colors={colors}>
        {match.matched_skills.length > 0 ? (
          <Text style={[styles.skillLine, { color: colors.textPrimary }]}>
            {match.matched_skills.join(", ")}
          </Text>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("jobMatch.noMatchedSkills")}
          </Text>
        )}
      </Section>

      <Section title={t("jobMatch.missingSkills")} colors={colors}>
        {match.missing_skills.length > 0 ? (
          <Text style={[styles.skillLine, { color: colors.textPrimary }]}>
            {match.missing_skills.join(", ")}
          </Text>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("jobMatch.nothingMissing")}
          </Text>
        )}
      </Section>

      <Section title={t("jobMatch.strengths")} colors={colors}>
        {match.strengths.length > 0 ? (
          match.strengths.map((strength) => (
            <Text key={strength} style={[styles.bullet, { color: colors.textPrimary }]}>
              • {strength}
            </Text>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("jobMatch.noStrengths")}
          </Text>
        )}
      </Section>

      <Section title={t("jobMatch.recommendedActions")} colors={colors}>
        {match.actions.length > 0 ? (
          match.actions.map((action) => (
            <View key={action.title} style={styles.actionBlock}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
                {action.title}
              </Text>
              <Text style={[styles.actionDetail, { color: colors.textSecondary }]}>
                {action.detail}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("jobMatch.noActions")}
          </Text>
        )}
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("common.tryAgain")}
        onPress={onRerun}
        style={({ pressed }) => [
          styles.secondaryButton,
          { backgroundColor: colors.surfaceRaised },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.primaryStrong }]}>
          {t("jobMatch.runAgain")}
        </Text>
      </Pressable>
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
  container: {
    flex: 1,
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
  jdInput: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  inputWithMic: {
    flex: 1,
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
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
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
  resultSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 2,
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
  skillLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  actionBlock: {
    marginTop: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
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
  savedText: {
    fontSize: 13,
    lineHeight: 18,
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
