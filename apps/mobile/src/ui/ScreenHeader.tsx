import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

interface ScreenHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function ScreenHeader({ eyebrow, title, subtitle, onBack }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { marginTop: insets.top + 12 }]}>
      {onBack !== undefined && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: colors.surfaceRaised },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.backButtonText, { color: colors.primaryStrong }]}>Back</Text>
        </Pressable>
      )}
      <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle !== undefined && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  backButton: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
});
