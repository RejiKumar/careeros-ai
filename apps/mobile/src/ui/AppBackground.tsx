import { StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "@/lib/theme";

interface AppBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** One solid canvas colour (the theme background) behind every screen. */
export default function AppBackground({ children, style }: AppBackgroundProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
