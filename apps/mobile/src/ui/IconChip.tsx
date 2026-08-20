import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/lib/theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface IconChipProps {
  name: IconName;
  size?: number;
  color?: string;
  gradient?: readonly [string, string];
}

export default function IconChip({
  name,
  size = 44,
  color,
  gradient,
}: IconChipProps) {
  const { theme } = useTheme();
  const iconColor = color ?? (gradient !== undefined ? "#FFFFFF" : theme.colors.primary);
  const inner = (
    <Ionicons name={name} size={size * 0.5} color={iconColor} />
  );

  if (gradient !== undefined) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.chip, { width: size, height: size, borderRadius: size * 0.32 }]}
      >
        {inner}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: theme.colors.primarySoft,
        },
      ]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    justifyContent: "center",
  },
});
