// Read-only fund routes — extracted from routes.ts.
//
// SCOPE: this module owns the GET surface for parent-side fund views,
// plus the lightweight POST /dismiss-nudge. Fund mutations (POST /api/funds,
// PATCH /api/funds/:id, POST liquidate, POST activate, etc.) stay inline
// in routes.ts for now — they pull in a dozen monetization helpers
// (logMonetizationActivity, startTrialForFund, isReverseTrialEnabled,
// resolveAllowedFundStrategy, recomputeSubscriberContributionStats…)
// that aren't worth lifting out as a single deps blob. They'll move
// when the monetization helpers themselves get extracted to a service
// module — that's the right next refactor, not extracting more route
// files first.
//
// Routes covered:
//   GET    /api/funds                              — list (with cross-device email merge)
//   GET    /api/funds/:id                          — single
//   GET    /api/funds/:fundId/holdings             — current positions
//   GET    /api/funds/:fundId/transactions         — money-flow ledger (last 50)
//   GET    /api/funds/:fundId/activities           — activity feed
//   GET    /api/funds/:fundId/history              — fund_snapshots time series
//   GET    /api/funds/:fundId/your-story           — year-by-year retrospective for at-18
//   POST   /api/funds/:fundId/dismiss-nudge        — per-fund dismissed-nudge ledger

import type { Express, RequestHandler } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { WebhookHandlers } from "../webhookHandlers";
import { users, transactions, fundSnapshots, fundCollaborators, funds as fundsTable } from "@shared/schema";
import { and, inArray } from "drizzle-orm";
import { yearOfLifeForDate } from "../../shared/age18-decisions";

export type KidAgePhase = {
  age: number | null;
  phase: "child" | "teen" | "adult" | "unknown";
  monthsUntil18: number | null;
  daysUntil18: number | null;
};

export type FundsRoutesDeps = {
  isAuthenticated: RequestHandler;
  // captureFundSnapshot returns the snapshot id string or null on no-op;
  // callers ignore the return value, so the union type is intentional.
  captureFundSnapshot: (fundId: string) => Promise<string | null | void>;
  ensureFundSlugAndPermanentEvent: (fund: any, userId: string) => Promise<any>;
  getKidAgePhase: (birthdate: Date | string | null | undefined, majorityAge?: number) => KidAgePhase;
};

export function registerFundReadRoutes(app: Express, deps: FundsRoutesDeps): void {
  const { isAuthenticated, captureFundSnapshot, ensureFundSlugAndPermanentEvent, getKidAgePhase } = deps;

  // List all funds for the signed-in user. Two layers of defense here:
  //   (1) Cross-device email merge — if a parent has signed up multiple
  //       times with the same email (case-insensitive), aggregate funds
  //       across all of those user rows. Keeps split-state funds visible.
  //   (2) Stale-Drizzle-schema enrichment — if the running Node compiled
  //       schema.ts before recent UTMA columns existed, Drizzle silently
  //       drops them from SELECTs even though the DB has them. Re-fetch
  //       the columns the dashboard depends on via raw SQL and merge.
  app.get("/api/funds", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const userEmail = String((req.user as any).email || "").trim().toLowerCase();
      let funds = await storage.getFundsByUser(userId);
      // Merge in transferred funds (where the user is the previous
      // custodian and the kid has claimed). Per FUND_STATES_SPEC.md
      // item 4: post-handoff, the fund stays in the parent's list
      // but renders read-only with a "Transferred" pill. Without this
      // merge the fund disappears entirely from the parent's view
      // once fund.userId flips to the kid. The append is at the END
      // of the active list (after the dedupe-on-email merge below)
      // so active funds stay top-of-list and transferred ones sit
      // beneath them.
      const previouslyOwned = await storage.getPreviouslyOwnedFundsByUser(userId);

      if (userEmail) {
        try {
          const candidates = await db
            .select({ id: users.id, createdAt: users.createdAt })
            .from(users)
            .where(sql`LOWER(${users.email}) = ${userEmail}`);

          if (candidates.length >= 1) {
            const allFunds = await Promise.all(
              candidates.map(async (candidate) => {
                const candidateFunds = await storage.getFundsByUser(candidate.id);
                return candidateFunds;
              }),
            );
            const merged = allFunds.flat();
            const seen = new Set<string>();
            const deduped = merged.filter((fund: any) => {
              const id = String(fund?.id || "");
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });
            deduped.sort((a: any, b: any) => {
              const aCreated = new Date(a?.createdAt || 0).getTime();
              const bCreated = new Date(b?.createdAt || 0).getTime();
              return bCreated - aCreated;
            });
            funds = deduped as any;
          }
        } catch (canonicalErr) {
          console.warn("[funds] canonical fallback skipped:", (canonicalErr as any)?.message || canonicalErr);
        }
      }

      // Merge in funds the user is an ACCEPTED collaborator on
      // (co-parent / partner access). Without this, GET /api/funds
      // returns only owner-funds, so the co-parent's dashboard sees
      // an empty list and gets redirected to /get-started — even
      // though every per-fund endpoint (gated by requireOwnedFundParam)
      // would happily grant them access. Locked 2026-05-21 after the
      // Dunphy demo's Claire account exposed this gap end-to-end.
      try {
        const collaboratorRows = await db
          .select({ fundId: fundCollaborators.fundId })
          .from(fundCollaborators)
          .where(and(
            eq(fundCollaborators.userId, userId),
            eq(fundCollaborators.status, "accepted"),
          ));
        const collaboratorFundIds = collaboratorRows
          .map((row) => String(row.fundId || ""))
          .filter(Boolean);
        const alreadyListed = new Set(funds.map((f: any) => String(f?.id || "")));
        const missingFundIds = collaboratorFundIds.filter((id) => !alreadyListed.has(id));
        if (missingFundIds.length > 0) {
          const collabFunds = await db
            .select()
            .from(fundsTable)
            .where(inArray(fundsTable.id, missingFundIds));
          // Tag with accessRole='collaborator' so client surfaces can
          // identify them without re-querying fund_collaborators.
          for (const fund of collabFunds) {
            funds.push({ ...(fund as any), accessRole: "collaborator" as const });
          }
        }
      } catch (collabErr) {
        // Non-fatal — collaborator merge is additive. If it fails,
        // owner-funds still render correctly.
        console.warn("[funds] collaborator merge skipped:", (collabErr as any)?.message || collabErr);
      }

      // Append previously-owned funds AFTER the email-merge step so
      // active funds always sort to the top of the list. Filter out
      // any that already appear in `funds` (rare — would happen if
      // the kid was somehow re-assigned back to the parent's
      // userId after transfer, but defensive). Transferred funds
      // skip the ensureFundSlugAndPermanentEvent / captureFundSnapshot
      // dance since they're no longer the parent's to mutate.
      const activeIds = new Set(funds.map((f: any) => String(f?.id || "")));
      const transferredOnly = previouslyOwned.filter((f: any) => !activeIds.has(String(f?.id || "")));

      const ensuredFunds: any[] = [];
      for (const fund of funds) {
        try {
          const ensured = await ensureFundSlugAndPermanentEvent(fund, userId);
          await captureFundSnapshot(ensured.id);
          ensuredFunds.push(ensured);
        } catch (err) {
          console.error("Failed to ensure fund setup:", fund.id, err);
          ensuredFunds.push(fund);
        }
      }
      // Tag transferred-only funds so client surfaces can identify
      // them without re-checking previous_owner_id every render. The
      // accessRole='previous_owner' tag mirrors the per-fund auth
      // middleware shape (which also branches on this).
      for (const fund of transferredOnly) {
        ensuredFunds.push({ ...(fund as any), accessRole: 'previous_owner' as const });
      }

      try {
        const ids = ensuredFunds.map((f: any) => String(f?.id || "")).filter(Boolean);
        if (ids.length > 0) {
          // sql.join expansion — Drizzle interpolates a JS array as a
          // parameter tuple `($1, $2, ...)`, so `ANY(${ids}::varchar[])`
          // produced invalid SQL and the enrichment silently failed
          // (caught below). Now `IN (sql-joined)` parameterizes each
          // id individually, which Postgres parses correctly.
          const idsSql = sql.join(ids.map((id) => sql`${id}`), sql`, `);
          const enrichRows = await db.execute(sql`
            SELECT
              id,
              recipient_ssn_last4,
              recipient_ssn_collected_at,
              recipient_state,
              majority_age,
              utma_acknowledged_at,
              utma_acknowledged_by_user_id,
              successor_custodian_name,
              successor_custodian_email,
              successor_custodian_relation,
              successor_custodian_added_at
            FROM funds
            WHERE id IN (${idsSql})
          `);
          const enrichRowsAny = enrichRows as unknown as { rows: Array<Record<string, any>> };
          const byId = new Map<string, any>();
          for (const r of enrichRowsAny.rows || []) {
            byId.set(String(r.id), r);
          }
          for (const f of ensuredFunds) {
            const extra = byId.get(String((f as any).id));
            if (!extra) continue;
            const target = f as any;
            target.recipientSsnLast4 = extra.recipient_ssn_last4 ?? target.recipientSsnLast4 ?? null;
            target.recipientSsnCollectedAt = extra.recipient_ssn_collected_at ?? null;
            target.recipientState = extra.recipient_state ?? null;
            target.majorityAge = extra.majority_age ?? target.majorityAge ?? 18;
            target.utmaAcknowledgedAt = extra.utma_acknowledged_at ?? null;
            target.utmaAcknowledgedByUserId = extra.utma_acknowledged_by_user_id ?? null;
            target.successorCustodianName = extra.successor_custodian_name ?? null;
            target.successorCustodianEmail = extra.successor_custodian_email ?? null;
            target.successorCustodianRelation = extra.successor_custodian_relation ?? null;
            target.successorCustodianAddedAt = extra.successor_custodian_added_at ?? null;
          }
        }
      } catch (enrichErr) {
        console.warn("[funds] UTMA-column enrichment skipped:", (enrichErr as any)?.message || enrichErr);
      }

      // Owner-mode relational label. For a fund the viewer now owns
      // post-handoff (transferredAt set + previousOwnerId present), surface
      // the PREVIOUS custodian's "what do your kids call you" label
      // (users.preferred_name — the Account-settings field, placeholder
      // "Dad, Mom, Papa…") as previousOwnerCallMe. The owner-mode Dashboard
      // uses it so the grown kid sees "Invested by Dad" instead of the
      // custodian's bare first name. Null when the custodian never set one →
      // the client falls back to the first name (unchanged behavior). No
      // hardcoding: purely the value the custodian chose.
      try {
        const ownerHeld = ensuredFunds.filter(
          (f: any) => f?.transferredAt && f?.previousOwnerId,
        );
        const prevOwnerIds = Array.from(
          new Set(ownerHeld.map((f: any) => String(f.previousOwnerId)).filter(Boolean)),
        );
        if (prevOwnerIds.length > 0) {
          const labelRows = await db
            .select({ id: users.id, preferredName: users.preferredName })
            .from(users)
            .where(inArray(users.id, prevOwnerIds));
          const labelById = new Map(
            labelRows.map((r) => [String(r.id), String(r.preferredName || "").trim()]),
          );
          for (const f of ensuredFunds) {
            const ff = f as any;
            if (ff?.transferredAt && ff?.previousOwnerId) {
              const lbl = labelById.get(String(ff.previousOwnerId));
              if (lbl) ff.previousOwnerCallMe = lbl;
            }
          }
        }
      } catch (labelErr) {
        console.warn("[funds] previous-owner label enrichment skipped:", (labelErr as any)?.message || labelErr);
      }

      // Tag owned funds before any merge with collaborated funds.
      // accessRole = 'owner' on every entry the parent owns DIRECTLY — but
      // preserve any role already stamped above. The transferred-only push
      // (line ~173) tags handed-off funds 'previous_owner'; a blanket 'owner'
      // map clobbered that tag, so a parent viewing a fund they handed off
      // (Phil → Haley's transferred fund) resolved to accessRole='owner' +
      // transferredAt = isOwnerMode, and saw the now-adult's second-person
      // self-view ("your future / who loves you / Start one for someone you
      // love") instead of the read-only previous-owner view. Only entries with
      // no prior tag are ones the viewer owns directly → default those to owner.
      const ownedTagged = ensuredFunds.map((f: any) => ({ ...f, accessRole: (f.accessRole as 'owner' | 'previous_owner' | 'collaborator' | undefined) || 'owner' }));

      // Union with funds this user has been accepted into as a collaborator.
      // The shape is identical to owned funds plus an accessRole tag the
      // client uses to decide which CTAs to show (viewer hides invest /
      // settings / recurring; co-admin shows them all, then mutation
      // endpoints fall through to the route-body owner check for v1).
      //
      // Why we don't slot collaborated funds into the cross-device email
      // merge above: the merge is for the same person who signed up
      // multiple times with the same email. A collaborator is explicitly
      // a different account with explicit consent, so it gets a clean
      // separate path and an explicit role tag.
      let sharedFunds: any[] = [];
      try {
        const collabFunds = await storage.getCollaboratedFunds(userId);
        sharedFunds = collabFunds.map((f: any) => ({ ...f, accessRole: f.accessRole }));
      } catch (collabErr) {
        console.warn("[funds] collaborator union skipped:", (collabErr as any)?.message || collabErr);
      }

      // Dedupe by id — if a parent somehow both owns and is collaborator
      // on the same fund (shouldn't happen but: db state can drift) the
      // owned version wins because the owner role is strictly higher.
      const seenIds = new Set<string>(ownedTagged.map((f: any) => String(f.id)));
      const sharedDeduped = sharedFunds.filter((f: any) => !seenIds.has(String(f.id)));

      res.json([...ownedTagged, ...sharedDeduped]);
    } catch (error) {
      console.error("Error fetching funds:", error);
      res.status(500).json({ error: "Failed to fetch funds" });
    }
  });

  app.get("/api/funds/:id", isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.id);
      if (!fund) {
        return res.status(404).json({ error: "Fund not found" });
      }
      const userId = (req.user as any).id;
      // Permit owner OR accepted collaborator. Same role discrimination
      // shape as the /api/funds list endpoint.
      let accessRole: 'owner' | 'co-admin' | 'viewer' | null = null;
      if (fund.userId === userId) {
        accessRole = 'owner';
      } else {
        const collab = await storage.getCollaboratorForFundAndUser(fund.id, userId);
        if (collab) accessRole = collab.role === 'co-admin' ? 'co-admin' : 'viewer';
      }
      if (!accessRole) {
        return res.status(403).json({ error: "Forbidden" });
      }
      let ensuredFund = fund;
      try {
        // ensureFundSlugAndPermanentEvent does owner-only setup writes
        // (slug ensure, permanent event create). Only call when the
        // viewer IS the owner — collaborators don't trigger owner-side
        // setup work.
        if (accessRole === 'owner') {
          ensuredFund = await ensureFundSlugAndPermanentEvent(fund, userId);
          await captureFundSnapshot(ensuredFund.id);
        }
      } catch (err) {
        console.error("Failed to ensure fund setup:", fund.id, err);
      }
      res.json({ ...ensuredFund, accessRole });
    } catch (error) {
      console.error("Error fetching fund:", error);
      res.status(500).json({ error: "Failed to fetch fund" });
    }
  });

  app.get("/api/funds/:fundId/holdings", isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: "Fund not found" });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Self-heal pending/processing gifts before showing positions, so the
      // ghost holdings (rounding artifacts from refunds) don't survive.
      await WebhookHandlers.selfHealPendingGifts(req.params.fundId).catch(() => {});

      const holdings = await storage.getHoldingsByFund(req.params.fundId);
      const activeHoldings: any[] = [];
      for (const h of holdings) {
        if (parseFloat(h.shares || "0") < 0.0001 || parseFloat(h.currentValue || "0") < 0.01) {
          try { await storage.deleteHolding(h.id); } catch {}
        } else {
          activeHoldings.push(h);
        }
      }
      res.json(activeHoldings);
    } catch (error) {
      console.error("Error fetching holdings:", error);
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  app.get("/api/funds/:fundId/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const fund = (req as any).ownedFund || (await storage.getFund(req.params.fundId));
      if (!fund) return res.status(404).json({ error: "Fund not found" });

      const rows = await db
        .select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
          status: transactions.status,
          description: transactions.description,
          metadata: transactions.metadata,
          giftId: transactions.giftId,
          eventId: transactions.eventId,
          fundId: transactions.fundId,
          completedAt: transactions.completedAt,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.fundId, fund.id))
        .orderBy(desc(transactions.completedAt), desc(transactions.createdAt))
        .limit(50);

      res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
      res.json(rows);
    } catch (error) {
      console.error("Error fetching fund transactions:", error);
      res.status(500).json({ error: "Failed to fetch fund transactions" });
    }
  });

  app.get("/api/funds/:fundId/activities", isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) {
        return res.status(404).json({ error: "Fund not found" });
      }
      if (fund.userId !== (req.user as any).id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
      const activities = await storage.getActivitiesByFund(req.params.fundId, limit);
      const enriched = activities.map((activity) => ({
        ...activity,
        type: activity.type || "event_update",
        title: activity.title || "Fund update",
        fundName: fund.name,
        recipientFirstName: fund.recipientFirstName || null,
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.get("/api/funds/:fundId/history", isAuthenticated, async (req: any, res) => {
    try {
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: "Fund not found" });
      if (fund.userId !== (req.user as any).id) return res.status(403).json({ error: "Forbidden" });

      await captureFundSnapshot(fund.id);
      try {
        const rows = await db
          .select()
          .from(fundSnapshots)
          .where(eq(fundSnapshots.fundId, fund.id))
          .orderBy(fundSnapshots.snapshotDate);

        return res.json(rows.map((r: any) => ({
          snapshotDate: r.snapshotDate,
          investedValue: r.investedValue,
          cashValue: r.cashValue,
          totalValue: r.totalValue,
          principalBasis: r.principalBasis,
        })));
      } catch {
        // Snapshots table may not exist in environments with pending migrations.
        // Build a one-row fallback so the chart never goes empty. principal_basis
        // here intentionally derives from gifts (not from balance) for the same
        // reason captureFundSnapshot does — see that function's comment.
        const fallbackGifts = await storage.getGiftsByFund(fund.id).catch(() => [] as any[]);
        const fallbackPrincipalBasis = (fallbackGifts as any[])
          .reduce((acc, g) => {
            const status = String(g?.status || "").toLowerCase();
            if (["pending", "failed", "refunded", "canceled", "host_hold"].includes(status)) return acc;
            return acc + parseFloat(String(g?.netAmount || g?.amount || "0"));
          }, 0)
          .toFixed(2);
        return res.json([{
          snapshotDate: new Date(),
          investedValue: fund.balance || "0",
          cashValue: (Number(fund.pendingBalance || 0) + Number((fund as any).cashBalance || 0)).toFixed(2),
          totalValue: (Number(fund.balance || 0) + Number(fund.pendingBalance || 0) + Number((fund as any).cashBalance || 0)).toFixed(2),
          principalBasis: fallbackPrincipalBasis,
        }]);
      }
    } catch (error) {
      console.error("Error fetching fund history:", error);
      res.status(500).json({ error: "Failed to fetch fund history" });
    }
  });

  // Year-by-year retrospective. Buckets gifts and memory entries by the
  // recipient's year-of-life and returns a timeline the kid scrolls on
  // their 18th. Owner-gated — same auth gate works for the parent
  // pre-handoff and the kid post-handoff (kid IS the owner once
  // ownership transferred).
  //
  // Visibility rules (mirror the Memory Book):
  //   parent_only  → never returned
  //   kid_at_18    → returned only when phase === 'adult'
  //   kid_now      → always returned
  //
  // Sealed-letter / parent-letter entries surface as a top-level field
  // (sealedLetter) so the client can render the unsealing treatment;
  // they do NOT appear in any year bucket.
  app.get("/api/funds/:fundId/your-story", isAuthenticated, async (req: any, res) => {
    try {
      // One round-trip wave instead of two: the fund lookup, gifts, and
      // memory entries all fire in parallel. The DB executes each in <1ms;
      // the real cost is per-round-trip network latency to the (remote) DB,
      // so collapsing getFund -> {gifts, memory} from sequential to parallel
      // roughly halves the endpoint's wall-clock. Auth/validation runs on the
      // resolved fund below; the gifts/memory results are simply discarded on
      // a 403/404 (cheap, read-only, owner-scoped route).
      const [fund, allGifts, allEntries] = await Promise.all([
        storage.getFund(req.params.fundId),
        storage.getGiftsByFund(req.params.fundId),
        storage.getMemoryEntriesByFund(req.params.fundId),
      ]);
      if (!fund) return res.status(404).json({ error: "Fund not found" });
      if (fund.userId !== (req.user as any).id) return res.status(403).json({ error: "Forbidden" });
      if (!fund.recipientBirthdate) {
        return res.status(400).json({ error: "Fund needs a recipient birthdate to build the story." });
      }

      const birthDate = fund.recipientBirthdate instanceof Date
        ? fund.recipientBirthdate
        : new Date(fund.recipientBirthdate);
      if (Number.isNaN(birthDate.getTime())) {
        return res.status(400).json({ error: "Recipient birthdate is invalid." });
      }

      const ageInfo = getKidAgePhase(fund.recipientBirthdate, Number((fund as any).majorityAge) || 18);
      const isAdult = ageInfo.phase === "adult";

      const currentAge = Number(ageInfo.age) || 0;
      const yearCap = Math.max(1, currentAge + 1);

      const yearOfLife = (timestamp: string | Date | null | undefined): number | null => {
        if (!timestamp) return null;
        const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return yearOfLifeForDate(d, birthDate, yearCap);
      };

      type YearBucket = {
        year: number;
        ageStart: number;
        gifts: Array<{ senderName: string; amount: number; message: string | null; eventName: string | null; createdAt: string }>;
        memories: Array<{ id: string; content: string | null; authorName: string | null; createdAt: string; visibility: string }>;
        totalReceived: number;
        contributorEmails: Set<string>;
      };

      const buckets = new Map<number, YearBucket>();
      const ensureBucket = (yol: number): YearBucket => {
        let b = buckets.get(yol);
        if (!b) {
          b = {
            year: yol,
            ageStart: yol - 1,
            gifts: [],
            memories: [],
            totalReceived: 0,
            contributorEmails: new Set(),
          };
          buckets.set(yol, b);
        }
        return b;
      };

      for (const g of allGifts) {
        const status = String(g.status || "").toLowerCase();
        if (["pending", "failed", "refunded", "canceled", "host_hold"].includes(status)) continue;
        const yol = yearOfLife(g.createdAt as any);
        if (!yol) continue;
        const amt = parseFloat(String(g.netAmount || g.amount || "0"));
        if (!Number.isFinite(amt) || amt <= 0) continue;
        const bucket = ensureBucket(yol);
        const giftIso = g.createdAt ? new Date(g.createdAt).toISOString() : new Date().toISOString();
        bucket.gifts.push({
          senderName: g.senderName || "Someone who loves you",
          amount: amt,
          message: g.message || null,
          eventName: null,
          createdAt: giftIso,
        });
        bucket.totalReceived += amt;
        const contributorKey = String(g.senderEmail || g.senderName || "").trim().toLowerCase();
        if (contributorKey) bucket.contributorEmails.add(contributorKey);
      }

      let sealedLetter: { content: string | null; authorName: string | null; createdAt: string } | null = null;
      const nowMsForStory = Date.now();
      for (const e of allEntries) {
        const v = String((e as any).visibility || "kid_now");
        if (v === "parent_only") continue;
        if (v === "kid_at_18" && !isAdult) continue;
        if (v === "sealed") {
          const deliverAt = (e as any).deliverAt ? new Date((e as any).deliverAt).getTime() : null;
          if (!deliverAt || Number.isNaN(deliverAt) || deliverAt > nowMsForStory) continue;
        }
        if ((e as any).type === "sealed_letter" || (e as any).type === "parent_letter") {
          const candidate = {
            content: e.content || null,
            authorName: e.authorName || null,
            createdAt: e.createdAt ? new Date(e.createdAt as any).toISOString() : new Date().toISOString(),
          };
          // sealed_letter wins over parent_letter when both exist
          if (!sealedLetter || (e as any).type === "sealed_letter") {
            sealedLetter = candidate;
          }
          continue;
        }
        const yol = yearOfLife(e.createdAt as any);
        if (!yol) continue;
        const bucket = ensureBucket(yol);
        bucket.memories.push({
          id: e.id,
          content: e.content || null,
          authorName: e.authorName || null,
          createdAt: e.createdAt ? new Date(e.createdAt as any).toISOString() : new Date().toISOString(),
          visibility: v,
        });
      }

      const years = Array.from(buckets.values())
        .sort((a, b) => a.year - b.year)
        .map((b) => {
          const giftsAsc = [...b.gifts].sort(
            (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
          );
          const firstGift = giftsAsc[0] || null;
          const largestGift = [...b.gifts].sort((x, y) => y.amount - x.amount)[0] || null;
          const memoriesAsc = [...b.memories].sort(
            (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
          );
          return {
            year: b.year,
            ageLabel: b.year === 1 ? "Year 1 (birth)" : `Age ${b.ageStart} → ${b.year}`,
            totalReceived: b.totalReceived.toFixed(2),
            giftCount: b.gifts.length,
            contributorCount: b.contributorEmails.size,
            firstGift,
            largestGift,
            memories: memoriesAsc,
          };
        });

      res.json({
        fund: {
          id: fund.id,
          recipientFirstName: fund.recipientFirstName,
          recipientBirthdate: birthDate.toISOString(),
          balance: fund.balance,
        },
        majorityAge: Number((fund as any).majorityAge) || 18,
        currentAge,
        currentPhase: ageInfo.phase,
        years,
        sealedLetter,
      });
    } catch (error) {
      console.error("Error building your-story:", error);
      res.status(500).json({ error: "Failed to build your story" });
    }
  });

  app.post("/api/funds/:fundId/dismiss-nudge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).id;
      const fund = await storage.getFund(req.params.fundId);
      if (!fund) return res.status(404).json({ error: "Fund not found" });
      if (fund.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const nudgeKey = String(req.body?.nudgeKey || "").trim();
      if (!nudgeKey) return res.status(400).json({ error: "nudgeKey is required" });

      const existing = Array.isArray((fund as any).dismissedNudges) ? (fund as any).dismissedNudges : [];
      if (existing.includes(nudgeKey)) {
        return res.json({ success: true, dismissedNudges: existing });
      }
      const updated = [...existing, nudgeKey];
      await storage.updateFund(fund.id, { dismissedNudges: updated } as any);
      res.json({ success: true, dismissedNudges: updated });
    } catch (error) {
      console.error("Error dismissing nudge:", error);
      res.status(500).json({ error: "Failed to dismiss nudge" });
    }
  });
}
