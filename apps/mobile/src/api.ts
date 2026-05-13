/**
 * Kiddo mobile API client.
 *
 * Base URL: set EXPO_PUBLIC_API_URL in your .env for production/staging.
 * In Expo Go dev, we derive the LAN host from the Metro URL so a physical
 * phone talks to your computer instead of trying to call itself.
 */
import Constants from "expo-constants";
import type { PublicGiftDestination } from "@kora/types";

function getExpoHostUri() {
  const constants = Constants as any;
  return (
    constants?.expoConfig?.hostUri ||
    constants?.manifest2?.extra?.expoClient?.hostUri ||
    constants?.manifest?.debuggerHost ||
    ""
  );
}

function deriveDevApiBase() {
  const hostUri = String(getExpoHostUri() || "");
  const host = hostUri.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:5000`;
  }
  return "http://127.0.0.1:5000";
}

function resolveApiBase() {
  const configured = String(process.env.EXPO_PUBLIC_API_URL || "").trim();
  const derived = deriveDevApiBase();
  if (!configured) return derived;
  if (configured.includes("localhost") || configured.includes("127.0.0.1")) {
    return derived;
  }
  return configured.replace(/\/$/, "");
}

export const API_BASE: string = resolveApiBase();

export const WEB_BASE: string =
  process.env.EXPO_PUBLIC_WEB_URL ||
  ((Constants as any)?.expoConfig?.extra?.webUrl as string | undefined) ||
  "https://kiddofund.com";

export interface ApiUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: string;
}

export interface ApiFund {
  id: string;
  name: string;
  slug: string;
  accountType: string;
  status: string;
  balance: string;
  pendingBalance: string;
  totalGain: string;
  gainPercent: string;
  contributorCount: number;
  recipientFirstName: string | null;
  recipientBirthdate: string | null;
  createdAt: string;
  // accessRole tags this fund row as owned vs collaborated. Web
  // dashboard branches on this for the shared-fund pill and to hide
  // write CTAs in viewer mode. Mobile follows the same pattern:
  // collaborator-listed funds appear in the dashboard, fund-detail
  // hides invest/recurring/settings affordances when viewer-only.
  // Older server responses omit this field; consumers should default
  // to 'owner' rather than locking the surface.
  accessRole?: 'owner' | 'co-admin' | 'viewer';
}

export interface ApiHolding {
  id: string;
  ticker: string;
  name: string;
  shares: string;
  currentValue: string;
  gain: string;
}

export interface ApiGift {
  id: string;
  amount: string;
  senderName: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  source?: string;
  asOf?: string;
  isEstimate?: boolean;
}

export interface GiftCheckoutPayload {
  fundId: string;
  eventId?: string;
  amount: number;
  senderName?: string;
  senderEmail?: string;
  message?: string;
  coverFees?: boolean;
  paymentMethod?: "apple_pay" | "card" | "bank";
  executionModel?: "auto" | "pick" | "family";
  selectedTicker?: string;
}

export interface ApiEvent {
  id: string;
  name: string;
  eventType: string;
  status: string;
  eventDate: string | null;
  fundId: string;
  fundName?: string;
  isPermanent: boolean;
  giftCount: number;
  totalRaised: string;
  createdAt: string;
}

export interface MobilePushPreferences {
  enabled: boolean;
  deviceCount: number;
  devices: Array<{
    tokenPreview: string;
    platform: string;
    deviceName: string | null;
    appOwnership: string | null;
    lastRegisteredAt: string;
    disabledAt: string | null;
    disabledReason: string | null;
  }>;
}

export async function apiGetMarketQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const unique = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
  if (unique.length === 0) return [];
  const res = await apiFetch(`/api/market/quotes?symbols=${encodeURIComponent(unique.join(","))}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.quotes) ? data.quotes : [];
}

let _sessionCookie: string | null = null;

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  // On React Native, credentials: "include" uses an in-memory cookie store.
  // We also manually mirror the session cookie in headers for reliability on physical devices.
  if (_sessionCookie) {
    headers["Cookie"] = _sessionCookie;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const cookie = response.headers.get("set-cookie");
  if (cookie) {
    // Extract just the name=value pair (before the first "; ")
    _sessionCookie = cookie.split(";")[0];
  }

  return response;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function apiLogin(email: string, password: string): Promise<ApiUser> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return parseJson<ApiUser>(res);
}

export async function apiRegister(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<ApiUser> {
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, firstName, lastName }),
  });
  return parseJson<ApiUser>(res);
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
  _sessionCookie = null;
}

export async function apiGetUser(): Promise<ApiUser | null> {
  const res = await apiFetch("/api/auth/user");
  // /api/auth/user returns 200 + null body when not authenticated. The 401
  // branch is a defensive fallback for the deploy window where an older
  // server may still be returning 401 — once both halves are deployed, the
  // 200 + null path is the only one that fires.
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const body = (await res.json()) as ApiUser | null;
  return body;
}

export async function apiGetFunds(): Promise<ApiFund[]> {
  const res = await apiFetch("/api/funds");
  return parseJson<ApiFund[]>(res);
}

export async function apiGetFundHoldings(fundId: string): Promise<ApiHolding[]> {
  const res = await apiFetch(`/api/funds/${fundId}/holdings`);
  return parseJson<ApiHolding[]>(res);
}

export async function apiGetFundGifts(fundId: string): Promise<ApiGift[]> {
  const res = await apiFetch(`/api/funds/${fundId}/gifts`);
  return parseJson<ApiGift[]>(res);
}

export async function apiCreateFund(data: {
  name: string;
  slug: string;
  accountType: string;
  recipientFirstName: string;
  recipientLastName?: string;
  recipientBirthdate: Date;
  recipientRelation: string;
}): Promise<ApiFund> {
  const res = await apiFetch("/api/funds", {
    method: "POST",
    body: JSON.stringify({ ...data, status: "draft" }),
  });
  return parseJson<ApiFund>(res);
}

export async function apiGetAllEvents(): Promise<ApiEvent[]> {
  const res = await apiFetch("/api/events");
  return parseJson<ApiEvent[]>(res);
}

export async function apiGetFundEvents(fundId: string): Promise<ApiEvent[]> {
  const res = await apiFetch(`/api/funds/${fundId}/events`);
  return parseJson<ApiEvent[]>(res);
}

export async function apiCreateEvent(data: {
  fundId: string;
  name: string;
  slug: string;
  description?: string;
  eventType: string;
  goalAmount?: string;
  eventDate?: string;
  status?: string;
  isPermanent?: boolean;
}): Promise<ApiEvent> {
  const res = await apiFetch("/api/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return parseJson<ApiEvent>(res);
}

export async function apiGetMobilePushPreferences(): Promise<MobilePushPreferences> {
  const res = await apiFetch("/api/mobile-push/preferences");
  return parseJson<MobilePushPreferences>(res);
}

export async function apiRegisterMobilePushToken(payload: {
  token: string;
  platform: string;
  deviceName?: string | null;
  appOwnership?: string | null;
}) {
  const res = await apiFetch("/api/mobile-push/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ ok: boolean; enabled: boolean; deviceCount: number }>(res);
}

export async function apiUpdateMobilePushPreferences(enabled: boolean) {
  const res = await apiFetch("/api/mobile-push/preferences", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  return parseJson<{ ok: boolean; enabled: boolean; deviceCount: number }>(res);
}

export async function apiQueueTestMobilePush() {
  const res = await apiFetch("/api/mobile-push/test", {
    method: "POST",
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiGetPublicGiftDestination(identifier: string): Promise<PublicGiftDestination> {
  const eventRes = await apiFetch(`/api/public/events/${identifier}`);
  if (eventRes.ok) {
    return parseJson<PublicGiftDestination>(eventRes);
  }

  const fundRes = await apiFetch(`/api/public/funds/${identifier}`);
  if (!fundRes.ok) {
    let message = `Gift page not found: ${identifier}`;
    try {
      const body = await fundRes.json();
      message = body?.message || body?.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  const fundBody = await fundRes.json();
  return {
    event: {
      id: "",
      name: "Gift anytime",
    },
    fund: fundBody.fund,
    giftCount: 0,
  } as PublicGiftDestination;
}

export async function apiCreateGiftCheckout(payload: GiftCheckoutPayload): Promise<{ url?: string }> {
  const res = await apiFetch("/api/stripe/checkout/gift", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ url?: string }>(res);
}

// International waitlist signup. Same shape as the web off-ramp.
// Used by the mobile AddFundScreen country gate when the parent
// indicates they live outside the US.
export async function apiJoinInternationalWaitlist(data: {
  email: string;
  country?: string;
  sourceSurface: string;
}): Promise<void> {
  const res = await apiFetch("/api/waitlist/international", {
    method: "POST",
    body: JSON.stringify({
      email: data.email.trim().toLowerCase(),
      country: data.country?.trim() || "",
      sourceSurface: data.sourceSurface,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Could not save your email.");
  }
}

export function formatBalance(value: string | number | undefined | null): string {
  const n = parseFloat(String(value ?? "0"));
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ─── Realtime (SSE) ─────────────────────────────────────────────────────────
//
// React Native doesn't ship an EventSource. We avoid taking a dep on
// react-native-sse by rolling a small streaming-fetch parser. The server
// shape is /api/me/events from server/realtime.ts — JSON-per-`data:` line
// with periodic `: heartbeat` comments. See web /lib/realtime-context for
// the equivalent EventSource consumer.
//
// Reconnect policy: caller-provided callback signals close. We DON'T
// implement an internal retry loop because the call site in App.tsx
// already re-creates the stream on auth-state change + app-foreground
// transitions, which is the same set of triggers the web visibility-
// change reopen handles. If you find you want internal retry, fold it
// in here rather than duplicating across screens.
//
// Polling stays as the safety net: every dashboard / fund-detail screen
// continues to refetch on focus. SSE is the fast path; polling closes
// the gap on dropped streams.

export type MobileRealtimeEvent =
  | { type: "gift.arrived"; fundId: string; giftId: string }
  | { type: "fund.updated"; fundId: string };

export type MobileRealtimeStream = {
  /** Cancel the stream. Idempotent; safe to call multiple times. */
  close: () => void;
};

/**
 * Open a long-lived SSE stream to /api/me/events. Returns immediately
 * with a handle whose `close()` aborts the underlying fetch.
 *
 * On every parsed event, `onEvent` fires. On stream end (server close,
 * network drop, or caller .close()), `onClose` fires once. Errors during
 * the initial connect or mid-stream are swallowed silently — the polling
 * fallback in each screen covers the staleness window. The caller is
 * expected to reopen the stream on app-foreground if they care.
 */
export function openRealtimeStream(
  onEvent: (event: MobileRealtimeEvent) => void,
  onClose?: () => void,
): MobileRealtimeStream {
  const controller = new AbortController();
  let closedExternally = false;
  const close = () => {
    if (closedExternally) return;
    closedExternally = true;
    try { controller.abort(); } catch { /* ignore */ }
  };

  (async () => {
    try {
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };
      if (_sessionCookie) headers["Cookie"] = _sessionCookie;

      const response = await fetch(`${API_BASE}/api/me/events`, {
        method: "GET",
        headers,
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        onClose?.();
        return;
      }

      const reader = (response.body as any).getReader?.();
      if (!reader) {
        // RN runtime without ReadableStream support. Falls through to
        // polling — silent, by design (see file header).
        onClose?.();
        return;
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line (\n\n). Drain any
        // complete frames out of the buffer; keep the trailing partial.
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // Heartbeats are `:`-prefixed comments — skip without parsing.
          // Server also emits an `event: ready` frame on connect; we
          // don't strictly need to handle it but ignoring it is safe.
          if (frame.startsWith(":")) continue;
          // Extract data lines. SSE supports multi-line `data:` but the
          // server always sends single-line JSON, so first match wins.
          const dataLine = frame
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json) as MobileRealtimeEvent;
            onEvent(parsed);
          } catch {
            // Malformed payloads dropped silently.
          }
        }
      }
    } catch {
      // Aborted, network error, or stream end. All paths reach onClose.
    } finally {
      onClose?.();
    }
  })();

  return { close };
}
