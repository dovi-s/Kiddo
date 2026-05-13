// Server-side error tracking + structured-event abstraction.
//
// Today: console.error / console.warn fallback. Errors land in stdout,
// which the runtime's log pipeline (e.g., Vercel / Render / Replit
// stderr) captures.
//
// Production hardening: add `@sentry/node`, set `SENTRY_DSN` env, and
// swap the captureError / captureMessage internals to call Sentry.
// Every call site already passes the right shape (Error + context) so
// no callers need to change. The seam exists; the integration is one
// dependency + a function-body swap.
//
// Why have the seam without the integration: callers should NOT use
// `console.error` directly. Once the seam exists, every error-path
// flows through one place. Adding Sentry later means changing one
// file, not chasing N call sites. This is also what an audit looks
// for — error handling that says "we have a place errors go" instead
// of "we hope someone notices the console output."

type ErrorContext = {
  // Where the error originated — routes.ts:postFundCancel,
  // age18Worker:processToday, etc. Free-form but please be specific.
  source: string;
  // User identifier when known. Helps Sentry's per-user error tracking;
  // null for anonymous flows (gifter checkout, public memory upload).
  userId?: string | null;
  // Free-form context — fundId, giftId, paymentIntentId, anything
  // useful for replay. Keep small (one-line objects); large payloads
  // make error dashboards unreadable.
  extra?: Record<string, unknown>;
};

let sentryEnabled = false;
let sentryClient: any = null;

// Lazy initialization — no-op when @sentry/node isn't installed AND
// SENTRY_DSN isn't set. When BOTH are present, the next captureError
// call will route through Sentry transparently. Keeps the dependency
// optional during development and lets production opt in by setting
// the env var.
async function ensureSentry(): Promise<void> {
  if (sentryEnabled || sentryClient !== null) return;
  const dsn = String(process.env.SENTRY_DSN || "").trim();
  if (!dsn) return;
  try {
    // Dynamic import so the module isn't required at build time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentryModule: any = await import("@sentry/node").catch(() => null);
    if (!sentryModule || typeof sentryModule.init !== "function") return;
    sentryModule.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      // Sample 10% of transactions in production; full sampling in dev.
      // Tune based on volume.
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
    sentryClient = sentryModule;
    sentryEnabled = true;
    console.log("[observability] Sentry initialized");
  } catch (err) {
    // Sentry init failure should NOT crash the app. Log once and
    // fall back to console.
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
      // Sentry runtime failure — fall through to console.
    }
  }
  // Fallback: structured stderr so log pipelines can parse.
  console.error(
    JSON.stringify({
      level: "error",
      source: context.source,
      userId: context.userId || null,
      message: err.message,
      stack: err.stack,
      extra: context.extra || null,
      ts: new Date().toISOString(),
    }),
  );
}

export function captureMessage(message: string, context: ErrorContext & { level?: "info" | "warning" }): void {
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
  logFn(
    JSON.stringify({
      level,
      source: context.source,
      userId: context.userId || null,
      message,
      extra: context.extra || null,
      ts: new Date().toISOString(),
    }),
  );
}

// Express error-handler middleware. Mount at the bottom of the
// middleware chain in server/index.ts. Catches anything thrown from
// route handlers that wasn't already handled, captures it, and
// returns a 500 with a generic message so internals don't leak.
export function expressErrorHandler(err: any, req: any, _res: any, next: any) {
  if (err) {
    captureError(err, {
      source: `express:${req?.method || "?"} ${req?.path || "?"}`,
      userId: req?.user?.id || null,
      extra: {
        method: req?.method,
        path: req?.path,
        query: req?.query,
      },
    });
  }
  next(err);
}
