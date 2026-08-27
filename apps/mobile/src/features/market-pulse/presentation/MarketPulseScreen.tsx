import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
import ScreenHeader from "@/ui/ScreenHeader";
import { ApiError, type MarketPulseResponse, type SkillTrendResponse } from "@/services/contract";

const LOCATIONS = ["", "Bangalore", "Hyderabad", "Mumbai", "Delhi", "Chennai", "Pune"];

type PulseState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: MarketPulseResponse; trends: SkillTrendResponse };

const apiClient = new ApiClient();

export default function MarketPulseScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [location, setLocation] = useState("");
  const [pulseState, setPulseState] = useState<PulseState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (showRefresh: boolean) => {
      if (accessToken === undefined && !(isGuest && guestId !== null)) {
        void handleUnauthorized();
        return;
      }
      if (!showRefresh) {
        setPulseState({ status: "loading" });
      }
      try {
        const token = isGuest ? undefined : accessToken;
        const guest = isGuest ? (guestId ?? undefined) : undefined;
        const [data, trends] = await Promise.all([
          apiClient.getMarketPulse(token, location || undefined, undefined, guest),
          apiClient.getSkillTrends(token, undefined, location || undefined, guest),
        ]);
        setPulseState({ status: "success", data, trends });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          void handleUnauthorized();
          return;
        }
        setPulseState({
          status: "error",
          message: err instanceof Error ? err.message : t("marketPulse.error"),
        });
      } finally {
        if (showRefresh) {
          setRefreshing(false);
        }
      }
    },
    [accessToken, isGuest, guestId, location, handleUnauthorized],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const handleLocationChange = useCallback((next: string) => {
    setLocation(next);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="market-pulse-scroll"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            testID="market-pulse-refresh"
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader
          eyebrow={t("marketPulse.eyebrow")}
          title={t("marketPulse.title")}
          subtitle={t("marketPulse.subtitle")}
          onBack={() => router.back()}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t("marketPulse.location")}
        </Text>
        <View style={styles.chipRow}>
          {LOCATIONS.map((loc) => {
            const selected = loc === location;
            return (
              <Pressable
                key={loc || "all"}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => handleLocationChange(loc)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.onPrimary : colors.textPrimary },
                  ]}
                >
                  {loc === "" ? t("marketPulse.allLocations") : loc}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {pulseState.status === "loading" && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading market data" />
          </View>
        )}

        {pulseState.status === "error" && (
          <View
            style={[styles.notice, { backgroundColor: colors.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>
              {pulseState.message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.tryAgain")}
              onPress={() => void load(false)}
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: colors.onDanger },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.retryButtonText, { color: colors.danger }]}>
                {t("common.tryAgain")}
              </Text>
            </Pressable>
          </View>
        )}

        {pulseState.status === "success" && isEmpty(pulseState.data, pulseState.trends) && (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t("marketPulse.noData")}
            </Text>
          </View>
        )}

        {pulseState.status === "success" && !isEmpty(pulseState.data, pulseState.trends) && (
          <MarketPulseView data={pulseState.data} trends={pulseState.trends} colors={colors} />
        )}
      </ScrollView>
    </View>
  );
}

function isEmpty(data: MarketPulseResponse, trends: SkillTrendResponse): boolean {
  return (
    data.skill_demand.length === 0 &&
    data.salary_ranges.length === 0 &&
    data.top_companies.length === 0 &&
    data.recommended_skills.length === 0 &&
    trends.trends.length === 0
  );
}

function ChangeBadge({ changePct, colors }: { changePct: number; colors: ThemeColors }) {
  const positive = changePct > 0;
  const negative = changePct < 0;
  const color = positive ? colors.success : negative ? colors.danger : colors.textSecondary;
  const arrow = positive ? "↑" : negative ? "↓" : "→";
  return (
    <Text style={[styles.changeBadge, { color }]}>
      {arrow} {positive ? "+" : ""}
      {changePct}%
    </Text>
  );
}

function MarketPulseView({
  data,
  trends,
  colors,
}: {
  data: MarketPulseResponse;
  trends: SkillTrendResponse;
  colors: ThemeColors;
}) {
  return (
    <View>
      {data.skill_demand.length > 0 && (
        <Section title={t("marketPulse.skillDemand")} colors={colors}>
          {data.skill_demand.map((item) => (
            <View
              key={item.skill}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.skillDemandHeader}>
                <Text style={[styles.skillName, { color: colors.textPrimary }]}>{item.skill}</Text>
                <ChangeBadge changePct={item.change_pct} colors={colors} />
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(0, Math.min(100, item.demand_score))}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.jobCount, { color: colors.textSecondary }]}>
                {t("marketPulse.jobCount", { count: item.job_count })}
              </Text>
            </View>
          ))}
        </Section>
      )}

      {data.salary_ranges.length > 0 && (
        <Section title={t("marketPulse.salaryRanges")} colors={colors}>
          {data.salary_ranges.map((salary, index) => (
            <View
              key={`${salary.role}-${salary.location}-${index}`}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.salaryRole, { color: colors.textPrimary }]}>{salary.role}</Text>
              <Text style={[styles.salaryLocation, { color: colors.textSecondary }]}>
                {salary.location}
              </Text>
              <View style={styles.salaryRow}>
                <SalaryStat label="Min" value={formatCurrency(salary.min)} colors={colors} />
                <SalaryStat label="Median" value={formatCurrency(salary.median)} colors={colors} />
                <SalaryStat label="Max" value={formatCurrency(salary.max)} colors={colors} />
              </View>
            </View>
          ))}
        </Section>
      )}

      {data.top_companies.length > 0 && (
        <Section title={t("marketPulse.topCompanies")} colors={colors}>
          {data.top_companies.map((company) => (
            <View
              key={company.name}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.companyHeader}>
                <Text style={[styles.companyName, { color: colors.textPrimary }]}>
                  {company.name}
                </Text>
                <Text style={[styles.jobCount, { color: colors.textSecondary }]}>
                  {t("marketPulse.jobCount", { count: company.job_count })}
                </Text>
              </View>
              <View style={styles.badgeRow}>
                {company.tech_stack.map((tech) => (
                  <View key={tech} style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.badgeText, { color: colors.primaryStrong }]}>{tech}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Section>
      )}

      {trends.trends.length > 0 && (
        <Section title={t("marketPulse.skillTrends")} colors={colors}>
          <View style={styles.trendGroup}>
            <TrendColumn
              heading={t("marketPulse.rising")}
              items={trends.trends.filter((item) => item.trend === "rising")}
              color={colors.success}
              colors={colors}
            />
            <TrendColumn
              heading={t("marketPulse.stable")}
              items={trends.trends.filter((item) => item.trend === "stable")}
              color={colors.textSecondary}
              colors={colors}
            />
            <TrendColumn
              heading={t("marketPulse.declining")}
              items={trends.trends.filter((item) => item.trend === "declining")}
              color={colors.danger}
              colors={colors}
            />
          </View>
        </Section>
      )}

      {data.recommended_skills.length > 0 && (
        <Section title={t("marketPulse.recommendedSkills")} colors={colors}>
          <View style={styles.badgeRow}>
            {data.recommended_skills.map((skill) => (
              <View key={skill} style={[styles.badge, { backgroundColor: colors.surfaceRaised }]}>
                <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{skill}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}
    </View>
  );
}

function SalaryStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.salaryStat}>
      <Text style={[styles.salaryStatLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.salaryStatValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function TrendColumn({
  heading,
  items,
  color,
  colors,
}: {
  heading: string;
  items: SkillTrendResponse["trends"];
  color: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.trendColumn}>
      <Text style={[styles.trendHeading, { color }]}>{heading}</Text>
      {items.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textDisabled }]}>—</Text>
      ) : (
        items.map((item) => {
          const arrow = item.trend === "rising" ? "↑" : item.trend === "declining" ? "↓" : "→";
          return (
            <View key={item.skill} style={styles.trendItem}>
              <Text style={[styles.trendArrow, { color }]}>{arrow}</Text>
              <Text style={[styles.trendSkill, { color: colors.textPrimary }]}>{item.skill}</Text>
              <Text style={[styles.trendChange, { color }]}>{item.change_pct}%</Text>
            </View>
          );
        })
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
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_00_000) {
    const lakhs = value / 1_00_000;
    return `₹${lakhs % 1 === 0 ? lakhs : lakhs.toFixed(1)}L`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
}

type ThemeColors = import("@careeros/design-tokens").ThemeTokens["colors"];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
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
  center: {
    alignItems: "center",
    paddingVertical: 48,
  },
  notice: {
    marginTop: 24,
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
  retryButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  skillDemandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  skillName: {
    fontSize: 15,
    fontWeight: "700",
  },
  changeBadge: {
    fontSize: 13,
    fontWeight: "700",
  },
  barTrack: {
    height: 8,
    borderRadius: 9999,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 9999,
  },
  jobCount: {
    fontSize: 13,
    marginTop: 8,
  },
  salaryRole: {
    fontSize: 15,
    fontWeight: "700",
  },
  salaryLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  salaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  salaryStat: {
    flex: 1,
    alignItems: "center",
  },
  salaryStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  salaryStatValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  companyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  companyName: {
    fontSize: 15,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  trendGroup: {
    flexDirection: "row",
    gap: 12,
  },
  trendColumn: {
    flex: 1,
    gap: 8,
  },
  trendHeading: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  trendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendArrow: {
    fontSize: 14,
    fontWeight: "800",
  },
  trendSkill: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  trendChange: {
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
