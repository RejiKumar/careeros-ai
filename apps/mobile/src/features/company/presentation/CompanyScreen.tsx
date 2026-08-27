import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { ApiClient } from "@/services/api";
import { t } from "../../../i18n";
import AppBackground from "@/ui/AppBackground";
import ScreenHeader from "@/ui/ScreenHeader";
import {
  ApiError,
  type CompanyJob,
  type CompanyProfileResponse,
  type SavedCompanyResponse,
} from "@/services/contract";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; results: CompanyProfileResponse[] };

type JobsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; jobs: CompanyJob[] };

const apiClient = new ApiClient();

export default function CompanyScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });
  const [savedCompanies, setSavedCompanies] = useState<SavedCompanyResponse[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [jobsState, setJobsState] = useState<JobsState>({ status: "idle" });
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadSaved = useCallback(async () => {
    try {
      const items = isGuest
        ? await apiClient.listSavedCompanies(undefined, guestId ?? undefined)
        : await apiClient.listSavedCompanies(accessToken);
      setSavedCompanies(items);
      setSavedIds(new Set(items.map((i) => i.company_id)));
    } catch {
      // Saved list is optional
    }
  }, [isGuest, guestId, accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved]),
  );

  async function handleSearch() {
    if (query.trim() === "") {
      return;
    }
    setSearchState({ status: "loading" });
    try {
      const results = await apiClient.searchCompanies(
        isGuest ? undefined : accessToken,
        query.trim(),
        location.trim() !== "" ? location.trim() : undefined,
        isGuest && guestId !== null ? guestId : undefined,
      );
      setSearchState({ status: "success", results });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setSearchState({
          status: "error",
          message: err instanceof Error ? err.message : t("company.error"),
        });
      }
    }
  }

  async function handleSelectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    setJobsState({ status: "loading" });
    try {
      const response = await apiClient.getCompanyJobs(
        isGuest ? undefined : accessToken,
        companyId,
        isGuest && guestId !== null ? guestId : undefined,
      );
      setJobsState({ status: "success", jobs: response.jobs });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setJobsState({
          status: "error",
          message: err instanceof Error ? err.message : t("company.error"),
        });
      }
    }
  }

  async function handleSaveCompany(company: CompanyProfileResponse) {
    if (savedIds.has(company.id)) {
      return;
    }
    try {
      const saved = await apiClient.saveCompany(
        isGuest ? undefined : accessToken,
        { company_id: company.id, company_name: company.name },
        isGuest && guestId !== null ? guestId : undefined,
      );
      setSavedIds((prev) => new Set([...prev, saved.company_id]));
      setSavedCompanies((prev) => [...prev, saved]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  async function handleDeleteSaved(savedId: string) {
    if (isGuest) {
      return;
    }
    if (accessToken === undefined) {
      return;
    }
    try {
      await apiClient.deleteSavedCompany(accessToken, savedId);
      setSavedCompanies((prev) => prev.filter((c) => c.id !== savedId));
      void loadSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow={t("company.eyebrow")}
          title={t("company.title")}
          subtitle={t("company.subtitle")}
        />

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInputWrap,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void handleSearch()}
              returnKeyType="search"
              accessibilityLabel={t("company.searchPlaceholder")}
              placeholder={t("company.searchPlaceholder")}
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
            <TextInput
              value={location}
              onChangeText={setLocation}
              onSubmitEditing={() => void handleSearch()}
              returnKeyType="search"
              accessibilityLabel={t("company.locationPlaceholder")}
              placeholder={t("company.locationPlaceholder")}
              placeholderTextColor={colors.textDisabled}
              style={[styles.searchInput, { color: colors.textPrimary }]}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("company.eyebrow")}
          onPress={() => void handleSearch()}
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
              {t("company.eyebrow")}
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

        {searchState.status === "success" && searchState.results.length === 0 && (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.textDisabled, marginTop: 12 }]}>
              {t("company.noResults")}
            </Text>
          </View>
        )}

        {searchState.status === "success" &&
          searchState.results.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              colors={colors}
              isSaved={savedIds.has(company.id)}
              isSelected={selectedCompanyId === company.id}
              onSave={() => void handleSaveCompany(company)}
              onSelect={() => void handleSelectCompany(company.id)}
              jobsState={selectedCompanyId === company.id ? jobsState : { status: "idle" }}
            />
          ))}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 32 }]}>
          {t("company.saved")}
        </Text>
        {savedCompanies.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("company.noResults")}
          </Text>
        )}
        {savedCompanies.map((saved) => (
          <View
            key={saved.id}
            style={[
              styles.savedCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.savedBody}>
              <Text style={[styles.savedTitle, { color: colors.textPrimary }]}>
                {saved.company_name}
              </Text>
            </View>
            <View style={styles.savedActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("common.delete")} ${saved.company_name}`}
                onPress={() => void handleDeleteSaved(saved.id)}
                style={[styles.smallButton, { backgroundColor: colors.danger }]}
              >
                <Text style={[styles.smallButtonText, { color: colors.onDanger }]}>
                  {t("common.delete")}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </AppBackground>
  );
}

function CompanyCard({
  company,
  colors,
  isSaved,
  isSelected,
  onSave,
  onSelect,
  jobsState,
}: {
  company: CompanyProfileResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
  isSaved: boolean;
  isSelected: boolean;
  onSave: () => void;
  onSelect: () => void;
  jobsState:
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "success"; jobs: CompanyJob[] };
}) {
  return (
    <View
      style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.resultHeader}>
        <Text style={[styles.resultTitle, { color: colors.textPrimary }]}>{company.name}</Text>
        {company.location !== null && (
          <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>
            {company.location}
          </Text>
        )}
      </View>

      {company.industry !== null && (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("company.industry")}</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{company.industry}</Text>
        </View>
      )}

      {company.team_size !== null && (
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("company.teamSize")}</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{company.team_size}</Text>
        </View>
      )}

      {company.tech_stack.length > 0 && (
        <View style={styles.infoSection}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("company.techStack")}</Text>
          <View style={styles.badgeRow}>
            {company.tech_stack.map((tech) => (
              <View key={tech} style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.badgeText, { color: colors.primaryStrong }]}>{tech}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {company.culture_signals.length > 0 && (
        <View style={styles.infoSection}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("company.cultureSignals")}</Text>
          {company.culture_signals.map((signal) => (
            <Text key={signal} style={[styles.bullet, { color: colors.textPrimary }]}>
              • {signal}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t("company.recentJobs")}</Text>
        <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{company.recent_job_count}</Text>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSelected ? "Loading jobs" : t("company.recentJobs")}
          onPress={onSelect}
          disabled={jobsState.status === "loading"}
          style={({ pressed }) => [
            styles.secondaryButton,
            { backgroundColor: colors.surfaceRaised },
            pressed && styles.pressed,
            jobsState.status === "loading" && styles.disabled,
          ]}
        >
          {jobsState.status === "loading" ? (
            <ActivityIndicator color={colors.primaryStrong} accessibilityLabel="Loading jobs" />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.primaryStrong }]}>
              {t("company.recentJobs")}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? t("company.saved") : t("company.saveCompany")}
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
          <Text
            style={[
              styles.saveButtonText,
              { color: isSaved ? colors.textDisabled : colors.onPrimary },
            ]}
          >
            {isSaved ? t("company.saved") : t("company.saveCompany")}
          </Text>
        </Pressable>
      </View>

      {isSelected && jobsState.status === "success" && (
        <View style={styles.jobsSection}>
          {jobsState.jobs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
              {t("company.noResults")}
            </Text>
          ) : (
            jobsState.jobs.map((job) => (
              <View
                key={job.id}
                style={[styles.jobCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
              >
                <Text style={[styles.jobTitle, { color: colors.textPrimary }]}>{job.title}</Text>
                {job.location !== null && (
                  <Text style={[styles.jobMeta, { color: colors.textSecondary }]}>{job.location}</Text>
                )}
                {job.posted_date !== null && (
                  <Text style={[styles.jobMeta, { color: colors.textDisabled }]}>{job.posted_date}</Text>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {isSelected && jobsState.status === "error" && (
        <View
          style={[styles.notice, { backgroundColor: colors.danger }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.noticeText, { color: colors.onDanger }]}>
            {jobsState.message}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
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
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
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
    flex: 1,
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
  resultTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  resultMeta: {
    fontSize: 14,
    fontWeight: "500",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoSection: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  jobsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 12,
    gap: 8,
  },
  jobCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  jobTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  jobMeta: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  savedCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  savedBody: {
    gap: 4,
  },
  savedTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  savedActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
