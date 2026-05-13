import fs from "fs/promises";
import path from "path";

const MOBILE_PUSH_STATE_PATH = path.join(process.cwd(), ".local", "mobile-push-state.json");
const MOBILE_PUSH_QUEUE_PATH = path.join(process.cwd(), ".local", "mobile-push-queue.jsonl");
const MOBILE_PUSH_DELIVERY_LOG_PATH = path.join(process.cwd(), ".local", "mobile-push-deliveries.json");

type MobilePushDevice = {
  token: string;
  platform: "ios" | "android" | "unknown";
  deviceName: string | null;
  appOwnership: string | null;
  lastRegisteredAt: string;
  disabledAt: string | null;
  disabledReason: string | null;
};

type MobilePushUserRecord = {
  userId: string;
  enabled: boolean;
  devices: Record<string, MobilePushDevice>;
  updatedAt: string;
};

type MobilePushStore = {
  byUserId: Record<string, MobilePushUserRecord>;
};

type MobilePushQueueEntry = {
  id?: string;
  type?: string;
  userId?: string;
  title?: string;
  body?: string;
  deepLink?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
};

type DeliveryLog = {
  deliveredById: Record<string, { deliveredAt: string; channel: string; status: string }>;
};

function createEmptyStore(): MobilePushStore {
  return { byUserId: {} };
}

function normalizeToken(value: unknown) {
  return String(value || "").trim();
}

function normalizeDevice(token: string, raw: any): MobilePushDevice {
  const platform = String(raw?.platform || "").trim().toLowerCase();
  return {
    token,
    platform: platform === "ios" || platform === "android" ? platform : "unknown",
    deviceName: typeof raw?.deviceName === "string" && raw.deviceName.trim() ? raw.deviceName.trim() : null,
    appOwnership: typeof raw?.appOwnership === "string" && raw.appOwnership.trim() ? raw.appOwnership.trim() : null,
    lastRegisteredAt: typeof raw?.lastRegisteredAt === "string" ? raw.lastRegisteredAt : new Date().toISOString(),
    disabledAt: typeof raw?.disabledAt === "string" ? raw.disabledAt : null,
    disabledReason: typeof raw?.disabledReason === "string" ? raw.disabledReason : null,
  };
}

function normalizeUserRecord(userId: string, raw: any): MobilePushUserRecord {
  const devicesRaw = raw?.devices && typeof raw.devices === "object" ? raw.devices : {};
  return {
    userId,
    enabled: raw?.enabled !== false,
    devices: Object.fromEntries(
      Object.entries(devicesRaw).map(([token, value]) => {
        const normalizedToken = normalizeToken(token);
        return [normalizedToken, normalizeDevice(normalizedToken, value)];
      }).filter(([token]) => Boolean(token)),
    ),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

async function loadStore(): Promise<MobilePushStore> {
  try {
    const raw = await fs.readFile(MOBILE_PUSH_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const byUserIdRaw = parsed?.byUserId && typeof parsed.byUserId === "object" ? parsed.byUserId : {};
    return {
      byUserId: Object.fromEntries(
        Object.entries(byUserIdRaw).map(([userId, value]) => [userId, normalizeUserRecord(String(userId), value)]),
      ),
    };
  } catch {
    return createEmptyStore();
  }
}

async function saveStore(store: MobilePushStore) {
  await fs.mkdir(path.dirname(MOBILE_PUSH_STATE_PATH), { recursive: true });
  await fs.writeFile(MOBILE_PUSH_STATE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function loadDeliveryLog(): Promise<DeliveryLog> {
  try {
    const raw = await fs.readFile(MOBILE_PUSH_DELIVERY_LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      deliveredById: parsed?.deliveredById && typeof parsed.deliveredById === "object" ? parsed.deliveredById : {},
    };
  } catch {
    return { deliveredById: {} };
  }
}

async function saveDeliveryLog(log: DeliveryLog) {
  await fs.mkdir(path.dirname(MOBILE_PUSH_DELIVERY_LOG_PATH), { recursive: true });
  await fs.writeFile(MOBILE_PUSH_DELIVERY_LOG_PATH, JSON.stringify(log, null, 2), "utf8");
}

export async function registerMobilePushDevice(
  userId: string,
  payload: { token: string; platform?: string; deviceName?: string | null; appOwnership?: string | null },
) {
  const token = normalizeToken(payload.token);
  if (!token) {
    throw new Error("Push token is required.");
  }

  const store = await loadStore();
  const record = normalizeUserRecord(userId, store.byUserId[userId]);
  record.devices[token] = normalizeDevice(token, {
    ...record.devices[token],
    platform: payload.platform,
    deviceName: payload.deviceName,
    appOwnership: payload.appOwnership,
    lastRegisteredAt: new Date().toISOString(),
    disabledAt: null,
    disabledReason: null,
  });
  record.updatedAt = new Date().toISOString();
  store.byUserId[userId] = record;
  await saveStore(store);
  return record;
}

export async function getMobilePushSettings(userId: string) {
  const store = await loadStore();
  return normalizeUserRecord(userId, store.byUserId[userId]);
}

export async function updateMobilePushSettings(userId: string, patch: { enabled?: boolean }) {
  const store = await loadStore();
  const record = normalizeUserRecord(userId, store.byUserId[userId]);
  if (typeof patch.enabled === "boolean") {
    record.enabled = patch.enabled;
  }
  record.updatedAt = new Date().toISOString();
  store.byUserId[userId] = record;
  await saveStore(store);
  return record;
}

export async function queueMobilePush(entry: MobilePushQueueEntry) {
  const payload = {
    id: typeof entry.id === "string" && entry.id ? entry.id : `${String(entry.type || "push")}:${String(entry.userId || "unknown")}:${Date.now()}`,
    ...entry,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(MOBILE_PUSH_QUEUE_PATH), { recursive: true });
  await fs.appendFile(MOBILE_PUSH_QUEUE_PATH, JSON.stringify(payload) + "\n", "utf8");
}

async function disableDeviceToken(userId: string, token: string, reason: string) {
  const store = await loadStore();
  const record = normalizeUserRecord(userId, store.byUserId[userId]);
  if (record.devices[token]) {
    record.devices[token] = {
      ...record.devices[token],
      disabledAt: new Date().toISOString(),
      disabledReason: reason,
    };
    record.updatedAt = new Date().toISOString();
    store.byUserId[userId] = record;
    await saveStore(store);
  }
}

async function sendExpoPush(token: string, title: string, body: string, deepLink?: string | null, metadata?: Record<string, unknown> | null) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: "default",
      priority: "high",
      data: {
        deepLink: deepLink || null,
        ...(metadata || {}),
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as any)?.errors?.[0]?.message || `Expo push failed: ${response.status}`);
  }
  return payload;
}

let running = false;

export async function runMobilePushWorker(log: (message: string, source?: string) => void = () => undefined) {
  if (running) return;
  running = true;
  try {
    let raw = "";
    try {
      raw = await fs.readFile(MOBILE_PUSH_QUEUE_PATH, "utf8");
    } catch {
      return;
    }
    if (!raw.trim()) return;

    const lines = raw.split(/\r?\n/).filter(Boolean);
    const deliveryLog = await loadDeliveryLog();
    let processed = 0;

    for (const line of lines) {
      let parsed: MobilePushQueueEntry | null = null;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (!parsed) continue;
      const id = String(parsed.id || "");
      if (!id || deliveryLog.deliveredById[id]) continue;

      const userId = String(parsed.userId || "");
      const title = String(parsed.title || "").trim();
      const body = String(parsed.body || "").trim();
      if (!userId || !title || !body) continue;

      const record = await getMobilePushSettings(userId);
      const activeDevices = Object.values(record.devices).filter((device) => !device.disabledAt);

      if (!record.enabled || activeDevices.length === 0) {
        deliveryLog.deliveredById[id] = {
          deliveredAt: new Date().toISOString(),
          channel: "mobile_push",
          status: "skipped",
        };
        processed += 1;
        continue;
      }

      let hadSuccess = false;
      for (const device of activeDevices) {
        try {
          const payload: any = await sendExpoPush(device.token, title, body, parsed.deepLink || null, parsed.metadata || null);
          const details = payload?.data;
          if (details?.status === "error") {
            const reason = String(details?.details?.error || details?.message || "push_error");
            if (reason.toLowerCase().includes("device") || reason.toLowerCase().includes("notregistered")) {
              await disableDeviceToken(userId, device.token, reason);
            } else {
              throw new Error(reason);
            }
          } else {
            hadSuccess = true;
          }
        } catch (error) {
          log(`mobile push send failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`, "mobile-push-worker");
        }
      }

      deliveryLog.deliveredById[id] = {
        deliveredAt: new Date().toISOString(),
        channel: "mobile_push",
        status: hadSuccess ? "sent" : "attempted",
      };
      processed += 1;
    }

    if (processed > 0) {
      await saveDeliveryLog(deliveryLog);
      log(`processed ${processed} mobile push event(s)`, "mobile-push-worker");
    }
  } finally {
    running = false;
  }
}

export function startMobilePushWorker(log: (message: string, source?: string) => void = () => undefined) {
  const intervalMs = Number(process.env.MOBILE_PUSH_WORKER_INTERVAL_MS || 1000 * 60 * 2);
  void runMobilePushWorker(log);
  const interval = setInterval(() => {
    void runMobilePushWorker(log);
  }, intervalMs);
  log(`mobile push worker started (every ${Math.round(intervalMs / 1000)} sec)`, "mobile-push-worker");
  return interval;
}
