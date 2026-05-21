import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App";
import "./index.css";

const DEV_USER_ID_KEY = "kora:dev-user-id";
const DEV_AUTH_OVERRIDE_FLAG = "kora:enable-dev-auth-override";

function isApiRequest(input: RequestInfo | URL): boolean {
  const raw = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";
  const existingPatched = (window as any).__koraDevFetchPatched === true;
  if (isLocalHost && !existingPatched) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        if (isApiRequest(input)) {
          const devOverrideEnabled =
            window.sessionStorage.getItem(DEV_AUTH_OVERRIDE_FLAG) === "1" ||
            window.localStorage.getItem(DEV_AUTH_OVERRIDE_FLAG) === "1";
          if (!devOverrideEnabled) {
            return nativeFetch(input, init);
          }

          const devUserId = window.localStorage.getItem(DEV_USER_ID_KEY);
          if (devUserId) {
            const headers = new Headers(init?.headers || undefined);
            headers.set("x-kora-dev-user-id", devUserId);
            return nativeFetch(input, { ...(init || {}), headers });
          }
        }
      } catch {
        // non-blocking; fall through to native fetch
      }
      return nativeFetch(input, init);
    };
    (window as any).__koraDevFetchPatched = true;
  }

  // Global safety net for 403s on fund-scoped endpoints. Any time a
  // request to /api/funds/<uuid>/... returns 403, the cached fund ID
  // pointing at that UUID is definitely stale (the server says the
  // current user doesn't own this fund). Eagerly clear the
  // localStorage entries that could keep re-introducing the bad ID
  // on the next page load — without this, the activeFundId guard in
  // Dashboard only fixes the current render, not the stored state
  // that re-seeds the bad ID next time.
  //
  // Pattern: wrap window.fetch a second time AFTER the dev-auth
  // wrapper above, so both layers compose. The wrapper observes the
  // response, doesn't transform anything else. localStorage writes
  // are best-effort; failures fall through silently.
  //
  // Locked 2026-05-21 after the third 403-storm report — even with
  // the Dashboard activeFundId guard and the prefetch fix, a stale
  // ?fund=... URL param or a cached selectedFundId could still get
  // re-introduced from any number of code paths. The cleanest
  // self-heal is at the response layer.
  const FUND_SCOPED_PATH = /^\/api\/funds\/([0-9a-f-]{8,})\//i;
  const ACTIVE_FUND_LS_KEY = "kiddo_active_fund_id";
  const FUNDS_LIST_LS_KEY = "kiddo.dashboard.funds.v1";
  const cleanupAlready = (window as any).__koraStaleFundCleanupInstalled === true;
  if (!cleanupAlready) {
    const layeredFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await layeredFetch(input, init);
      try {
        if (response.status === 403) {
          const raw = typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
          const url = new URL(raw, window.location.origin);
          const match = url.pathname.match(FUND_SCOPED_PATH);
          if (match && match[1]) {
            const offendingFundId = match[1].toLowerCase();
            const cachedActiveId = (window.localStorage.getItem(ACTIVE_FUND_LS_KEY) || "").toLowerCase();
            if (cachedActiveId && cachedActiveId === offendingFundId) {
              window.localStorage.removeItem(ACTIVE_FUND_LS_KEY);
            }
            // Strip ?fund=<offending> from URL if present so a hard
            // reload doesn't re-introduce it.
            const currentParams = new URLSearchParams(window.location.search);
            if ((currentParams.get("fund") || "").toLowerCase() === offendingFundId) {
              currentParams.delete("fund");
              const qs = currentParams.toString();
              window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
            }
            // Drop the cached funds list — it's possibly stale and
            // could re-validate the bad ID on next mount. The
            // Dashboard's useQuery will refetch on next render.
            window.localStorage.removeItem(FUNDS_LIST_LS_KEY);
            // Drop any per-fund caches keyed by the offending UUID.
            for (let i = window.localStorage.length - 1; i >= 0; i--) {
              const k = window.localStorage.key(i);
              if (k && k.toLowerCase().includes(offendingFundId)) {
                window.localStorage.removeItem(k);
              }
            }
          }
        }
      } catch {
        // best-effort; never block the response
      }
      return response;
    };
    (window as any).__koraStaleFundCleanupInstalled = true;
  }
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; errorMessage: string } {
    return { hasError: true, errorMessage: error?.message || "Unknown error" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Route through the observability seam — production routes to Sentry
    // when VITE_SENTRY_DSN is set, otherwise structured console.error.
    // Earlier this used console.error directly, which meant production
    // render errors disappeared unless the user reported them.
    void import("@/lib/observability").then(({ captureError }) => {
      captureError(error, {
        source: "react:AppErrorBoundary",
        extra: { componentStack: errorInfo?.componentStack || null },
      });
    });

    // Common local-dev failure: stale Vite chunk/dynamic import mismatch after edits.
    // Hard-reload once automatically so the latest bundle is picked up.
    const msg = String(error?.message || "").toLowerCase();
    const isChunkLoadError =
      msg.includes("failed to fetch dynamically imported module") ||
      msg.includes("loading chunk") ||
      msg.includes("chunkloaderror");
    if (isChunkLoadError) {
      const key = "kora:chunk-reload-once";
      if (sessionStorage.getItem(key) !== "1") {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
          <div className="max-w-lg">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please refresh the page and try again.
            </p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              Error: {this.state.errorMessage}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                Reload
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem("kora:chunk-reload-once");
                  window.location.assign("/");
                }}
                className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
