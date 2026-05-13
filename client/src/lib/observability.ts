// Client-side error tracking abstraction.
//
// Today: console.error fallback. Errors are visible in browser DevTools
// during development; in production they vanish unless the user reports
// them.
//
// Production hardening: add `@sentry/react`, set `VITE_SENTRY_DSN` env,
// and the next captureError call routes through Sentry. The seam exists
// so call sites don't need to change. Same pattern as `server/observability.ts`.

type ErrorContext = {
  source: string;
  userId?: string | null;
  extra?: Record<string, unknown>;
};

let sentryEnabled = false;
let sentryClient: any = null;

async function ensureSentry(): Promise<void> {
  if (sentryEnabled || sentryClient !== null) return;
  const dsn = String(import.meta.env?.VITE_SENTRY_DSN || "").trim();
  if (!dsn) return;
  try {
    // Indirect dynamic import via Function constructor — bypasses
    // TypeScript's module resolver so this file compiles even when
    // @sentry/react isn't installed. Same pattern as server/ops.ts.
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;
    const sentryModule: any = await dynamicImport("@sentry/react").catch(() => null);
    if (!sentryModule || typeof sentryModule.init !== "function") return;
    sentryModule.init({
      dsn,
      environment: import.meta.env?.MODE || "development",
      tracesSampleRate: import.meta.env?.PROD ? 0.1 : 1.0,
    });
    sentryClient = sentryModule;
    sentryEnabled = true;
    if (import.meta.env?.DEV) console.log("[observability] Sentry initialized");
  } catch (err) {
    console.warn("[observability] Sentry init failed:", (err as any)?.message || err);
    sentryEnabled = false;
  }
}

void ensureSentry();

export function captureError(error: unknown, context: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (sentryEnabled && sentryClient) {
    try {
      sentryClient.withScope((scope: any) => {
        scope.setTag("source", context.source);
        if (context.userId) scope.setUser({ id: context.userId });
        if (context.extra) scope.setContext("extra", context.extra);
        sentryClient.captureException(err);
      });
      return;
    } catch {
      // fall through
    }
  }
  // Fallback: structured console for dev visibility. Production without
  // Sentry loses these — that's the gap the seam exists to close once
  // a DSN is wired.
  console.error("[observability]", {
    source: context.source,
    userId: context.userId || null,
    message: err.message,
    stack: err.stack,
    extra: context.extra || null,
  });
}

export function captureMessage(
  message: string,
  context: ErrorContext & { level?: "info" | "warning" },
): void {
  const level = context.level || "info";
  if (sentryEnabled && sentryClient) {
    try {
      sentryClient.withScope((scope: any) => {
        scope.setTag("source", context.source);
        if (context.userId) scope.setUser({ id: context.userId });
        if (context.extra) scope.setContext("extra", context.extra);
        sentryClient.captureMessage(message, level);
      });
      return;
    } catch {
      // fall through
    }
  }
  const logFn = level === "warning" ? console.warn : console.log;
  logFn("[observability]", {
    source: context.source,
    userId: context.userId || null,
    message,
    extra: context.extra || null,
  });
}
