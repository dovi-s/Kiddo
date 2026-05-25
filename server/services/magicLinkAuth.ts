// Magic-link auth service — shared between the route handlers in auth.ts
// and the webhook handler that fires after a gifter-recurring Stripe
// checkout completes.
//
// Per project_recurring_gifting_without_password_spec.md (locked 2026-05-25).
// Backs the team-audit conversion #1 experiment: drop password collection
// from the gifter-recurring flow; replace with passwordless auth via
// emailed magic links.
//
// Two entry points:
//   - issueGifterMagicLink({...}) — mint a token, store SHA-256 hash,
//     send the email. Called by both the welcome-after-checkout webhook
//     and the /api/auth/magic-link/request route.
//   - consumeMagicLinkToken(rawToken, req) — validate + mark used.
//     Called by /api/auth/magic-link/verify.
//
// Discipline (mirrors password_resets):
//   - Raw 32-byte hex token in the email; SHA-256 hash in DB.
//   - 15-minute TTL (short — most legit clicks happen <1 min).
//   - Single-use (usedAt set on first verify).
//   - Anti-enumeration on the request route (always 200).
//   - Rate-limit 5/email/hour at the route handler (in-process Map,
//     matches the LOGIN_ATTEMPT_WINDOW_MS pattern in auth.ts).
//
// Feature flag: MAGIC_LINK_GIFTER_AUTH must be 'true' (case-insensitive)
// to enable both the request route AND the gift-recurring endpoint's
// password-drop behavior. The webhook handler ALWAYS sends the welcome
// email when present, so that no gifter is left without an auth method
// even mid-rollout. The flag-checking helper isMagicLinkAuthEnabled()
// is exported so call sites can branch without re-reading the env.

import crypto from "crypto";
import type { Request } from "express";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { magicLinkTokens } from "@shared/models/auth";
import { sendEmail } from "../emailDelivery";
import { buildGifterMagicLinkEmail, type GifterMagicLinkInput } from "../templates/gifterMagicLink";

const MAGIC_LINK_TOKEN_BYTES = 32;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

// Rate limiter: 5 requests per email per hour. In-process Map, same
// pattern as the LOGIN_ATTEMPT_WINDOW_MS limiter. Resets across server
// restarts which is acceptable for soft enumeration mitigation.
const MAGIC_LINK_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAGIC_LINK_REQUEST_MAX = 5;
const magicLinkRateStore = new Map<string, { count: number; windowStart: number }>();

export function isMagicLinkAuthEnabled(): boolean {
  return String(process.env.MAGIC_LINK_GIFTER_AUTH || "").trim().toLowerCase() === "true";
}

function hashMagicLinkToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function getBaseUrl(): string {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "https://kiddofund.com";
}

export function checkMagicLinkRateLimit(email: string): { allowed: boolean; retryAfterMs?: number } {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const existing = magicLinkRateStore.get(key);
  if (!existing || existing.windowStart + MAGIC_LINK_REQUEST_WINDOW_MS < now) {
    magicLinkRateStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (existing.count >= MAGIC_LINK_REQUEST_MAX) {
    return { allowed: false, retryAfterMs: existing.windowStart + MAGIC_LINK_REQUEST_WINDOW_MS - now };
  }
  magicLinkRateStore.set(key, { count: existing.count + 1, windowStart: existing.windowStart });
  return { allowed: true };
}

export type IssueMagicLinkInput = {
  userId: string;
  email: string;
  intent: "gifter_welcome" | "gifter_relogin";
  firstName?: string | null;
  giftSummary?: GifterMagicLinkInput["giftSummary"];
  // Optional forensic context. Pass `req` from the route handler;
  // the webhook handler passes nulls.
  req?: Request | null;
};

// Mint a token, persist the hash, send the email. On success returns
// the row id and the raw token (for tests / smoke-script verification).
// Throws on DB or email-send failure — caller decides whether to swallow.
//
// IMPORTANT: in production code paths, callers should ALWAYS swallow
// send failures (anti-enumeration discipline + don't block the parent
// checkout success on email delivery). The webhook handler logs +
// continues; the request route returns 200 regardless.
export async function issueGifterMagicLink(input: IssueMagicLinkInput): Promise<{ tokenId: string; rawToken: string; linkUrl: string }> {
  const { userId, email, intent, firstName, giftSummary, req } = input;
  const rawToken = crypto.randomBytes(MAGIC_LINK_TOKEN_BYTES).toString("hex");
  const tokenHash = hashMagicLinkToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  const rawIp = req
    ? ((req.headers["x-forwarded-for"] as string | undefined) || req.ip || "").toString().split(",")[0]?.trim() || null
    : null;
  const rawUa = req ? (req.get("user-agent") || "").slice(0, 512) || null : null;

  const inserted = await db
    .insert(magicLinkTokens)
    .values({
      userId,
      tokenHash,
      intent,
      expiresAt,
      requestIp: rawIp,
      requestUserAgent: rawUa,
    })
    .returning({ id: magicLinkTokens.id });

  const linkUrl = `${getBaseUrl()}/auth/magic?token=${encodeURIComponent(rawToken)}`;

  await sendEmail(
    buildGifterMagicLinkEmail({
      to: email,
      linkUrl,
      intent,
      firstName: firstName ?? null,
      giftSummary: giftSummary ?? null,
    }),
  );

  return { tokenId: inserted[0].id, rawToken, linkUrl };
}

export type ConsumedMagicLinkRow = {
  id: string;
  userId: string;
  intent: string;
};

// Validate the raw token. Returns the row to consume if valid; returns
// null for ANY failure (anti-enumeration). The route handler should NOT
// distinguish "token expired" vs "token used" vs "token doesn't exist"
// in the user-facing response — all three return the same generic
// "Sign-in link expired or already used. We sent a fresh one if your
// email is on file" message.
//
// On success the token row's usedAt is set BEFORE the function returns.
// This is intentionally inside the same function so the success path
// is atomic from the route handler's perspective — no chance of a
// race where two browser windows both succeed.
export async function consumeMagicLinkToken(rawToken: string): Promise<ConsumedMagicLinkRow | null> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 256) return null;
  const tokenHash = hashMagicLinkToken(rawToken);
  const rows = await db
    .select({
      id: magicLinkTokens.id,
      userId: magicLinkTokens.userId,
      intent: magicLinkTokens.intent,
    })
    .from(magicLinkTokens)
    .where(
      and(
        eq(magicLinkTokens.tokenHash, tokenHash),
        isNull(magicLinkTokens.usedAt),
        gt(magicLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  // Stamp usedAt atomically. If a competing request already consumed
  // the token between our SELECT and UPDATE, the WHERE clause filters
  // out the row (we re-check isNull(usedAt) here) and rowCount is 0.
  const updated = await db
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(magicLinkTokens.id, row.id), isNull(magicLinkTokens.usedAt)))
    .returning({ id: magicLinkTokens.id });
  if (updated.length === 0) return null; // raced.
  return row;
}
