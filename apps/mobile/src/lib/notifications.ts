import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { ApiClient } from "@/services/api";
import type { AuthStatus } from "@/lib/auth";

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
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function registerNotificationListeners(): Promise<() => void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const receivedSub = Notifications.addNotificationReceivedListener((notification: any) => {
    console.log("[Notification] Foreground:", notification.request.content);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data;
    console.log("[Notification] Opened:", data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export async function setupNotifications(
  authStatus: AuthStatus,
  accessToken: string | undefined,
  guestId: string | null,
): Promise<() => void> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return () => {};
  }

  const token = await getFCMToken();
  if (token !== null) {
    try {
      await apiClient.registerFCMToken(
        accessToken,
        token,
        Platform.OS === "android" ? "android" : "ios",
        guestId ?? undefined,
      );
    } catch {
      // Registration failure is non-fatal — token will retry on next launch.
    }
  }

  const removeListeners = await registerNotificationListeners();
  return removeListeners;
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
    // Best-effort cleanup; the token expires server-side regardless.
  }
}
