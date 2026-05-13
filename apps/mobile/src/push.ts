import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getExpoProjectId() {
  const easProjectId = (Constants as any)?.easConfig?.projectId;
  const extraProjectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
  return String(easProjectId || extraProjectId || "").trim() || null;
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    return { ok: false as const, reason: "Push notifications require a physical device." };
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return { ok: false as const, reason: "Expo project ID is missing, so a push token cannot be created yet." };
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return { ok: false as const, reason: "Notification permission was not granted." };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2D5A27",
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  return {
    ok: true as const,
    token: tokenResponse.data,
    platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown",
    deviceName: Device.deviceName || null,
    appOwnership: (Constants as any)?.appOwnership || null,
  };
}
