type AlertPayload = {
  title: string;
  severity?: "info" | "warning" | "critical";
  source?: string;
  details?: Record<string, unknown>;
  // Free-text expansion of the title (one-paragraph context for the
  // on-call engineer reading the alert). Routes use this for the
  // "what happened + what's affected + manual remediation needed"
  // narrative; the `details` map is for structured props that get
  // logged separately.
  message?: string;
  // Alias for `details` for ergonomic call-site naming when the
  // payload is mostly identifying-context (fundId, userId, errorString).
  // Either name works; sendOpsAlert below merges them.
  context?: Record<string, unknown>;
};

type CapturePayload = {
  event: string;
  distinctId?: string;
  properties?: Record<string, unknown>;
};

let sentryClient: any = null;
const alertCooldownMs = 5 * 60 * 1000;
const lastAlertByKey = new Map<string, number>();

function shouldSendAlert(key: string) {
  const now = Date.now();
  const last = lastAlertByKey.get(key) || 0;
  if (now - last < alertCooldownMs) return false;
  lastAlertByKey.set(key, now);
  return true;
}

export async function initOpsMonitoring() {
  // Log the Sentry status explicitly on every startup. The auditor's
  // first question is "is your error tracking actually wired in
  // production?" — answering that with a single grep on the startup
  // log beats answering it from runtime behavior alone. See
  // SECURITY.md §3 (observability) and policies/incident-response.md
  // §4.1 for the role this plays in incident detection.
  const dsn = process.env.SENTRY_DSN;
  const env = process.env.NODE_ENV || "development";

  if (!dsn) {
    console.log(`[ops] Sentry: DISABLED (SENTRY_DSN unset; environment=${env})`);
    return;
  }

  try {
    const dynamicImport = new Function("m", "return import(m)");
    const sentry = await dynamicImport("@sentry/node");
    sentry.init({
      dsn,
      environment: env,
      // PII scrubbing: drop request bodies + headers that often carry
      // tokens or session data. See policies/data-classification.md
      // §6 — Tier 1/2 data must never reach a third party for
      // observability.
      beforeSend(event: any) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
    });
    sentryClient = sentry;
    console.log(`[ops] Sentry: ENABLED (environment=${env}, dsn=${redactDsn(dsn)})`);
  } catch (err) {
    console.warn(`[ops] Sentry: FAILED to init (DSN set but init threw): ${(err as any)?.message || err}`);
  }
}

function redactDsn(dsn: string): string {
  // Sentry DSN format: https://PUBLIC_KEY@oXXXX.ingest.sentry.io/PROJECT_ID
  // We log the project host but redact the public key.
  try {
    const u = new URL(dsn);
    return `${u.protocol}//[REDACTED]@${u.host}${u.pathname}`;
  } catch {
    return "[unparseable]";
  }
}

export async function captureEvent(payload: CapturePayload) {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return;
  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
  const distinctId = payload.distinctId || "server";

  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: payload.event,
        distinct_id: distinctId,
        properties: payload.properties || {},
      }),
    });
  } catch (err) {
    console.error("[ops] PostHog capture failed:", err);
  }
}

export async function captureError(error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  await captureEvent({
    event: "server_error",
    properties: {
      message,
      ...context,
    },
  });

  if (sentryClient) {
    try {
      sentryClient.captureException(error, { extra: context || {} });
    } catch (err) {
      console.error("[ops] Sentry capture failed:", err);
    }
  }
}

export async function sendOpsAlert(payload: AlertPayload, dedupeKey?: string) {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) return;
  const key = dedupeKey || `${payload.source || "app"}:${payload.title}`;
  if (!shouldSendAlert(key)) return;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.ALERT_WEBHOOK_BEARER) {
      headers.Authorization = `Bearer ${process.env.ALERT_WEBHOOK_BEARER}`;
    }

    // Merge `details` and `context` into a single bag — both are
    // optional aliases for the structured props. Call sites pick the
    // name that reads better at the call site; the wire format always
    // includes the merged map.
    const merged = { ...(payload.context || {}), ...(payload.details || {}) };
    await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: `[${payload.severity || "warning"}] ${payload.title}${payload.message ? `\n${payload.message}` : ""}`,
        message: payload.message,
        source: payload.source || "kora",
        details: merged,
        context: merged,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[ops] Alert webhook failed:", err);
  }
}
