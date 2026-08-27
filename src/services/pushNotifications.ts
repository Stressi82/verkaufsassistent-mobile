import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { API_URL } from "../config";
import {
  EbayNotificationStatus,
  PushRegistrationStatus,
} from "../types/push";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function projectId(): string | null {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("buyer-messages", {
    name: "Käufernachrichten",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    sound: "default",
  });
}

async function backendJson(
  path: string,
  pairingCode: string,
  options?: RequestInit
): Promise<any> {
  if (!API_URL) throw new Error("Backend ist noch nicht verbunden.");

  const response = await fetch(`${API_URL}${path}`, {
    ...(options || {}),
    headers: {
      "x-push-pairing-code": pairingCode,
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.detail ||
        `Serverfehler ${response.status}`
    );
  }

  return payload;
}

export async function getPushRegistrationStatus(pairingCode: string): Promise<PushRegistrationStatus> {
  if (Platform.OS === "web") {
    return {
      permission: "unknown",
      projectIdConfigured: Boolean(projectId()),
      tokenRegistered: false,
      detail: "Push-Benachrichtigungen stehen in der installierten Handy-App zur Verfügung.",
    };
  }

  const permission = await Notifications.getPermissionsAsync();
  const pid = projectId();

  let backend: any = null;
  if (API_URL) {
    try {
      backend = pairingCode ? await backendJson("/push/status", pairingCode) : null;
    } catch {
      backend = null;
    }
  }

  return {
    permission:
      permission.status === "granted" ||
      permission.status === "denied" ||
      permission.status === "undetermined"
        ? permission.status
        : "unknown",
    projectIdConfigured: Boolean(pid),
    tokenRegistered: Boolean(backend?.registeredDevices > 0),
    detail: !pid
      ? "EAS Project ID fehlt. Push kann erst nach EAS-Projektverknüpfung aktiviert werden."
      : backend?.registeredDevices > 0
        ? "Dieses Backend hat mindestens ein Push-Gerät registriert."
        : "Push ist noch nicht für dieses Backend registriert.",
  };
}

export async function registerPushNotifications(pairingCode: string): Promise<string> {
  if (Platform.OS === "web") {
    throw new Error(
      "Push-Benachrichtigungen können nur in der installierten Handy-App aktiviert werden."
    );
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    throw new Error("Push-Benachrichtigungen wurden nicht erlaubt.");
  }

  const pid = projectId();
  if (!pid) {
    throw new Error(
      "EAS Project ID fehlt. Führe für die App zuerst die EAS-Projektverknüpfung aus."
    );
  }

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({
      projectId: pid,
    })
  ).data;

  if (!pairingCode.trim()) {
    throw new Error("Bitte zuerst den Backend-Pairing-Code eingeben.");
  }

  await backendJson("/push/register", pairingCode, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expoPushToken,
      platform: Platform.OS,
    }),
  });

  return expoPushToken;
}

export async function sendTestPush(pairingCode: string): Promise<void> {
  await backendJson("/push/test", pairingCode, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function getEbayNotificationStatus(pairingCode: string): Promise<EbayNotificationStatus> {
  if (!API_URL) {
    return {
      configured: false,
      connected: false,
      endpoint: null,
      verificationTokenConfigured: false,
      destinationId: null,
      subscriptionId: null,
      topicId: null,
      enabled: false,
      recentEvents: 0,
      lastEventAt: null,
      detail: "Backend ist noch nicht verbunden.",
    };
  }

  if (!pairingCode.trim()) {
    return {
      configured: false,
      connected: false,
      endpoint: null,
      verificationTokenConfigured: false,
      destinationId: null,
      subscriptionId: null,
      topicId: null,
      enabled: false,
      recentEvents: 0,
      lastEventAt: null,
      detail: "Backend-Pairing-Code noch nicht eingegeben.",
    };
  }

  return await backendJson("/notifications/ebay/status", pairingCode);
}

export async function setupEbayMessageNotifications(pairingCode: string): Promise<EbayNotificationStatus> {
  return await backendJson("/notifications/ebay/setup", pairingCode, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function testEbayMessageSubscription(pairingCode: string): Promise<void> {
  await backendJson("/notifications/ebay/test", pairingCode, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export function observePushNavigation(
  onInbox: (conversationId?: string) => void
): () => void {
  if (Platform.OS === "web") return () => undefined;

  const handle = (notification: Notifications.Notification) => {
    const data = notification.request.content.data as Record<string, unknown>;
    if (data?.screen === "inbox") {
      onInbox(
        typeof data.conversationId === "string"
          ? data.conversationId
          : undefined
      );
    }
  };

  const last = Notifications.getLastNotificationResponse();
  if (last?.notification) {
    handle(last.notification);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Ignore stale native response cleanup failures.
    }
  }

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response.notification);
    });

  return () => {
    responseSubscription.remove();
  };
}
