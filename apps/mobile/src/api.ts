/**
 * Kiddo mobile API client.
 *
 * Base URL: set EXPO_PUBLIC_API_URL in your .env for production/staging.
 * In Expo Go dev, we derive the LAN host from the Metro URL so a physical
 * phone talks to your computer instead of trying to call itself.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PublicGiftDestination } from "@kora/types";

// Per-app client-source tag stamped on outgoing gift checkout payloads.
// Lets the server's gifts.source column distinguish mobile vs web at
// the row level, which is the OPS_RUNBOOK_MOBILE_FEE_DISPLAY_BUG_
// 2026-05-14.md Option C future-proofing — when the next mobile-only
// UI bug surfaces, ops can filter rows by surface without paging
// through Stripe user-agent metadata one payment intent at a time.
const CLIENT_SOURCE: "mobile_ios" | "mobile_android" =
  Platform.OS === "android" ? "mobile_android" : "mobile_ios";

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
  // Cash that has settled out of Stripe and into DriveWealth but
  // hasn't yet been invested by the auto-invest worker. Distinct
  // from pendingBalance (which is Stripe-in-flight). Surfaced on
  // FundDetailScreen as a small "still settling into investments"
  // line. Per money-classification audit 2026-05-14; mobile parity
  // added 2026-05-14. May be missing on older API responses;
  // consumers should default to "0".
  cashBalance?: string;
  totalGain: string;
  gainPercent: string;
  contributorCount: number;
  recipientFirstName: string | null;
  recipientBirthdate: string | null;
  createdAt: string;
  // accessRole tags this fund row as owned vs collaborated vs
  // transferred. Web dashboard + mobile detail branch on this:
  //  - 'owner' / 'co-admin': full write access
  //  - 'viewer': collaborator, read-only
  //  - 'previous_owner': post-handoff parent. Fund transferred to
  //    the kid at majority; parent sees it in their list with a
  //    "Transferred to {kid}" pill but write CTAs are hidden.
  //    Per FUND_STATES_SPEC.md item 4 and the 2026-05-14
  //    funds.previousOwnerId foundation. Older server responses
  //    omit this field; consumers should default to 'owner' rather
  //    than locking the surface.
  accessRole?: 'owner' | 'co-admin' | 'viewer' | 'previous_owner';
  // Stamped at the moment the kid claimed the fund at majority.
  // Only present (non-null) on funds where accessRole='previous_owner'.
  // Surfaced as the "Transferred on {date}" pill on parent surfaces.
  transferredAt?: string | null;
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
  // Optional — apiCreateGiftCheckout stamps this from Platform.OS so
  // callers don't have to pass it. Server validates against an allow-
  // list and falls back to 'web' on anything unrecognized.
  clientSource?: "mobile_ios" | "mobile_android" | "web";
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

// ─── Dashboard summary (the consolidated fund-page payload) ─────────────────
//
// Mirrors GET /api/funds/:fundId/dashboard-summary (server/routes.ts). This is
// the ONE endpoint the web Dashboard is built on — the rich fund page (hero,
// 30-day summary, growth chart, holdings split, recurring, who-loves) all read
// off it. The mobile Home tab now consumes the same payload so it mirrors the
// web fund page instead of re-deriving a thinner view from /holdings + /gifts.
//
// Fund IDENTITY (name, balance, recipientFirstName, accessRole, transferredAt)
// is NOT in this payload — it lives on the ApiFund row from apiGetFunds(). The
// Home tab combines the active ApiFund + this summary.

/** A point on the fund's value history (one row per captured snapshot). */
export interface DashboardHistoryPoint {
  snapshotDate: string;
  investedValue: string;
  cashValue: string;
  totalValue: string;
  /** Cost basis (sum of settled gift principal) — the chart's "principal" line. */
  principalBasis: string;
}

/** A richer gift row than ApiGift — the dashboard-summary returns full gift records. */
export interface DashboardGift {
  id: string;
  amount: string;
  netAmount?: string | null;
  senderName: string | null;
  senderEmail?: string | null;
  isAnonymous?: boolean;
  message: string | null;
  status: string;
  selectedTicker?: string | null;
  executionModel?: string | null;
  eventId?: string | null;
  createdAt: string;
  settledAt?: string | null;
}

/** A parent's recurring investment schedule (free across all tiers). */
export interface ParentContribution {
  id: string;
  amount: string;
  frequency: string; // "weekly" | "monthly" | "yearly" | "daily"
  status: string; // "active" | "paused" | ...
  nextRunDate?: string | null;
  selectedTicker?: string | null;
  executionModel?: string | null;
  pauseReason?: string | null;
  createdAt?: string;
}

/** Per-gift, per-ticker cost-basis allocation (drives holdings provenance). */
export interface GiftAllocation {
  id: string;
  giftId: string;
  ticker: string;
  costBasis: string;
  shares: string;
  source?: string; // "pick" | "auto" | "rebalance"
}

export interface DashboardTransaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  description: string | null;
  giftId: string | null;
  eventId: string | null;
  fundId: string;
  completedAt: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  fundId: string;
  /** Whether recurring is unlocked for this fund (Plus/Family/trial/demo/owner). */
  recurringEnabled: boolean;
  holdings: ApiHolding[];
  gifts: DashboardGift[];
  events: ApiEvent[];
  history: DashboardHistoryPoint[];
  investmentPreferences: any;
  giftCode: { code: string; lookupUrl: string; createdAt?: string; updatedAt?: string };
  parentContributions: ParentContribution[];
  transactions: DashboardTransaction[];
  giftAllocations: GiftAllocation[];
  /** Set only when the viewer is the kid who claimed within the last 60 days. */
  kidClaimedAt: string | null;
  coparentAcceptance: { collaboratorId: string; name: string; acceptedAt: string } | null;
  plusFirstMediaAt: string | null;
}

// ─── Memory Book ────────────────────────────────────────────────────────────
//
// Mirrors GET /api/funds/:fundId/memory (server/routes.ts). A timeline of
// gift messages, milestones, parent notes, and photos — the emotional core the
// web Memory Book renders. Gift entries carry the full gift sub-record.

export interface MemoryGift {
  id: string;
  senderName: string | null;
  senderEmail?: string | null;
  amount: string;
  netAmount?: string | null;
  status?: string | null;
  message: string | null;
  photoUrl?: string | null;
  createdAt: string;
  eventName?: string | null;
  eventId?: string | null;
  executionModel?: string | null;
  selectedTicker?: string | null;
  sharesAcquired?: string | null;
  priceAtPurchase?: string | null;
  recurringGiftId?: string | null;
  parentContributionId?: string | null;
}

export type MemoryEntryType =
  | "gift_message"
  | "milestone"
  | "photo"
  | "note"
  | "parent_note"
  | "parent_investment_start";

export interface MemoryEntry {
  id: string;
  fundId: string;
  giftId: string | null;
  type: MemoryEntryType;
  content: string | null;
  authorName: string | null;
  authorPhotoUrl?: string | null;
  photoUrl?: string | null;
  videoUrl?: string | null;
  visibility: "public" | "family" | "private";
  isFeatured?: boolean;
  mediaStatus?: string;
  createdAt: string;
  gift: MemoryGift | null;
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
let _deviceId: string | null = null;

// Mobile auth token (the primary auth on device — a physical phone has no
// reliable browser cookie store, which is why cookie-only login showed
// "unauthorized"). Issued by /api/auth/login + /register (mobileAuthToken in the
// response), stored in SecureStore (Keychain/Keystore), and sent as
// Authorization: Bearer on every request. The server's resolveRequestUser accepts
// it alongside the web cookie session. See server/mobileAuthToken.ts.
const AUTH_TOKEN_KEY = "kiddo.mobile.auth.token";
let _authToken: string | null = null;
let _authTokenLoaded = false;

async function loadAuthToken(): Promise<string | null> {
  if (_authTokenLoaded) return _authToken;
  try {
    _authToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    _authToken = null; // SecureStore unavailable (web preview) — degrade quietly.
  }
  _authTokenLoaded = true;
  return _authToken;
}
async function setAuthToken(token: string): Promise<void> {
  _authToken = token;
  _authTokenLoaded = true;
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  } catch {
    // ignore — in-memory copy still works for this session
  }
}
async function clearAuthToken(): Promise<void> {
  _authToken = null;
  _authTokenLoaded = true;
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}
/** True if a stored token exists — lets the app skip the login screen on relaunch. */
export async function hasStoredAuthToken(): Promise<boolean> {
  return Boolean(await loadAuthToken());
}

// Cached stable per-install device id. Pulled lazily on first request
// from biometric.ts (which manages the SecureStore key). Sent on every
// request as X-Kiddo-Device-Id so the server can identify the device
// for trusted-devices revocation + last-unlocked timestamping. Per
// FACE_ID_SPEC.md (trusted devices panel item).
async function getCachedDeviceId(): Promise<string | null> {
  if (_deviceId) return _deviceId;
  try {
    const { getOrCreateDeviceId } = await import("./biometric");
    _deviceId = await getOrCreateDeviceId();
    return _deviceId;
  } catch {
    return null;
  }
}

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

  // Primary auth: the SecureStore bearer token (cookie above is a best-effort
  // fallback). The server authenticates this via resolveRequestUser.
  const authToken = await loadAuthToken();
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  // Identify this device install for trusted-devices flows. Non-
  // sensitive header — the server pairs it with the authenticated
  // session before trusting it.
  const deviceId = await getCachedDeviceId();
  if (deviceId) {
    headers["X-Kiddo-Device-Id"] = deviceId;
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
  const data = await parseJson<ApiUser & { mobileAuthToken?: string }>(res);
  if (data.mobileAuthToken) await setAuthToken(data.mobileAuthToken);
  return data;
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
  const data = await parseJson<ApiUser & { mobileAuthToken?: string }>(res);
  if (data.mobileAuthToken) await setAuthToken(data.mobileAuthToken);
  return data;
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
  _sessionCookie = null;
  await clearAuthToken();
}

// ===== TRUSTED DEVICES (FACE_ID_SPEC.md) =====

export type TrustedDeviceRow = {
  id: string;
  deviceId: string;
  deviceName: string | null;
  platform: string | null;
  biometricEnabledAt: string;
  lastUnlockedAt: string | null;
  revokedAt: string | null;
};

export async function apiRegisterTrustedDevice(input: {
  deviceId: string;
  deviceName?: string;
  platform?: string;
}): Promise<{ success: boolean; id: string }> {
  const res = await apiFetch("/api/me/trusted-devices", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJson<{ success: boolean; id: string }>(res);
}

export async function apiListTrustedDevices(): Promise<{
  devices: TrustedDeviceRow[];
  currentDeviceId: string | null;
}> {
  const res = await apiFetch("/api/me/trusted-devices");
  return parseJson<{ devices: TrustedDeviceRow[]; currentDeviceId: string | null }>(res);
}

export async function apiRevokeTrustedDevice(id: string): Promise<void> {
  const res = await apiFetch(`/api/me/trusted-devices/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
  });
  await parseJson<{ success: boolean }>(res);
}

export async function apiGetDeviceStatus(): Promise<{ revoked: boolean; registered: boolean }> {
  const res = await apiFetch("/api/me/device-status");
  return parseJson<{ revoked: boolean; registered: boolean }>(res);
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

/**
 * The consolidated fund-page payload. ONE round-trip for the rich Home tab —
 * the same endpoint the web Dashboard is built on. Combine with the active
 * ApiFund (from apiGetFunds) for identity/balance.
 */
export async function apiGetDashboardSummary(fundId: string): Promise<DashboardSummary> {
  const res = await apiFetch(`/api/funds/${fundId}/dashboard-summary`);
  return parseJson<DashboardSummary>(res);
}

/** The Memory Book timeline for a fund (gift messages, milestones, notes, photos). */
export async function apiGetMemory(fundId: string): Promise<MemoryEntry[]> {
  const res = await apiFetch(`/api/funds/${fundId}/memory`);
  return parseJson<MemoryEntry[]>(res);
}

/**
 * Write a parent text note onto the Memory Book timeline. Mirrors the web
 * composer's POST /api/funds/:fundId/memory. `visibility` is the audience
 * sidecar (who sees it on the gift page); notes default to "family". Server
 * stamps the author from the session.
 */
export async function apiCreateMemoryNote(
  fundId: string,
  content: string,
  visibility: "public" | "family" | "private" = "family",
): Promise<MemoryEntry> {
  const res = await apiFetch(`/api/funds/${fundId}/memory`, {
    method: "POST",
    body: JSON.stringify({ type: "note", content: content.trim(), visibility, kidVisibility: "kid_now" }),
  });
  return parseJson<MemoryEntry>(res);
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
  // Guard the shape: GifterFlowScreen reads destination.fund.investmentPreferences
  // straight off this, so a 200 with a missing `fund` (server change / proxy /
  // malformed body) would crash the gift-link screen with "undefined" instead of
  // showing the screen's normal error state. Fail loud + clean here.
  if (!fundBody?.fund) {
    throw new Error(`Gift page not found: ${identifier}`);
  }
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
  // Stamp clientSource from the running platform if the caller didn't
  // override it. Server validates against the allow-list and silently
  // falls back to 'web' on unknown values, so this is best-effort tag
  // injection, not auth-sensitive.
  const withSource: GiftCheckoutPayload = {
    ...payload,
    clientSource: payload.clientSource ?? CLIENT_SOURCE,
  };
  const res = await apiFetch("/api/stripe/checkout/gift", {
    method: "POST",
    body: JSON.stringify(withSource),
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
