import { type Express } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { funds, events } from "@shared/schema";

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

export function registerOGMiddleware(app: Express) {
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
      const image = `${origin}/kiddo-og-image.png`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
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
