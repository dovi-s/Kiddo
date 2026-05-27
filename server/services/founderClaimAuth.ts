// Founder claim-token service — backs the founding-member launch claim flow.
//
// Per project_founding_member_claim_flow_spec.md (Days 2-3), decisions locked
// 2026-05-26: founders claim passwordless via a magic-link-style token (one
// auth system, no founder password storage). This is a SIBLING token type to
// server/services/magicLinkAuth.ts, not a new auth system — same discipline:
//
//   - 32-byte raw hex token in the URL; SHA-256(token) stored in
//     founding_members.claim_token. The raw token is NEVER persisted.
//   - 30-DAY TTL (founders may redeem the launch email days later — far longer
//     than magic-link's 15 min, by design). Stored in claim_token_expires_at.
//   - Single-use: claimedAt is stamped + claim_token cleared on completion,
//     with an atomic re-check that prevents a double-claim race.
//   - Anti-enumeration: issue returns null (not an error) for an unknown or
//     already-claimed email; the request ROUTE returns 200 regardless so the
//     response never reveals whether an email is in the founders table.
//
// Entry points:
//   - issueFounderClaimToken(email)   — mint/re-issue a token for an UNCLAIMED
//     founder. Re-issuing invalidates the prior token (overwrites hash+expiry).
//   - verifyFounderClaimToken(token)  — read-only validate (the landing page
//     calls this to render "Welcome, founder #N"). Does NOT consume.
//   - completeFounderClaim(token, userId) — consume: link the founder row to a
//     user, stamp claimedAt, clear the token, set users.founderTier.

import crypto from "crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "../db";
import { foundingMembers, users } from "@shared/models/auth";

const FOUNDER_CLAIM_TOKEN_BYTES = 32;
// 30 days. Founders act on a launch-announcement email, not a just-clicked
// flow, so the window is generous. Expired tokens are re-issuable via Path B.
const FOUNDER_CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashClaimToken(rawToken: string): string {
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

export type IssuedFounderClaim = {
  rawToken: string;
  linkUrl: string;
  position: number;
  firstName: string;
  email: string;
};

// Mint (or re-issue) a claim token for an UNCLAIMED founder, looked up by
// email. Returns null when no unclaimed founder row matches — the caller still
// returns 200 (anti-enumeration). Re-issuing overwrites the prior hash+expiry,
// invalidating any earlier link. The raw token is returned ONLY to the caller
// (which emails it); it is never stored.
export async function issueFounderClaimToken(email: string): Promise<IssuedFounderClaim | null> {
  const canonical = String(email || "").trim().toLowerCase();
  if (!canonical) return null;

  const [founder] = await db
    .select({
      id: foundingMembers.id,
      firstName: foundingMembers.firstName,
      position: foundingMembers.position,
      claimedAt: foundingMembers.claimedAt,
    })
    .from(foundingMembers)
    .where(eq(foundingMembers.email, canonical))
    .limit(1);

  // Not a founder, or already claimed → no token (anti-enumeration at the route).
  if (!founder || founder.claimedAt) return null;

  const rawToken = crypto.randomBytes(FOUNDER_CLAIM_TOKEN_BYTES).toString("hex");
  const tokenHash = hashClaimToken(rawToken);
  const expiresAt = new Date(Date.now() + FOUNDER_CLAIM_TTL_MS);

  await db
    .update(foundingMembers)
    .set({ claimToken: tokenHash, claimTokenExpiresAt: expiresAt })
    .where(eq(foundingMembers.id, founder.id));

  return {
    rawToken,
    linkUrl: `${getBaseUrl()}/founder-claim/${encodeURIComponent(rawToken)}`,
    position: founder.position,
    firstName: founder.firstName,
    email: canonical,
  };
}

export type VerifiedFounder = {
  id: string;
  email: string;
  firstName: string;
  position: number;
  giftedBy: string | null;
};

// Validate a raw claim token WITHOUT consuming it. The landing page calls this
// to render "Welcome, founder #N". Returns null for ANY failure (expired /
// already claimed / unknown) — the caller must not distinguish them in the
// user-facing response.
export async function verifyFounderClaimToken(rawToken: string): Promise<VerifiedFounder | null> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 256) return null;
  const tokenHash = hashClaimToken(rawToken);

  const [row] = await db
    .select({
      id: foundingMembers.id,
      email: foundingMembers.email,
      firstName: foundingMembers.firstName,
      position: foundingMembers.position,
      giftedBy: foundingMembers.giftedBy,
    })
    .from(foundingMembers)
    .where(
      and(
        eq(foundingMembers.claimToken, tokenHash),
        isNull(foundingMembers.claimedAt),
        gt(foundingMembers.claimTokenExpiresAt, new Date()),
      ),
    )
    .limit(1);

  return row ?? null;
}

// Consume the token: link the founder row to a user, stamp claimedAt, clear the
// token (single-use), and set the user's founderTier entitlement. The WHERE
// re-checks isNull(claimedAt) + unexpired so two concurrent completions can't
// both win (the second's UPDATE matches 0 rows). Returns false if the token was
// already claimed / expired / unknown (the row didn't update).
export async function completeFounderClaim(rawToken: string, userId: string): Promise<boolean> {
  if (!rawToken || !userId) return false;
  const tokenHash = hashClaimToken(rawToken);

  const updated = await db
    .update(foundingMembers)
    .set({ claimedAt: new Date(), claimedUserId: userId, claimToken: null })
    .where(
      and(
        eq(foundingMembers.claimToken, tokenHash),
        isNull(foundingMembers.claimedAt),
        gt(foundingMembers.claimTokenExpiresAt, new Date()),
      ),
    )
    .returning({ id: foundingMembers.id });

  if (updated.length === 0) return false; // already claimed / expired / raced

  // Stamp the entitlement. 'plus_founder' = the locked $19/yr Plus tier; the
  // Stripe price lookup + badge + early-access cohort all key off this.
  await db.update(users).set({ founderTier: "plus_founder" }).where(eq(users.id, userId));
  return true;
}
