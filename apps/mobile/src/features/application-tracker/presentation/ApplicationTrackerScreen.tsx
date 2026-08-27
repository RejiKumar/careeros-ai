import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import ScreenHeader from "@/ui/ScreenHeader";
import {
  ApiError,
  type ApplicationResponse,
  type ApplicationStatsResponse,
} from "@/services/contract";

type ApplicationStatus = "applied" | "interviewing" | "offered" | "rejected";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: ApplicationResponse[] };

type StatsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; data: ApplicationStatsResponse };

const STATUSES: ApplicationStatus[] = ["applied", "interviewing", "offered", "rejected"];

const STATUS_COLOR_KEY: Record<ApplicationStatus, "primary" | "warning" | "success" | "danger"> = {
  applied: "primary",
  interviewing: "warning",
  offered: "success",
  rejected: "danger",
};

const apiClient = new ApiClient();

export default function ApplicationTrackerScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [statsState, setStatsState] = useState<StatsState>({ status: "loading" });
  const [activeFilter, setActiveFilter] = useState<ApplicationStatus | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationResponse | null>(null);

  const [formJobTitle, setFormJobTitle] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formStatus, setFormStatus] = useState<ApplicationStatus>("applied");
  const [formNotes, setFormNotes] = useState("");
  const [formFollowUp, setFormFollowUp] = useState("");
  const [formInterviewDate, setFormInterviewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListState({ status: "loading" });
    setStatsState({ status: "loading" });
    try {
      const [items, stats] = await Promise.all([
        apiClient.listApplications(accessToken, undefined, guestId ?? undefined),
        apiClient.getApplicationStats(accessToken, guestId ?? undefined),
      ]);
      setListState({ status: "success", items });
      setStatsState({ status: "success", data: stats });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setListState({
          status: "error",
          message: err instanceof Error ? err.message : t("applications.error"),
        });
        setStatsState({ status: "error" });
      }
    }
  }, [accessToken, guestId, handleUnauthorized]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function openCreateModal() {
    setEditingApp(null);
    setFormJobTitle("");
    setFormCompany("");
    setFormStatus("applied");
    setFormNotes("");
    setFormFollowUp("");
    setFormInterviewDate("");
    setFormError(null);
    setModalVisible(true);
  }

  function openEditModal(app: ApplicationResponse) {
    setEditingApp(app);
    setFormJobTitle(app.job_title);
    setFormCompany(app.company ?? "");
    setFormStatus(app.status as ApplicationStatus);
    setFormNotes(app.notes ?? "");
    setFormFollowUp(app.follow_up_date ?? "");
    setFormInterviewDate(app.interview_date ?? "");
    setFormError(null);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingApp(null);
    setFormError(null);
  }

  async function handleSave() {
    if (formJobTitle.trim() === "") {
      setFormError(t("applications.jobTitle"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingApp !== null) {
        await apiClient.updateApplication(
          accessToken,
          editingApp.id,
          {
            job_title: formJobTitle.trim(),
            company: formCompany.trim() !== "" ? formCompany.trim() : null,
            status: formStatus,
            notes: formNotes.trim() !== "" ? formNotes.trim() : null,
            follow_up_date: formFollowUp.trim() !== "" ? formFollowUp.trim() : null,
            interview_date: formInterviewDate.trim() !== "" ? formInterviewDate.trim() : null,
          },
          guestId ?? undefined,
        );
      } else {
        await apiClient.createApplication(
          accessToken,
          {
            job_title: formJobTitle.trim(),
            company: formCompany.trim() !== "" ? formCompany.trim() : null,
            status: formStatus,
            notes: formNotes.trim() !== "" ? formNotes.trim() : null,
            follow_up_date: formFollowUp.trim() !== "" ? formFollowUp.trim() : null,
            interview_date: formInterviewDate.trim() !== "" ? formInterviewDate.trim() : null,
          },
          guestId ?? undefined,
        );
      }
      closeModal();
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setFormError(err instanceof Error ? err.message : t("applications.error"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(applicationId: string) {
    try {
      await apiClient.deleteApplication(accessToken, applicationId, guestId ?? undefined);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  async function handleChangeStatus(applicationId: string, newStatus: ApplicationStatus) {
    try {
      await apiClient.updateApplication(
        accessToken,
        applicationId,
        { status: newStatus },
        guestId ?? undefined,
      );
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  const filteredItems =
    listState.status === "success"
      ? activeFilter !== null
        ? listState.items.filter((item) => item.status === activeFilter)
        : listState.items
      : [];

  const itemsByStatus: Record<ApplicationStatus, ApplicationResponse[]> = {
    applied: [],
    interviewing: [],
    offered: [],
    rejected: [],
  };
  if (listState.status === "success") {
    for (const item of listState.items) {
      const statusKey = item.status as ApplicationStatus;
      if (itemsByStatus[statusKey] !== undefined) {
        itemsByStatus[statusKey].push(item);
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          eyebrow={t("applications.eyebrow")}
          title={t("applications.title")}
          subtitle={t("applications.subtitle")}
        />

        {statsState.status === "success" && (
          <View style={styles.statsRow}>
            <View
              style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.primaryStrong }]}>
                {statsState.data.total}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t("applications.totalApplications")}
              </Text>
            </View>
            <View
              style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.primaryStrong }]}>
                {statsState.data.total > 0
                  ? `${Math.round(
                      (statsState.data.by_status.interviewing / statsState.data.total) * 100,
                    )}%`
                  : "0%"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t("applications.interviewRate")}
              </Text>
            </View>
            <View
              style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.success }]}>
                {statsState.data.by_status.offered}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t("applications.offered")}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show all applications"
            accessibilityState={{ selected: activeFilter === null }}
            onPress={() => setActiveFilter(null)}
            style={[
              styles.filterChip,
              {
                backgroundColor: activeFilter === null ? colors.primary : colors.surface,
                borderColor: activeFilter === null ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: activeFilter === null ? colors.onPrimary : colors.textPrimary },
              ]}
            >
              {t("applications.totalApplications")}
            </Text>
          </Pressable>
          {STATUSES.map((status) => (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${status}`}
              accessibilityState={{ selected: activeFilter === status }}
              onPress={() => setActiveFilter(status)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === status ? colors[STATUS_COLOR_KEY[status]] : colors.surface,
                  borderColor: activeFilter === status ? colors[STATUS_COLOR_KEY[status]] : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: activeFilter === status ? colors.onPrimary : colors.textPrimary },
                ]}
              >
                {t(`applications.${status}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("applications.addApplication")}
          onPress={openCreateModal}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
            + {t("applications.addApplication")}
          </Text>
        </Pressable>

        {listState.status === "loading" && (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 32 }}
            accessibilityLabel="Loading applications"
          />
        )}

        {listState.status === "error" && (
          <View style={[styles.notice, { backgroundColor: colors.danger }]} accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{listState.message}</Text>
          </View>
        )}

        {listState.status === "success" && listState.items.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("applications.noApplications")}
          </Text>
        )}

        {activeFilter !== null && filteredItems.length > 0 && (
          <View style={styles.kanbanSection}>
            <Text style={[styles.kanbanTitle, { color: colors.textPrimary }]}>
              {t(`applications.${activeFilter}`)} ({filteredItems.length})
            </Text>
            {filteredItems.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                colors={colors}
                onEdit={() => openEditModal(app)}
                onDelete={() => void handleDelete(app.id)}
                onChangeStatus={(newStatus) => void handleChangeStatus(app.id, newStatus)}
              />
            ))}
          </View>
        )}

        {activeFilter === null && listState.status === "success" && listState.items.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kanbanScroll}
          >
            {STATUSES.map((status) => (
              <View key={status} style={styles.kanbanColumn}>
                <Text style={[styles.kanbanColumnTitle, { color: colors[STATUS_COLOR_KEY[status]] }]}>
                  {t(`applications.${status}`)} ({itemsByStatus[status].length})
                </Text>
                {itemsByStatus[status].length === 0 && (
                  <Text style={[styles.kanbanEmpty, { color: colors.textDisabled }]}>—</Text>
                )}
                {itemsByStatus[status].map((app) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    colors={colors}
                    onEdit={() => openEditModal(app)}
                    onDelete={() => void handleDelete(app.id)}
                    onChangeStatus={(newStatus) => void handleChangeStatus(app.id, newStatus)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {editingApp !== null ? t("applications.save") : t("applications.addApplication")}
              </Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("applications.jobTitle")}
              </Text>
              <TextInput
                value={formJobTitle}
                onChangeText={setFormJobTitle}
                accessibilityLabel={t("applications.jobTitle")}
                placeholder={t("applications.jobTitle")}
                placeholderTextColor={colors.textDisabled}
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("applications.company")}
              </Text>
              <TextInput
                value={formCompany}
                onChangeText={setFormCompany}
                accessibilityLabel={t("applications.company")}
                placeholder={t("applications.company")}
                placeholderTextColor={colors.textDisabled}
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("applications.status")}
              </Text>
              <View style={styles.statusRow}>
                {STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    accessibilityLabel={t(`applications.${status}`)}
                    accessibilityState={{ selected: formStatus === status }}
                    onPress={() => setFormStatus(status)}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: formStatus === status ? colors[STATUS_COLOR_KEY[status]] : colors.background,
                        borderColor: formStatus === status ? colors[STATUS_COLOR_KEY[status]] : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: formStatus === status ? colors.onPrimary : colors.textPrimary },
                      ]}
                    >
                      {t(`applications.${status}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("applications.followUp")}
              </Text>
              <TextInput
                value={formFollowUp}
                onChangeText={setFormFollowUp}
                accessibilityLabel={t("applications.followUp")}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("applications.interviewDate")}
              </Text>
              <TextInput
                value={formInterviewDate}
                onChangeText={setFormInterviewDate}
                accessibilityLabel={t("applications.interviewDate")}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
                style={[
                  styles.input,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("applications.notes")}
              </Text>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                accessibilityLabel={t("applications.notes")}
                placeholder={t("applications.notes")}
                placeholderTextColor={colors.textDisabled}
                multiline
                numberOfLines={3}
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
                ]}
              />

              {formError !== null && (
                <View
                  style={[styles.notice, { backgroundColor: colors.danger }]}
                  accessibilityRole="alert"
                >
                  <Text style={[styles.noticeText, { color: colors.onDanger }]}>{formError}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("applications.cancel")}
                  onPress={closeModal}
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                    {t("applications.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("applications.save")}
                  onPress={() => void handleSave()}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    pressed && styles.pressed,
                    saving && styles.disabled,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.onPrimary} accessibilityLabel="Saving" />
                  ) : (
                    <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
                      {t("applications.save")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ApplicationCard({
  app,
  colors,
  onEdit,
  onDelete,
  onChangeStatus,
}: {
  app: ApplicationResponse;
  colors: ReturnType<typeof import("@/lib/theme").useTheme>["theme"]["colors"];
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: (status: ApplicationStatus) => void;
}) {
  const statusKey = app.status as ApplicationStatus;
  const nextStatus: Record<ApplicationStatus, ApplicationStatus> = {
    applied: "interviewing",
    interviewing: "offered",
    offered: "rejected",
    rejected: "applied",
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${app.job_title}`}
        onPress={onEdit}
        style={styles.cardBody}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {app.job_title}
          </Text>
          <View style={[styles.badge, { backgroundColor: colors[STATUS_COLOR_KEY[statusKey]] }]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
              {t(`applications.${app.status}`)}
            </Text>
          </View>
        </View>
        {app.company !== null && (
          <Text style={[styles.cardCompany, { color: colors.textSecondary }]} numberOfLines={1}>
            {app.company}
          </Text>
        )}
        <View style={styles.cardDates}>
          <Text style={[styles.cardDate, { color: colors.textDisabled }]}>
            {t("applications.applied")}: {app.applied_date}
          </Text>
          {app.follow_up_date !== null && (
            <Text style={[styles.cardDate, { color: colors.textDisabled }]}>
              {t("applications.followUp")}: {app.follow_up_date}
            </Text>
          )}
        </View>
        {app.notes !== null && app.notes !== "" && (
          <Text style={[styles.cardNotes, { color: colors.textSecondary }]} numberOfLines={2}>
            {app.notes}
          </Text>
        )}
      </Pressable>

      <View style={styles.cardActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Move to ${nextStatus[statusKey]}`}
          onPress={() => onChangeStatus(nextStatus[statusKey])}
          style={[styles.cardAction, { backgroundColor: colors.primarySoft }]}
        >
          <Text style={[styles.cardActionText, { color: colors.primaryStrong }]}>
            → {t(`applications.${nextStatus[statusKey]}`)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("common.delete")} ${app.job_title}`}
          onPress={onDelete}
          style={[styles.cardAction, { backgroundColor: colors.danger }]}
        >
          <Text style={[styles.cardActionText, { color: colors.onDanger }]}>
            {t("common.delete")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  filterChip: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipText: {
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
  notice: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 32,
    textAlign: "center",
  },
  kanbanScroll: {
    paddingTop: 16,
    paddingRight: 24,
    gap: 12,
  },
  kanbanColumn: {
    width: 260,
    gap: 8,
  },
  kanbanColumnTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  kanbanEmpty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 12,
  },
  kanbanSection: {
    marginTop: 16,
  },
  kanbanTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardBody: {
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  badge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardCompany: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardDates: {
    gap: 2,
    marginTop: 4,
  },
  cardDate: {
    fontSize: 12,
  },
  cardNotes: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  cardAction: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 24,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
