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
  type BenefitsComparisonResponse,
  type NegotiationResponse,
} from "@/services/contract";

type SalaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: NegotiationResponse };

type BenefitsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: BenefitsComparisonResponse };

const EXPERIENCE_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 15, 20];

const apiClient = new ApiClient();

export default function SalaryNegotiatorScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [experienceYears, setExperienceYears] = useState(3);
  const [skills, setSkills] = useState("");
  const [company, setCompany] = useState("");
  const [salaryState, setSalaryState] = useState<SalaryState>({ status: "idle" });
  const [benefitsState, setBenefitsState] = useState<BenefitsState>({ status: "idle" });

  useFocusEffect(
    useCallback(() => {
      // No-op: screen is ready
    }, []),
  );

  async function handleGetRange() {
    if (role.trim() === "" || location.trim() === "") {
      return;
    }
    const skillsList = skills
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");

    const payload = {
      role: role.trim(),
      location: location.trim(),
      experience_years: experienceYears,
      skills: skillsList,
      ...(company.trim() !== "" ? { company: company.trim() } : {}),
    };

    setSalaryState({ status: "loading" });
    setBenefitsState({ status: "loading" });

    try {
      const result = await apiClient.getSalaryRange(
        isGuest ? undefined : accessToken,
        payload,
        isGuest && guestId !== null ? guestId : undefined,
      );
      setSalaryState({ status: "success", data: result });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setSalaryState({
          status: "error",
          message: err instanceof Error ? err.message : t("salary.error"),
        });
      }
    }

    try {
      const result = await apiClient.getBenefitsComparison(
        isGuest ? undefined : accessToken,
        payload,
        isGuest && guestId !== null ? guestId : undefined,
      );
      setBenefitsState({ status: "success", data: result });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setBenefitsState({
          status: "error",
          message: err instanceof Error ? err.message : t("salary.error"),
        });
      }
    }
  }

  const isLoading = salaryState.status === "loading" || benefitsState.status === "loading";

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow={t("salary.eyebrow")}
          title={t("salary.title")}
          subtitle={t("salary.subtitle")}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("salary.role")}</Text>
        <TextInput
          value={role}
          onChangeText={setRole}
          accessibilityLabel={t("salary.role")}
          placeholder={t("salary.role")}
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

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("salary.location")}</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          accessibilityLabel={t("salary.location")}
          placeholder={t("salary.location")}
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

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("salary.experience")}
        </Text>
        <View style={styles.chipRow}>
          {EXPERIENCE_OPTIONS.map((years) => (
            <Pressable
              key={years}
              accessibilityRole="button"
              accessibilityLabel={`${years} years`}
              accessibilityState={{ selected: experienceYears === years }}
              onPress={() => setExperienceYears(years)}
              style={[
                styles.chip,
                {
                  backgroundColor: experienceYears === years ? colors.primary : colors.surface,
                  borderColor: experienceYears === years ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: experienceYears === years ? colors.onPrimary : colors.textPrimary },
                ]}
              >
                {years}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("salary.skills")}</Text>
        <TextInput
          value={skills}
          onChangeText={setSkills}
          accessibilityLabel={t("salary.skills")}
          placeholder={t("salary.skills")}
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

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t("salary.company")}</Text>
        <TextInput
          value={company}
          onChangeText={setCompany}
          accessibilityLabel={t("salary.company")}
          placeholder={t("salary.company")}
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

        {salaryState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>
              {salaryState.message}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("salary.getRange")}
          onPress={() => void handleGetRange()}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            isLoading && styles.disabled,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator
              color={colors.onPrimary}
              accessibilityLabel={t("salary.analyzing")}
            />
          ) : (
            <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
              {t("salary.getRange")}
            </Text>
          )}
        </Pressable>

        {salaryState.status === "success" && (
          <SalaryResultView data={salaryState.data} colors={colors} />
        )}

        {benefitsState.status === "success" && (
          <BenefitsView data={benefitsState.data} colors={colors} />
        )}

        {salaryState.status === "idle" && benefitsState.status === "idle" && (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.textDisabled, marginTop: 24 }]}>
              {t("salary.noData")}
            </Text>
          </View>
        )}
      </ScrollView>
    </AppBackground>
  );
}

function SalaryResultView({
  data,
  colors,
}: {
  data: NegotiationResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
}) {
  const { salary_range: range, script } = data;

  return (
    <View
      style={[
        styles.resultCard,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
    >
      <Text style={[styles.resultLabel, { color: colors.primaryStrong }]}>{t("salary.title")}</Text>

      <View style={styles.salaryRow}>
        <View style={styles.salaryCol}>
          <Text style={[styles.salaryValue, { color: colors.primaryStrong }]}>
            {formatSalary(range.min_salary, range.currency)}
          </Text>
          <Text style={[styles.salaryLabel, { color: colors.textSecondary }]}>
            {t("salary.minSalary")}
          </Text>
        </View>
        <View style={styles.salaryCol}>
          <Text style={[styles.salaryValue, { color: colors.primaryStrong }]}>
            {formatSalary(range.median_salary, range.currency)}
          </Text>
          <Text style={[styles.salaryLabel, { color: colors.textSecondary }]}>
            {t("salary.medianSalary")}
          </Text>
        </View>
        <View style={styles.salaryCol}>
          <Text style={[styles.salaryValue, { color: colors.primaryStrong }]}>
            {formatSalary(range.max_salary, range.currency)}
          </Text>
          <Text style={[styles.salaryLabel, { color: colors.textSecondary }]}>
            {t("salary.maxSalary")}
          </Text>
        </View>
      </View>

      <View style={styles.confidenceRow}>
        <Text style={[styles.confidenceLabel, { color: colors.textSecondary }]}>
          {t("salary.confidence")}
        </Text>
        <Text style={[styles.confidenceValue, { color: colors.primaryStrong }]}>
          {Math.round(range.confidence * 100)}%
        </Text>
      </View>

      <Section title={t("salary.negotiationScript")} colors={colors}>
        <View style={styles.scriptSection}>
          <Text style={[styles.scriptLabel, { color: colors.textPrimary }]}>
            {t("salary.opening")}
          </Text>
          <Text style={[styles.scriptText, { color: colors.textSecondary }]}>{script.opening}</Text>
        </View>

        <View style={styles.scriptSection}>
          <Text style={[styles.scriptLabel, { color: colors.textPrimary }]}>
            {t("salary.justification")}
          </Text>
          {script.justification_points.map((point, idx) => (
            <Text key={idx} style={[styles.bullet, { color: colors.textSecondary }]}>
              • {point}
            </Text>
          ))}
        </View>

        <View style={styles.scriptSection}>
          <Text style={[styles.scriptLabel, { color: colors.textPrimary }]}>
            {t("salary.objections")}
          </Text>
          {script.handling_objections.map((point, idx) => (
            <Text key={idx} style={[styles.bullet, { color: colors.textSecondary }]}>
              • {point}
            </Text>
          ))}
        </View>

        <View style={styles.scriptSection}>
          <Text style={[styles.scriptLabel, { color: colors.textPrimary }]}>
            {t("salary.closing")}
          </Text>
          <Text style={[styles.scriptText, { color: colors.textSecondary }]}>{script.closing}</Text>
        </View>
      </Section>
    </View>
  );
}

function BenefitsView({
  data,
  colors,
}: {
  data: BenefitsComparisonResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
}) {
  return (
    <View
      style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Section title={t("salary.benefits")} colors={colors}>
        {data.benefits.length > 0 ? (
          data.benefits.map((benefit, idx) => (
            <View key={idx} style={styles.benefitBlock}>
              <Text style={[styles.benefitName, { color: colors.textPrimary }]}>
                {benefit.item}
              </Text>
              <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                {benefit.typical}
              </Text>
              {benefit.negotiable && (
                <View
                  style={[
                    styles.negotiableBadge,
                    { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.negotiableText, { color: colors.primaryStrong }]}>
                    {t("salary.negotiable")}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>—</Text>
        )}
      </Section>
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

function formatSalary(value: number, currency: string): string {
  if (currency === "INR") {
    if (value >= 1_00_000) {
      const lakhs = value / 1_00_000;
      return `₹${lakhs % 1 === 0 ? lakhs : lakhs.toFixed(1)}L`;
    }
    return `₹${value.toLocaleString("en-IN")}`;
  }
  return `${currency === "USD" ? "$" : `${currency} `}${value.toLocaleString()}`;
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
  resultLabel: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  salaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
  },
  salaryCol: {
    alignItems: "center",
    gap: 4,
  },
  salaryValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  salaryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  confidenceLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  section: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  scriptSection: {
    marginTop: 8,
    gap: 4,
  },
  scriptLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  scriptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  benefitBlock: {
    marginTop: 8,
    gap: 2,
  },
  benefitName: {
    fontSize: 14,
    fontWeight: "600",
  },
  benefitDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  negotiableBadge: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  negotiableText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
