import { StyleSheet, Text, View } from "react-native";

import { lightTheme } from "@careeros/design-tokens";

export default function HomeScreen() {
  const colors = lightTheme.colors;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Home"
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>CareerOS AI</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Your AI Career Companion
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityRole="summary">
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Resume Health</Text>
        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
          Import your resume to see a reviewable, explainable health score.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    marginTop: 24,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cardBody: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
});
