import { getDocumentAsync } from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../../../i18n";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { ApiError, type AssessmentResponse, type ResumeContent } from "@/services/contract";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

const JOURNEY_STEPS = [
  { titleKey: "resume.step1Title", descKey: "resume.step1Desc" },
  { titleKey: "resume.step2Title", descKey: "resume.step2Desc" },
  { titleKey: "resume.step3Title", descKey: "resume.step3Desc" },
] as const;

type ImportState =
  | { status: "idle" }
  | { status: "picking" }
  | { status: "uploading" }
  | { status: "error"; message: string }
  | { status: "success"; resumeId: string; parsed: ResumeContent };

type ScoreState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; assessment: AssessmentResponse };

const apiClient = new ApiClient();

export default function ResumeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();

  const insets = useSafeAreaInsets();
  const isGuest = authStatus === "guest";
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [restoring, setRestoring] = useState(true);
  const [scoreState, setScoreState] = useState<ScoreState>({ status: "idle" });
  const [pendingFile, setPendingFile] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);

  const accessToken = session?.access_token;

  function reportError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        void handleUnauthorized();
        return t("resume.sessionExpired");
      }
      return err.message;
    }
    return err instanceof Error ? err.message : t("resume.genericError");
  }

  const restoreLatestResume = useCallback(async () => {
    const token = isGuest ? undefined : accessToken;
    const gid = (isGuest ? guestId : undefined) ?? undefined;
    if (token === undefined && gid === undefined) {
      setRestoring(false);
      return;
    }
    try {
      const items = await apiClient.listResumes(token, gid);
      const latest = items.find((r) => r.current_version_id !== null);
      if (latest === undefined) {
        setRestoring(false);
        return;
      }
      const detail = await apiClient.getResume(token, latest.id, gid);
      if (detail.parsed !== null) {
        setImportState({ status: "success", resumeId: latest.id, parsed: detail.parsed });
      }
    } catch {
      // Restore is best-effort; the import journey remains available.
    } finally {
      setRestoring(false);
    }
  }, [accessToken, guestId, isGuest]);

  useFocusEffect(
    useCallback(() => {
      void restoreLatestResume();
    }, [restoreLatestResume]),
  );

  async function handleImport() {
    if (importState.status === "uploading" || importState.status === "picking") {
      return;
    }
    setImportState({ status: "picking" });
    setScoreState({ status: "idle" });
    try {
      const result = await getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || result.assets.length === 0) {
        setImportState({ status: "idle" });
        return;
      }

      const asset = result.assets[0];
      if (asset === undefined) {
        setImportState({ status: "idle" });
        return;
      }
      const fileName = asset.name ?? "resume";
      const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

      if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
        setImportState({
          status: "error",
          message: t("resume.unsupportedFile"),
        });
        return;
      }

      if (asset.size !== undefined && asset.size > MAX_FILE_BYTES) {
        setImportState({
          status: "error",
          message: t("resume.fileTooLarge"),
        });
        return;
      }

      await uploadFile({
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType ?? "application/octet-stream",
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
        setImportState({ status: "idle" });
      } else {
        setImportState({ status: "error", message: reportError(err) });
      }
    }
  }

  async function uploadFile(file: { uri: string; name: string; type: string }) {
    const token = isGuest ? undefined : accessToken;
    const gid = (isGuest ? guestId : undefined) ?? undefined;
    if (token === undefined && gid === undefined) {
      void handleUnauthorized();
      return;
    }
    setPendingFile(file);
    setImportState({ status: "uploading" });
    try {
      const response = await apiClient.importResume(token, file, gid);
      setImportState({ status: "success", resumeId: response.resume.id, parsed: response.parsed });
    } catch (err) {
      throw err;
    }
  }

  async function handleScore() {
    if (scoreState.status === "loading") {
      return;
    }
    if (importState.status !== "success") {
      return;
    }
    const token = isGuest ? undefined : accessToken;
    const gid = (isGuest ? guestId : undefined) ?? undefined;
    if (token === undefined && gid === undefined) {
      return;
    }
    setScoreState({ status: "loading" });
    try {
      const assessment = await apiClient.createAssessment(token, importState.resumeId, gid);
      setScoreState({ status: "success", assessment });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
        setScoreState({ status: "idle" });
      } else {
        setScoreState({ status: "error", message: reportError(err) });
      }
    }
  }

  const isBusy = importState.status === "picking" || importState.status === "uploading";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}>
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
          <Text style={[styles.backLabel, { color: colors.textPrimary }]}>
            {t("resume.homeButton")}
          </Text>
        </Pressable>

        <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>{t("resume.eyebrow")}</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t("resume.title")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("resume.subtitle")}
        </Text>

        {importState.status === "success" ? (
          <>
            <ParsedResumeView
              parsed={importState.parsed}
              colors={colors}
              scoreState={scoreState}
              onGetScore={() => void handleScore()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Improve my resume"
              onPress={() =>
                router.push({ pathname: "/rewrites", params: { resumeId: importState.resumeId } })
              }
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.secondary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
                {t("resume.improveButton")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import another resume"
              onPress={() => {
                setImportState({ status: "idle" });
                setScoreState({ status: "idle" });
                void handleImport();
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: colors.surfaceRaised },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryButtonLabel, { color: colors.primaryStrong }]}>
                {t("resume.importAnother") ?? "Import another resume"}
              </Text>
            </Pressable>
          </>
        ) : restoring ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Restoring resume" />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {t("resume.restoring") ?? "Restoring your resume\u2026"}
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel="No resume yet"
            >
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {t("resume.emptyTitle")}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t("resume.emptyDesc")}
              </Text>
            </View>

            <View style={styles.steps}>
              {JOURNEY_STEPS.map((step, index) => (
                <View key={step.titleKey} style={[styles.stepRow, { borderColor: colors.border }]}>
                  <View
                    style={[styles.stepNumber, { backgroundColor: colors.primarySoft }]}
                    accessibilityElementsHidden
                  >
                    <Text style={[styles.stepNumberText, { color: colors.primaryStrong }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                      {t(step.titleKey)}
                    </Text>
                    <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                      {t(step.descKey)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {importState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>
              {importState.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={() => {
                if (pendingFile !== null) {
                  void uploadFile(pendingFile);
                } else {
                  void handleImport();
                }
              }}
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: colors.surfaceRaised },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.retryText, { color: colors.textPrimary }]}>
                {t("common.tryAgain")}
              </Text>
            </Pressable>
          </View>
        )}

        {importState.status === "idle" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import resume"
            onPress={() => void handleImport()}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Importing" />
            ) : (
              <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
                {t("resume.importButton")}
              </Text>
            )}
          </Pressable>
        )}

        {importState.status === "uploading" && (
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {t("resume.uploading")}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

interface ParsedResumeViewProps {
  parsed: ResumeContent;
  scoreState: ScoreState;
  onGetScore: () => void;
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
}

function ParsedResumeView({ parsed, scoreState, onGetScore, colors }: ParsedResumeViewProps) {
  return (
    <>
      <View style={[styles.reviewCard, { backgroundColor: colors.surfaceRaised }]}>
        <Text style={[styles.reviewCardText, { color: colors.textSecondary }]}>
          {t("resume.reviewCard")}
        </Text>
      </View>

      <Section
        title={t("resume.contact")}
        colors={colors}
        renderContent={
          <>
            <Row label={t("resume.nameLabel")} value={parsed.contact.full_name} colors={colors} />
            <Row label={t("resume.emailLabel")} value={parsed.contact.email} colors={colors} />
            <Row label={t("resume.phoneLabel")} value={parsed.contact.phone} colors={colors} />
            <Row
              label={t("resume.locationLabel")}
              value={parsed.contact.location}
              colors={colors}
            />
            {parsed.contact.links.length > 0 && (
              <Row
                label={t("resume.linksLabel")}
                value={parsed.contact.links.join(" · ")}
                colors={colors}
              />
            )}
          </>
        }
      />

      {parsed.summary !== null && parsed.summary !== "" && (
        <Section
          title={t("resume.summary")}
          colors={colors}
          renderContent={
            <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{parsed.summary}</Text>
          }
        />
      )}

      {parsed.skills.length > 0 && (
        <Section
          title={t("resume.skills")}
          colors={colors}
          renderContent={
            <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
              {parsed.skills.join(", ")}
            </Text>
          }
        />
      )}

      {parsed.experience.map((entry, index) => (
        <Section
          key={`${entry.organization}-${index}`}
          title={entry.title && entry.title !== "" ? entry.title : entry.organization}
          colors={colors}
          renderContent={
            <>
              <Text style={[styles.entryOrg, { color: colors.textSecondary }]}>
                {[
                  entry.organization,
                  entry.start_date && entry.end_date
                    ? `${entry.start_date} – ${entry.end_date}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {entry.bullets.map((bullet) => (
                <Text key={bullet} style={[styles.bullet, { color: colors.textPrimary }]}>
                  • {bullet}
                </Text>
              ))}
            </>
          }
        />
      ))}

      {parsed.education.map((entry, index) => (
        <Section
          key={`${entry.institution}-${index}`}
          title={entry.institution}
          colors={colors}
          renderContent={
            <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
              {[entry.degree, entry.field_of_study].filter(Boolean).join(", ")}
            </Text>
          }
        />
      ))}

      {scoreState.status === "idle" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get my health score"
          onPress={onGetScore}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
            {t("resume.scoreButton")}
          </Text>
        </Pressable>
      )}

      {scoreState.status === "loading" && (
        <View style={[styles.loadingBox, { backgroundColor: colors.surfaceRaised }]}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Scoring" />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {t("resume.scoring")}
          </Text>
        </View>
      )}

      {scoreState.status === "error" && (
        <View style={[styles.notice, { backgroundColor: colors.danger }]} accessibilityRole="alert">
          <Text style={[styles.noticeText, { color: colors.onDanger }]}>{scoreState.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry health score"
            onPress={onGetScore}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.surfaceRaised },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.retryText, { color: colors.textPrimary }]}>
              {t("common.tryAgain")}
            </Text>
          </Pressable>
        </View>
      )}

      {scoreState.status === "success" && (
        <ScoreView assessment={scoreState.assessment} colors={colors} />
      )}
    </>
  );
}

function ScoreView({
  assessment,
  colors,
}: {
  assessment: AssessmentResponse;
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
}) {
  const overall =
    assessment.scores.length > 0
      ? Math.round(
          assessment.scores.reduce((sum, s) => sum + s.score, 0) / assessment.scores.length,
        )
      : null;

  return (
    <>
      <View style={[styles.reviewCard, { backgroundColor: colors.surfaceRaised }]}>
        <Text style={[styles.reviewCardText, { color: colors.textSecondary }]}>
          {t("resume.scoreReviewCard")}
        </Text>
      </View>

      {overall !== null && (
        <View
          style={[styles.overallCard, { backgroundColor: colors.primarySoft }]}
          accessibilityLabel={`Overall health score ${overall} out of 100`}
        >
          <Text style={[styles.overallValue, { color: colors.primaryStrong }]}>{overall}</Text>
          <Text style={[styles.overallLabel, { color: colors.primaryStrong }]}>
            {t("resume.overallScore")}
          </Text>
        </View>
      )}

      {assessment.scores.map((dimension) => (
        <View
          key={dimension.dimension}
          style={[
            styles.dimensionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.dimensionHeader}>
            <Text style={[styles.dimensionTitle, { color: colors.textPrimary }]}>
              {dimension.dimension}
            </Text>
            <Text style={[styles.dimensionScore, { color: colors.primaryStrong }]}>
              {dimension.score}/100
            </Text>
          </View>
          {dimension.explanation !== null && (
            <Text style={[styles.dimensionExplanation, { color: colors.textSecondary }]}>
              {dimension.explanation}
            </Text>
          )}
        </View>
      ))}

      <ListSection
        title={t("resume.strengths")}
        items={assessment.strengths}
        emptyText={t("resume.noStrengths")}
        colors={colors}
      />

      {assessment.gaps.length > 0 && (
        <Section
          title={t("resume.gapsSuggestions")}
          colors={colors}
          renderContent={
            <>
              {assessment.gaps.map((gap) => (
                <View key={gap.description} style={styles.gapBlock}>
                  <Text style={[styles.bullet, { color: colors.textPrimary }]}>
                    • {gap.description}
                  </Text>
                  {gap.suggestion !== null && (
                    <Text style={[styles.gapSuggestion, { color: colors.textSecondary }]}>
                      {t("resume.suggestionPrefix")}
                      {gap.suggestion}
                    </Text>
                  )}
                </View>
              ))}
            </>
          }
        />
      )}

      <ListSection
        title={t("resume.evidence")}
        items={assessment.evidence}
        emptyText={t("resume.noEvidence")}
        colors={colors}
      />
    </>
  );
}

function ListSection({
  title,
  items,
  emptyText,
  colors,
}: {
  title: string;
  items: string[];
  emptyText: string;
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
}) {
  return (
    <Section
      title={title}
      colors={colors}
      renderContent={
        items.length > 0 ? (
          items.map((item) => (
            <Text key={item} style={[styles.bullet, { color: colors.textPrimary }]}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyText}</Text>
        )
      }
    />
  );
}

function Section({
  title,
  colors,
  renderContent,
}: {
  title: string;
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
  renderContent: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {renderContent}
    </View>
  );
}

function Row({
  label,
  value,
  colors,
}: {
  label: string;
  value: string | null | undefined;
  colors: ReturnType<typeof useTheme>["theme"]["colors"];
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return (
    <Text style={[styles.rowText, { color: colors.textPrimary }]}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}: </Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    marginTop: 32,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  emptyCard: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  steps: {
    marginTop: 24,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  primaryButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
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
  reviewCard: {
    marginTop: 24,
    borderRadius: 12,
    padding: 14,
  },
  reviewCardText: {
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    marginTop: 24,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  rowText: {
    fontSize: 14,
    lineHeight: 20,
  },
  rowLabel: {
    fontWeight: "600",
  },
  entryOrg: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  loadingBox: {
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  overallCard: {
    marginTop: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  overallValue: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "800",
  },
  overallLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  dimensionCard: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  dimensionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dimensionTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  dimensionScore: {
    fontSize: 15,
    fontWeight: "700",
  },
  dimensionExplanation: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  gapBlock: {
    marginTop: 8,
  },
  gapSuggestion: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
