import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { t } from "../../../i18n";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import {
  ApiError,
  type ResumeDetailResponse,
  type RewriteBatchResponse,
} from "@/services/contract";

type BatchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; batch: RewriteBatchResponse };

type ResumeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; detail: ResumeDetailResponse };

const apiClient = new ApiClient();

export default function RewritesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ resumeId?: string }>();
  const resumeIdParam = typeof params.resumeId === "string" ? params.resumeId : undefined;
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, handleUnauthorized } = useAuth();

  const [resumeState, setResumeState] = useState<ResumeState>(
    resumeIdParam === undefined ? { status: "error", message: t("rewrites.noResume") } : { status: "loading" },
  );
  const [batchState, setBatchState] = useState<BatchState>({ status: "idle" });
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);

  const accessToken = session?.access_token;
  const resumeId = resumeIdParam;

  useEffect(() => {
    const token = accessToken;
    const rid = resumeId;
    if (token === undefined || rid === undefined) {
      return;
    }
    let cancelled = false;
    const loadResume = async () => {
      try {
        const detail = await apiClient.getResume(token, rid);
        if (!cancelled) {
          setResumeState({ status: "success", detail });
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          void handleUnauthorized();
        } else {
          setResumeState({
            status: "error",
            message: err instanceof Error ? err.message : t("rewrites.loadError"),
          });
        }
      }
    }
    void loadResume();
    return () => {
      cancelled = true;
    };
  }, [accessToken, resumeId, handleUnauthorized]);

  async function handleGenerate() {
    if (accessToken === undefined || resumeId === undefined) {
      return;
    }
    setBatchState({ status: "loading" });
    try {
      const batch = await apiClient.createRewriteBatch(accessToken, resumeId);
      setBatchState({ status: "success", batch });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setBatchState({
          status: "error",
          message: err instanceof Error ? err.message : t("rewrites.generateError"),
        });
      }
    }
  }

  function applySuggestion(content: ResumeDetailResponse["parsed"], suggestion: RewriteBatchResponse["suggestions"][number]): ResumeDetailResponse["parsed"] {
    if (content === null) {
      return content;
    }
    const next = structuredClone(content);
    const section = suggestion.section.toLowerCase();
    const replaceAll = (list: string[]) =>
      list.map((item) => (item === suggestion.original ? suggestion.rewritten : item));
    if (section.includes("summary") && next.summary === suggestion.original) {
      next.summary = suggestion.rewritten;
    } else if (section.includes("skill")) {
      next.skills = replaceAll(next.skills);
    } else if (section.includes("experienc") || section.includes("work")) {
      next.experience = next.experience.map((entry) => ({
        ...entry,
        bullets: replaceAll(entry.bullets),
        title: entry.title === suggestion.original ? suggestion.rewritten : entry.title,
      }));
    } else if (section.includes("project")) {
      next.projects = next.projects.map((entry) => ({
        ...entry,
        bullets: replaceAll(entry.bullets),
      }));
    } else if (section.includes("education")) {
      next.education = next.education.map((entry) => ({
        ...entry,
        degree: entry.degree === suggestion.original ? suggestion.rewritten : entry.degree,
      }));
    }
    return next;
  }

  async function handleAccept(suggestion: RewriteBatchResponse["suggestions"][number]) {
    if (accessToken === undefined || resumeId === undefined) {
      return;
    }
    if (resumeState.status !== "success" || batchState.status !== "success") {
      return;
    }
    const updatedContent = applySuggestion(resumeState.detail.parsed, suggestion);
    if (updatedContent === null) {
      setBatchState({ status: "error", message: t("rewrites.noContent") });
      return;
    }
    setBatchState({ status: "loading" });
    try {
      const result = await apiClient.acceptRewriteBatch(
        accessToken,
        resumeId,
        batchState.batch.id,
        updatedContent,
      );
      setBatchState({ status: "success", batch: batchState.batch });
      setResumeState({ status: "success", detail: { ...resumeState.detail, parsed: updatedContent } });
      setAcceptMessage(t("rewrites.savedVersion", { n: result.version }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setBatchState({
          status: "error",
          message: err instanceof Error ? err.message : t("rewrites.saveError"),
        });
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surfaceRaised },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.backArrow, { color: colors.textPrimary }]}>‹</Text>
          <Text style={[styles.backLabel, { color: colors.textPrimary }]}>{t("rewrites.resumeButton")}</Text>
        </Pressable>

        <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>{t("rewrites.eyebrow")}</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("rewrites.title")}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("rewrites.subtitle")}
        </Text>

        {resumeState.status === "loading" && (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading resume" />
        )}
        {resumeState.status === "error" && (
          <View style={[styles.notice, { backgroundColor: colors.danger }]} accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{resumeState.message}</Text>
          </View>
        )}

        {acceptMessage !== null && (
          <View style={[styles.notice, { backgroundColor: colors.success }]} accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{acceptMessage}</Text>
          </View>
        )}

        {batchState.status === "idle" && resumeState.status === "success" && (
          <>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {resumeState.detail.parsed === null
                ? t("rewrites.emptyTitle")
                : t("rewrites.emptyDesc")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate improvement suggestions"
              onPress={() => void handleGenerate()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
                {t("rewrites.generateButton")}
              </Text>
            </Pressable>
          </>
        )}

        {batchState.status === "loading" && (
          <View style={[styles.loadingBox, { backgroundColor: colors.surfaceRaised }]}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Generating suggestions" />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {t("rewrites.generating")}
            </Text>
          </View>
        )}

        {batchState.status === "error" && (
          <View style={[styles.notice, { backgroundColor: colors.danger }]} accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{batchState.message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try generating suggestions again"
              onPress={() => void handleGenerate()}
              style={[styles.retryButton, { backgroundColor: colors.surfaceRaised }]}
            >
              <Text style={[styles.retryText, { color: colors.textPrimary }]}>{t("common.tryAgain")}</Text>
            </Pressable>
          </View>
        )}

        {batchState.status === "success" && batchState.batch.suggestions.length === 0 && (
          <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]} accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: colors.textPrimary }]}>
              {t("rewrites.noSuggestions")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try generating suggestions again"
              onPress={() => void handleGenerate()}
              style={[styles.retryButton, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.retryText, { color: colors.textPrimary }]}>{t("rewrites.generateButton")}</Text>
            </Pressable>
          </View>
        )}

        {batchState.status === "success" && batchState.batch.suggestions.length > 0 && (
          <>
            {batchState.batch.suggestions.map((suggestion) => (
              <View
                key={suggestion.id}
                style={[styles.suggestionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.suggestionSection, { color: colors.primaryStrong }]}>
                  {suggestion.section}
                </Text>
                <Text style={[styles.suggestionLabel, { color: colors.textDisabled }]}>{t("rewrites.before")}</Text>
                <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>
                  {suggestion.original}
                </Text>
                <Text style={[styles.suggestionLabel, { color: colors.textDisabled }]}>{t("rewrites.after")}</Text>
                <Text style={[styles.suggestionText, { color: colors.textPrimary }]}>
                  {suggestion.rewritten}
                </Text>
                <Text style={[styles.suggestionRationale, { color: colors.textSecondary }]}>
                  {suggestion.rationale}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Accept suggestion for ${suggestion.section}`}
                  onPress={() => void handleAccept(suggestion)}
                  style={({ pressed }) => [
                    styles.acceptButton,
                    { backgroundColor: colors.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.acceptText, { color: colors.onPrimary }]}>{t("rewrites.acceptButton")}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
  },
  backArrow: {
    fontSize: 22,
    lineHeight: 24,
    marginRight: 4,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: "600",
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
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
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
  notice: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  loadingBox: {
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  suggestionCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  suggestionSection: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
  },
  suggestionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionRationale: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  acceptButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
