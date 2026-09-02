import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";

import { t } from "../../src/i18n";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: "home", inactive: "home-outline" },
  resume: { active: "document-text", inactive: "document-text-outline" },
  search: { active: "search", inactive: "search-outline" },
  coach: { active: "chatbubble-ellipses", inactive: "chatbubble-ellipses-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const { theme } = useTheme();
  const icon = TAB_ICONS[name] ?? { active: "ellipse", inactive: "ellipse-outline" };
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: theme.colors.primarySoft }]}>
      <Ionicons
        name={focused ? icon.active : icon.inactive}
        size={22}
        color={focused ? theme.colors.primaryStrong : theme.colors.textDisabled}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primaryStrong,
        tabBarInactiveTintColor: theme.colors.textDisabled,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          elevation: 10,
          shadowColor: "#14181D",
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ focused }) => <TabBarIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="resume"
        options={{
          title: t("tabs.resume"),
          tabBarIcon: ({ focused }) => <TabBarIcon name="resume" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          tabBarIcon: ({ focused }) => <TabBarIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: t("tabs.coach"),
          tabBarIcon: ({ focused }) => <TabBarIcon name="coach" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ focused }) => <TabBarIcon name="profile" focused={focused} />,
        }}
      />
      <Tabs.Screen name="job-match" options={{ href: null }} />
      <Tabs.Screen name="tailor" options={{ href: null }} />
      <Tabs.Screen name="missions" options={{ href: null }} />
      <Tabs.Screen name="applications" options={{ href: null }} />
      <Tabs.Screen name="rewrites" options={{ href: null }} />
      <Tabs.Screen name="roast" options={{ href: null }} />
      <Tabs.Screen name="wrapped" options={{ href: null }} />
      <Tabs.Screen name="interview" options={{ href: null }} />
      <Tabs.Screen name="skills-gap" options={{ href: null }} />
      <Tabs.Screen name="market-pulse" options={{ href: null }} />
      <Tabs.Screen name="company" options={{ href: null }} />
      <Tabs.Screen name="salary" options={{ href: null }} />
      <Tabs.Screen name="career-path" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
