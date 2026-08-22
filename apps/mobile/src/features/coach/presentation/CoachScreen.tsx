import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t, useStrings } from "../../../i18n";
import { ApiClient } from "@/services/api";
import SpeechToTextButton from "@/ui/SpeechToTextButton";
import {
  ApiError,
  type CoachMessageResponse,
  type CoachThreadResponse,
  type ResumeResponse,
} from "@/services/contract";

type ViewMode = "list" | "chat";

type ThreadsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; items: CoachThreadResponse[] };

type ChatState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; messages: CoachMessageResponse[] };

const apiClient = new ApiClient();

export default function CoachScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const { session, guestId, status: authStatus, handleUnauthorized } = useAuth();
  const strings = useStrings();

  const isGuest = authStatus === "guest";
  const accessToken = session?.access_token;

  const [mode, setMode] = useState<ViewMode>("list");
  const [threadsState, setThreadsState] = useState<ThreadsState>({ status: "loading" });
  const [activeThread, setActiveThread] = useState<CoachThreadResponse | null>(null);
  const [chatState, setChatState] = useState<ChatState>({ status: "idle" });
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const localIdCounter = useRef(0);

  const loadThreads = useCallback(async () => {
    if (isGuest && guestId !== null) {
      setThreadsState({ status: "loading" });
      try {
        const items = await apiClient.listCoachThreads(undefined, guestId);
        setThreadsState({ status: "success", items });
      } catch (err) {
        setThreadsState({
          status: "error",
          message: err instanceof Error ? err.message : t("coach.errorLoading"),
        });
      }
      return;
    }
    if (accessToken === undefined) {
      void handleUnauthorized();
      return;
    }
    setThreadsState({ status: "loading" });
    try {
      const items = await apiClient.listCoachThreads(accessToken);
      setThreadsState({ status: "success", items });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setThreadsState({
          status: "error",
          message: err instanceof Error ? err.message : t("coach.errorLoading"),
        });
      }
    }
  }, [isGuest, guestId, accessToken, handleUnauthorized]);

  const loadResumes = useCallback(async () => {
    if (isGuest && guestId !== null) {
      try {
        const items = await apiClient.listResumes(undefined, guestId);
        setResumes(items);
        if (resumeId === null && items.length > 0) {
          setResumeId(items[0]?.id ?? null);
        }
      } catch {
        // Resume context is optional
      }
      return;
    }
    if (accessToken === undefined) {
      return;
    }
    try {
      const items = await apiClient.listResumes(accessToken);
      setResumes(items);
      if (resumeId === null && items.length > 0) {
        setResumeId(items[0]?.id ?? null);
      }
    } catch {
      // Resume context is optional
    }
  }, [isGuest, guestId, accessToken, resumeId]);

  useFocusEffect(
    useCallback(() => {
      void loadThreads();
      void loadResumes();
    }, [loadThreads, loadResumes]),
  );

  async function handleCreateThread() {
    if (creating) {
      return;
    }
    setCreating(true);
    try {
      const payload: { title?: string; resume_id?: string } = { title: t("coach.newConversation") };
      if (resumeId !== null) {
        payload.resume_id = resumeId;
      }
      const thread = isGuest
        ? await apiClient.createCoachThread(undefined, payload, guestId ?? undefined)
        : await apiClient.createCoachThread(accessToken, payload);
      setActiveThread(thread);
      setChatState({ status: "idle" });
      setMode("chat");
      void loadThreads();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenThread(thread: CoachThreadResponse) {
    setActiveThread(thread);
    setMode("chat");
    setChatState({ status: "loading" });
    try {
      const detail = isGuest
        ? await apiClient.getCoachThread(undefined, thread.id, guestId ?? undefined)
        : await apiClient.getCoachThread(accessToken, thread.id);
      setChatState({ status: "success", messages: detail.messages });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setChatState({
          status: "error",
          message: err instanceof Error ? err.message : t("coach.errorLoadingChat"),
        });
      }
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      if (!isGuest && accessToken !== undefined) {
        await apiClient.deleteCoachThread(accessToken, threadId);
      }
      void loadThreads();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      }
    }
  }

  const [isSending, setIsSending] = useState(false);

  async function handleSend(contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    if (content === "" || activeThread === null) {
      return;
    }
    if (chatState.status === "loading" || isSending) {
      return;
    }
    const optimistic: CoachMessageResponse[] =
      chatState.status === "success" ? chatState.messages : [];
    localIdCounter.current += 1;
    const userMessage: CoachMessageResponse = {
      id: `local-${localIdCounter.current}`,
      thread_id: activeThread.id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setChatState({ status: "success", messages: [...optimistic, userMessage] });
    setDraft("");
    setIsSending(true);
    try {
      const pair = isGuest
        ? await apiClient.sendCoachMessage(undefined, activeThread.id, content, guestId ?? undefined)
        : await apiClient.sendCoachMessage(accessToken, activeThread.id, content);
      setChatState({
        status: "success",
        messages: [...optimistic, pair.user_message, pair.assistant_message],
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setChatState({
          status: "error",
          message: err instanceof Error ? err.message : t("coach.errorReply"),
        });
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleRegenerate() {
    if (chatState.status !== "success" || chatState.messages.length < 2 || isSending) {
      return;
    }
    const lastUserMsg = [...chatState.messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg === undefined) {
      return;
    }
    const messagesWithoutLastReply = chatState.messages.slice(0, chatState.messages.length - 1);
    setChatState({ status: "success", messages: messagesWithoutLastReply });
    setIsSending(true);
    try {
      const pair = isGuest
        ? await apiClient.sendCoachMessage(undefined, activeThread!.id, lastUserMsg.content, guestId ?? undefined)
        : await apiClient.sendCoachMessage(accessToken, activeThread!.id, lastUserMsg.content);
      setChatState({
        status: "success",
        messages: [...messagesWithoutLastReply, pair.user_message, pair.assistant_message],
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void handleUnauthorized();
      } else {
        setChatState({
          status: "error",
          message: err instanceof Error ? err.message : t("coach.errorRegenerate"),
        });
      }
    } finally {
      setIsSending(false);
    }
  }

  if (mode === "chat" && activeThread !== null) {
    const lastAssistantMsg =
      chatState.status === "success"
        ? [...chatState.messages].reverse().find((m) => m.role === "assistant")
        : null;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.chatHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("coach.chatBack")}
            onPress={() => setMode("list")}
            style={[styles.backButton, { backgroundColor: colors.surfaceRaised }]}
          >
            <Text style={[styles.backArrow, { color: colors.textPrimary }]}>‹</Text>
            <Text style={[styles.backLabel, { color: colors.textPrimary }]}>{t("coach.chatBack")}</Text>
          </Pressable>
          <Text numberOfLines={1} style={[styles.chatTitle, { color: colors.textPrimary }]}>
            {activeThread.title ?? t("coach.chatHeader")}
          </Text>
        </View>

        <View style={[styles.guideDisclosureBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.guideDisclosureText, { color: colors.textDisabled }]}>
            {t("coach.disclosure")}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {chatState.status === "loading" && (
            <ActivityIndicator color={colors.primary} accessibilityLabel={t("coach.conversations")} />
          )}
          {chatState.status === "error" && (
            <View style={[styles.notice, { backgroundColor: colors.danger }]} accessibilityRole="alert">
              <Text style={[styles.noticeText, { color: colors.onDanger }]}>{chatState.message}</Text>
            </View>
          )}
          {(chatState.status === "idle" ||
            (chatState.status === "success" && chatState.messages.length === 0)) && (
            <>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t("coach.emptyChat")}
              </Text>
              {strings.coach.suggestedPrompts.map((prompt, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggested prompt: ${prompt}`}
                  onPress={() => void handleSend(prompt)}
                  style={[styles.suggestedPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.suggestedPromptText, { color: colors.primaryStrong }]}>{prompt}</Text>
                </Pressable>
              ))}
            </>
          )}
          {chatState.status === "success" &&
            chatState.messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === "user"
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: message.role === "user" ? colors.onPrimary : colors.textPrimary },
                  ]}
                >
                  {message.content}
                </Text>
                {message.role === "assistant" && message.id !== "local-1" && (
                  <View style={styles.messageActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("common.copy")}
                      onPress={() => {
                        // Clipboard is a no-op without expo-clipboard; just show feedback
                      }}
                      style={[styles.actionLink]}
                    >
                      <Text style={[styles.actionLinkText, { color: colors.primaryStrong }]}>{t("common.copy")}</Text>
                    </Pressable>
                    {message.id === lastAssistantMsg?.id && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("common.regenerate")}
                        onPress={() => void handleRegenerate()}
                        style={[styles.actionLink]}
                      >
                        <Text style={[styles.actionLinkText, { color: colors.primaryStrong }]}>{t("common.regenerate")}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            ))}
          {isSending && (
            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            accessibilityLabel={t("coach.composerPlaceholder")}
            placeholder={t("coach.composerPlaceholder")}
            placeholderTextColor={colors.textDisabled}
            multiline
            style={[styles.composerInput, { color: colors.textPrimary }]}
          />
          <SpeechToTextButton
            onResult={(text) => setDraft((prev) => (prev === "" ? text : `${prev} ${text}`))}
            color={colors.textDisabled}
            activeColor={colors.primaryStrong}
            label={t("coach.voiceInput")}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.send")}
            onPress={() => void handleSend()}
            disabled={draft.trim() === "" || isSending}
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
              (draft.trim() === "" || isSending) && styles.disabled,
            ]}
          >
            <Text style={[styles.sendButtonText, { color: colors.onPrimary }]}>{t("common.send")}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.eyebrow, { color: colors.primaryStrong }]}>{t("coach.listEyebrow")}</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t("coach.listTitle")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t("coach.listSubtitle")}
        </Text>

        {resumes.length > 0 && (
          <View style={styles.chipRow}>
            {resumes.map((resume) => (
              <Pressable
                key={resume.id}
                accessibilityRole="button"
                accessibilityLabel={`Use resume context ${resume.title}`}
                accessibilityState={{ selected: resumeId === resume.id }}
                onPress={() => setResumeId(resume.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: resumeId === resume.id ? colors.primary : colors.surface,
                    borderColor: resumeId === resume.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: resumeId === resume.id ? colors.onPrimary : colors.textPrimary },
                  ]}
                >
                  {resume.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("coach.newConversation")}
          onPress={() => void handleCreateThread()}
          disabled={creating}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            creating && styles.disabled,
          ]}
        >
          {creating ? (
            <ActivityIndicator color={colors.onPrimary} accessibilityLabel={t("coach.newConversation")} />
          ) : (
            <Text style={[styles.primaryButtonLabel, { color: colors.onPrimary }]}>
              {t("coach.newConversation")}
            </Text>
          )}
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t("coach.conversations")}</Text>
        {threadsState.status === "loading" && (
          <ActivityIndicator color={colors.primary} accessibilityLabel={t("common.loading")} />
        )}
        {threadsState.status === "error" && (
          <View style={[styles.notice, { backgroundColor: colors.danger }]} accessibilityRole="alert">
            <Text style={[styles.noticeText, { color: colors.onDanger }]}>{threadsState.message}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("common.tryAgain")}
              onPress={() => void loadThreads()}
              style={[styles.retryButton, { backgroundColor: colors.surfaceRaised }]}
            >
              <Text style={[styles.retryText, { color: colors.textPrimary }]}>{t("common.tryAgain")}</Text>
            </Pressable>
          </View>
        )}
        {threadsState.status === "success" && threadsState.items.length === 0 && (
          <Text style={[styles.emptyText, { color: colors.textDisabled }]}>
            {t("coach.emptyThreads")}
          </Text>
        )}
        {threadsState.status === "success" &&
          threadsState.items.map((thread) => (
            <View
              key={thread.id}
              style={[styles.threadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open conversation ${thread.title ?? "untitled"}`}
                onPress={() => void handleOpenThread(thread)}
                style={styles.threadBody}
              >
                <Text style={[styles.threadTitle, { color: colors.textPrimary }]}>
                  {thread.title ?? t("coach.untitled")}
                </Text>
                <Text style={[styles.threadMeta, { color: colors.textDisabled }]}>
                  {t("coach.updatedPrefix", { date: new Date(thread.updated_at).toLocaleString() })}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete conversation ${thread.title ?? "untitled"}`}
                onPress={() => void handleDeleteThread(thread.id)}
                style={[styles.deleteButton, { backgroundColor: colors.danger }]}
              >
                <Text style={[styles.deleteText, { color: colors.onDanger }]}>{t("coach.delete")}</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 8,
  },
  notice: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  threadCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  threadBody: {
    flex: 1,
    gap: 4,
  },
  threadTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  threadMeta: {
    fontSize: 12,
  },
  deleteButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteText: {
    fontSize: 13,
    fontWeight: "700",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backArrow: {
    fontSize: 20,
    lineHeight: 22,
    marginRight: 4,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  chatTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  guideDisclosureBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  guideDisclosureText: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
  },
  messagesContent: {
    padding: 20,
    gap: 10,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  actionLink: {},
  actionLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  suggestedPrompt: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  suggestedPromptText: {
    fontSize: 13,
    fontWeight: "600",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    paddingVertical: 8,
  },
  sendButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
