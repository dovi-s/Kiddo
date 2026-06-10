import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { getPublicBaseUrl } from "./publicUrl";
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
import { startStalledHandoffWorker } from "./stalledHandoffWorker";
import { startDemoResetWorker } from "./demoResetWorker";
import { startPostHandoffEngagementWorker } from "./postHandoffEngagementWorker";
import { startAccountDeletionWorker } from "./accountDeletionWorker";
import { startGiftIntentExpiryWorker } from "./giftIntentExpiryWorker";
import { startFundBirthdayWorker } from "./fundBirthdayWorker";
import { startFundAnniversaryWorker } from "./fundAnniversaryWorker";
import { startSealedLetterDeliveryWorker } from "./sealedLetterDeliveryWorker";
import { startSponsoredSubscriptionRenewalWorker } from "./sponsoredSubscriptionRenewalWorker";
import { startKidMilestoneWorker } from "./kidMilestoneWorker";
import { startMonthlyPulseWorker } from "./monthlyPulseWorker";
import { startHolidayWarmthWorker } from "./holidayWarmthWorker";
import { startYearEndWrappedWorker } from "./yearEndWrappedWorker";
import { startGifterYearEndWorker } from "./gifterYearEndWorker";
import { startTaxSeasonPrepWorker } from "./taxSeasonPrepWorker";
import { startGifterReturnReminderWorker } from "./gifterReturnReminderWorker";
import { startVolatilityReassuranceWorker } from "./volatilityReassuranceWorker";
import { startPmfSurveyTriggerWorker } from "./pmfSurveyTriggerWorker";
import { startGiftOrphanMonitorWorker } from "./giftOrphanMonitorWorker";
import { registerOGMiddleware } from "./ogMiddleware";
import { users } from "@shared/schema";
import { getConfiguredSuperAdminEmails, getDefaultSuperAdminEmails } from "@shared/adminAccess";
import { buildPlatformReadiness, summarizePlatformReadiness } from "@shared/platformReadiness";
import { US_STATES } from "@shared/utma";
import { inArray, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import net from "net";
import { checkRateLimit } from "./rateLimiter";

const app = express();
const httpServer = createServer(app);
const uploadsPath = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
// SECURITY (PII): /uploads (local-disk dev/fallback path) holds children's
// Memory Book media, child hero photos, and gift media. Some of it is
// INTENTIONALLY public — the child hero photo on the public gift landing page,
// gift media on public success/claim pages, and media embedded in emails (email
// clients can't carry a session cookie). So this path canNOT sit behind
// isAuthenticated without breaking the public gifter loop. The real protection
// is the private-bucket + short-lived signed-URL read path in objectStorage.ts
// (the durable-storage workstream; not yet wired). Until that ships, harden the
// public static handler so kids' media is at least not search-indexed and its
// URLs don't leak via Referer headers.
app.use(
  "/uploads",
  express.static(uploadsPath, {
    index: false,
    // dotfiles "deny" (vs the default "ignore") returns 403 rather than 404
    // for any "/uploads/.something" request — no accidental serving of a
    // stray .env / .git artifact that lands in the dir.
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Robots-Tag", "noindex, noimageindex, nofollow");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Defense-in-depth against same-origin XSS from served content. Uploads
      // are already restricted to raster/AV MIME types at the upload boundary
      // (no SVG/HTML; ext derived from validated MIME), but if anything ever
      // slips through, this CSP sandboxes the response when it's navigated to
      // DIRECTLY as a document (no scripts, opaque origin). It does NOT affect
      // <img>/<video>/<audio> embedding — CSP on a subresource response is
      // ignored for rendering — so the public gifter loop, email media, and
      // Kid View are unaffected.
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox; frame-ancestors 'none'");
    },
  })
);

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
    // Dev-only: allow local device-frame preview tools (Responsively App, and
    // similar) to inject their browser-sync client, which loads from a local
    // https://localhost:<port> origin (the port varies per session) and opens
    // a socket back to it for cross-device mirroring + live reload. Without
    // localhost in script-src, the browser-sync-client.js is refused (it was
    // only in connect-src before). Production never gets any of this — gated on
    // !isProd, same as the vscode-webview frame-ancestors accommodation below.
    scriptSrc.push("http://localhost:*", "https://localhost:*", "http://127.0.0.1:*", "https://127.0.0.1:*");
    connectSrc.push("ws:", "wss:", "http://localhost:*", "https://localhost:*", "http://127.0.0.1:*", "https://127.0.0.1:*");
  }

  // Dev-only: allow the app to be embedded in the VS Code "Mobile Preview"
  // webview, whose framing origin is `vscode-webview://`. Production stays
  // locked to 'self' so the deployed app can never be framed by anyone else.
  const frameAncestors = isProd ? `'self'` : `'self' vscode-webview:`;

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors ${frameAncestors}`,
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
  ];

  // upgrade-insecure-requests would rewrite the dev server's http://localhost
  // navigation to https inside the preview webview and break it. The deployed
  // app is served over https, so production keeps the directive.
  if (isProd) {
    directives.push(`upgrade-insecure-requests`);
  }

  return directives.join("; ");
}

app.use((req, res, next) => {
  res.setHeader("X-DNS-Prefetch-Control", "on");
  // In production, forbid framing outright. In dev we omit X-Frame-Options so
  // the VS Code "Mobile Preview" webview can embed the app — X-Frame-Options
  // has no per-origin allowlist, and Chromium blocks the frame on SAMEORIGIN
  // regardless of CSP. The dev-only `frame-ancestors ... vscode-webview:` above
  // still scopes exactly who may frame it.
  if (process.env.NODE_ENV === "production") {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
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
  // Every PUBLIC, indexable, non-user-scoped page. The satellite SEO surface
  // (comparisons, tools, programmatic state pages) is the gifter-intent funnel
  // — these were built but absent from the sitemap, so search engines weren't
  // told they exist. Private/user-scoped routes stay out (and are also blocked
  // in robots.txt above); orphan/noindex pages (/partners, /demo) stay out by
  // design. See SEO_GTM_STRATEGY.md.
  const routes: Array<{ path: string; changefreq: string; priority: string }> = [
    // Core funnel
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/get-started", changefreq: "weekly", priority: "0.9" },
    { path: "/how-it-works", changefreq: "monthly", priority: "0.8" },
    { path: "/give-a-gift", changefreq: "monthly", priority: "0.8" },
    { path: "/pricing", changefreq: "monthly", priority: "0.7" },
    { path: "/founding-members", changefreq: "monthly", priority: "0.7" },
    { path: "/personal-funds", changefreq: "monthly", priority: "0.6" },
    { path: "/age-18", changefreq: "monthly", priority: "0.6" },
    // Gifter-intent SEO satellites (the strategic core: comparison + tools)
    { path: "/compare", changefreq: "monthly", priority: "0.8" },
    { path: "/tools/at-18-calculator", changefreq: "monthly", priority: "0.8" },
    { path: "/tools/robux-vs-utma", changefreq: "monthly", priority: "0.8" },
    { path: "/tools/trump-account-vs-utma", changefreq: "monthly", priority: "0.8" },
    { path: "/tools/utma-by-state", changefreq: "monthly", priority: "0.7" },
    // Content hubs (children discovered via the hub + entries below)
    { path: "/blog", changefreq: "weekly", priority: "0.6" },
    { path: "/stories", changefreq: "weekly", priority: "0.6" },
    // Trust / info
    { path: "/faq", changefreq: "monthly", priority: "0.7" },
    { path: "/security", changefreq: "monthly", priority: "0.5" },
    { path: "/about", changefreq: "monthly", priority: "0.6" },
    { path: "/contact", changefreq: "monthly", priority: "0.4" },
    { path: "/legal", changefreq: "monthly", priority: "0.4" },
  ];
  // Programmatic: one UTMA page per state. Self-maintaining from shared
  // US_STATES; canonical URL is lowercase (matches UtmaByStateIndex links).
  for (const s of US_STATES) {
    routes.push({ path: `/tools/utma-by-state/${s.code.toLowerCase()}`, changefreq: "monthly", priority: "0.6" });
  }
  // Programmatic: comparison pages. Keep in sync with COMPARISONS in
  // client/src/pages/Compare.tsx (small, stable set).
  const COMPARE_SLUGS = ["earlybird", "acorns-early", "greenlight", "stockpile", "529", "savings-account", "fidelity-utma"];
  for (const slug of COMPARE_SLUGS) {
    routes.push({ path: `/compare/${slug}`, changefreq: "monthly", priority: "0.7" });
  }
  // Blog articles (the gifter-intent SEO clusters — see SEO_CLUSTERS_PLAN.md).
  // Markdown-file-driven; the server bundle can't read the client glob, so keep
  // this in sync with client/src/content/blog/*.md (add a slug when a post ships).
  const BLOG_SLUGS = [
    "best-way-to-invest-birthday-money-for-kids",
    "how-to-ask-family-to-invest-instead-of-buying-toys",
    "how-to-set-up-a-fund-before-your-baby-shower",
    "gifts-for-a-kid-who-has-everything",
    "utma-vs-529-for-family-gifting",
    "earlybird-alternative",
    "utma-financial-aid-fafsa",
  ];
  for (const slug of BLOG_SLUGS) {
    routes.push({ path: `/blog/${slug}`, changefreq: "monthly", priority: "0.6" });
  }
  // Story entries (the occasion-narrative SEO surface). Same markdown-driven,
  // server-can't-read-the-client-glob constraint as BLOG_SLUGS above: keep in
  // sync with client/src/content/stories/*.md (one entry per file; add a slug
  // when a story ships). The /stories hub is listed above; these are its
  // indexable children — both are index,follow in client getSeoForPath, so they
  // belong in the sitemap too (they were previously omitted).
  const STORY_SLUGS = ["emma-birthday-fund", "noah-baby-shower-fund"];
  for (const slug of STORY_SLUGS) {
    routes.push({ path: `/stories/${slug}`, changefreq: "monthly", priority: "0.5" });
  }
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
    // SECURITY (security-audit 2026-05-28): this endpoint is PUBLIC/unauthenticated,
    // so it must NOT enumerate env-var NAMES (architectural reconnaissance — reveals
    // which integrations are wired). `configured` (boolean) is enough for uptime /
    // public readiness. The admin diagnostics panel reads the full per-var detail from
    // the AUTHED /api/admin/integrations endpoint, so dropping envVars here is safe.
    checks: checks.map((check) => ({
      id: check.id,
      label: check.label,
      layer: check.layer,
      status: check.status,
      requiredForLaunch: check.requiredForLaunch,
      configured: check.configured,
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
  // Dev CORS. SECURITY (security-audit 2026-05-28): previously this reflected ANY
  // Origin back WITH Access-Control-Allow-Credentials:true — so a malicious site
  // could make authenticated cross-origin requests against a network-reachable
  // dev/staging server and exfiltrate session-scoped data. Now we only allow the
  // local web client + Expo dev client (localhost, private-LAN IPs for on-device
  // testing, exp://), plus anything explicitly listed in DEV_ALLOWED_ORIGINS
  // (comma-separated — add your Expo tunnel / ngrok URL here if you use one).
  const extraOrigins = String(process.env.DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isAllowedDevOrigin = (origin: string | undefined): boolean => {
    if (!origin) return false;
    if (extraOrigins.includes(origin)) return true;
    if (/^exp:\/\//i.test(origin)) return true;
    try {
      const host = new URL(origin).hostname;
      if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") return true;
      // Private LAN ranges (Expo device-on-LAN testing against the dev server).
      if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    } catch {
      /* malformed Origin — deny */
    }
    return false;
  };
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isAllowedDevOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin as string);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    // X-Kiddo-Device-Id: the mobile app (and its web preview) sends this on every
    // request for trusted-device pairing; without it in the allowlist the CORS
    // preflight rejects EVERY request ("x-kiddo-device-id is not allowed") → no
    // data, no auth on the web preview. Authorization is already allowed (the
    // mobile Bearer token). 2026-06-02.
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,Cookie,X-Requested-With,X-Kiddo-Device-Id");
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
    // The deep variant exposes secret-presence/readiness detail. Smoke/deploy
    // scripts hit ?deep=1 UNAUTHENTICATED and require HTTP 200, so we keep the
    // route open and 200 for everyone — but only AUTHENTICATED ADMINS get the
    // detailed payload; everyone else gets the minimal liveness body.
    let isAdminCaller = false;
    try {
      const sessionUser =
        (req as any).user ?? (req as any).session?.user;
      isAdminCaller = Boolean(
        sessionUser?.isAdmin || sessionUser?.isSuperAdmin,
      );
    } catch {
      isAdminCaller = false;
    }
    if (!isAdminCaller) {
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
app.get("/api/health/deep", async (req, res) => {
  const base = {
    ok: true,
    status: "ok",
    timestamp: Date.now(),
    uptimeSec: Math.round(process.uptime()),
  };
  try {
    await pool.query("select 1");
    // Only AUTHENTICATED ADMINS get the secret-presence/readiness detail;
    // everyone else gets the minimal liveness body. Always 200 (smoke/deploy
    // scripts hit this unauthenticated and require 200).
    let isAdminCaller = false;
    try {
      const sessionUser =
        (req as any).user ?? (req as any).session?.user;
      isAdminCaller = Boolean(
        sessionUser?.isAdmin || sessionUser?.isSuperAdmin,
      );
    } catch {
      isAdminCaller = false;
    }
    if (!isAdminCaller) {
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
  // Kid-View PIN unlock: the share link is meant to be handed to the child,
  // so anyone holding it could brute-force a short PIN (10k candidates for 4
  // digits) and mint an access token that drives a permanent custodial
  // ownership transfer at majority. Cap unlock attempts hard.
  { name: "kid-view-unlock", methods: ["POST"], match: /^\/api\/kid-view\/[^/]+\/unlock$/, max: 8, windowMs: 15 * 60 * 1000 },
  // Public gift-fund fetch: the slug is a guessable child-name (slugify(name),
  // no token — see routes.ts:7186) and the response carries the child's first
  // name + photo. noindex blocks search discovery but NOT enumeration; the
  // limiter keys per-IP across the whole rule (not per-slug), so one source
  // can't sweep the slug space to harvest kids. Tuned GENEROUS on purpose — this
  // is the gifter conversion surface, and a false 429 is a lost gift — but still
  // far below a dictionary sweep. (Guessing ONE known name is a single request;
  // that targeted case is the photo-gating decision held for counsel, not this.)
  { name: "public-fund-view", methods: ["GET"], match: /^\/api\/public\/funds\/[^/]+$/, max: 60, windowMs: 10 * 60 * 1000 },
];

// Durable (cross-instance) rate limiter — see server/rateLimiter.ts. Backed by
// Postgres so a multi-instance deploy shares one window instead of N; fails
// OPEN to an in-memory fallback if the DB is unavailable, so a DB hiccup never
// blocks auth/checkout. Middleware is async; on any limiter error we let the
// request through rather than risk locking users out.
app.use(async (req, res, next) => {
  const rule = rateLimitRules.find((r) => {
    if (r.methods && !r.methods.includes(req.method.toUpperCase())) return false;
    return r.match.test(req.path);
  });
  if (!rule) return next();

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${rule.name}:${req.method}:${ip}`;
  try {
    const allowed = await checkRateLimit(key, rule.max, rule.windowMs);
    if (!allowed) {
      return res.status(429).json({
        error: "Too many requests. Please try again shortly.",
      });
    }
  } catch {
    // Never block the request path on a limiter failure.
  }
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
      // SECURITY: the response body routinely contains PII — children's
      // first names + birthdates + photo URLs (dashboard-summary), gifter
      // emails/messages, KYC echoes. safeJsonPreview does NO key redaction,
      // so logging it in prod writes minors' data + third-party emails into
      // stdout/log aggregation in plaintext (GDPR/CCPA/COPPA-relevant). Only
      // attach the body preview in non-prod where logs are local + ephemeral.
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
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
  startStalledHandoffWorker(log);
  startDemoResetWorker(log);
  startPostHandoffEngagementWorker(log);
  startAccountDeletionWorker(log);
  startGiftIntentExpiryWorker(log);
  startGiftOrphanMonitorWorker(log);
  startFundBirthdayWorker(log);
  startFundAnniversaryWorker(log);
  startSealedLetterDeliveryWorker(log);
  startSponsoredSubscriptionRenewalWorker(log);
  startKidMilestoneWorker(log);
  startMonthlyPulseWorker(log);
  startHolidayWarmthWorker(log);
  startYearEndWrappedWorker(log);
  startGifterYearEndWorker(log);
  startTaxSeasonPrepWorker(log);
  startGifterReturnReminderWorker(log);
  startVolatilityReassuranceWorker(log);
  startPmfSurveyTriggerWorker(log);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Client-aborted or reset connections are not server faults. The peer went
    // away mid-request (closed tab, HMR reload, flaky mobile link, proxy
    // timeout), so don't surface them as 500s, don't page ops, and don't try
    // to write to a socket that's already gone (that throws write-after-end).
    const code = err?.code;
    const clientAbort =
      code === "ECONNRESET" ||
      code === "ECONNABORTED" ||
      code === "EPIPE" ||
      err?.type === "request.aborted" ||
      _req.aborted === true;
    if (clientAbort || res.headersSent || res.writableEnded) {
      // Nothing safe to send; let the socket close. (next() would re-enter the
      // default handler and also fail on a dead socket.)
      return;
    }

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
