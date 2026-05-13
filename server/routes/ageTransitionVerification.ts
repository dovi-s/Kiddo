// Age-transition email verification routes — extracted from routes.ts as
// a proof-of-pattern for domain decomposition.
//
// PATTERN: each domain module exports a single `register*Routes(app, deps)`
// function. routes.ts (the entrypoint) wires them all by calling each
// registration function with the shared dependencies (auth middleware,
// utility functions). Modules don't import the kitchen sink — they
// declare exactly what they need via the deps object.
//
// Why deps as a parameter object instead of direct imports: some helpers
// (`getAppBaseUrl(req)`) close over request state and aren't exportable
// as standalone functions. Passing them in keeps the module pure and
// testable. Dependencies that ARE exportable as standalone modules
// (storage, sendEmail, ageTransitionStore) get imported directly.
//
// Two routes live here:
//   POST /api/funds/:fundId/age-transition/verify-email-link
//     Parent-triggered. Sends the kid a verification email.
//   POST /api/age-transition-verify/:token
//     Public. Kid clicks the link, verifies, single-use token cleared.
//
// Together they implement the verification gate — the at-18 worker
// won't auto-send the claim invite unless `childEmailVerifiedAt` is
// set, preventing the parent-typo-six-years-ago failure mode.
//
// See `project_age18_handoff_lifecycle_automatic.md` for the
// load-bearing principles around this gate.

import type { Express, RequestHandler, Request } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { sendEmail } from "../emailDelivery";
import {
  getAgeTransitionRecord,
  patchAgeTransitionRecord,
  findAgeTransitionByVerificationToken,
} from "../ageTransitionStore";

export type AgeTransitionVerificationDeps = {
  isAuthenticated: RequestHandler;
  // Closes over req for canonical-host detection. Each caller passes
  // their own resolver because the routes.ts version uses
  // `req.headers.host` and worker versions use env-only.
  getAppBaseUrl: (req: Request) => string;
};

export function registerAgeTransitionVerificationRoutes(
  app: Express,
  deps: AgeTransitionVerificationDeps,
): void {
  const { isAuthenticated, getAppBaseUrl } = deps;

  // Parent triggers the verification email. Verification token is
  // single-use; once the kid clicks the public link below, the token
  // is cleared but `childEmailVerifiedAt` persists as the worker's
  // gating signal.
  app.post(
    "/api/funds/:fundId/age-transition/verify-email-link",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const fund = await storage.getFund(req.params.fundId);
        if (!fund) return res.status(404).json({ error: "Fund not found" });
        if (fund.userId !== (req.user as any).id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const existing = await getAgeTransitionRecord(fund.id);
        if (!existing.childEmail) {
          return res
            .status(400)
            .json({ error: "Add the child's email before sending verification." });
        }
        if (existing.childEmailVerifiedAt) {
          return res.json({
            success: true,
            alreadyVerified: true,
            verifiedAt: existing.childEmailVerifiedAt,
            childEmail: existing.childEmail,
          });
        }

        const verificationToken = crypto.randomUUID();
        const record = await patchAgeTransitionRecord(fund.id, {
          childEmailVerificationToken: verificationToken,
          childEmailVerificationSentAt: new Date().toISOString(),
        });

        const verifyUrl = `${getAppBaseUrl(req)}/transition/verify/${verificationToken}`;
        const childFirst = fund.recipientFirstName || "there";

        const emailDelivery = await sendEmail({
          to: existing.childEmail,
          subject: `Confirm your email for your Kiddo fund`,
          text: [
            `Hi ${childFirst},`,
            "",
            "Your family is preparing the Kiddo fund handoff for your 18th birthday. We need to confirm this is the right email so the claim link reaches you on the day.",
            "",
            `Confirm here: ${verifyUrl}`,
            "",
            "If you weren't expecting this, you can ignore this email.",
            "",
            "The Kiddo team",
          ].join("\n"),
          tags: ["age_transition", "email_verification"],
          metadata: { fundId: fund.id, childEmail: existing.childEmail },
        });

        await storage.createActivity({
          userId: (req.user as any).id,
          fundId: fund.id,
          type: "age18_email_verification_sent",
          title: "Email verification sent",
          description: `Verification email sent to ${existing.childEmail}.`,
        });

        res.json({
          success: true,
          verifyUrl,
          verificationSentAt: record.childEmailVerificationSentAt,
          emailDeliveryMode: emailDelivery.mode,
        });
      } catch (error) {
        console.error("Error sending verification email:", error);
        res.status(500).json({ error: "Failed to send verification email" });
      }
    },
  );

  // Public endpoint — kid clicks the link in the verification email and
  // lands here. No auth required (the kid likely doesn't have a Kiddo
  // account yet at this stage). Token is single-use; once consumed,
  // verifiedAt is stamped and the token cleared.
  app.post("/api/age-transition-verify/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) return res.status(400).json({ error: "Verification token required" });

      // Index-backed token lookup — replaces the previous "load entire
      // store, scan for token" pattern. With the new Postgres-backed
      // store + age_transitions_verification_token_idx, this is one
      // query instead of N. See server/ageTransitionStore.ts.
      const existing = await findAgeTransitionByVerificationToken(token);
      if (!existing) {
        return res.status(404).json({ error: "Verification link is no longer valid." });
      }
      const fundId = existing.fundId;
      if (existing.childEmailVerifiedAt) {
        return res.json({
          success: true,
          alreadyVerified: true,
          verifiedAt: existing.childEmailVerifiedAt,
        });
      }

      const updated = await patchAgeTransitionRecord(fundId, {
        childEmailVerifiedAt: new Date().toISOString(),
        // Clear the token so the URL can't be re-used. The verifiedAt
        // stamp is the persistent signal the worker checks.
        childEmailVerificationToken: null,
      });

      const fund = await storage.getFund(fundId).catch(() => null);
      if (fund) {
        await storage
          .createActivity({
            userId: fund.userId,
            fundId,
            type: "age18_email_verified",
            title: "Child email verified",
            description: `${existing.childEmail || "The child"} confirmed their email. The at-18 invite will land in their inbox automatically on the day.`,
          })
          .catch(() => undefined);
      }

      res.json({
        success: true,
        verifiedAt: updated.childEmailVerifiedAt,
      });
    } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });
}
