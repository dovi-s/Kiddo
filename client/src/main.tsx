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
