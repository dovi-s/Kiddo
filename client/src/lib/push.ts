// Web Push (client) — opt the current browser into OS-level notifications.
//
// IMPORTANT: nothing here runs automatically. The permission prompt is a
// founder/UX decision — you must NEVER fire it on page load (browsers penalize
// that, and it tanks grant rates). Call subscribeToPush() from a deliberate
// moment: a Settings toggle, or right after a high-intent action ("notify me
// when a gift lands"). That copy + timing is yours to design.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

let cachedConfig: { publicKey: string; enabled: boolean } | null = null;
async function getServerConfig(): Promise<{ publicKey: string; enabled: boolean }> {
  if (cachedConfig) return cachedConfig;
  const res = await fetch("/api/push/public-key", { credentials: "include" });
  cachedConfig = await res.json();
  return cachedConfig!;
}

// Request permission, subscribe via PushManager, and register the subscription
// with the server. Returns true only if the browser is now subscribed. Safe to
// call when already subscribed (reuses the existing subscription).
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const { publicKey, enabled } = await getServerConfig();
  if (!enabled || !publicKey) return false; // server has no VAPID keys configured

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ subscription: { endpoint: sub.endpoint, keys: json.keys } }),
  });
  return res.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// Dev helper: fire a test push to your own devices (server route is auth-gated).
export async function sendTestPush(): Promise<{ sent: number; pruned: number; failed: number }> {
  const res = await fetch("/api/push/test", { method: "POST", credentials: "include" });
  return res.json();
}
