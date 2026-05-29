import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { getDefaultSuperAdminEmails, getEffectiveAdminFlags } from "@shared/adminAccess";
import { LOCAL_CACHE_KEYS, readLocalCache, removeLocalCache, removeLocalCachePrefix, writeLocalCache } from "@/lib/local-cache";

type SafeUser = Omit<User, "passwordHash">;
type SafeUserWithFlags = SafeUser & { isSuperAdmin?: boolean };

const FALLBACK_SUPER_ADMINS = getDefaultSuperAdminEmails();
const DEV_USER_ID_KEY = "kora:dev-user-id";

function normalizeUser(raw: any): SafeUserWithFlags {
  return {
    ...(raw || {}),
    ...getEffectiveAdminFlags(raw || {}, FALLBACK_SUPER_ADMINS),
  };
}

function persistDevUserId(user: SafeUserWithFlags | null) {
  if (typeof window === "undefined") return;
  if (user?.id) {
    window.localStorage.setItem(DEV_USER_ID_KEY, String(user.id));
  } else {
    window.localStorage.removeItem(DEV_USER_ID_KEY);
  }
}

async function fetchUser(): Promise<SafeUserWithFlags | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  // /api/auth/user is a session-state query: 200 + user when authenticated,
  // 200 + null when not. The 401 branch is a defensive fallback for the
  // deploy window where an older server may still be in flight returning
  // 401 for unauthenticated. Once both halves are deployed, only the 200
  // path executes in practice.
  if (response.status === 401) {
    persistDevUserId(null);
    removeLocalCache(LOCAL_CACHE_KEYS.authUser);
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const body = await response.json();
  if (body === null) {
    persistDevUserId(null);
    removeLocalCache(LOCAL_CACHE_KEYS.authUser);
    return null;
  }
  const normalized = normalizeUser(body);
  persistDevUserId(normalized);
  writeLocalCache(LOCAL_CACHE_KEYS.authUser, normalized);
  return normalized;
}

async function loginFn(data: { email: string; password: string }): Promise<SafeUserWithFlags | { twoFactorRequired: true }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Login failed");
  }

  const user = await response.json();
  // Password accepted, but the account has 2FA on — the server has NOT created
  // a session yet. Return a marker so the Login page can collect the
  // authenticator code; do not normalize/stamp (there is no user session yet).
  if (user && user.twoFactorRequired === true) {
    return { twoFactorRequired: true };
  }
  const normalized = normalizeUser(user);
  persistDevUserId(normalized);
  writeLocalCache(LOCAL_CACHE_KEYS.authUser, normalized);
  return normalized;
}

// Completes a 2FA login: posts the authenticator (or backup) code; the server
// only establishes the session on success.
async function verifyTwoFactorFn(code: string): Promise<SafeUserWithFlags> {
  const response = await fetch("/api/auth/2fa/login-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Verification failed");
  }

  const user = await response.json();
  const normalized = normalizeUser(user);
  persistDevUserId(normalized);
  writeLocalCache(LOCAL_CACHE_KEYS.authUser, normalized);
  return normalized;
}

async function registerFn(data: { email: string; password: string; firstName?: string; lastName?: string; referralCode?: string }): Promise<SafeUserWithFlags> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Registration failed");
  }

  const user = await response.json();
  const normalized = normalizeUser(user);
  persistDevUserId(normalized);
  writeLocalCache(LOCAL_CACHE_KEYS.authUser, normalized);
  return normalized;
}

async function logoutFn(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, isFetched } = useQuery<SafeUserWithFlags | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    initialData: () => readLocalCache<SafeUserWithFlags>(LOCAL_CACHE_KEYS.authUser) ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Per-user dismissal-key cleanup. These are global (NOT fund-scoped)
  // localStorage keys that represent "this specific user dismissed this
  // specific nudge" — without explicit cleanup at the auth boundary they
  // leak across user sessions on a shared browser. Example bug: user A
  // dismisses the "set up recurring" reminder nudge on /gift/success;
  // user B logs in on the same browser and never sees the nudge they
  // should see. Locked 2026-05-23 per the localStorage-dedupe audit
  // (deferred Tier-3 item #9). Sync this list when adding new
  // per-user dismissal keys ANYWHERE in the codebase.
  const PER_USER_KEYS_TO_CLEAR = [
    // Notification panel — read-state of notification IDs, last-read
    // timestamp. Per-user state; logging out as A and into B means B
    // shouldn't inherit A's read state.
    "kiddo.notif.lastReadAt",
    "kiddo.notif.readIds",
    "kiddo.notif.unreadIds",
    // PlanBenefitsCard — set of dismissed Plus-benefit nudges. Per-user.
    "kora:plan-benefit-nudge-dismissed",
    // GiftSuccess "set up recurring" + "remind me later" dismissals.
    // Per-user, not per-gift.
    "kora:dismissed:recurring-nudge",
    "kora:dismissed:reminder-nudge",
    // PlusFirstMediaCelebrationBanner — fires once per parent across
    // their lifetime when they upload their first parent-authored
    // photo/video/voice on Kiddo+. Per-user (NOT per-fund).
    "kora:dismissed:plus-first-media-celebration",
  ];
  const PER_USER_PREFIXES_TO_CLEAR = [
    // Gentle-nudge per-key dismissals on the Dashboard — pattern is
    // kora:dismissed:gentle-nudge:{nudgeKey}. Wipe all of them on auth
    // change so user B doesn't inherit A's dismissals.
    "kora:dismissed:gentle-nudge:",
    // Proactive Plus prompt dismissals — pattern is
    // kora:dismissed:plus-prompt:{kind}. Shipped 2026-05-23 per the
    // pre-launch upgrade-conversion plan; same per-user-scope reason.
    "kora:dismissed:plus-prompt:",
    // Aggregated recurring-requests nudge per-fund dismissals — pattern
    // is kora:dismissed:recurring-requests-nudge:{fundId}. Shipped
    // 2026-05-23 (later this session) per pricing-v3 gifter-side ship.
    "kora:dismissed:recurring-requests-nudge:",
  ];

  function clearPerUserDismissals() {
    try {
      for (const key of PER_USER_KEYS_TO_CLEAR) {
        window.localStorage.removeItem(key);
      }
      for (const prefix of PER_USER_PREFIXES_TO_CLEAR) {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(prefix)) window.localStorage.removeItem(k);
        }
      }
    } catch {
      // best-effort
    }
  }

  const loginMutation = useMutation({
    mutationFn: loginFn,
    onSuccess: (user) => {
      // 2FA pending: there is no session yet — the Login page collects the
      // authenticator code via verifyTwoFactor. Skip ALL session-stamping for
      // the marker so the normal (non-2FA) path below is byte-for-byte intact.
      if ((user as any)?.twoFactorRequired === true) return;
      // Stamp the new user first, then drop the per-user localStorage
      // caches that were keyed to the previous account. The localStorage
      // entries (active fund ID, funds list cache) survive across logins
      // unless explicitly cleared — without this, logging into account B
      // in the same browser inherits account A's active fund ID and
      // funds list (initialData), which then 403s every fund-scoped
      // query because account B doesn't own account A's funds.
      //
      // DO NOT call queryClient.clear() here — it wipes the auth query
      // mid-render, which Dashboard sees as "logged out, no funds" and
      // redirects to /get-started. The per-query invalidation below is
      // enough; TanStack Query refetches on next read.
      writeLocalCache(LOCAL_CACHE_KEYS.authUser, user);
      queryClient.setQueryData(["/api/auth/user"], user);
      try { window.localStorage.removeItem("kiddo_active_fund_id"); } catch {}
      removeLocalCache(LOCAL_CACHE_KEYS.funds);
      removeLocalCache(LOCAL_CACHE_KEYS.subscription);
      removeLocalCachePrefix("kora.dashboard-summary.");
      removeLocalCachePrefix("kiddo.fund-balance.");
      clearPerUserDismissals();
      // Invalidate (not clear) the data queries that are scoped to the
      // current user. Invalidation marks them stale so the next read
      // refetches; it doesn't wipe the cached value in a way that
      // briefly shows "no data" to currently-mounted components.
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  // Second-factor completion. On success it establishes the session, so it
  // runs the same post-login cache reset as loginMutation.
  const verifyTwoFactorMutation = useMutation({
    mutationFn: verifyTwoFactorFn,
    onSuccess: (user) => {
      writeLocalCache(LOCAL_CACHE_KEYS.authUser, user);
      queryClient.setQueryData(["/api/auth/user"], user);
      try { window.localStorage.removeItem("kiddo_active_fund_id"); } catch {}
      removeLocalCache(LOCAL_CACHE_KEYS.funds);
      removeLocalCache(LOCAL_CACHE_KEYS.subscription);
      removeLocalCachePrefix("kora.dashboard-summary.");
      removeLocalCachePrefix("kiddo.fund-balance.");
      clearPerUserDismissals();
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerFn,
    onSuccess: (user) => {
      writeLocalCache(LOCAL_CACHE_KEYS.authUser, user);
      queryClient.setQueryData(["/api/auth/user"], user);
      try { window.localStorage.removeItem("kiddo_active_fund_id"); } catch {}
      removeLocalCache(LOCAL_CACHE_KEYS.funds);
      removeLocalCache(LOCAL_CACHE_KEYS.subscription);
      removeLocalCachePrefix("kora.dashboard-summary.");
      removeLocalCachePrefix("kiddo.fund-balance.");
      clearPerUserDismissals();
      queryClient.invalidateQueries({ queryKey: ["/api/funds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      persistDevUserId(null);
      removeLocalCache(LOCAL_CACHE_KEYS.authUser);
      removeLocalCache(LOCAL_CACHE_KEYS.funds);
      removeLocalCache(LOCAL_CACHE_KEYS.events);
      removeLocalCache(LOCAL_CACHE_KEYS.subscription);
      removeLocalCachePrefix(LOCAL_CACHE_KEYS.activities);
      try { window.localStorage.removeItem("kiddo_active_fund_id"); } catch {}
      clearPerUserDismissals();
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      // Always leave protected routes after logout.
      window.location.assign("/");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    // True once the auth query has actually fetched from the server (not
    // just rehydrated from localStorage initialData). Downstream queries
    // that should never fire while still showing stale-cached auth state
    // gate on this in addition to isAuthenticated. Without it, a logged-out
    // visitor with a stale cached user would briefly satisfy
    // isAuthenticated, fire the protected query, get 401, and produce
    // console noise before useAuth refetched and corrected the state.
    isAuthChecked: isFetched,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message,
    isLoggingIn: loginMutation.isPending,
    verifyTwoFactor: verifyTwoFactorMutation.mutateAsync,
    verifyTwoFactorError: verifyTwoFactorMutation.error?.message,
    isVerifyingTwoFactor: verifyTwoFactorMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error?.message,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
