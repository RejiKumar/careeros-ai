import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/lib/theme";
import AppBackground from "@/ui/AppBackground";
import GlassCard from "@/ui/GlassCard";
import IconChip, { type IconName } from "@/ui/IconChip";
import ScreenHeader from "@/ui/ScreenHeader";

import { t } from "../../src/i18n";

interface ToolItem {
  key: string;
  route: string;
  icon: IconName;
  gradient: readonly [string, string];
}

const TOOLS: ToolItem[] = [
  {
    key: "tools.match",
    route: "/job-match",
    icon: "flash",
    gradient: ["#38BDF8", "#5B5BF0"],
  },
  {
    key: "tools.tailor",
    route: "/tailor",
    icon: "create",
    gradient: ["#5B5BF0", "#B34AF0"],
  },
  {
    key: "tools.applications",
    route: "/applications",
    icon: "albums",
    gradient: ["#B34AF0", "#38BDF8"],
  },
  {
    key: "tools.skillsGap",
    route: "/skills-gap",
    icon: "stats-chart",
    gradient: ["#F59E0B", "#EF4444"],
  },
  {
    key: "tools.marketPulse",
    route: "/market-pulse",
    icon: "pulse",
    gradient: ["#16A34A", "#38BDF8"],
  },
  {
    key: "tools.company",
    route: "/company",
    icon: "business",
    gradient: ["#38BDF8", "#16A34A"],
  },
  {
    key: "tools.salary",
    route: "/salary",
    icon: "cash",
    gradient: ["#F59E0B", "#B34AF0"],
  },
  {
    key: "tools.careerPath",
    route: "/career-path",
    icon: "map",
    gradient: ["#5B5BF0", "#16A34A"],
  },
  {
    key: "tools.notifications",
    route: "/notifications",
    icon: "notifications",
    gradient: ["#EF4444", "#F59E0B"],
  },
];

export default function ToolsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          eyebrow={t("tools.eyebrow")}
          title={t("tools.title")}
          subtitle={t("tools.subtitle")}
          onBack={() => router.back()}
        />

        <View style={styles.grid}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              accessibilityRole="button"
              accessibilityLabel={`Open ${t(tool.key)}`}
              onPress={() => router.push(tool.route)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <GlassCard style={styles.cardInner}>
                <IconChip name={tool.icon} size={52} gradient={tool.gradient} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t(tool.key)}</Text>
                <View style={styles.cardFooter}>
                  <Ionicons name="arrow-forward" size={16} color={colors.textDisabled} />
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 80,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "48%",
  },
  cardInner: {
    minHeight: 148,
    padding: 16,
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginTop: 12,
    lineHeight: 20,
    minHeight: 40,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
