import { Platform } from "react-native";

import { ANDROID_CHANNEL_ID, routeForNotification, setupNotifications } from "./notifications";

const mockRegisterFCMToken = jest.fn();
const mockPush = jest.fn();
const mockSetChannel = jest.fn();
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetDeviceToken = jest.fn();
const mockGetLastResponse = jest.fn();
const mockAddTokenListener = jest.fn();
const mockAddResponseListener = jest.fn();
const order: string[] = [];

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

jest.mock("@/services/api", () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    registerFCMToken: (...a: unknown[]) => mockRegisterFCMToken(...a),
    removeFCMToken: jest.fn(),
  })),
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: (...a: unknown[]) => mockSetChannel(...a),
  getPermissionsAsync: (...a: unknown[]) => mockGetPermissions(...a),
  requestPermissionsAsync: (...a: unknown[]) => mockRequestPermissions(...a),
  getDevicePushTokenAsync: (...a: unknown[]) => mockGetDeviceToken(...a),
  getLastNotificationResponseAsync: (...a: unknown[]) => mockGetLastResponse(...a),
  addPushTokenListener: (...a: unknown[]) => mockAddTokenListener(...a),
  addNotificationResponseReceivedListener: (...a: unknown[]) => mockAddResponseListener(...a),
}));

describe("routeForNotification", () => {
  it("opens missions and applications for the reminder types the API sends", () => {
    expect(routeForNotification({ type: "mission" })).toBe("/missions");
    expect(routeForNotification({ type: "followup" })).toBe("/applications");
  });

  it("ignores unknown or malformed payloads", () => {
    expect(routeForNotification({ type: "other" })).toBeNull();
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification("mission")).toBeNull();
  });
});

describe("setupNotifications", () => {
  const removeToken = jest.fn();
  const removeResponse = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    order.length = 0;
    Platform.OS = "android";
    mockSetChannel.mockImplementation(async () => {
      order.push("channel");
    });
    mockGetPermissions.mockResolvedValue({ status: "undetermined" });
    mockRequestPermissions.mockImplementation(async () => {
      order.push("permission");
      return { status: "granted" };
    });
    mockGetDeviceToken.mockResolvedValue({ data: "fcm-token-1" });
    mockGetLastResponse.mockResolvedValue(null);
    mockRegisterFCMToken.mockResolvedValue({});
    mockAddTokenListener.mockReturnValue({ remove: removeToken });
    mockAddResponseListener.mockReturnValue({ remove: removeResponse });
  });

  it("does nothing until the user has an identity", async () => {
    for (const status of ["restoring", "signedOut"] as const) {
      await setupNotifications(status, undefined, null);
    }

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockRegisterFCMToken).not.toHaveBeenCalled();
  });

  it("creates the Android channel before asking for permission, then registers the token", async () => {
    await setupNotifications("signedIn", "access-token", null);

    expect(order).toEqual(["channel", "permission"]);
    expect(mockSetChannel).toHaveBeenCalledWith(ANDROID_CHANNEL_ID, expect.any(Object));
    expect(mockRegisterFCMToken).toHaveBeenCalledWith(
      "access-token",
      "fcm-token-1",
      "android",
      undefined,
    );
  });

  it("registers guests under their guest id", async () => {
    await setupNotifications("guest", undefined, "guest-1");

    expect(mockRegisterFCMToken).toHaveBeenCalledWith(
      undefined,
      "fcm-token-1",
      "android",
      "guest-1",
    );
  });

  it("registers nothing when the user declines permission", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "denied" });

    await setupNotifications("signedIn", "access-token", null);

    expect(mockRegisterFCMToken).not.toHaveBeenCalled();
  });

  it("re-registers when FCM rotates the token", async () => {
    await setupNotifications("signedIn", "access-token", null);
    const onTokenChange = mockAddTokenListener.mock.calls[0]?.[0] as (t: { data: string }) => void;

    onTokenChange({ data: "fcm-token-2" });

    expect(mockRegisterFCMToken).toHaveBeenLastCalledWith(
      "access-token",
      "fcm-token-2",
      "android",
      undefined,
    );
  });

  it("opens the screen for a tapped notification", async () => {
    await setupNotifications("signedIn", "access-token", null);
    const onTap = mockAddResponseListener.mock.calls[0]?.[0] as (r: unknown) => void;

    onTap({ notification: { request: { content: { data: { type: "mission" } } } } });

    expect(mockPush).toHaveBeenCalledWith("/missions");
  });

  it("opens the screen when the app was launched by a notification", async () => {
    mockGetLastResponse.mockResolvedValue({
      notification: { request: { content: { data: { type: "followup" } } } },
    });

    await setupNotifications("signedIn", "access-token", null);

    expect(mockPush).toHaveBeenCalledWith("/applications");
  });

  it("removes every listener on cleanup", async () => {
    const cleanup = await setupNotifications("signedIn", "access-token", null);

    cleanup();

    expect(removeToken).toHaveBeenCalledTimes(1);
    expect(removeResponse).toHaveBeenCalledTimes(1);
  });
});
