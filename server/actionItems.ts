// Action-item derivation. Reads user + fund state, returns the
// "still open, not snoozed" todos for the bell badge + UI.
//
// IMPORTANT: this module is the source of truth for whether a todo
// is currently outstanding. The activities ledger is append-only and
// includes resolved-long-ago rows; if you query "has the user seen
// kyc_action_required" you'll get a misleading yes. Always come
// through here.
//
// Snooze:
//   - Stored on `funds.dismissedNudges` JSONB: { [type]: ISO }
//   - User-scoped types (KYC, payment_failed) use the user's first
//     fund as their canonical snooze home (matches how the source
//     activity is logged in routes.ts:5604-5620)
//   - When now > stored ISO, the item is no longer snoozed

import { sql } from "drizzle-orm";
import type { Fund, User } from "@shared/schema";
import type {
  ActionItem,
  ActionItemType,
} from "@shared/action-items";
import { isSnoozable } from "@shared/action-items";
import { db } from "./db";

type Bag<T> = Record<string, T>;

function readSnoozeMap(fund: Pick<Fund, "dismissedNudges">): Bag<string> {
  const raw = (fund as any).dismissedNudges;
  if (!raw || typeof raw !== "object") return {};
  return raw as Bag<string>;
}

function isSnoozedNow(snoozeMap: Bag<string>, type: ActionItemType): string | null {
  const until = snoozeMap[type];
  if (!until || typeof until !== "string") return null;
  const t = new Date(until).getTime();
  if (!Number.isFinite(t)) return null;
  if (t <= Date.now()) return null; // expired snooze
  return until;
}

function fundLabel(fund: Fund): string {
  if (fund.recipientFirstName) return `${fund.recipientFirstName}'s Fund`;
  return fund.name || "Fund";
}

// Derive every open action item for a single user across all their
// funds. Includes both server-emitted activity-derived todos (KYC,
// payment_failed, large_gift_hold) and state-derived todos (SSN
// missing, bank not linked, etc.).
//
// `funds` is the user's owned fund list, NOT including collaborated
// funds — collaborators shouldn't be nagged about an owner's setup
// state. `hasBank` is a global property (one bank list per user) so
// it's passed in once rather than re-queried per fund.
export async function deriveActionItemsForUser(
  user: User,
  funds: Fund[],
  hasBank: boolean,
): Promise<ActionItem[]> {
  const out: ActionItem[] = [];

  // Demo accounts skip action-item derivation entirely. The Rivera
  // demo is showcase-mode — the visitor is here to see what a
  // fully-set-up Kiddo dashboard feels like, not the new-customer
  // onboarding state. KYC nudges, bank-link prompts, "activate
  // investing" CTAs, and the SetupProgressNudge all live on the
  // action-items / setup-progress derivations and are noise inside
  // the demo. Locked 2026-05-21 after the demo dashboard surfaced
  // four separate setup-incomplete nudges (link bank, finish setup,
  // activate investing, etc.) on Marcus's seeded Family-tier account —
  // none of which apply to a sandboxed demo.
  if ((user as any)?.isDemoAccount) {
    return out;
  }

  // KYC-state-driven items. KYC is user-scoped; we anchor the card
  // to the user's first fund (same anchor routes.ts uses when it
  // logs the activity). Resolved when kycStatus is "approved" or
  // explicitly cleared. "pending" stays in the badge as an advisory
  // because it can stall for days and the parent wants the breadcrumb.
  const primaryFund: Fund | undefined = funds[0];
  const userKycStatus = (user.kycStatus || "none").toLowerCase();
  if (primaryFund) {
    const snoozeMap = readSnoozeMap(primaryFund);
    if (userKycStatus === "failed") {
      const snoozedUntil = isSnoozedNow(snoozeMap, "kyc_action_required");
      if (!snoozedUntil) {
        // Surface the SPECIFIC failure message when persisted to
        // user.kycData (routes.ts stores lastFailureMessage at submit
        // time). Falls back to the generic description for legacy
        // rows that pre-date that persistence. Per the 2026-05-13
        // audit: the activity ledger had the specific message but
        // the action-item card had a generic one. Closes that gap.
        const kycDataAny = (user as any).kycData as any;
        const specificMessage = kycDataAny && typeof kycDataAny.lastFailureMessage === "string"
          ? String(kycDataAny.lastFailureMessage).trim()
          : "";
        const description = specificMessage
          ? specificMessage
          : "We weren't able to verify your identity. Update the details to get investing going.";

        out.push({
          id: `kyc_action_required:${primaryFund.id}`,
          type: "kyc_action_required",
          fundId: primaryFund.id,
          fundLabel: fundLabel(primaryFund),
          title: "Identity details need attention",
          description,
          ctaLabel: "Fix identity",
          ctaPath: "/activate",
          snoozedUntil: null,
          canSnooze: isSnoozable("kyc_action_required"),
          category: "identity",
          severity: "blocking",
        });
      }
    } else if (userKycStatus === "pending") {
      // Pending is advisory; we still surface it so the parent has
      // visibility into "we're working on it." Snoozable because
      // there's nothing they can do.
      const snoozedUntil = isSnoozedNow(snoozeMap, "kyc_pending_review");
      if (!snoozedUntil) {
        out.push({
          id: `kyc_pending_review:${primaryFund.id}`,
          type: "kyc_pending_review",
          fundId: primaryFund.id,
          fundLabel: fundLabel(primaryFund),
          title: "Identity review in progress",
          description: "Manual review can take 1-3 business days. We'll email you the moment it clears.",
          ctaLabel: "View status",
          ctaPath: "/activate",
          snoozedUntil: null,
          canSnooze: isSnoozable("kyc_pending_review"),
          category: "identity",
          severity: "advisory",
        });
      }
    }
  }

  // Payment-failed state. Derived from open subscription rows.
  // user-scoped; we anchor to primaryFund for snooze storage like
  // KYC does. We consider it open when there's a subscription with
  // status "past_due" / "unpaid" / "incomplete" on file.
  if (primaryFund) {
    try {
      const subs = await db.execute(sql`
        SELECT status FROM subscriptions
        WHERE user_id = ${user.id}
          AND status IN ('past_due', 'unpaid', 'incomplete')
        LIMIT 1
      `);
      if ((subs.rows as any[])?.length > 0) {
        const snoozeMap = readSnoozeMap(primaryFund);
        const snoozedUntil = isSnoozedNow(snoozeMap, "payment_failed");
        if (!snoozedUntil) {
          out.push({
            id: `payment_failed:${primaryFund.id}`,
            type: "payment_failed",
            fundId: primaryFund.id,
            fundLabel: fundLabel(primaryFund),
            title: "Payment needs updating",
            description: "Your last subscription charge didn't go through. Update your card to keep things flowing.",
            ctaLabel: "Update payment",
            // Routes to Account "Plan & billing" per the WHO/HOW IA
            // Phase 1c-B. Account has the inline Manage billing button
            // that opens the Stripe billing portal in one tap, which
            // is the canonical fix for a failed-charge state.
            ctaPath: "/account?tab=plan",
            snoozedUntil: null,
            canSnooze: isSnoozable("payment_failed"),
            category: "payment",
            severity: "blocking",
          });
        }
      }
    } catch (err) {
      // Subscriptions table might not exist in older DBs; non-fatal.
      // The action item degrades to "absent" which is correct
      // behavior for an unknown subscription state.
    }
  }

  // Large-gift hold — fund-scoped. Source of truth is the gifts
  // table where status = 'host_hold'. Each held gift is its own
  // action item because the parent needs to decide per-gift.
  try {
    const fundIds = funds.map((f) => f.id);
    if (fundIds.length > 0) {
      const fundIdsSql = sql.join(
        fundIds.map((id) => sql`${id}`),
        sql`, `,
      );
      const heldGifts = await db.execute(sql`
        SELECT id, fund_id, sender_name, amount
        FROM gifts
        WHERE fund_id IN (${fundIdsSql}) AND status = 'host_hold'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      for (const row of (heldGifts.rows as any[]) || []) {
        const fund = funds.find((f) => f.id === row.fund_id);
        if (!fund) continue;
        out.push({
          id: `large_gift_hold_started:${row.id}`,
          type: "large_gift_hold_started",
          fundId: fund.id,
          fundLabel: fundLabel(fund),
          title: "Large gift waiting on you",
          description: `${row.sender_name || "A gifter"} sent $${row.amount}. It's on hold pending your approval.`,
          ctaLabel: "Review gift",
          ctaPath: `/activity?fund=${fund.id}`,
          snoozedUntil: null,
          canSnooze: isSnoozable("large_gift_hold_started"),
          category: "gift_hold",
          severity: "blocking",
        });
      }
    }
  } catch {
    // Non-fatal — held gifts UI degrades to absent if the query
    // shape breaks somehow.
  }

  // Fund-state-derived todos. Per-fund: SSN, recipient details,
  // activate-investing. Each fund evaluates independently because
  // each UTMA is its own legal account.
  for (const fund of funds) {
    const snoozeMap = readSnoozeMap(fund);
    const fundIsUtma = (fund.accountType || "UTMA").toUpperCase() === "UTMA";
    const fundIsActive = (fund.status || "").toLowerCase() === "active";
    const hasRecipient = Boolean(
      fund.recipientFirstName && fund.recipientBirthdate,
    );
    const hasSsn = Boolean((fund as any).recipientSsnFullEncrypted);

    if (fundIsUtma && !hasRecipient) {
      const snoozedUntil = isSnoozedNow(snoozeMap, "recipient_details_missing");
      if (!snoozedUntil) {
        out.push({
          id: `recipient_details_missing:${fund.id}`,
          type: "recipient_details_missing",
          fundId: fund.id,
          fundLabel: fundLabel(fund),
          title: "Add your child's details",
          description: "Name + birthdate unlocks the rest of the fund (gift link, kid view, projections).",
          ctaLabel: "Add details",
          ctaPath: `/dashboard?fund=${fund.id}&editRecipient=1`,
          snoozedUntil: null,
          canSnooze: isSnoozable("recipient_details_missing"),
          category: "fund_setup",
          severity: "blocking",
        });
      }
    } else if (fundIsUtma && hasRecipient && !hasSsn && !fundIsActive) {
      // SSN gating only matters once recipient details exist. Block-
      // before-investing — without SSN we can't issue 1099-DIV.
      const snoozedUntil = isSnoozedNow(snoozeMap, "ssn_missing");
      if (!snoozedUntil) {
        out.push({
          id: `ssn_missing:${fund.id}`,
          type: "ssn_missing",
          fundId: fund.id,
          fundLabel: fundLabel(fund),
          title: "Child's SSN needed before investing",
          description: "The IRS requires it for the 1099-DIV. Stored encrypted, never displayed again after entry.",
          ctaLabel: "Add SSN",
          ctaPath: `/activate?fund=${fund.id}`,
          snoozedUntil: null,
          canSnooze: isSnoozable("ssn_missing"),
          category: "fund_setup",
          severity: "blocking",
        });
      }
    } else if (fundIsUtma && hasRecipient && hasSsn && !fundIsActive) {
      // Activate investing is the LAST setup step — only fires when
      // every gate before it is satisfied. Otherwise the order of
      // todos would feel scrambled.
      const snoozedUntil = isSnoozedNow(snoozeMap, "activate_investing");
      if (!snoozedUntil) {
        out.push({
          id: `activate_investing:${fund.id}`,
          type: "activate_investing",
          fundId: fund.id,
          fundLabel: fundLabel(fund),
          title: "Activate investing",
          description: "Flip the switch so first gifts go straight into real stocks instead of sitting as cash.",
          ctaLabel: "Activate",
          ctaPath: `/activate?fund=${fund.id}`,
          snoozedUntil: null,
          canSnooze: isSnoozable("activate_investing"),
          category: "fund_setup",
          severity: "advisory",
        });
      }
    }
  }

  // User-scoped fund_setup items: bank, profile. Anchor to primary
  // fund for snooze. Bank is the withdrawal/payout rail for the at-18
  // handoff (NOT custody/SIPC protection, which comes from the
  // custodian); profile gates the Memory Book "from:" attribution.
  if (primaryFund && !hasBank) {
    const snoozeMap = readSnoozeMap(primaryFund);
    const snoozedUntil = isSnoozedNow(snoozeMap, "bank_not_linked");
    if (!snoozedUntil) {
      out.push({
        id: `bank_not_linked:${primaryFund.id}`,
        type: "bank_not_linked",
        fundId: primaryFund.id,
        fundLabel: fundLabel(primaryFund),
        title: "Link a bank for withdrawals",
        description: "Required for cashing out at the age-18 handoff. Plaid-backed, view-only access.",
        ctaLabel: "Link bank",
        // Bank linking lives in Settings money tab today. The earlier
        // /settings?bank=1 path didn't specify the tab, so the user
        // landed on the default Child tab and had to navigate. Now
        // points at the money tab so the bank-linking UI is one step
        // away. Per the WHO/HOW IA principle, bank linking is account-
        // level (one bank per user) and would move to Account in a
        // future Phase 2 refactor; for now its home is Settings money.
        ctaPath: "/settings?tab=money",
        snoozedUntil: null,
        canSnooze: isSnoozable("bank_not_linked"),
        category: "fund_setup",
        severity: "advisory",
      });
    }
  }

  if (primaryFund && !(user.firstName || (user as any).preferredName)) {
    const snoozeMap = readSnoozeMap(primaryFund);
    const snoozedUntil = isSnoozedNow(snoozeMap, "profile_incomplete");
    if (!snoozedUntil) {
      out.push({
        id: `profile_incomplete:${primaryFund.id}`,
        type: "profile_incomplete",
        fundId: primaryFund.id,
        fundLabel: fundLabel(primaryFund),
        title: "Add your name to the Memory Book",
        description: "Without it, your notes to your child sign as 'Anonymous parent' on their 18th-birthday view.",
        ctaLabel: "Complete profile",
        ctaPath: "/profile",
        snoozedUntil: null,
        canSnooze: isSnoozable("profile_incomplete"),
        category: "fund_setup",
        severity: "advisory",
      });
    }
  }

  // Stalled-handoff action items. Per-fund check: if the kid was
  // invited to claim their fund but hasn't claimed within 90 days,
  // surface the situation on the parent dashboard. The stalled-
  // handoff worker (server/stalledHandoffWorker.ts) has already
  // emailed kid + parent + trusted contact by this point; the
  // action item is the visible long-term affordance for the parent
  // to do something.
  //
  // Defensive: the JOIN below may fail if age_transitions doesn't
  // exist (very old DBs) or if stalled_handoff_t90_at column hasn't
  // been pushed yet. We treat any failure as "no stalled funds"
  // and log once per derivation rather than 500ing the whole
  // action-items endpoint.
  try {
    const fundIds = funds.map((f) => f.id);
    if (fundIds.length > 0) {
      const fundIdsSql = sql.join(
        fundIds.map((id) => sql`${id}`),
        sql`, `,
      );
      const T90_DAYS = 90;
      const stalledResult = await db.execute(sql`
        SELECT
          at.fund_id            AS "fundId",
          at.invited_at         AS "invitedAt",
          at.child_email        AS "childEmail"
        FROM age_transitions at
        WHERE at.fund_id IN (${fundIdsSql})
          AND at.invited_at IS NOT NULL
          AND at.child_claimed_at IS NULL
          AND at.ownership_transferred_at IS NULL
          AND at.invited_at <= NOW() - INTERVAL '${sql.raw(String(T90_DAYS))} days'
      `);
      const stalledRows = (stalledResult.rows as any[]) || [];
      for (const row of stalledRows) {
        const fund = funds.find((f) => f.id === row.fundId);
        if (!fund) continue;
        const snoozeMap = readSnoozeMap(fund);
        const snoozedUntil = isSnoozedNow(snoozeMap, "stalled_handoff");
        if (snoozedUntil) continue;
        const childName = fund.recipientFirstName || "your child";
        const daysStalled = Math.floor(
          (Date.now() - new Date(row.invitedAt).getTime()) / (24 * 60 * 60 * 1000),
        );
        const monthsStalled = Math.floor(daysStalled / 30);
        const timeDescriptor = monthsStalled >= 1
          ? `${monthsStalled} month${monthsStalled === 1 ? '' : 's'}`
          : `${daysStalled} days`;
        out.push({
          id: `stalled_handoff:${fund.id}`,
          type: "stalled_handoff",
          fundId: fund.id,
          fundLabel: fundLabel(fund),
          title: `${childName} hasn't claimed their fund`,
          description: `${childName} was sent the claim link ${timeDescriptor} ago and hasn't opened it yet. The money is safe; we'll keep holding it. A quick text to ${childName} usually does the trick.`,
          ctaLabel: "Open Age-18 plan",
          ctaPath: "/age-18-plan",
          snoozedUntil: null,
          canSnooze: isSnoozable("stalled_handoff"),
          category: "lifecycle",
          severity: "advisory",
        });
      }
    }
  } catch (err) {
    console.warn(
      `[action-items] stalled_handoff derivation skipped: ${String((err as any)?.message || err)}`,
    );
  }

  return out;
}
