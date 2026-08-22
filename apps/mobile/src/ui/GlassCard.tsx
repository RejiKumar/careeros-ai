import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/lib/theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

export default function GlassCard({ children, style, elevated = false }: GlassCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: theme.shadows.card.shadowColor,
          shadowOpacity: elevated
            ? theme.shadows.elevated.shadowOpacity
            : theme.shadows.card.shadowOpacity,
          shadowRadius: elevated
            ? theme.shadows.elevated.shadowRadius
            : theme.shadows.card.shadowRadius,
          shadowOffset: elevated
            ? theme.shadows.elevated.shadowOffset
            : theme.shadows.card.shadowOffset,
          elevation: elevated ? theme.shadows.elevated.elevation : theme.shadows.card.elevation,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
});
