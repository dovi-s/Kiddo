import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebhookHandlers } from "./webhookHandlers";
import { setupAuth } from "./auth";
import { pool, db } from "./db";
import { captureError, captureEvent, initOpsMonitoring, sendOpsAlert } from "./ops";
import { startGifterNotificationWorker } from "./gifterNotificationWorker";
import { startRecurringContributionWorker } from "./recurringContributionWorker";
import { logStorageMode } from "./objectStorage";
import { startParentLifecycleWorker } from "./parentLifecycleWorker";
import { startMobilePushWorker } from "./mobilePushWorker";
import { startAge18TransitionWorker } from "./age18TransitionWorker";
import { startDemoResetWorker } from "./demoResetWorker";
import { registerOGMiddleware } from "./ogMiddleware";
import { users } from "@shared/schema";
import { getConfiguredSuperAdminEmails, getDefaultSuperAdminEmails } from "@shared/adminAccess";
import { buildPlatformReadiness, summarizePlatformReadiness } from "@shared/platformReadiness";
import { inArray, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import net from "net";

const app = express();
const httpServer = createServer(app);
const uploadsPath = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use("/uploads", express.static(uploadsPath));

// Local/dev environments behind corporate proxies often present self-signed/intercepted certs.
// Keep TLS secure by default; allow insecure TLS only when explicitly opted in for local debugging.
if (
  process.env.NODE_ENV !== "production" &&
  process.env.ALLOW_INSECURE_DEV_TLS === "1" &&
  process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0"
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn("ALLOW_INSECURE_DEV_TLS=1 -> TLS verification disabled for local debugging.");
}

if (process.env.NODE_ENV === "production" && process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error("Unsafe TLS configuration: NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production.");
}

function buildContentSecurityPolicy() {
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://js.stripe.com",
    "https://cdn.plaid.com",
  ];
  const styleSrc = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];
  const connectSrc = [
    "'self'",
    "https://api.stripe.com",
    "https://r.stripe.com",
    "https://m.stripe.network",
    "https://*.plaid.com",
    "https://cdn.plaid.com",
  ];

  if (!isProd) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("ws:", "wss:", "http://localhost:*", "http://127.0.0.1:*");
  }

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'self'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `style-src ${styleSrc.join(" ")}`,
    `script-src ${scriptSrc.join(" ")}`,
    // worker-src must be set explicitly. Without it, browsers fall back to
    // script-src, which doesn't allow `blob:` — and blob URLs are how Vite's
    // HMR client and a number of bundled libraries (audio worklets, image
    // processing, third-party SDKs) instantiate Web Workers. Adding `blob:`
    // here keeps the strict default-src 'self' baseline while permitting
    // the specific worker pattern that the app actually uses.
    `worker-src 'self' blob:`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://cdn.plaid.com https://*.plaid.com https://s.tradingview.com https://www.tradingview.com`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

app.use((req, res, next) => {
  res.setHeader("X-DNS-Prefetch-Control", "on");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // microphone=(self) so first-party voice recording works (gifter
  // checkout voice notes, parent Memory Book voice notes — both
  // call navigator.mediaDevices.getUserMedia({ audio: true })).
  // The empty form `microphone=()` blocks even same-origin access
  // and was breaking voice-note recording in GiftCheckout +
  // MemoryMediaPicker + MemoryBook. Camera + geolocation stay
  // denied because no current code path uses them via getUserMedia
  // (photo uploads go through <input type="file">, no permissions
  // policy needed).
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy());
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function bootstrapSuperAdmins() {
  // Always merge env-configured super admins WITH the hardcoded defaults so core
  // accounts are never accidentally excluded by an env misconfiguration.
  const fromEnv = getConfiguredSuperAdminEmails(
    process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL,
  );
  const defaults = getDefaultSuperAdminEmails();
  const emails = Array.from(new Set(Array.from(fromEnv).concat(Array.from(defaults))));
  if (emails.length === 0) return;
  try {
    const updated = await db
      .update(users)
      .set({ isAdmin: true })
      .where(sql`LOWER(${users.email}) in (${sql.join(emails.map((email) => sql`${email}`), sql`, `)})`)
      .returning({ email: users.email });
    if (updated.length > 0) {
      log(`Super admin bootstrap: granted is_admin to ${updated.map((u) => u.email).join(", ")}`);
    } else {
      log(`Super admin bootstrap: no matching accounts found yet for [${emails.join(", ")}]. It will apply once the account is created`);
    }
  } catch (err) {
    // Non-fatal: DB may not be ready or users may not exist yet.
    log(`Super admin bootstrap skipped: ${(err as Error).message}`);
  }
}

async function initStripe() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
    console.warn('Stripe is not fully configured: missing STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('Stripe webhook verification is disabled until STRIPE_WEBHOOK_SECRET is set');
  }
}

function getPublicBaseUrl(req: Request): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    "";
  if (configured) {
    try {
      const u = new URL(configured);
      return `${u.protocol}//${u.host}`;
    } catch {
      // fall through to request-derived URL
    }
  }
  const forwardedProtoRaw = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHostRaw = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const reqHostRaw = String(req.get("host") || "").split(",")[0].trim();
  const proto = forwardedProtoRaw || req.protocol || "https";
  const host = forwardedHostRaw || reqHostRaw || "localhost:5000";
  return `${proto}://${host}`;
}

function parseEnvList(value: string | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAppleAppSiteAssociation() {
  const teamId =
    process.env.APPLE_TEAM_ID ||
    process.env.APPLE_APP_ID_PREFIX ||
    process.env.EXPO_APPLE_TEAM_ID ||
    "";
  const bundleId = "app.kora.mobile";
  const appId = teamId ? `${teamId}.${bundleId}` : "";
  const paths = ["/gift/*", "/g/*", "/claim/*", "/send/*"];

  return {
    applinks: {
      apps: [],
      details: appId
        ? [
            {
              appID: appId,
              paths,
            },
          ]
        : [],
    },
  };
}

function getAndroidAssetLinks() {
  const packageName = "app.kora.mobile";
  const fingerprints = [
    ...parseEnvList(process.env.ANDROID_SHA256_CERT_FINGERPRINT),
    ...parseEnvList(process.env.ANDROID_SHA256_CERT_FINGERPRINTS),
  ];

  if (fingerprints.length === 0) return [];

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

app.get("/robots.txt", (req, res) => {
  const base = getPublicBaseUrl(req);
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /dashboard",
    "Disallow: /profile",
    "Disallow: /settings",
    "Disallow: /activity",
    "Disallow: /events",
    "Disallow: /event/create",
    "Disallow: /send",
    "Disallow: /memory/",
    "Disallow: /kid/",
    "Disallow: /claim/",
    "Disallow: /gift/success",
    "Disallow: /onboard",
    "Disallow: /activate",
    `Sitemap: ${base}/sitemap.xml`,
  ];
  res.type("text/plain").status(200).send(lines.join("\n"));
});

app.get("/sitemap.xml", (req, res) => {
  const base = getPublicBaseUrl(req);
  const now = new Date().toISOString();
  const routes: Array<{ path: string; changefreq: string; priority: string }> = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/get-started", changefreq: "weekly", priority: "0.9" },
    { path: "/faq", changefreq: "monthly", priority: "0.7" },
    { path: "/about", changefreq: "monthly", priority: "0.6" },
    { path: "/legal", changefreq: "monthly", priority: "0.5" },
  ];
  const urlset = routes
    .map(
      (r) =>
        `<url><loc>${base}${r.path}</loc><lastmod>${now}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlset}</urlset>`;
  res.type("application/xml").status(200).send(xml);
});

app.get(["/.well-known/apple-app-site-association", "/apple-app-site-association"], (_req, res) => {
  const payload = getAppleAppSiteAssociation();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(JSON.stringify(payload));
});

app.get("/.well-known/assetlinks.json", (_req, res) => {
  const payload = getAndroidAssetLinks();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(JSON.stringify(payload));
});

app.get("/api/status", async (_req, res) => {
  const checks = buildPlatformReadiness(process.env);
  const summary = summarizePlatformReadiness(checks);
  res.status(summary.ok ? 200 : 503).json({
    ok: summary.ok,
    status: summary.ok ? "ok" : "degraded",
    timestamp: Date.now(),
    version: process.env.APP_VERSION || "dev",
    summary,
    checks: checks.map((check) => ({
      id: check.id,
      label: check.label,
      layer: check.layer,
      status: check.status,
      requiredForLaunch: check.requiredForLaunch,
      configured: check.configured,
      envVars: check.envVars,
      detail: check.detail,
    })),
  });
});

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        await sendOpsAlert(
          {
            title: "Stripe webhook payload type invalid",
            severity: "critical",
            source: "webhook",
            details: { bodyType: typeof req.body },
          },
          "webhook-payload-type-invalid",
        );
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      await captureEvent({ event: "webhook_received", properties: { ok: true } });
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      await captureError(error, { route: "/api/stripe/webhook" });
      await sendOpsAlert(
        {
          title: "Stripe webhook processing failed",
          severity: "critical",
          source: "webhook",
          details: { message: error?.message || "unknown" },
        },
        "webhook-processing-failed",
      );
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Allow cross-origin requests from the Expo/React Native dev client in development.
// In production the mobile app calls the same origin and this is skipped.
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,Cookie,X-Requested-With");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}

app.use(
  // Body limit sized for the largest legitimate JSON payload the app
  // sends: a 25MB video upload encoded as a base64 dataUrl. Base64
  // inflates by ~33%, plus JSON wrapper overhead → ~34MB before any
  // headroom. The previous 8mb limit produced 413 errors on every
  // video upload (and on audio uploads bigger than ~6MB) because the
  // global parser rejected the body BEFORE the route's per-payload
  // size check at server/routes.ts:5232 could run. Per-route
  // validation (25MB video / 10MB audio) still enforces sensible
  // upper bounds; this limit just clears the runway for them.
  express.json({
    limit: "35mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const slowApiLogThresholdMs = Number(process.env.SLOW_API_LOG_MS || 300);
if (process.env.NODE_ENV !== "production" && Number.isFinite(slowApiLogThresholdMs) && slowApiLogThresholdMs > 0) {
  app.use("/api", (req, res, next) => {
    const startedAt = performance.now();
    res.on("finish", () => {
      const elapsedMs = Math.round(performance.now() - startedAt);
      if (elapsedMs >= slowApiLogThresholdMs) {
        console.warn(`[slow-api] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${elapsedMs}ms`);
      }
    });
    next();
  });
}

app.get("/api/health", async (req, res) => {
  const deep = String(req.query.deep || "") === "1";
  const base = {
    ok: true,
    status: "ok",
    timestamp: Date.now(),
    uptimeSec: Math.round(process.uptime()),
  };
  try {
    await pool.query("select 1");
    if (!deep) {
      return res.status(200).json({ ...base, db: "ok" });
    }
    return res.status(200).json({
      ...base,
      db: "ok",
      platform: summarizePlatformReadiness(buildPlatformReadiness(process.env)),
      checks: {
        stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        stripePublishableConfigured: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
        stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
      },
      version: process.env.APP_VERSION || "dev",
    });
  } catch (error) {
    await captureError(error, { route: "/api/health", deep });
    await sendOpsAlert(
      {
        title: "Health check failed (database unavailable)",
        severity: "critical",
        source: "health",
      },
      "health-db-down",
    );
    return res.status(503).json({ ...base, ok: false, status: "degraded", db: "error" });
  }
});

// Backward-compatible deep health route alias.
app.get("/api/health/deep", async (_req, res) => {
  const base = {
    ok: true,
    status: "ok",
    timestamp: Date.now(),
    uptimeSec: Math.round(process.uptime()),
  };
  try {
    await pool.query("select 1");
    return res.status(200).json({
      ...base,
      db: "ok",
      platform: summarizePlatformReadiness(buildPlatformReadiness(process.env)),
      checks: {
        stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        stripePublishableConfigured: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
        stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
      },
      version: process.env.APP_VERSION || "dev",
    });
  } catch (error) {
    await captureError(error, { route: "/api/health/deep", deep: true });
    await sendOpsAlert(
      {
        title: "Deep health check failed (database unavailable)",
        severity: "critical",
        source: "health",
      },
      "health-deep-db-down",
    );
    return res.status(503).json({ ...base, ok: false, status: "degraded", db: "error" });
  }
});

type RateLimitRule = {
  name: string;
  methods?: string[];
  match: RegExp;
  max: number;
  windowMs: number;
};

const rateLimitRules: RateLimitRule[] = [
  { name: "auth-login", methods: ["POST"], match: /^\/api\/auth\/login$/, max: 10, windowMs: 15 * 60 * 1000 },
  { name: "auth-register", methods: ["POST"], match: /^\/api\/auth\/register$/, max: 8, windowMs: 15 * 60 * 1000 },
  { name: "stripe-checkout-gift", methods: ["POST"], match: /^\/api\/stripe\/checkout\/gift$/, max: 20, windowMs: 10 * 60 * 1000 },
  { name: "stripe-checkout-plan", methods: ["POST"], match: /^\/api\/stripe\/checkout\/(starter-plan|family-plan|legacy-plan|event-pass|premium-event-coverage)$/, max: 20, windowMs: 10 * 60 * 1000 },
  { name: "stripe-calc-fees", methods: ["POST"], match: /^\/api\/stripe\/calculate-fees$/, max: 80, windowMs: 10 * 60 * 1000 },
  { name: "stripe-webhook", methods: ["POST"], match: /^\/api\/stripe\/webhook$/, max: 300, windowMs: 10 * 60 * 1000 },
  { name: "referral-events", methods: ["POST"], match: /^\/api\/referrals\/events$/, max: 120, windowMs: 10 * 60 * 1000 },
  { name: "memory-create", methods: ["POST"], match: /^\/api\/funds\/[^/]+\/memory$/, max: 30, windowMs: 10 * 60 * 1000 },
];

const rateLimitStore = new Map<string, number[]>();
app.use((req, res, next) => {
  const rule = rateLimitRules.find((r) => {
    if (r.methods && !r.methods.includes(req.method.toUpperCase())) return false;
    return r.match.test(req.path);
  });
  if (!rule) return next();

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${rule.name}:${req.method}:${ip}`;
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const hits = (rateLimitStore.get(key) || []).filter((ts) => ts > windowStart);

  if (hits.length >= rule.max) {
    return res.status(429).json({
      error: "Too many requests. Please try again shortly.",
    });
  }

  hits.push(now);
  rateLimitStore.set(key, hits);
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function canListenOnPort(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", () => resolve(false));
    probe.listen({ port, host: "0.0.0.0" }, () => {
      probe.close(() => resolve(true));
    });
  });
}

async function resolveListenPort(requestedPort: number): Promise<number> {
  if (process.env.NODE_ENV === "production") return requestedPort;
  if (await canListenOnPort(requestedPort)) return requestedPort;

  const fallbackPorts = [5001, 5002, 5003, 5004, 5005];
  for (const port of fallbackPorts) {
    if (port === requestedPort) continue;
    if (await canListenOnPort(port)) {
      log(`port ${requestedPort} is busy in development, falling back to ${port}`);
      return port;
    }
  }
  return requestedPort;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const safeJsonPreview = (value: unknown) => {
    try {
      const seen = new WeakSet<object>();
      const json = JSON.stringify(
        value,
        (_key, val) => {
          if (typeof val === "bigint") return val.toString();
          if (typeof val === "object" && val !== null) {
            if (seen.has(val as object)) return "[Circular]";
            seen.add(val as object);
          }
          return val;
        },
      );
      if (!json) return "";
      return json.length > 1200 ? `${json.slice(0, 1200)}...` : json;
    } catch {
      return "[unserializable response]";
    }
  };

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${safeJsonPreview(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await initStripe();
  await initOpsMonitoring();
  await bootstrapSuperAdmins();
  setupAuth(app);
  await registerRoutes(httpServer, app);
  startGifterNotificationWorker(log);
  startParentLifecycleWorker(log);
  startMobilePushWorker(log);
  startRecurringContributionWorker(log);
  startAge18TransitionWorker(log);
  startDemoResetWorker(log);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    captureError(err, { route: _req.path, method: _req.method, status }).catch(() => null);
    sendOpsAlert(
      {
        title: "Unhandled API error",
        severity: status >= 500 ? "critical" : "warning",
        source: "express",
        details: { path: _req.path, method: _req.method, status, message },
      },
      `express-error:${_req.path}:${status}`,
    ).catch(() => null);
  });

  // OG tag injection for gift link scrapers (iMessage, WhatsApp, etc.)
  // Must run after API routes but before the SPA catch-all
  registerOGMiddleware(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const requestedPort = parseInt(process.env.PORT || "5000", 10);
  const port = await resolveListenPort(requestedPort);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      // Tell the operator immediately whether voice notes / photos / videos
      // will survive a container restart. The local-disk fallback is the
      // single biggest broken-promise risk in the product (Memory Book
      // entries pointing to vanished files), so the warning is loud.
      logStorageMode();
    },
  );
})();

let shuttingDown = false;
process.once("SIGTERM", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log("SIGTERM received, shutting down gracefully");

  httpServer.close(async (err) => {
    if (err) {
      console.error("Error closing HTTP server:", err);
      process.exit(1);
    }

    try {
      await pool.end();
      log("Database pool closed");
      process.exit(0);
    } catch (dbErr) {
      console.error("Error closing database pool:", dbErr);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Force exiting after shutdown timeout");
    process.exit(1);
  }, 15_000).unref();
});

process.once("SIGINT", () => {
  process.kill(process.pid, "SIGTERM");
});
