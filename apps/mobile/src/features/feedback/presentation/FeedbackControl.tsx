import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";

const REASONS = [
  { key: "incorrect", label: t("feedback.reasons.incorrect") },
  { key: "too_generic", label: t("feedback.reasons.tooGeneric") },
  { key: "not_relevant", label: t("feedback.reasons.notRelevant") },
  { key: "too_long", label: t("feedback.reasons.tooLong") },
  { key: "other", label: t("feedback.reasons.other") },
] as const;

interface FeedbackControlProps {
  outputType: string;
  outputId: string;
}

const apiClient = new ApiClient();

export default function FeedbackControl({ outputType, outputId }: FeedbackControlProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus } = useAuth();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<"helpful" | "not_helpful" | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRate(newRating: "helpful" | "not_helpful") {
    if (submitting || submitted) {
      return;
    }
    setRating(newRating);
    if (newRating === "helpful") {
      setSubmitting(true);
      try {
        await apiClient.submitFeedback(
          accessToken,
          { output_type: outputType, output_id: outputId, rating: "helpful" },
          isGuest ? (guestId ?? undefined) : undefined,
        );
        setSubmitted(true);
      } catch {
        // Fail silently for feedback
      } finally {
        setSubmitting(false);
      }
    } else {
      setShowReasons(true);
    }
  }

  async function handleSubmitReason() {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const reason = selectedReason === "other" ? "other" : selectedReason;
      const reasonDetail = selectedReason === "other" ? otherText : null;
      await apiClient.submitFeedback(
        accessToken,
        {
          output_type: outputType,
          output_id: outputId,
          rating: "not_helpful",
          reason: reason,
          reason_detail: reasonDetail,
        },
        isGuest ? (guestId ?? undefined) : undefined,
      );
      setSubmitted(true);
    } catch {
      // Fail silently
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={[styles.thankYou, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.thankYouText, { color: colors.primaryStrong }]}>
          {t("feedback.thankYou")}
        </Text>
      </View>
    );
  }

  if (!showReasons) {
    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.textDisabled }]}>{t("feedback.question")}</Text>
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Helpful"
            accessibilityState={{ selected: rating === "helpful" }}
            onPress={() => void handleRate("helpful")}
            disabled={submitting}
            style={({ pressed }) => [
              styles.rateButton,
              {
                backgroundColor: rating === "helpful" ? colors.success : colors.surface,
                borderColor: rating === "helpful" ? colors.success : colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.rateButtonText,
                { color: rating === "helpful" ? colors.onPrimary : colors.textPrimary },
              ]}
            >
              {t("feedback.helpful")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not helpful"
            accessibilityState={{ selected: rating === "not_helpful" }}
            onPress={() => void handleRate("not_helpful")}
            disabled={submitting}
            style={({ pressed }) => [
              styles.rateButton,
              {
                backgroundColor: rating === "not_helpful" ? colors.danger : colors.surface,
                borderColor: rating === "not_helpful" ? colors.danger : colors.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.rateButtonText,
                { color: rating === "not_helpful" ? colors.onPrimary : colors.textPrimary },
              ]}
            >
              {t("feedback.notHelpful")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.reasonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.reasonTitle, { color: colors.textPrimary }]}>
        {t("feedback.whyNotHelpful")}
      </Text>
      <View style={styles.reasonRow}>
        {REASONS.map((r) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityLabel={`Reason: ${r.label}`}
            accessibilityState={{ selected: selectedReason === r.key }}
            onPress={() => setSelectedReason(r.key)}
            style={[
              styles.reasonChip,
              {
                backgroundColor: selectedReason === r.key ? colors.primarySoft : colors.surface,
                borderColor: selectedReason === r.key ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.reasonChipText,
                { color: selectedReason === r.key ? colors.primaryStrong : colors.textPrimary },
              ]}
            >
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedReason === "other" && (
        <TextInput
          value={otherText}
          onChangeText={setOtherText}
          accessibilityLabel="Other reason"
          placeholder={t("feedback.placeholder")}
          placeholderTextColor={colors.textDisabled}
          style={[
            styles.otherInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      )}

      <View style={styles.reasonActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip reason and submit"
          onPress={() => void handleSubmitReason()}
          disabled={submitting}
          style={({ pressed }) => [
            styles.skipButton,
            { backgroundColor: colors.surfaceRaised },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t("common.skip")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit feedback"
          onPress={() => void handleSubmitReason()}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            submitting && styles.disabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Submitting" />
          ) : (
            <Text style={[styles.submitText, { color: colors.onPrimary }]}>
              {t("common.submit")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 6 },
  label: { fontSize: 12, fontWeight: "500" },
  buttonRow: { flexDirection: "row", gap: 8 },
  rateButton: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  rateButtonText: { fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  thankYou: { marginTop: 10, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  thankYouText: { fontSize: 13, fontWeight: "600" },
  reasonCard: { marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  reasonTitle: { fontSize: 14, fontWeight: "700" },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: { borderRadius: 9999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  reasonChipText: { fontSize: 12, fontWeight: "600" },
  otherInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  reasonActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  skipButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  skipText: { fontSize: 13, fontWeight: "600" },
  submitButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  submitText: { fontSize: 13, fontWeight: "700" },
});
