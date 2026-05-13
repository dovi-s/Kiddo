// WebAuthn / passkey authentication for the Kiddo web app.
// Per FACE_ID_SPEC.md (formerly deferred item: "web passkeys / WebAuthn").
//
// Composes with the existing password + OAuth flows — doesn't replace
// them. A user can have a password AND zero or more passkeys; logging
// in either way creates the same session shape. Passkeys are an
// alternative method, never the only one (password fallback always
// works in case the user loses every passkey-registered device).
//
// Flows implemented:
//   - Register a new passkey (authenticated user adds device-bound credential)
//   - Authenticate with passkey (unauthenticated user logs in via credential)
//   - List my passkeys
//   - Delete a passkey
//
// Library: @simplewebauthn/server handles the protocol detail (CBOR
// decoding, attestation verification, counter checks, etc.). Don't
// hand-roll WebAuthn; the spec is dense and the failure modes are
// security-sensitive.
//
// Challenge storage: per-session via express-session. Challenges are
// short-lived (60s) and the session is the canonical "this user, this
// browser, this moment" anchor. No need for a separate Redis cache.

import type { Express, Request, Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { db } from "./db";
import { users, passkeys } from "@shared/models/auth";
import { eq, and } from "drizzle-orm";

// RP (Relying Party) configuration. rpID is the domain users browsers
// will check against (no protocol, no path). origin is the full URL
// they connect from (used for replay protection). Both are env-driven
// so production / staging / dev each get the right values.
function getRpConfig() {
  const isProd = process.env.NODE_ENV === "production";
  const rpID = process.env.WEBAUTHN_RP_ID || (isProd ? "kiddofund.com" : "localhost");
  const rpName = "Kiddo";
  const origin = process.env.WEBAUTHN_ORIGIN || (isProd ? "https://kiddofund.com" : "http://localhost:5000");
  return { rpID, rpName, origin };
}

type SessionWithChallenge = Request["session"] & {
  passkeyChallenge?: string;
  passkeyChallengeUserId?: string;
};

// Helper: get a string-safe representation of a Buffer / Uint8Array
// without throwing on already-string inputs (the library is generous
// about input types).
function bufToB64Url(buf: Uint8Array | string): string {
  if (typeof buf === "string") return buf;
  return Buffer.from(buf).toString("base64url");
}

export function registerPasskeyRoutes(
  app: Express,
  middleware: { isAuthenticated: any },
) {
  const { isAuthenticated } = middleware;

  // ── REGISTER A NEW PASSKEY (authenticated flow) ──────────────────

  // Step 1: server generates the challenge + options the browser will
  // sign with the device's authenticator. Options include the user's
  // existing credentials so the same authenticator isn't double-registered.
  app.post("/api/auth/passkey/register/options", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const email = (req.user as any).email || "";
      const firstName = (req.user as any).firstName || "";
      const userName = email;
      const userDisplay = [firstName, (req.user as any).lastName].filter(Boolean).join(" ") || email;

      // Existing passkeys — pass them in so the browser won't let the
      // user register the same authenticator twice.
      const existing = await db.select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
        .from(passkeys)
        .where(eq(passkeys.userId, userId));

      const { rpID, rpName } = getRpConfig();
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId, "utf8"),
        userName,
        userDisplayName: userDisplay,
        // Recommended attestation pattern: "none" — we don't need to
        // verify the device manufacturer for consumer Kiddo, just that
        // the device controls the private key.
        attestationType: "none",
        excludeCredentials: existing.map((c) => ({
          id: c.credentialId,
          transports: c.transports ? (c.transports.split(",") as any) : undefined,
        })),
        authenticatorSelection: {
          // userVerification "preferred" lets the OS pick the best UX:
          // Face ID / Touch ID / Windows Hello when available, fallback
          // to PIN. "required" would refuse cheaper authenticators.
          userVerification: "preferred",
          // residentKey "preferred" makes the credential discoverable
          // (the user doesn't have to enter email first to log in).
          residentKey: "preferred",
          // Don't restrict to platform — let the user use YubiKeys etc.
        },
      });

      // Stash the challenge in the session for verification.
      (req.session as SessionWithChallenge).passkeyChallenge = options.challenge;
      (req.session as SessionWithChallenge).passkeyChallengeUserId = userId;

      res.json(options);
    } catch (error) {
      console.error("Passkey register options error:", error);
      res.status(500).json({ error: "Could not start passkey registration" });
    }
  });

  // Step 2: browser sends back the attestation. Verify it and persist
  // the public key.
  app.post("/api/auth/passkey/register/verify", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const session = req.session as SessionWithChallenge;
      const expectedChallenge = session.passkeyChallenge;
      const challengeUserId = session.passkeyChallengeUserId;
      if (!expectedChallenge || challengeUserId !== userId) {
        return res.status(400).json({ error: "No passkey registration in progress" });
      }

      const { rpID, origin } = getRpConfig();
      const response = req.body as RegistrationResponseJSON;
      const nickname = String(req.body?.nickname || "").trim() || null;

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: "Passkey verification failed" });
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      // Persist the credential. credentialID + publicKey are bytes;
      // store base64url. counter starts at the value from registration
      // (usually 0). transports are reported by the authenticator and
      // help the browser narrow the prompt on authentication.
      await db.insert(passkeys).values({
        userId,
        credentialId: bufToB64Url(credential.id),
        publicKey: bufToB64Url(credential.publicKey),
        counter: credential.counter,
        nickname,
        transports: Array.isArray(response.response.transports)
          ? response.response.transports.join(",")
          : null,
      } as any);

      // Clear the challenge from session.
      session.passkeyChallenge = undefined;
      session.passkeyChallengeUserId = undefined;

      res.json({
        success: true,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      });
    } catch (error) {
      console.error("Passkey register verify error:", error);
      res.status(500).json({ error: "Could not complete passkey registration" });
    }
  });

  // ── AUTHENTICATE WITH PASSKEY (unauthenticated flow) ─────────────

  // Step 1: server generates challenge. No user context required (the
  // discoverable credential will tell us which user once they sign).
  app.post("/api/auth/passkey/authenticate/options", async (req: Request, res: Response) => {
    try {
      const { rpID } = getRpConfig();
      const options = await generateAuthenticationOptions({
        rpID,
        // Empty allowCredentials = let the browser show every
        // discoverable credential for this RP. The user picks.
        userVerification: "preferred",
      });
      (req.session as SessionWithChallenge).passkeyChallenge = options.challenge;
      res.json(options);
    } catch (error) {
      console.error("Passkey authenticate options error:", error);
      res.status(500).json({ error: "Could not start passkey authentication" });
    }
  });

  // Step 2: browser sends assertion. Verify it and create a session.
  app.post("/api/auth/passkey/authenticate/verify", async (req: Request, res: Response) => {
    try {
      const session = req.session as SessionWithChallenge;
      const expectedChallenge = session.passkeyChallenge;
      if (!expectedChallenge) {
        return res.status(400).json({ error: "No passkey authentication in progress" });
      }

      const { rpID, origin } = getRpConfig();
      const response = req.body as AuthenticationResponseJSON;

      // Look up the credential by its ID.
      const credentialId = response.id;
      const [passkey] = await db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).limit(1);
      if (!passkey) {
        return res.status(404).json({ error: "Passkey not recognized" });
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: passkey.counter,
          transports: passkey.transports ? (passkey.transports.split(",") as any) : undefined,
        },
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.authenticationInfo) {
        return res.status(401).json({ error: "Passkey verification failed" });
      }

      // Update counter to prevent replay. Update lastUsedAt for the
      // Settings UI.
      await db.update(passkeys)
        .set({
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(passkeys.id, passkey.id));

      // Establish session via passport. Look up the user row + call
      // req.login to mirror what the password flow does.
      const [user] = await db.select().from(users).where(eq(users.id, passkey.userId)).limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });

      session.passkeyChallenge = undefined;

      req.login(user as any, (err) => {
        if (err) {
          console.error("Passkey login error:", err);
          return res.status(500).json({ error: "Could not establish session" });
        }
        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
      });
    } catch (error) {
      console.error("Passkey authenticate verify error:", error);
      res.status(500).json({ error: "Could not complete passkey authentication" });
    }
  });

  // ── LIST + DELETE PASSKEYS ────────────────────────────────────────

  app.get("/api/me/passkeys", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const rows = await db.select({
        id: passkeys.id,
        nickname: passkeys.nickname,
        transports: passkeys.transports,
        createdAt: passkeys.createdAt,
        lastUsedAt: passkeys.lastUsedAt,
      })
        .from(passkeys)
        .where(eq(passkeys.userId, userId));
      res.json({ passkeys: rows });
    } catch (error) {
      console.error("Passkey list error:", error);
      res.status(500).json({ error: "Could not load passkeys" });
    }
  });

  app.delete("/api/me/passkeys/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const id = req.params.id;
      // Guard: only delete if it belongs to this user.
      const [existing] = await db.select({ id: passkeys.id })
        .from(passkeys)
        .where(and(eq(passkeys.id, id), eq(passkeys.userId, userId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Passkey not found" });
      await db.delete(passkeys).where(eq(passkeys.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Passkey delete error:", error);
      res.status(500).json({ error: "Could not delete passkey" });
    }
  });
}
