import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { ApiClient } from "@/services/api";
import type { AuthStatus } from "@/lib/auth";

/** Must match ANDROID_CHANNEL_ID in the API's FCM sender. */
export const ANDROID_CHANNEL_ID = "default";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const apiClient = new ApiClient();

/**
 * Android 8+ needs the channel to exist, and Android 13+ only shows the
 * permission prompt once a channel exists, so create it before asking.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "CareerOS reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") {
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return typeof tokenData.data === "string" ? tokenData.data : null;
  } catch {
    return null;
  }
}

/** Where a tapped notification should open, based on the `type` the API sends. */
export function routeForNotification(data: unknown): "/missions" | "/applications" | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const type = (data as { type?: unknown }).type;
  if (type === "mission") {
    return "/missions";
  }
  if (type === "followup") {
    return "/applications";
  }
  return null;
}

function openNotification(response: Notifications.NotificationResponse): void {
  const route = routeForNotification(response.notification.request.content.data);
  if (route !== null) {
    router.push(route);
  }
}

async function registerToken(
  accessToken: string | undefined,
  token: string,
  guestId: string | null,
): Promise<void> {
  try {
    await apiClient.registerFCMToken(
      accessToken,
      token,
      Platform.OS === "android" ? "android" : "ios",
      guestId ?? undefined,
    );
  } catch {
    // Registration failure is non-fatal; it is retried on the next launch or token refresh.
  }
}

/**
 * Registers the device for push and wires tap handling. Does nothing until the
 * user has an identity (guest or signed in), so a token is never registered
 * anonymously. Returns a cleanup function that removes every listener.
 */
export async function setupNotifications(
  authStatus: AuthStatus,
  accessToken: string | undefined,
  guestId: string | null,
): Promise<() => void> {
  if (authStatus !== "signedIn" && authStatus !== "guest") {
    return () => {};
  }

  await ensureAndroidChannel();
  const granted = await requestNotificationPermission();
  if (!granted) {
    return () => {};
  }

  const token = await getFCMToken();
  if (token !== null) {
    await registerToken(accessToken, token, guestId);
  }

  // FCM rotates tokens occasionally; keep the server copy current.
  const tokenSub = Notifications.addPushTokenListener((next) => {
    if (typeof next.data === "string") {
      void registerToken(accessToken, next.data, guestId);
    }
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener(openNotification);

  // The app may have been launched by tapping a notification.
  const last = await Notifications.getLastNotificationResponseAsync();
  if (last !== null) {
    openNotification(last);
  }

  return () => {
    tokenSub.remove();
    responseSub.remove();
  };
}

export async function removeFCMTokenOnSignOut(
  accessToken: string | undefined,
  guestId: string | null,
): Promise<void> {
  const token = await getFCMToken();
  if (token === null) {
    return;
  }
  try {
    await apiClient.removeFCMToken(accessToken, token, guestId ?? undefined);
  } catch {
    // Best-effort cleanup; the server also drops tokens FCM reports as invalid.
  }
}
