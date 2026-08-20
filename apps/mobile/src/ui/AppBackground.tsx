import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "@/lib/theme";

interface AppBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function AppBackground({ children, style }: AppBackgroundProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden>
        <View style={[styles.orb, styles.orbViolet, { backgroundColor: colors.aurora.violet }]} />
        <View style={[styles.orb, styles.orbCyan, { backgroundColor: colors.aurora.cyan }]} />
        <View style={[styles.orb, styles.orbMagenta, { backgroundColor: colors.aurora.magenta }]} />
        <LinearGradient
          colors={[theme.gradients.subtle[0], theme.gradients.subtle[1]]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb: {
    position: "absolute",
    borderRadius: 9999,
  },
  orbViolet: {
    width: 340,
    height: 340,
    top: -130,
    right: -100,
  },
  orbCyan: {
    width: 280,
    height: 280,
    top: 80,
    left: -140,
  },
  orbMagenta: {
    width: 240,
    height: 240,
    bottom: -80,
    right: -70,
  },
});
