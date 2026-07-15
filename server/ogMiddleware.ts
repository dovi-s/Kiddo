import { type Express } from "express";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "./db";
import { funds, events } from "@shared/schema";
import { BRICOLAGE_BOLD_B64 } from "./ogFont";

const SCRAPER_RE = /facebookexternalhit|facebookbot|twitterbot|whatsapp|slackbot|linkedinbot|discordbot|telegrambot|iMessage|Googlebot-Image|Pinterest|Embedly|Flipboard|Baiduspider|vkShare/i;

function isScraper(ua: string): boolean {
  return SCRAPER_RE.test(ua);
}

// Babylist's "Add Any Item" scrapes a URL's OG tags to build the registry tile.
// Their bot is NOT in SCRAPER_RE above, so without this a Kiddo gift link added
// to a Babylist registry falls back to the generic default index.html meta (a
// bland/empty tile). `babylist` is a BEST-GUESS token — VERIFY it: add a gift
// link to a test Babylist registry, grep server logs for the user-agent that
// hits `/:fundSlug`, and replace this with the exact string. (If Babylist
// fetches via Embedly, that's already matched in SCRAPER_RE and this is a
// harmless no-op.) Kept separate from SCRAPER_RE so the registry-tuned tile
// copy below can branch on it without affecting social-share previews.
const BABYLIST_UA = /babylist/i;

function isBabylistScraper(ua: string): boolean {
  return BABYLIST_UA.test(ua);
}

// Paths that are definitely app routes, not fund slugs
const APP_PATH_PREFIXES = new Set([
  "api", "dashboard", "settings", "account", "login", "register",
  "onboard", "gift", "claim", "legal", "security", "faq",
  "memory-book", "events", "activity", "send", "age-18", "age18",
  "get-started", "about", "how-it-works", "compare", "home",
  "upgrade", "invite", "admin", "uploads", "_vite", "assets",
]);

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function roundedCount(n: number): string {
  if (n < 50) return "thousands of";
  if (n < 1000) return `${Math.floor(n / 50) * 50}+`;
  const k = n / 1000;
  return `${parseFloat(k.toFixed(1)).toString()}k+`;
}

let cachedFamilyCount: { value: number; ts: number } | null = null;

async function getFamilyCount(): Promise<number> {
  const now = Date.now();
  if (cachedFamilyCount && now - cachedFamilyCount.ts < 60_000) {
    return cachedFamilyCount.value;
  }
  try {
    const [row] = await db.select({ count: sql<string>`count(*)` }).from(funds);
    const value = parseInt(row?.count ?? "0", 10);
    cachedFamilyCount = { value, ts: now };
    return value;
  } catch {
    return cachedFamilyCount?.value ?? 0;
  }
}

// ── Dynamic per-fund OG image ────────────────────────────────────────────────
// Renders a 1200x630 PNG card personalized to the child ("Gift {name}'s
// future.") in the real brand font, so a shared gift link shows the child's name
// ON the preview image, not only in the (already per-fund) OG title. sharp
// rasterizes an SVG with the Bricolage Bold font embedded (base64, deploy-safe).
// Cached in-memory per slug; on ANY failure the endpoint falls back to the
// static brand card so a scraper never gets a broken image.
const OG_IMAGE_TTL_MS = 60 * 60 * 1000;
const ogImageCache = new Map<string, { buf: Buffer; ts: number }>();

function escSvg(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildFundOgSvg(childName: string): string {
  const headline = `Gift ${escSvg(childName)}'s future.`;
  // Down-size the headline for long names so it never overflows 1200px.
  const size = headline.length > 22 ? 84 : headline.length > 17 ? 100 : 116;
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face { font-family: 'BrandHead'; font-weight: 700; src: url(data:font/truetype;charset=utf-8;base64,${BRICOLAGE_BOLD_B64}); }
      /* MUST request weight 700: librsvg registers the embedded TTF at its
         intrinsic weight (Bold) and falls back to a system font for a 400
         request, so every text element below inherits font-weight:700. */
      .t { font-family: 'BrandHead', sans-serif; font-weight: 700; }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FBF9F5"/><stop offset="0.55" stop-color="#F8F5F0"/><stop offset="1" stop-color="#F3EFE7"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.88" cy="-0.1" r="0.6">
      <stop offset="0" stop-color="rgba(197,130,30,0.12)"/><stop offset="1" stop-color="rgba(197,130,30,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <text x="80" y="118" class="t" font-size="30" letter-spacing="6" fill="#1B3A2D" opacity="0.85">KIDDO</text>
  <text x="80" y="320" class="t" font-size="${size}" fill="#1B3A2D">${headline}</text>
  <rect x="82" y="356" width="92" height="6" rx="3" fill="#C5821E"/>
  <text x="80" y="430" class="t" font-size="38" fill="rgba(26,23,16,0.55)">A real investment gift that grows with them.</text>
  <text x="80" y="582" class="t" font-size="24" fill="rgba(26,23,16,0.45)">getkiddo · invest in a child's future</text>
</svg>`;
}

async function renderFundOgPng(slug: string, childName: string): Promise<Buffer> {
  const cached = ogImageCache.get(slug);
  if (cached && Date.now() - cached.ts < OG_IMAGE_TTL_MS) return cached.buf;
  const buf = await sharp(Buffer.from(buildFundOgSvg(childName))).png().toBuffer();
  ogImageCache.set(slug, { buf, ts: Date.now() });
  return buf;
}

export function registerOGMiddleware(app: Express) {
  // Dynamic per-fund preview image. 4-segment path can't collide with the
  // catch-all `/:fundSlug/:eventSlug?` below. Falls back to the static card.
  app.get("/og/fund/:slug/card.png", async (req, res) => {
    try {
      const [fund] = await db
        .select({ recipientFirstName: funds.recipientFirstName })
        .from(funds)
        .where(eq(funds.slug, req.params.slug))
        .limit(1);
      if (!fund) return res.redirect(302, "/kiddo-og-image.png");
      const child = (fund.recipientFirstName || "").trim() || "a child";
      const png = await renderFundOgPng(req.params.slug, child);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-Robots-Tag", "noindex");
      return res.end(png);
    } catch {
      return res.redirect(302, "/kiddo-og-image.png");
    }
  });

  app.get("/:fundSlug/:eventSlug?", async (req, res, next) => {
    try {
      const ua = req.headers["user-agent"] || "";
      if (!isScraper(ua) && !isBabylistScraper(ua)) return next();

      const { fundSlug, eventSlug } = req.params;

      // Skip anything that looks like a file, an API call, or a known app route
      if (
        fundSlug.includes(".") ||
        APP_PATH_PREFIXES.has(fundSlug.toLowerCase()) ||
        req.path.startsWith("/api/")
      ) {
        return next();
      }

      const [fund] = await db
        .select({ id: funds.id, recipientFirstName: funds.recipientFirstName, slug: funds.slug })
        .from(funds)
        .where(eq(funds.slug, fundSlug))
        .limit(1);

      if (!fund) return next();

      let eventName: string | null = null;
      if (eventSlug) {
        const [ev] = await db
          .select({ name: events.name })
          .from(events)
          .where(eq(events.slug, eventSlug))
          .limit(1);
        if (ev) eventName = ev.name;
      }

      const familyCount = await getFamilyCount();
      const child = fund.recipientFirstName || "a child";
      const fromBabylist = isBabylistScraper(ua);

      // Babylist renders this as a giftABLE tile in a grid next to physical
      // products, so lead with the product + the differentiators (grows for
      // life, no account needed, video memory). Social shares (Facebook,
      // WhatsApp, iMessage, ...) keep the existing "Gift {child}'s future"
      // framing, which is tuned for a feed/chat context, not a registry.
      const title = fromBabylist
        ? `Invest in ${child}'s future, a gift that grows 🌱`
        : eventName
          ? `${eventName}: Gift ${child}'s future 🎁`
          : `Gift ${child}'s future. 🌱`;

      const desc = fromBabylist
        ? `Instead of something they'll outgrow, give ${child} a real investment that grows with them for life. About a minute, no account needed, and you can add a video message they'll keep.`
        : `Join ${roundedCount(familyCount)} families investing in their children's futures. ${child}'s fund is live. Send a real investment gift in under a minute.`;

      const origin = `${req.protocol}://${req.get("host")}`;
      const pageUrl = `${origin}${req.path}`;
      // Per-fund dynamic card (child's name ON the image). Endpoint falls back
      // to the static brand card if rendering fails, so this is always safe.
      const image = `${origin}/og/fund/${encodeURIComponent(fundSlug)}/card.png`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      // A child's fund/gift page is PRIVATE — its OG title carries the child's
      // first name. It's meant to be shared via a private link, never crawled
      // into a search index. Belt-and-suspenders: header + meta. (This branch
      // only ever serves real fund slugs, so it can't de-index marketing.)
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escHtml(title)}</title>
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escHtml(pageUrl)}" />
  <meta property="og:site_name" content="Kiddo" />
  <meta property="og:image" content="${escHtml(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(desc)}" />
  <meta name="twitter:image" content="${escHtml(image)}" />
</head>
<body>
  <script>window.location.replace(${JSON.stringify(pageUrl)});</script>
</body>
</html>`);
    } catch {
      next();
    }
  });
}
