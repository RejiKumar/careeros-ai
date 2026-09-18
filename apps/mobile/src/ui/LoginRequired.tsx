import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { t } from "@/i18n";
import { useTheme } from "@/lib/theme";

function LoginButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("loginRequired.loginButton")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        style,
        { backgroundColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
        {t("loginRequired.loginButton")}
      </Text>
    </Pressable>
  );
}

export function LoginRequiredBanner({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
      accessibilityRole="alert"
    >
      <View style={styles.bannerRow}>
        <View style={[styles.lockBadge, { backgroundColor: colors.primary }]}>
          <Ionicons name="lock-closed" size={16} color={colors.onPrimary} />
        </View>
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerTitle, { color: colors.primaryStrong }]}>
            {t("loginRequired.title")}
          </Text>
          <Text style={[styles.bannerMessage, { color: colors.textSecondary }]}>
            {t("loginRequired.message")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("loginRequired.notNow")}
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismissButton}
        >
          <Ionicons name="close" size={20} color={colors.textDisabled} />
        </Pressable>
      </View>
      <View style={styles.bannerActions}>
        <LoginButton onPress={() => router.push("/auth")} style={styles.bannerButton} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("loginRequired.notNow")}
          onPress={onDismiss}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.secondaryButtonLabel, { color: colors.textPrimary }]}>
            {t("loginRequired.notNow")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function LoginRequiredScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.lockBadge, styles.screenIcon, { backgroundColor: colors.primary }]}>
        <Ionicons name="lock-closed" size={28} color={colors.onPrimary} />
      </View>
      <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
        {t("loginRequired.title")}
      </Text>
      <Text style={[styles.screenMessage, { color: colors.textSecondary }]}>
        {t("loginRequired.message")}
      </Text>
      <LoginButton onPress={() => router.push("/auth")} style={styles.screenButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerBody: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  bannerMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 2,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
  },
  bannerButton: {
    flex: 1,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  screenButton: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  screenIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  screenMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.85,
  },
});