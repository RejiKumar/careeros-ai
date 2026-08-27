import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";
import { ApiError, type JobSearchResult } from "@/services/contract";

const SOURCES = [
  { key: "", labelKey: "jobSearch.allSources" },
  { key: "technopark", labelKey: "jobSearch.technopark" },
  { key: "naukri", labelKey: "jobSearch.naukri" },
  { key: "linkedin", labelKey: "jobSearch.linkedin" },
  { key: "indeed", labelKey: "jobSearch.indeed" },
  { key: "monster", labelKey: "jobSearch.monster" },
] as const;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; results: JobSearchResult[]; page: number; hasMore: boolean };

const apiClient = new ApiClient();

export default function JobSearchScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [activeSource, setActiveSource] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadSaved = useCallback(async () => {
    if (isGuest && guestId !== null) {
      try {
        const items = await apiClient.listSavedJobs(undefined, guestId);
        setSavedIds(new Set(items.map((i) => i.job_id)));
      } catch {
        // Saved list is optional for guests
      }
      return;
    }
    if (accessToken === undefined) {
      void handleUnauthorized();
      return;
    }
    try {
      const items = await apiClient.listSavedJobs(accessToken);
      setSavedIds(new Set(items.map((i) => i.job_id)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved]),
  );

  async function handleSearch(page = 1) {
    if (query.trim() === "") {
      return;
    }
    setSearchState({ status: "loading" });
    try {
      const response = await apiClient.searchJobs(
        isGuest ? undefined : accessToken,
        query.trim(),
        location.trim() !== "" ? location.trim() : undefined,
        activeSource !== "" ? activeSource : undefined,
        page,
        20,
        isGuest && guestId !== null ? guestId : undefined,
      );
      setSearchState({
        status: "success",
        results:
          page === 1
            ? response.results
            : [
                ...(searchState.status === "success" ? searchState.results : []),
                ...response.results,
              ],
        page,
        hasMore: response.has_more,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setSearchState({
          status: "error",
          message: err instanceof Error ? err.message : t("jobSearch.error"),
        });
      }
    }
  }

  async function handleSaveJob(job: JobSearchResult) {
    if (savedIds.has(job.id)) {
      return;
    }
    try {
      const saved = await apiClient.saveJob(
        isGuest ? undefined : accessToken,
        {
          job_id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          source: job.source,
          url: job.url,
        },
        isGuest && guestId !== null ? guestId : undefined,
      );
      setSavedIds((prev) => new Set([...prev, saved.job_id]));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  async function handleRefresh() {
    await Promise.all([handleSearch(1), loadSaved()]);
  }

  function formatDate(dateStr: string | null): string | null {
    if (dateStr === null) {
      return null;
    }
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        return "today";
      }
      if (diffDays === 1) {
        return "yesterday";
      }
      if (diffDays < 7) {
        return `${diffDays}d ago`;
      }
      if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)}w ago`;
      }
      return `${Math.floor(diffDays / 30)}mo ago`;
    } catch {
      return dateStr;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={searchState.status === "success" ? searchState.results : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>
              {t("jobSearch.eyebrow")}
            </Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t("jobSearch.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("jobSearch.subtitle")}
            </Text>

            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchInputWrap,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="search"
                  size={18}
                  color={colors.textDisabled}
                  style={styles.searchIcon}
                />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => void handleSearch(1)}
                  returnKeyType="search"
                  accessibilityLabel={t("jobSearch.searchPlaceholder")}
                  placeholder={t("jobSearch.searchPlaceholder")}
                  placeholderTextColor={colors.textDisabled}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                />
              </View>
            </View>

            <View style={styles.locationRow}>
              <View
                style={[
                  styles.locationInputWrap,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.textDisabled}
                  style={styles.searchIcon}
                />
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  onSubmitEditing={() => void handleSearch(1)}
                  returnKeyType="search"
                  accessibilityLabel={t("jobSearch.locationPlaceholder")}
                  placeholder={t("jobSearch.locationPlaceholder")}
                  placeholderTextColor={colors.textDisabled}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                />
              </View>
            </View>

            <FlatList
              data={SOURCES}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(item.labelKey as Parameters<typeof t>[0])}
                  accessibilityState={{ selected: activeSource === item.key }}
                  onPress={() => setActiveSource(item.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: activeSource === item.key ? colors.primary : colors.surface,
                      borderColor: activeSource === item.key ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: activeSource === item.key ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {t(item.labelKey as Parameters<typeof t>[0])}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search jobs"
              onPress={() => void handleSearch(1)}
              disabled={searchState.status === "loading"}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                searchState.status === "loading" && styles.disabled,
              ]}
            >
              {searchState.status === "loading" ? (
                <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Searching" />
              ) : (
                <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
                  {t("jobSearch.eyebrow")}
                </Text>
              )}
            </Pressable>

            {searchState.status === "error" && (
              <View
                style={[styles.notice, { backgroundColor: colors.danger }]}
                accessibilityRole="alert"
              >
                <Text style={[styles.noticeText, { color: colors.onDanger }]}>
                  {searchState.message}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          searchState.status === "idle" ? null : searchState.status === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
                accessibilityLabel="Loading search results"
              />
            </View>
          ) : searchState.status === "error" ? null : (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={48} color={colors.textDisabled} />
              <Text style={[styles.emptyText, { color: colors.textDisabled, marginTop: 12 }]}>
                {t("jobSearch.noResults")}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <JobResultCard
            job={item}
            colors={colors}
            isSaved={savedIds.has(item.id)}
            onSave={() => void handleSaveJob(item)}
            formatDate={formatDate}
          />
        )}
        ListFooterComponent={
          searchState.status === "success" && searchState.hasMore ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Load more results"
              onPress={() => void handleSearch(searchState.page + 1)}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: colors.surfaceRaised },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primaryStrong }]}>
                Load more
              </Text>
            </Pressable>
          ) : null
        }
        onRefresh={handleRefresh}
        refreshing={searchState.status === "loading"}
      />
    </View>
  );
}

function JobResultCard({
  job,
  colors,
  isSaved,
  onSave,
  formatDate,
}: {
  job: JobSearchResult;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
  isSaved: boolean;
  onSave: () => void;
  formatDate: (date: string | null) => string | null;
}) {
  const posted = formatDate(job.posted_date);

  return (
    <View
      style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.resultHeader}>
        <View style={styles.resultTitleRow}>
          <Text style={[styles.resultTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {job.title}
          </Text>
          {job.match_score !== null && (
            <View style={[styles.matchBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.matchBadgeText, { color: colors.primaryStrong }]}>
                {job.match_score}%
              </Text>
            </View>
          )}
        </View>
        {job.company !== null && (
          <Text style={[styles.resultCompany, { color: colors.textSecondary }]} numberOfLines={1}>
            {job.company}
          </Text>
        )}
        <View style={styles.resultMetaRow}>
          {job.location !== null && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color={colors.textDisabled} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {job.location}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="globe-outline" size={13} color={colors.textDisabled} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {job.source}
            </Text>
          </View>
          {posted !== null && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.textDisabled} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{posted}</Text>
            </View>
          )}
        </View>
      </View>

      {job.salary_range !== null && (
        <Text style={[styles.salaryText, { color: colors.textSecondary }]}>
          {t("jobSearch.salary", { range: job.salary_range })}
        </Text>
      )}

      {job.skills.length > 0 && (
        <View style={styles.skillRow}>
          {job.skills.slice(0, 6).map((skill) => (
            <View key={skill} style={[styles.skillTag, { backgroundColor: colors.primarySoft }]}>
              <Text
                style={[styles.skillTagText, { color: colors.primaryStrong }]}
                numberOfLines={1}
              >
                {skill}
              </Text>
            </View>
          ))}
          {job.skills.length > 6 && (
            <Text style={[styles.skillMore, { color: colors.textDisabled }]}>
              +{job.skills.length - 6}
            </Text>
          )}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSaved ? t("jobSearch.saved") : t("jobSearch.saveJob")}
        onPress={onSave}
        disabled={isSaved}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: isSaved ? colors.surfaceRaised : colors.primary,
          },
          pressed && !isSaved && styles.pressed,
          isSaved && styles.disabled,
        ]}
      >
        <Ionicons
          name={isSaved ? "checkmark-circle" : "bookmark-outline"}
          size={16}
          color={isSaved ? colors.textDisabled : colors.onPrimary}
        />
        <Text
          style={[
            styles.saveButtonText,
            { color: isSaved ? colors.textDisabled : colors.onPrimary },
          ]}
        >
          {isSaved ? t("jobSearch.saved") : t("jobSearch.saveJob")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
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
    marginBottom: 16,
  },
  searchRow: {
    marginBottom: 10,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  locationRow: {
    marginBottom: 12,
  },
  locationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  notice: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  resultCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  resultHeader: {
    gap: 4,
  },
  resultTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  matchBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  resultCompany: {
    fontSize: 14,
    fontWeight: "500",
  },
  resultMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  salaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillTag: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  skillMore: {
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "center",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
