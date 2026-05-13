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

async function loginFn(data: { email: string; password: string }): Promise<SafeUserWithFlags> {
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

  const loginMutation = useMutation({
    mutationFn: loginFn,
    onSuccess: (user) => {
      writeLocalCache(LOCAL_CACHE_KEYS.authUser, user);
      queryClient.setQueryData(["/api/auth/user"], user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerFn,
    onSuccess: (user) => {
      writeLocalCache(LOCAL_CACHE_KEYS.authUser, user);
      queryClient.setQueryData(["/api/auth/user"], user);
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
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error?.message,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
