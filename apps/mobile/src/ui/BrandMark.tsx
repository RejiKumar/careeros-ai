import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/lib/theme";

interface BrandMarkProps {
  size?: number;
}

export default function BrandMark({ size = 56 }: BrandMarkProps) {
  const { theme } = useTheme();
  const iconSize = size * 0.5;
  return (
    <View style={[styles.wrap, { shadowColor: theme.colors.primary, elevation: 6 }]}>
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}
      >
        <Ionicons name="sparkles" size={iconSize} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "center",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
  },
});
