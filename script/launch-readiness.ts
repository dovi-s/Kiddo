/* eslint-disable no-console */
import "dotenv/config";
import pg from "pg";
import Stripe from "stripe";
import { buildPlatformReadiness } from "@shared/platformReadiness";

const { Pool } = pg;
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000";

type CheckResult = { name: string; ok: boolean; detail?: string; required?: boolean };

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

function ok(name: string, detail?: string, required = true): CheckResult {
  return { name, ok: true, detail, required };
}

function fail(name: string, detail?: string, required = true): CheckResult {
  return { name, ok: false, detail, required };
}

async function run() {
  const results: CheckResult[] = [];
  const pool = new Pool({
    connectionString: getConnectionString(),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  });

  try {
    // 1) App health
    try {
      const [h, d] = await Promise.all([
        fetch(`${baseUrl}/api/health`),
        fetch(`${baseUrl}/api/health?deep=1`),
      ]);
      results.push(h.ok ? ok("API health", `${h.status}`) : fail("API health", `${h.status}`));
      results.push(d.ok ? ok("API deep health", `${d.status}`) : fail("API deep health", `${d.status}`));
    } catch (e: any) {
      results.push(fail("API health", e?.message || "unreachable"));
      results.push(fail("API deep health", e?.message || "unreachable"));
    }

    // 2) Stripe config and reachability
    const secret = process.env.STRIPE_SECRET_KEY || "";
    const pub = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
    if (!secret || !pub) {
      results.push(fail("Stripe keys configured", "missing STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY"));
    } else {
      results.push(ok("Stripe keys configured", `${secret.slice(0, 7)} / ${pub.slice(0, 7)}`));
      try {
        const stripe = new Stripe(secret, { apiVersion: "2025-11-17.clover" });
        const [acct, prices] = await Promise.all([
          stripe.accounts.retrieve(),
          stripe.prices.list({ active: true, limit: 50 }),
        ]);
        results.push(ok("Stripe reachability", acct.id));

        const byName = new Set<string>();
        for (const p of prices.data) {
          let productName = "";
          if (typeof p.product !== "string") {
            productName = p.product?.name || "";
          }
          if (!productName) {
            try {
              const prodId = typeof p.product === "string" ? p.product : p.product?.id;
              if (prodId) {
                const prod = await stripe.products.retrieve(prodId);
                productName = prod.name || "";
              }
            } catch {
              // ignore per-product read errors
            }
          }
          if (productName) byName.add(productName);
        }

        const requiredProducts = ["Kiddo Plus", "Kiddo Family", "Kiddo Occasions"];
        for (const rp of requiredProducts) {
          results.push(byName.has(rp) ? ok(`Stripe product: ${rp}`) : fail(`Stripe product: ${rp}`, "not found among active prices"));
        }
      } catch (e: any) {
        results.push(fail("Stripe reachability", e?.message || "failed"));
      }
    }

    // 2b) Core external provider configuration
    const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
    results.push(sessionSecret ? ok("Session secret configured") : fail("Session secret configured", "missing SESSION_SECRET"));

    const oauthGoogle = Boolean(String(process.env.GOOGLE_CLIENT_ID || "").trim() && String(process.env.GOOGLE_CLIENT_SECRET || "").trim());
    const oauthApple = Boolean(String(process.env.APPLE_CLIENT_ID || "").trim() && String(process.env.APPLE_CLIENT_SECRET || "").trim());
    results.push(
      oauthGoogle || oauthApple
        ? ok("At least one OAuth provider configured", `google=${oauthGoogle} apple=${oauthApple}`)
        : fail("At least one OAuth provider configured", "missing Google and Apple OAuth credentials"),
    );

    const espConfigured = Boolean(String(process.env.POSTMARK_SERVER_TOKEN || "").trim() || String(process.env.SENDGRID_API_KEY || "").trim());
    results.push(
      espConfigured
        ? ok("ESP configured", String(process.env.POSTMARK_SERVER_TOKEN || "").trim() ? "postmark" : "sendgrid")
        : fail("ESP configured", "missing POSTMARK_SERVER_TOKEN and SENDGRID_API_KEY"),
    );

    const platformReadiness = buildPlatformReadiness(process.env);
    for (const check of platformReadiness) {
      if (["postgres", "session-secret", "stripe", "email"].includes(check.id)) continue;
      const detail = check.configured
        ? `${check.status}`
        : `missing ${check.envVars.join(", ")}`;
      results.push(check.configured ? ok(`Stack: ${check.label}`, detail, check.requiredForLaunch) : fail(`Stack: ${check.label}`, detail, check.requiredForLaunch));
    }

    const founderPhoto = String(process.env.VITE_FOUNDER_PHOTO_URL || "").trim();
    const founderVideo = String(process.env.VITE_FOUNDER_VIDEO_URL || "").trim();
    results.push(
      founderPhoto
        ? ok("Founder photo asset configured", founderPhoto, false)
        : fail("Founder photo asset configured", "set VITE_FOUNDER_PHOTO_URL when the asset exists", false),
    );
    results.push(
      founderVideo
        ? ok("Founder video asset configured", founderVideo, false)
        : fail("Founder video asset configured", "set VITE_FOUNDER_VIDEO_URL when the asset exists", false),
    );

    const pipAnimationConfigured = Boolean(
      String(process.env.VITE_PIP_DEFAULT_ANIMATION_URL || "").trim() ||
      String(process.env.VITE_PIP_PLANTING_ANIMATION_URL || "").trim(),
    );
    results.push(
      pipAnimationConfigured
        ? ok("Pip animation asset configured", "animation URL present", false)
        : fail("Pip animation asset configured", "static mascot fallback will be used until animation assets exist", false),
    );

    // 3) Data integrity
    try {
      const integrity = await pool.query(`
        WITH draft_funds_with_gifts AS (
          SELECT COUNT(*)::int AS total
          FROM funds f
          WHERE f.status = 'draft'
            AND EXISTS (SELECT 1 FROM gifts g WHERE g.fund_id = f.id)
        ),
        gifts_without_memory AS (
          SELECT COUNT(*)::int AS total
          FROM gifts g
          LEFT JOIN memory_entries m ON m.gift_id = g.id
          WHERE m.id IS NULL
        ),
        gifts_without_thankyou AS (
          SELECT COUNT(*)::int AS total
          FROM gifts g
          LEFT JOIN thank_yous t ON t.gift_id = g.id
          WHERE t.id IS NULL
        ),
        gift_tx_without_gift AS (
          SELECT COUNT(*)::int AS total
          FROM transactions t
          LEFT JOIN gifts g ON g.stripe_payment_intent_id = t.stripe_payment_intent_id
          WHERE t.type = 'gift'
            AND t.status = 'completed'
            AND g.id IS NULL
        )
        SELECT
          (SELECT total FROM draft_funds_with_gifts) AS draft_funds_with_gifts,
          (SELECT total FROM gifts_without_memory) AS gifts_without_memory,
          (SELECT total FROM gifts_without_thankyou) AS gifts_without_thankyou,
          (SELECT total FROM gift_tx_without_gift) AS gift_tx_without_gift
      `);
      const row = integrity.rows?.[0] || {};
      const badDraft = Number(row.draft_funds_with_gifts || 0);
      const noMem = Number(row.gifts_without_memory || 0);
      const noTy = Number(row.gifts_without_thankyou || 0);
      const txNoGift = Number(row.gift_tx_without_gift || 0);
      results.push(badDraft === 0 ? ok("No draft funds with gifts") : fail("No draft funds with gifts", `${badDraft} found`));
      results.push(noMem === 0 ? ok("All gifts have memory entries") : fail("All gifts have memory entries", `${noMem} missing`));
      results.push(noTy === 0 ? ok("All gifts have thank-you drafts") : fail("All gifts have thank-you drafts", `${noTy} missing`));
      results.push(txNoGift === 0 ? ok("No orphan gift transactions") : fail("No orphan gift transactions", `${txNoGift} found`));
    } catch (e: any) {
      results.push(fail("Data integrity checks", e?.message || "failed"));
    }

    // 4) Checkout path validation (session URL creation)
    try {
      const target = await pool.query(`
        SELECT f.id AS fund_id, e.id AS event_id
        FROM funds f
        LEFT JOIN events e ON e.fund_id = f.id AND e.status = 'active'
        ORDER BY f.created_at DESC
        LIMIT 1
      `);
      const fundId = target.rows?.[0]?.fund_id;
      const eventId = target.rows?.[0]?.event_id || undefined;
      if (!fundId) {
        results.push(fail("Gift checkout endpoint", "no fund found in DB"));
      } else {
        const body = {
          fundId,
          eventId,
          amount: 18,
          senderName: "Launch Readiness",
          senderEmail: "launch.readiness@example.com",
          coverFees: true,
          paymentMethod: "card",
          executionModel: "pick",
          selectedTicker: "NKE",
        };
        const res = await fetch(`${baseUrl}/api/stripe/checkout/gift`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.url && data?.sessionId) {
          results.push(ok("Gift checkout endpoint", data.sessionId));
        } else {
          const detail = data?.error || data?.message || `HTTP ${res.status}`;
          results.push(fail("Gift checkout endpoint", detail));
        }
      }
    } catch (e: any) {
      results.push(fail("Gift checkout endpoint", e?.message || "failed"));
    }

    // Final report
    const requiredFailures = results.filter((r) => r.required !== false && !r.ok);
    const advisoryFailures = results.filter((r) => r.required === false && !r.ok);
    console.log("Launch Readiness Report");
    for (const r of results) {
      const label = r.ok ? "PASS" : r.required === false ? "WARN" : "FAIL";
      console.log(`${label}  ${r.name}${r.detail ? ` :: ${r.detail}` : ""}`);
    }
    console.log(`\nSummary: ${results.length - requiredFailures.length - advisoryFailures.length}/${results.length} checks passing cleanly`);
    if (advisoryFailures.length > 0) {
      console.log(`Advisories: ${advisoryFailures.length}`);
    }
    if (requiredFailures.length > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Launch readiness failed:", err?.message || err);
  process.exit(1);
});
