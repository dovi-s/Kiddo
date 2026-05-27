// Age-transition lifecycle routes — parent-side state management for the
// at-18 handoff. Extracted from routes.ts as part of the routes.ts
// decomposition (see ARCHITECTURE.md §11).
//
// Five endpoints, all parent-authenticated, all keyed on fundId:
//   GET    /api/funds/:fundId/age-transition           — read state
//   PATCH  /api/funds/:fundId/age-transition           — update childEmail/parentMessage
//                                                        (Zod-validated, .strict())
//   POST   /api/funds/:fundId/age-transition/preview-link  — mint preview token (age 17)
//   POST   /api/funds/:fundId/age-transition/invite-link   — mint invite token + email kid
//                                                            (manual override; bypasses verification gate
//                                                             since parent explicitly opted in)
//   POST   /api/funds/:fundId/age-transition/handoff       — request brokerage ownership
//                                                            transfer (queues custodianTransfer event)
//
// Sister module: routes/ageTransitionVerification.ts (verify-email-link
// + public verify-token endpoints). Together they cover every
// age-transition surface except the public /api/age-transition/:token
// payload endpoint (which has wider helper dependencies — separate
// extraction session).
//
// Pattern: see routes/ageTransitionVerification.ts for the deps-object
// approach. registration function takes (app, deps) where deps holds
// closure-bound helpers (auth middleware, getAppBaseUrl, etc.) that
// can't be imported as standalone modules.

import type { Express, Request, RequestHandler } from "express";
import crypto from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { storage } from "../storage";
import { sendEmail } from "../emailDelivery";
import { queueCustodianTransfer } from "../custodianTransfer";
import { getAgeTransitionRecord, patchAgeTransitionRecord } from "../ageTransitionStore";
import { getAgeMilestoneState } from "@shared/age18-decisions";

export type AgeTransitionLifecycleDeps = {
  isAuthenticated: RequestHandler;
  getAppBaseUrl: (req: Request) => string;
};

export function registerAgeTransitionLifecycleRoutes(
  app: Express,
  deps: AgeTransitionLifecycleDeps,
): void {
  const { isAuthenticated, getAppBaseUrl } = deps;

  // Read parent-managed age-transition state. Surfaces preview/invite
  // links (when minted) and the claiming child's email (when claim
  // has happened) for the AgeTransitionManager UI.
  app.get(
    "/api/funds/:fundId/age-transition",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const fund = await storage.getFund(req.params.fundId);
        if (!fund) return res.status(404).json({ error: "Fund not found" });
        if (fund.userId !== (req.user as any).id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const record = await getAgeTransitionRecord(fund.id);
        const claimedBy = record.childClaimedByUserId
          ? await db
              .select({ email: users.email, firstName: users.firstName })
              .from(users)
              .where(eq(users.id, record.childClaimedByUserId))
              .limit(1)
          : [];

        res.json({
          ...record,
          previewLink: record.previewToken
            ? `${getAppBaseUrl(req)}/transition/${record.previewToken}`
            : null,
          inviteLink: record.inviteToken
            ? `${getAppBaseUrl(req)}/transition/${record.inviteToken}`
            : null,
          claimedByEmail: claimedBy[0]?.email || null,
          claimedByFirstName: claimedBy[0]?.firstName || null,
        });
      } catch (error) {
        console.error("Error fetching age transition:", error);
        res.status(500).json({ error: "Failed to fetch age transition" });
      }
    },
  );

  // Zod-validated body — replaces the previous manual regex + length
  // checks. Rejects unknown keys (.strict()) so a typo'd field name
  // can't silently no-op. Returns issue list so the client can surface
  // field-level errors. Pattern documented in ARCHITECTURE.md §11.
  const ageTransitionPatchSchema = z
    .object({
      childEmail: z
        .string()
        .trim()
        .toLowerCase()
        .email({ message: "A valid child email is required." })
        .or(z.literal(""))
        .optional()
        .transform((v: string | undefined) => (v ? v : null)),
      parentMessage: z
        .string()
        .trim()
        .max(1200, { message: "Parent message must be 1200 characters or fewer." })
        .optional()
        .transform((v: string | undefined) => (v ? v : null)),
    })
    .strict();

  app.patch(
    "/api/funds/:fundId/age-transition",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const fund = await storage.getFund(req.params.fundId);
        if (!fund) return res.status(404).json({ error: "Fund not found" });
        if (fund.userId !== (req.user as any).id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const parsed = ageTransitionPatchSchema.safeParse(req.body || {});
        if (!parsed.success) {
          const firstIssue = parsed.error.issues[0];
          return res.status(400).json({
            error: firstIssue?.message || "Invalid request",
            issues: parsed.error.issues,
          });
        }
        const childEmailRaw = parsed.data.childEmail;
        const parentMessageRaw = parsed.data.parentMessage;

        // If the parent changed the email address, drop any prior
        // verification — the new address hasn't been confirmed by the
        // kid (the previous verification was for a different inbox).
        // Without this, a parent could verify "wrong@email.com", later
        // edit to "right@email.com", and the worker would auto-send to
        // the new address treating it as verified — exactly the failure
        // mode the verification gate exists to prevent.
        const existingForCompare = await getAgeTransitionRecord(fund.id);
        const emailChanged =
          (existingForCompare.childEmail || null) !== (childEmailRaw || null);
        const verificationReset = emailChanged
          ? {
              childEmailVerifiedAt: null,
              childEmailVerificationToken: null,
              childEmailVerificationSentAt: null,
            }
          : {};

        const record = await patchAgeTransitionRecord(fund.id, {
          childEmail: childEmailRaw,
          parentMessage: parentMessageRaw,
          ...verificationReset,
        });

        return res.json({
          ...record,
          previewLink: record.previewToken
            ? `${getAppBaseUrl(req)}/transition/${record.previewToken}`
            : null,
          inviteLink: record.inviteToken
            ? `${getAppBaseUrl(req)}/transition/${record.inviteToken}`
            : null,
        });
      } catch (error) {
        console.error("Error updating age transition:", error);
        res.status(500).json({ error: "Failed to update age transition" });
      }
    },
  );

  // Mint a preview token + URL. Unlocks during age 17 (per
  // getAgeMilestoneState.previewEligible). Read-only Memory Book preview
  // for the kid before they own anything.
  app.post(
    "/api/funds/:fundId/age-transition/preview-link",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const fund = await storage.getFund(req.params.fundId);
        if (!fund) return res.status(404).json({ error: "Fund not found" });
        if (fund.userId !== (req.user as any).id) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (!fund.recipientBirthdate) {
          return res
            .status(400)
            .json({ error: "Add the child's birthdate before creating a preview link." });
        }
        const majorityAge = Number((fund as any).majorityAge) || 18;
        const milestone = getAgeMilestoneState(fund.recipientBirthdate, majorityAge);
        if (!milestone.previewEligible) {
          return res
            .status(409)
            .json({ error: `Preview links unlock during the year before the child turns ${majorityAge}.` });
        }

        const record = await patchAgeTransitionRecord(fund.id, {
          previewToken: crypto.randomUUID(),
          previewPreparedAt: new Date().toISOString(),
        });

        await storage.createActivity({
          userId: (req.user as any).id,
          fundId: fund.id,
          type: "age18_preview_prepared",
          title: "Age-17 preview prepared",
          description: `A preview link is ready for ${fund.recipientFirstName || fund.name}.`,
        });

        res.json({
          ...record,
          previewLink: `${getAppBaseUrl(req)}/transition/${record.previewToken}`,
        });
      } catch (error) {
        console.error("Error creating age preview link:", error);
        res.status(500).json({ error: "Failed to create preview link" });
      }
    },
  );

  // Mint an invite token + email the kid the claim link manually.
  // Bypasses the verification gate (the worker uses the gate; this is
  // the explicit parent-override path). Unlocks once the kid hits
  // majority age. Requires childEmail on file.
  app.post(
    "/api/funds/:fundId/age-transition/invite-link",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const fund = await storage.getFund(req.params.fundId);
        if (!fund) return res.status(404).json({ error: "Fund not found" });
        if (fund.userId !== (req.user as any).id) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (!fund.recipientBirthdate) {
          return res
            .status(400)
            .json({ error: "Add the child's birthdate before creating an invite." });
        }
        const majorityAge = Number((fund as any).majorityAge) || 18;
        const milestone = getAgeMilestoneState(fund.recipientBirthdate, majorityAge);
        if (!milestone.inviteEligible) {
          return res
            .status(409)
            .json({ error: `Invite links unlock once the child reaches the age of majority (${majorityAge}).` });
        }

        const existing = await getAgeTransitionRecord(fund.id);
        if (!existing.childEmail) {
          return res
            .status(400)
            .json({ error: "Add the child's email before creating an invite." });
        }

        const record = await patchAgeTransitionRecord(fund.id, {
          inviteToken: crypto.randomUUID(),
          invitedAt: new Date().toISOString(),
        });
        const inviteLink = `${getAppBaseUrl(req)}/transition/${record.inviteToken}`;
        const emailDelivery = await sendEmail({
          to: existing.childEmail,
          subject: `${fund.recipientFirstName || "Your"} Kiddo fund is ready to claim`,
          text: [
            `Hi ${fund.recipientFirstName || "there"},`,
            "",
            `${fund.userId === (req.user as any).id ? "Your family" : "A parent"} has prepared your Kiddo handoff.`,
            "Your fund is ready to move into your own Kiddo account. Everything that was built for you is waiting.",
            "",
            `Open your invite: ${inviteLink}`,
            "",
            "The Kiddo team",
          ].join("\n"),
          tags: ["age_transition", "invite"],
          metadata: {
            fundId: fund.id,
            childEmail: existing.childEmail,
          },
        });

        await storage.createActivity({
          userId: (req.user as any).id,
          fundId: fund.id,
          type: "age18_invite_prepared",
          title: "Age-18 invite prepared",
          description: `An account handoff invite is ready for ${existing.childEmail}.`,
        });

        res.json({
          ...record,
          inviteLink,
          emailDeliveryMode: emailDelivery.mode,
        });
      } catch (error) {
        console.error("Error creating age invite link:", error);
        res.status(500).json({ error: "Failed to create invite link" });
      }
    },
  );

  // Request the actual brokerage ownership transfer. Gated on:
  //   1. kid has reached majority age
  //   2. kid has accepted the invite (childClaimedAt set)
  //   3. transfer hasn't already happened
  // Queues a custodianTransfer event. DriveWealth integration is
  // scaffolded but not wired (see ARCHITECTURE.md §5) — for now this
  // appends to the outbox JSONL file.
  app.post(
    "/api/funds/:fundId/age-transition/handoff",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const fund = await storage.getFund(req.params.fundId);
        if (!fund) return res.status(404).json({ error: "Fund not found" });
        if (fund.userId !== (req.user as any).id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const existing = await getAgeTransitionRecord(fund.id);
        const majorityAge = Number((fund as any).majorityAge) || 18;
        const milestone = getAgeMilestoneState(fund.recipientBirthdate, majorityAge);
        if (!milestone.inviteEligible) {
          return res
            .status(409)
            .json({ error: `The final handoff can only be requested once the age of majority (${majorityAge}) is reached.` });
        }
        if (!existing.childClaimedAt) {
          return res
            .status(409)
            .json({ error: "The child needs to accept the invite before you request the handoff." });
        }
        if (existing.ownershipTransferredAt) {
          return res
            .status(409)
            .json({ error: "The Kiddo transfer has already been completed." });
        }

        const record = await patchAgeTransitionRecord(fund.id, {
          handoffRequestedAt: new Date().toISOString(),
        });
        const custodianTransfer = await queueCustodianTransfer({
          type: "age18_handoff_requested",
          fundId: fund.id,
          childEmail: existing.childEmail,
          childUserId: existing.childClaimedByUserId,
          previousCustodianUserId: fund.userId,
          requestedByUserId: (req.user as any).id,
          requestedAt: record.handoffRequestedAt,
        });

        await storage.createActivity({
          userId: (req.user as any).id,
          fundId: fund.id,
          type: "age18_handoff_requested",
          title: "Age-18 handoff requested",
          description: `${fund.recipientFirstName || "Your child"} is ready for the final Kiddo ownership transfer.`,
        });

        res.json({
          ...record,
          custodianTransferMode: custodianTransfer.mode,
        });
      } catch (error) {
        console.error("Error requesting age handoff:", error);
        res.status(500).json({ error: "Failed to request handoff" });
      }
    },
  );
}
