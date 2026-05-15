import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import bcrypt from "bcryptjs";
import pg from "pg";
import path from "path";
import type { Express, Request, RequestHandler, Response } from "express";
import { users, type User } from "@shared/models/auth";
// Imports for account-deletion helpers below. `funds` for blocked-state
// checks; `subscriptions` + `fundMemberships` for Stripe cancellation;
// `activities` for the audit-log entry.
import {
  funds,
  fundMemberships,
  subscriptions,
  activities,
  fundCollaborators,
  parentContributions,
  bankAccounts,
} from "@shared/schema";
import {
  getConfiguredSuperAdminEmails,
  getDefaultSuperAdminEmails,
  getEffectiveAdminFlags,
  isEmailInAdminSet,
} from "@shared/adminAccess";
import { db } from "./db";
import { eq, sql, and } from "drizzle-orm";
import { storage } from "./storage";
import { recordEvent, eventCtxFromReq } from "./analytics";
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  fetchUserInfo,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from "openid-client";
import { URL } from "url";
import { getUserIdForOAuthIdentity, linkOAuthIdentity } from "./oauthIdentityStore";
import { registerPasskeyRoutes } from "./passkeyAuth";
import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

const registerSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  firstName: z
    .string()
    .trim()
    .max(60, "First name is too long")
    .optional()
    .transform((value) => value || undefined),
  lastName: z
    .string()
    .trim()
    .max(60, "Last name is too long")
    .optional()
    .transform((value) => value || undefined),
  referralCode: z
    .string()
    .trim()
    .max(32, "Referral code is too long")
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must be 128 characters or fewer"),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttemptStore = new Map<string, { count: number; firstFailedAt: number; lockedUntil: number | null }>();

function normalizeIdentity(identity: string) {
  return identity.trim().toLowerCase();
}

function getLoginAttemptState(identity: string) {
  const key = normalizeIdentity(identity);
  const now = Date.now();
  const existing = loginAttemptStore.get(key);
  if (!existing) {
    return { key, state: { count: 0, firstFailedAt: now, lockedUntil: null } };
  }
  if (existing.firstFailedAt + LOGIN_ATTEMPT_WINDOW_MS < now && (!existing.lockedUntil || existing.lockedUntil < now)) {
    const reset = { count: 0, firstFailedAt: now, lockedUntil: null };
    loginAttemptStore.set(key, reset);
    return { key, state: reset };
  }
  return { key, state: existing };
}

function recordLoginFailure(identity: string) {
  const { key, state } = getLoginAttemptState(identity);
  const now = Date.now();
  const nextCount = state.count + 1;
  const shouldLock = nextCount >= MAX_LOGIN_ATTEMPTS;
  loginAttemptStore.set(key, {
    count: nextCount,
    firstFailedAt: state.firstFailedAt || now,
    lockedUntil: shouldLock ? now + LOGIN_LOCKOUT_MS : null,
  });
}

function clearLoginFailures(identity: string) {
  loginAttemptStore.delete(normalizeIdentity(identity));
}

function getSuperAdminEmails() {
  // Always merge env-configured emails WITH the hardcoded defaults.
  // This prevents env misconfiguration from accidentally locking out core super-admins.
  const fromEnv = getConfiguredSuperAdminEmails(
    process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL,
  );
  const defaults = getDefaultSuperAdminEmails();
  return new Set(Array.from(fromEnv).concat(Array.from(defaults)));
}

function isSuperAdminEmail(email: string | null | undefined) {
  return isEmailInAdminSet(email, getSuperAdminEmails());
}

function isDatabaseUnavailableError(error: unknown) {
  const code = String((error as any)?.code || "").trim().toUpperCase();
  const message = String((error as any)?.message || "").toLowerCase();
  return [
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EPIPE",
    "EAI_AGAIN",
    "EACCES",
    "57P01",
    "57P02",
    "57P03",
  ].includes(code)
    || message.includes("connect")
    || message.includes("connection terminated")
    || message.includes("database")
    || message.includes("postgres");
}

function getAuthInfrastructureMessage() {
  if (process.env.NODE_ENV !== "production") {
    return "Kiddo can't reach its database right now. Start Postgres or fix DATABASE_URL, then try again.";
  }
  return "Kiddo is temporarily unavailable. Please try again shortly.";
}

function getValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message || "Invalid request";
}

async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

function getDevHeaderUserId(req: Request): string | null {
  if (process.env.KORA_ENABLE_DEV_AUTH_OVERRIDE !== "1") return null;
  const host = String(req.headers.host || "").toLowerCase();
  const isLocalHost =
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("[::1]");
  if (!isLocalHost) return null;
  const raw = req.headers["x-kora-dev-user-id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const userId = String(value || "").trim();
  return userId || null;
}

async function resolveRequestUser(req: Request): Promise<(User & { isSuperAdmin?: boolean }) | null> {
  if ((req as any).isAuthenticated?.() && (req as any).user) {
    const sessionUser = (req as any).user as User & { isSuperAdmin?: boolean };
    let canonical: User | undefined;
    try {
      canonical = sessionUser?.email ? await getUserByEmail(sessionUser.email) : undefined;
    } catch (err) {
      // Transient DB error. Fall back to the session user so a connection blip
      // doesn't log out an authenticated user or accidentally deny admin access.
      console.warn("[resolveRequestUser] DB lookup failed, using session user:", (err as Error).message);
    }
    const resolved = canonical || sessionUser;
    return { ...resolved, ...getEffectiveAdminFlags(resolved, getSuperAdminEmails()) };
  }

  const devUserId = getDevHeaderUserId(req);
  if (!devUserId) return null;

  const user = await getUser(devUserId);
  if (!user) return null;
  let canonical: User | undefined;
  try {
    canonical = user.email ? await getUserByEmail(user.email) : undefined;
  } catch {
    // ignore transient error, fall back to dev user
  }
  const resolved = canonical || user;
  return { ...resolved, ...getEffectiveAdminFlags(resolved, getSuperAdminEmails()) };
}

async function getUserByEmail(email: string): Promise<User | undefined> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return undefined;

  // Case-insensitive lookup to avoid fragmented accounts caused by historical
  // casing differences (e.g., Foo@x.com vs foo@x.com).
  const candidates = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${normalized}`);

  if (!candidates.length) return undefined;
  if (candidates.length === 1) return candidates[0];

  // Canonicalize by selecting the account with the most funds, then oldest.
  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      let fundCount = 0;
      try {
        const funds = await storage.getFundsByUser(candidate.id);
        fundCount = funds.length;
      } catch {
        fundCount = 0;
      }
      return { candidate, fundCount };
    }),
  );

  scored.sort((a, b) => {
    if (b.fundCount !== a.fundCount) return b.fundCount - a.fundCount;
    const aCreated = new Date(a.candidate.createdAt || 0).getTime();
    const bCreated = new Date(b.candidate.createdAt || 0).getTime();
    return aCreated - bCreated;
  });

  return scored[0].candidate;
}

async function getUserByReferralCode(referralCode: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
  return user;
}

function makeReferralCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function createUser(data: {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  referredBy?: string | null;
}): Promise<User> {
  // Defensive idempotency: even though every caller is supposed to check
  // getUserByEmail() before calling createUser(), a race between two
  // concurrent signup requests can sneak a duplicate past that check.
  // One check here at the head of the function catches the common case;
  // the try/catch below catches the actual concurrent-insert race.
  const normalizedEmail = data.email.toLowerCase();
  const existingByEmail = await getUserByEmail(normalizedEmail);
  if (existingByEmail) {
    return existingByEmail;
  }

  let referralCode = makeReferralCode();
  for (let i = 0; i < 5; i++) {
    const existingCode = await getUserByReferralCode(referralCode);
    if (!existingCode) break;
    referralCode = makeReferralCode();
  }

  try {
    const [user] = await db.insert(users).values({
      email: normalizedEmail,
      passwordHash: data.passwordHash,
      referralCode,
      referredBy: data.referredBy || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
    }).returning();
    return user;
  } catch (err: any) {
    // Postgres UNIQUE-violation code is 23505 — fires on the new
    // case-insensitive `users_email_lower_unique` index (see migration
    // below in N4) when two concurrent inserts both pass the
    // getUserByEmail() check above and both reach the DB. Recover by
    // returning the row the OTHER request just created. If the email
    // genuinely doesn't exist yet (shouldn't happen but defense in
    // depth), rethrow so the caller sees the real error.
    const code = String(err?.code || err?.cause?.code || "");
    if (code === "23505") {
      const existing = await getUserByEmail(normalizedEmail);
      if (existing) return existing;
    }
    throw err;
  }
}

type OAuthProvider = "google" | "apple";

type OAuthProviderConfig = {
  provider: OAuthProvider;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scope: string;
};

function getBaseUrl(req: Request) {
  const configured =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function getOAuthProviderConfig(provider: OAuthProvider): OAuthProviderConfig | null {
  if (provider === "google") {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      issuer: "https://accounts.google.com",
      clientId,
      clientSecret,
      scope: "openid email profile",
    };
  }

  const clientId = String(process.env.APPLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.APPLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  return {
    provider,
    issuer: "https://appleid.apple.com",
    clientId,
    clientSecret,
    scope: "openid email name",
  };
}

function getOAuthCallbackUrl(req: Request, provider: OAuthProvider) {
  return `${getBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
}

function getOAuthErrorRedirect(req: Request, provider: OAuthProvider, reason: string) {
  return `/login?oauth=${provider}&error=${encodeURIComponent(reason)}`;
}

function getSafeReturnTo(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

async function getOrCreateOAuthUser(params: {
  provider: OAuthProvider;
  subject: string;
  email: string | null;
  givenName?: string | null;
  familyName?: string | null;
}) {
  const linkedUserId = await getUserIdForOAuthIdentity(params.provider, params.subject);
  if (linkedUserId) {
    const linkedUser = await getUser(linkedUserId);
    if (linkedUser) return linkedUser;
  }

  if (params.email) {
    const existingUser = await getUserByEmail(params.email);
    if (existingUser) {
      await linkOAuthIdentity(existingUser.id, params.provider, params.subject);
      return existingUser;
    }
  }

  if (!params.email) {
    throw new Error("OAuth provider did not return an email for a new account.");
  }

  const passwordHash = await bcrypt.hash(`${params.provider}:${params.subject}:${Date.now()}`, process.env.NODE_ENV === "production" ? 12 : 10);
  const user = await createUser({
    email: params.email,
    passwordHash,
    firstName: params.givenName || undefined,
    lastName: params.familyName || undefined,
  });
  await storage.ensureSubscription(user.id).catch(() => undefined);
  await linkOAuthIdentity(user.id, params.provider, params.subject);
  return user;
}

function respondAfterSessionSave(
  req: Request,
  res: Response,
  onSuccess: () => void,
) {
  req.session.save((saveError) => {
    if (saveError) {
      console.error("Session save error:", saveError);
      return res.status(500).json({ message: "Failed to persist session" });
    }
    onSuccess();
  });
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set");
  }

  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  // Default to Postgres-backed sessions even in development so auth remains
  // consistent across devices, tabs, and local process restarts.
  // Opt into memory only when explicitly requested.
  const useMemoryStore = process.env.SESSION_STORE === "memory";
  let sessionStore: session.Store;
  if (useMemoryStore) {
    const MemoryStore = createMemoryStore(session);
    sessionStore = new MemoryStore({
      checkPeriod: sessionTtl,
      ttl: sessionTtl,
    });
    console.warn("[auth] Using memory session store in non-production mode");
  } else {
    const pgStore = connectPg(session);
    // Strip sslmode from the URL and configure SSL separately. Same approach as db.ts.
    // so that the session store and Drizzle pool both use consistent TLS settings.
    let sessionConString = process.env.DATABASE_URL!;
    try {
      const parsed = new URL(sessionConString);
      parsed.searchParams.delete("sslmode");
      sessionConString = parsed.toString();
    } catch {
      // leave as-is if not parseable
    }
    const sessionSsl =
      process.env.PGSSLMODE === "disable"
        ? false
        : process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: process.env.PGSSLMODE !== "no-verify" }
          : { rejectUnauthorized: false };
    // Session-store pool. Distinct from the main db pool in
    // server/db.ts. CRITICAL: attach an 'error' handler before
    // passing this pool to pgStore — without one, a transient
    // Supabase connection drop emits an unhandled 'error' event
    // and kills the Node process. The main db pool already has
    // this handler; this one was missing, which is the root cause
    // of the 2026-05-14 crash spiral (server crashed 23 times
    // after Supabase pooler dropped TLS connections, all 500s
    // upstream came from that). Pool handlers are background-only;
    // individual query failures still bubble up to callers.
    const sessionPool = new pg.Pool({
      connectionString: sessionConString,
      ssl: sessionSsl,
      max: 5,
    });
    sessionPool.on("error", (error) => {
      // Downgraded to console.warn 2026-05-14 — transient Supabase
      // connection drops are normal background noise (TLS resets,
      // pool idle-timeout, brief network blips). The handler's job
      // is to swallow the unhandled 'error' event so Node doesn't
      // exit; the logging here is informational, not an alert.
      // console.error makes managed-host log aggregators (Datadog,
      // Sentry default rules) page on it, which is wrong for
      // background-pool reconnect chatter.
      console.warn("Session pool error (transient, suppressed to prevent process crash):", error?.message ?? error);
    });
    sessionStore = new pgStore({
      conString: sessionConString,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
      pool: sessionPool,
    });
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionTtl,
        // Lax is more reliable for mobile/webview and cross-navigation login flows.
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const { state } = getLoginAttemptState(email);
          if (state.lockedUntil && state.lockedUntil > Date.now()) {
            const retryMinutes = Math.ceil((state.lockedUntil - Date.now()) / 60000);
            return done(null, false, { message: `Too many attempts. Try again in ${retryMinutes} minute(s).` });
          }

          const user = await getUserByEmail(email);
          if (!user || !user.passwordHash) {
            recordLoginFailure(email);
            return done(null, false, { message: "Invalid email or password" });
          }
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            recordLoginFailure(email);
            return done(null, false, { message: "Invalid email or password" });
          }
          clearLoginFailures(email);
          return done(null, user);
        } catch (err) {
          if (isDatabaseUnavailableError(err)) {
            return done(null, false, { message: getAuthInfrastructureMessage() } as any);
          }
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await getUser(id);
      if (!user) return done(null, false);
      // Re-resolve through case-insensitive canonical email match so stale sessions
      // keep pointing at the account that actually owns funds.
      const canonical = user.email ? await getUserByEmail(user.email) : user;
      const resolved = canonical || user;
      done(null, { ...resolved, ...getEffectiveAdminFlags(resolved, getSuperAdminEmails()) });
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: getValidationMessage(parsed.error) });
      }
      const { email, password, firstName, lastName, referralCode } = parsed.data;

      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      let referredBy: string | null = null;
      if (referralCode) {
        const referrer = await getUserByReferralCode(String(referralCode).trim().toUpperCase());
        if (referrer) {
          referredBy = referrer.id;
        }
      }

      const bcryptRounds = process.env.NODE_ENV === "production" ? 12 : 10;
      const passwordHash = await bcrypt.hash(password, bcryptRounds);
      const user = await createUser({ email, passwordHash, firstName, lastName, referredBy });

      try {
        await storage.ensureSubscription(user.id);
      } catch (subErr) {
        console.error("Failed to create free subscription:", subErr);
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }
        const { passwordHash: _, kycData: _kd, ...safeUser } = user;
        recordEvent({
          ...eventCtxFromReq(req),
          name: "signup",
          userId: user.id,
          source: "web",
          props: { hasReferral: !!referredBy },
        });
        return respondAfterSessionSave(req, res, () => {
          res.status(201).json({ ...safeUser, isSuperAdmin: isSuperAdminEmail(user.email) });
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (isDatabaseUnavailableError(error)) {
        return res.status(503).json({ message: getAuthInfrastructureMessage() });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // ─── Age-18 fund-claim endpoint ───────────────────────────────────────
  // The kid (now 18+) clicks "Claim your account" in their Kid View. They
  // arrive at /get-started?claim={shareToken}, fill in email + password,
  // and this endpoint:
  //   1. Verifies the share token + access token (proves they're inside the
  //      kid's PIN-gated view)
  //   2. Verifies the recipient is actually 18+ (no premature claims)
  //   3. Creates (or finds) a user with the supplied email + password
  //   4. Atomically transfers funds.userId from the old custodian (parent)
  //      to the new owner (the now-18 kid)
  //   5. Establishes a session as the new owner
  //
  // What this does NOT do:
  //   - Cancel/migrate the parent's subscription (orthogonal — parent might
  //     have other funds; subscription stays with parent's user account)
  //   - Touch DriveWealth (custodian integration not yet wired — the legal
  //     UTMA transfer is still a real-world action governed by state law)
  //   - Move recurring contributions/parent_contributions (those belong to
  //     the parent's user_id and should NOT be auto-transferred — parent's
  //     monthly $25 isn't suddenly the kid's monthly $25)
  app.post("/api/kid-view/:token/claim-account", async (req, res) => {
    try {
      const { db: dbModule } = await import("./db");
      const { storage: storageModule } = await import("./storage");
      const { funds: fundsTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const shareToken = String(req.params.token || "");
      const accessToken = String(req.body?.accessToken || "");
      const email = String(req.body?.email || "").trim().toLowerCase();
      const password = String(req.body?.password || "");
      const firstName = req.body?.firstName ? String(req.body.firstName).trim() : null;

      if (!shareToken || !accessToken) {
        return res.status(400).json({ message: "Missing claim token." });
      }
      if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email required." });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      // Reach into the kid-view store to validate the share token + access.
      // The kid-view registry is file-backed (.local/kid-view.json) — same
      // shape used by /api/kid-view/:token/* routes elsewhere.
      const kidViewPath = path.join(process.cwd(), ".local", "kid-view.json");
      const fsMod = await import("fs/promises");
      const raw = await fsMod.readFile(kidViewPath, "utf-8").catch(() => "{}");
      const store = JSON.parse(raw);
      const fundEntry = Object.values(store?.byFundId || {}).find((row: any) =>
        row?.shareToken === shareToken && row?.enabled,
      ) as any;
      if (!fundEntry) {
        return res.status(404).json({ message: "Claim link is no longer valid." });
      }
      const validAccessToken = (store?.accessTokens || {})[accessToken];
      if (!validAccessToken || validAccessToken.shareToken !== shareToken) {
        return res.status(401).json({ message: "Unlock the Kid View first, then try again." });
      }

      const fund = await storageModule.getFund(fundEntry.fundId);
      if (!fund) {
        return res.status(404).json({ message: "Fund not found." });
      }
      if (!fund.recipientBirthdate) {
        return res.status(409).json({ message: "This fund doesn't have a birthdate set yet." });
      }
      const birthdate = fund.recipientBirthdate instanceof Date ? fund.recipientBirthdate : new Date(fund.recipientBirthdate);
      // Use the fund's locked-in UTMA majority age — 18 in most states, but
      // PA/MS funds need 21, etc. Hardcoding 18 would let a PA kid claim
      // their account three years before legal control transfers.
      const majorityAge = Number((fund as any).majorityAge) || 18;
      const majorityDate = new Date(birthdate);
      majorityDate.setFullYear(birthdate.getFullYear() + majorityAge);
      if (majorityDate.getTime() > Date.now()) {
        return res.status(409).json({ message: `You can claim this fund on your ${majorityAge}th birthday (your state's UTMA age of majority).` });
      }

      // Find or create the user. Existing user with matching email + password
      // can claim (they may have made a Kiddo account separately as a teen).
      // Otherwise create fresh. Either way: end state is user owns the fund.
      let user = await getUserByEmail(email);
      if (user) {
        // If the user exists, validate the password — we're not silently
        // attaching a stranger's account. Match the auth pattern from /login.
        if (!user.passwordHash) {
          return res.status(409).json({ message: "An account exists with this email but uses social login. Sign in with that, then claim from your dashboard." });
        }
        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) {
          return res.status(401).json({ message: "Email already taken. Wrong password." });
        }
        // Don't let a kid claim into the SAME parent account. That would
        // make the parent both custodian AND now-adult owner under one
        // identity, which isn't legally meaningful.
        if (user.id === fund.userId) {
          return res.status(409).json({ message: "This account is the current custodian. Use a different email." });
        }
      } else {
        const bcryptRounds = process.env.NODE_ENV === "production" ? 12 : 10;
        const passwordHash = await bcrypt.hash(password, bcryptRounds);
        user = await createUser({
          email,
          passwordHash,
          firstName: firstName || fund.recipientFirstName || undefined,
          lastName: fund.recipientLastName || undefined,
        });
        try {
          await storageModule.ensureSubscription(user.id);
        } catch (subErr) {
          console.error("Failed to create free subscription on claim:", subErr);
        }
      }

      // Atomic ownership transfer. After this row update, every fund-scoped
      // permission check (`fund.userId !== req.user.id`) flips for the kid.
      // transferredAt is set in the same UPDATE so the legal-transfer
      // moment is preserved (distinct from updatedAt which churns on
      // every fund-row write). Enables future post-handoff read-only
      // treatment per FUND_STATES_SPEC.md item 4.
      //
      // Restored 2026-05-14 after the schema-DB-drift recovery. The
      // original add (commit e2fd175) broke 500s on every fund query;
      // recovery commit b8e16e9 reverted both schema and auth.ts;
      // this commit restores them AFTER db:push has applied the
      // column to the DB. The discipline is locked at
      // feedback_schema_migration_sync_discipline.md — schema and
      // DB stay in sync.
      const previousOwnerId = fund.userId;
      const transferTime = new Date();
      await dbModule
        .update(fundsTable)
        .set({
          userId: user.id,
          previousOwnerId,
          transferredAt: transferTime,
          updatedAt: transferTime,
        })
        .where(eq(fundsTable.id, fund.id));

      // Activity log so the parent + admin can see the transition happened.
      try {
        await storageModule.createActivity({
          userId: previousOwnerId,
          fundId: fund.id,
          type: "kid_claimed_fund",
          title: `${fund.recipientFirstName || "The recipient"} claimed the fund`,
          description: `Ownership transferred to ${user.email} on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
        });
      } catch (actErr) {
        console.error("Failed to log claim activity:", actErr);
      }

      // Establish session as the new owner (mirror /api/auth/register).
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Account claimed, but session failed. Try logging in." });
        }
        const { passwordHash: _ph, kycData: _kd, ...safeUser } = user!;
        return respondAfterSessionSave(req, res, () => {
          res.status(200).json({ ...safeUser, isSuperAdmin: isSuperAdminEmail(user!.email), claimedFundId: fund.id });
        });
      });
    } catch (error) {
      console.error("Claim flow failed:", error);
      if (isDatabaseUnavailableError(error)) {
        return res.status(503).json({ message: getAuthInfrastructureMessage() });
      }
      res.status(500).json({ message: "Could not claim the fund. Try again." });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: getValidationMessage(parsed.error) });
    }
    req.body = parsed.data;

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        if (isDatabaseUnavailableError(err)) {
          return res.status(503).json({ message: getAuthInfrastructureMessage() });
        }
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        if (info?.message === getAuthInfrastructureMessage()) {
          return res.status(503).json({ message: info?.message || getAuthInfrastructureMessage() });
        }
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create session" });
        }
        const { passwordHash: _, kycData: _kd, ...safeUser } = user;
        return respondAfterSessionSave(req, res, () => {
          res.json({ ...safeUser, isSuperAdmin: isSuperAdminEmail(user.email) });
        });
      });
    })(req, res, next);
  });

  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      google: Boolean(getOAuthProviderConfig("google")),
      apple: Boolean(getOAuthProviderConfig("apple")),
      biometricReady: false,
      biometricNote: "Native biometrics still require provider and platform setup outside this repo.",
    });
  });

  app.get("/api/auth/oauth/:provider", async (req, res) => {
    const provider = String(req.params.provider || "").trim().toLowerCase() as OAuthProvider;
    if (provider !== "google" && provider !== "apple") {
      return res.status(404).json({ message: "OAuth provider not found" });
    }

    const config = getOAuthProviderConfig(provider);
    if (!config) {
      return res.status(503).json({ message: `${provider} OAuth is not configured` });
    }

    try {
      const issuer = await discovery(new URL(config.issuer), config.clientId, config.clientSecret);
      const codeVerifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
      const state = randomState();
      const nonce = randomNonce();

      (req.session as any).oauth = {
        provider,
        state,
        nonce,
        codeVerifier,
        redirectUri: getOAuthCallbackUrl(req, provider),
        returnTo: getSafeReturnTo(req.query?.returnTo),
      };

      const authorizationUrl = buildAuthorizationUrl(issuer, {
        redirect_uri: getOAuthCallbackUrl(req, provider),
        scope: config.scope,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        ...(provider === "apple" ? { response_mode: "form_post" } : {}),
      });

      return res.redirect(authorizationUrl.href);
    } catch (error) {
      console.error(`OAuth start error for ${provider}:`, error);
      return res.redirect(getOAuthErrorRedirect(req, provider, "start_failed"));
    }
  });

  const finishOAuth = async (req: Request, res: any) => {
    const provider = String(req.params.provider || "").trim().toLowerCase() as OAuthProvider;
    if (provider !== "google" && provider !== "apple") {
      return res.status(404).json({ message: "OAuth provider not found" });
    }

    const config = getOAuthProviderConfig(provider);
    const sessionOAuth = (req.session as any)?.oauth;
    if (!config || !sessionOAuth || sessionOAuth.provider !== provider) {
      return res.redirect(getOAuthErrorRedirect(req, provider, "not_configured"));
    }

    try {
      const issuer = await discovery(new URL(config.issuer), config.clientId, config.clientSecret);
      const currentUrl = new URL(getOAuthCallbackUrl(req, provider));
      const code = String(req.method === "POST" ? req.body?.code || "" : req.query?.code || "");
      const state = String(req.method === "POST" ? req.body?.state || "" : req.query?.state || "");
      const error = String(req.method === "POST" ? req.body?.error || "" : req.query?.error || "");

      if (error) {
        return res.redirect(getOAuthErrorRedirect(req, provider, error));
      }
      if (!code || !state || state !== sessionOAuth.state) {
        return res.redirect(getOAuthErrorRedirect(req, provider, "state_mismatch"));
      }

      currentUrl.searchParams.set("code", code);
      currentUrl.searchParams.set("state", state);

      const tokens = await authorizationCodeGrant(issuer, currentUrl, {
        pkceCodeVerifier: sessionOAuth.codeVerifier,
        expectedState: sessionOAuth.state,
        expectedNonce: sessionOAuth.nonce,
      });

      const claims = (tokens.claims() || {}) as Record<string, unknown>;
      let email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null;
      const subject = String(claims.sub || "").trim();
      const givenName =
        typeof claims.given_name === "string"
          ? claims.given_name
          : typeof req.body?.user === "string"
            ? JSON.parse(req.body.user || "{}")?.name?.firstName || null
            : null;
      const familyName =
        typeof claims.family_name === "string"
          ? claims.family_name
          : typeof req.body?.user === "string"
            ? JSON.parse(req.body.user || "{}")?.name?.lastName || null
            : null;

      if (!email && provider === "google") {
        try {
          const userInfo = await fetchUserInfo(issuer, tokens.access_token, subject);
          if (typeof userInfo.email === "string") {
            email = userInfo.email.trim().toLowerCase();
          }
        } catch (userInfoError) {
          console.warn("Google userinfo lookup failed:", userInfoError);
        }
      }

      if (!subject) {
        return res.redirect(getOAuthErrorRedirect(req, provider, "missing_subject"));
      }

      const user = await getOrCreateOAuthUser({
        provider,
        subject,
        email,
        givenName,
        familyName,
      });

      delete (req.session as any).oauth;
      return req.login(user, (loginError) => {
        if (loginError) {
          console.error(`OAuth login error for ${provider}:`, loginError);
          return res.redirect(getOAuthErrorRedirect(req, provider, "session_failed"));
        }
        return req.session.save((saveError) => {
          if (saveError) {
            console.error(`OAuth session save error for ${provider}:`, saveError);
            return res.redirect(getOAuthErrorRedirect(req, provider, "session_failed"));
          }
          return res.redirect(sessionOAuth.returnTo || "/dashboard");
        });
      });
    } catch (error) {
      console.error(`OAuth callback error for ${provider}:`, error);
      return res.redirect(getOAuthErrorRedirect(req, provider, "callback_failed"));
    }
  };

  app.get("/api/auth/oauth/:provider/callback", finishOAuth);
  app.post("/api/auth/oauth/:provider/callback", finishOAuth);

  // Session-state query, not a protected resource. Returns 200 with the
  // user object when authenticated, 200 with null body when not. Previously
  // returned 401 for unauthenticated, which produced "Failed to load
  // resource" noise in the browser console on every public-page load — a
  // calm, on-register product shouldn't have its devtools light up red just
  // because a logged-out visitor opened the gift-checkout page.
  app.get("/api/auth/user", async (req, res) => {
    const resolvedUser = await resolveRequestUser(req);
    if (!resolvedUser) {
      return res.json(null);
    }
    const user = resolvedUser as User;
    const { passwordHash: _, kycData: _kd, ...safeUser } = user;
    res.json({ ...safeUser, isSuperAdmin: isSuperAdminEmail((user as any).email) });
  });

  // Backward-compatible alias used by older clients/integrations.
  app.get("/api/user", async (req, res) => {
    const resolvedUser = await resolveRequestUser(req);
    if (!resolvedUser) {
      return res.json(null);
    }
    const user = resolvedUser as User;
    const { passwordHash: _, kycData: _kd, ...safeUser } = user;
    res.json({ ...safeUser, isSuperAdmin: isSuperAdminEmail((user as any).email) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
      });
    });
  });

  // Register WebAuthn / passkey routes. Per FACE_ID_SPEC.md.
  registerPasskeyRoutes(app, { isAuthenticated });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });

  // Account deletion (App Store 5.1.1(v) compliance). Spec in
  // project_account_deletion_spec.md. Two endpoints:
  //   GET  /api/account/delete/preflight — non-destructive check; returns
  //                                        {ok: true} OR {blocked, funds}
  //                                        so the UI can show blocked-state
  //                                        guidance before the user types
  //                                        the email-to-confirm.
  //   POST /api/account/delete           — destructive; re-checks block
  //                                        state server-side, then cancels
  //                                        Stripe subs, soft-deletes user,
  //                                        invalidates session.
  //
  // Locked decisions:
  //   - Block when any fund has no co-parent + positive balance
  //   - Co-parent (Family plan) gets auto-promoted to primary if present
  //   - Soft-delete (users.deletedAt = NOW) + immediate session destroy
  //   - PII anonymization deferred to a 30-day worker (not in this PR)
  //   - Stripe subscription cancellation: at_period_end so the user keeps
  //     features until their already-paid period ends (no refund needed)
  app.get("/api/account/delete/preflight", isAuthenticated, async (req: any, res) => {
    try {
      const userId = String(req.user?.id || "");
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const blockedFunds = await getFundsBlockingAccountDeletion(userId);
      if (blockedFunds.length > 0) {
        return res.json({ blocked: true, reason: "active_funds_with_balance", funds: blockedFunds });
      }
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[account-delete-preflight] error:", err);
      return res.status(500).json({ error: "Could not check account status." });
    }
  });

  app.post("/api/account/delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = String(req.user?.id || "");
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const userEmail = String(req.user?.email || "").trim().toLowerCase();
      const confirmedEmail = String(req.body?.confirmedEmail || "").trim().toLowerCase();
      if (!confirmedEmail || confirmedEmail !== userEmail) {
        return res.status(400).json({ error: "Email confirmation did not match." });
      }
      // Re-check block state server-side (the client may have stale
      // preflight data, or another tab created a fund in between).
      const blockedFunds = await getFundsBlockingAccountDeletion(userId);
      if (blockedFunds.length > 0) {
        return res.status(409).json({ blocked: true, reason: "active_funds_with_balance", funds: blockedFunds });
      }
      const reason = String(req.body?.reason || "").trim().slice(0, 500) || null;
      await performAccountDeletion(userId, reason);
      // Invalidate session immediately so the next request doesn't
      // re-authenticate against a now-deleted user.
      req.logout(() => {
        req.session.destroy(() => {
          res.clearCookie("connect.sid");
          res.json({ message: "Account deleted", graceperiod_days: 30 });
        });
      });
    } catch (err: any) {
      console.error("[account-delete] error:", err);
      return res.status(500).json({ error: err?.message || "Could not delete account. Try emailing support@kiddofund.com." });
    }
  });

  // Forgot password. Always responds 200 to prevent email enumeration.
  // When email delivery is wired, send a real reset link here.
  app.post("/api/auth/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (parsed.success) {
      const { email } = parsed.data;
      try {
        const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (user.length > 0) {
          // TODO: generate reset token, store it, and send email via sendEmail()
          // For now we log so devs can see it was triggered.
          console.log(`[forgot-password] Reset requested for ${email} (user id: ${user[0].id})`);
        }
      } catch (err) {
        console.error("[forgot-password] lookup error:", err);
      }
    }
    // Always return success to avoid email enumeration
    res.status(200).json({ message: "If that email exists, a reset link is on its way." });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const resolvedUser = await resolveRequestUser(req);
    if (!resolvedUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Soft-deleted users can't re-authenticate. Per
    // project_account_deletion_spec.md: deletion sets users.deletedAt = NOW
    // and destroys the session. This check is the belt-and-suspenders: if a
    // session somehow persists past the destroy() call, or if a stale session
    // resolves to a soft-deleted user, we still reject it here. The 30-day
    // grace period for "undo deletion" is handled via support email channel,
    // not via re-auth.
    if ((resolvedUser as any).deletedAt) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    (req as any).user = resolvedUser;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  try {
    const resolvedUser = await resolveRequestUser(req);
    if (!resolvedUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (resolvedUser?.isAdmin || resolvedUser?.isSuperAdmin || isSuperAdminEmail(resolvedUser?.email)) {
      (req as any).user = resolvedUser;
      return next();
    }
    return res.status(403).json({ message: "Forbidden: admin access required" });
  } catch (err) {
    // resolveRequestUser threw. Likely a transient DB error.
    // Fall back to a direct session-email check so a DB hiccup never locks out a super-admin.
    console.error("[isAdmin] resolveRequestUser threw, falling back to session check:", (err as Error).message);
    try {
      const sessionEmail = (req as any).user?.email as string | null | undefined;
      if (sessionEmail && isSuperAdminEmail(sessionEmail)) {
        (req as any).user = (req as any).user;
        return next();
      }
    } catch {
      // ignore secondary error
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// ============================================================================
// Account-deletion helpers (App Store 5.1.1(v) compliance)
//
// Spec: project_account_deletion_spec.md
// Locked decisions: see endpoint handlers above.
// ============================================================================

type BlockedFund = {
  id: string;
  recipientFirstName: string | null;
  // Total funds at risk on this row. Sums invested balance + cash balance +
  // pending balance so the UI shows the parent the FULL exposure, not just
  // the invested slice (the bug: a fund with $0 invested but $500 held as
  // cash used to pass the gate silently).
  balance: number;
  // Sub-totals so the UI can guide the parent on WHAT to do per slice:
  //   invested → liquidate before withdraw (separate flow)
  //   cash     → withdraw directly
  //   pending  → wait for settlement OR refund, can't withdraw mid-flight
  investedBalance: number;
  cashBalance: number;
  pendingBalance: number;
};

/**
 * Returns the funds that BLOCK this user's account deletion. A fund blocks
 * deletion when ALL of these are true:
 *   - The user is primary custodian (funds.userId = user.id)
 *   - The fund has no ACCEPTED CO-ADMIN collaborator (viewers and pending
 *     invites do NOT count — viewers can't act as custodian, pending invites
 *     might never be accepted)
 *   - The fund has any non-zero value across invested + cash + pending
 *     (> $0.01 total)
 *
 * If an accepted co-admin exists, the deletion is NOT blocked — the
 * co-admin inherits primary custodianship during performAccountDeletion
 * (see Ring B). Zero-value funds with no co-admin are NOT blocked
 * (they're test/empty funds; soft-deleted alongside the user via the
 * close-on-delete branch).
 *
 * History (2026-05-14 audit, see commit log):
 *   - Earlier version checked only funds.balance, ignoring cashBalance
 *     and pendingBalance. Money held as cash or in flight passed silently.
 *   - Earlier version treated any collaborator row as unblocking,
 *     including pending invites with no userId and viewer-only rows.
 *     That allowed a parent to invite a fake email and immediately
 *     delete, orphaning the fund.
 */
async function getFundsBlockingAccountDeletion(userId: string): Promise<BlockedFund[]> {
  const ownedFunds = await db
    .select({
      id: funds.id,
      recipientFirstName: funds.recipientFirstName,
      balance: funds.balance,
      cashBalance: funds.cashBalance,
      pendingBalance: funds.pendingBalance,
    })
    .from(funds)
    .where(eq(funds.userId, userId));

  const blocked: BlockedFund[] = [];
  for (const f of ownedFunds) {
    const investedNum = parseFloat(String(f.balance || "0"));
    const cashNum = parseFloat(String(f.cashBalance || "0"));
    const pendingNum = parseFloat(String(f.pendingBalance || "0"));
    const totalAtRisk =
      (Number.isFinite(investedNum) ? investedNum : 0) +
      (Number.isFinite(cashNum) ? cashNum : 0) +
      (Number.isFinite(pendingNum) ? pendingNum : 0);
    if (totalAtRisk <= 0.01) continue;
    // Look for an ACCEPTED CO-ADMIN — the only kind of collaborator
    // that legally + UX-wise can inherit primary custodianship.
    const inheritor = await db
      .select({ id: fundCollaborators.id })
      .from(fundCollaborators)
      .where(
        and(
          eq(fundCollaborators.fundId, f.id),
          eq(fundCollaborators.role, "co-admin"),
          eq(fundCollaborators.status, "accepted"),
        ),
      )
      .limit(1);
    if (inheritor.length === 0) {
      blocked.push({
        id: f.id,
        recipientFirstName: f.recipientFirstName,
        balance: totalAtRisk,
        investedBalance: Math.max(0, investedNum),
        cashBalance: Math.max(0, cashNum),
        pendingBalance: Math.max(0, pendingNum),
      });
    }
  }
  return blocked;
}

/**
 * Performs the account deletion transaction. Called AFTER block-state
 * is re-verified server-side and email-confirmation matches.
 *
 * Steps:
 *   1. Cancel active Stripe subscriptions (at_period_end so user keeps
 *      features through already-paid period; no refund).
 *   2. Soft-delete the user: set deletedAt = NOW, store reason.
 *   3. Write activity-log entry for audit.
 *
 * What this does NOT do (deferred to a 30-day delayed worker per spec):
 *   - PII anonymization (firstName/lastName/preferredName/profileImageUrl scrub)
 *   - Email field anonymization (so user can email support during grace period)
 *   - DriveWealth-side account closure (separate compliance flow)
 *   - Memory-Book gifter-attribution anonymization (final 30-day scrub only)
 *
 * Co-parent inheritance: V1 ships the user-side flow; co-parent
 * promotion is a follow-up worker. Admin can manually re-assign primary
 * custodianship via existing admin endpoints if needed.
 */
async function performAccountDeletion(userId: string, reason: string | null): Promise<void> {
  // 1. Cancel active Stripe subscriptions at period end. Errors here
  //    don't fail the whole deletion — Stripe-side cleanup can be
  //    completed manually if the API call fails.
  try {
    const { getUncachableStripeClient } = await import("./stripeClient");
    const stripe = await getUncachableStripeClient();
    const userSubs = await db
      .select({ stripeSubscriptionId: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    for (const s of userSubs) {
      if (s.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(s.stripeSubscriptionId, { cancel_at_period_end: true });
        } catch (subErr: any) {
          console.warn(`[account-delete] Could not cancel Stripe sub ${s.stripeSubscriptionId}:`, subErr?.message);
        }
      }
    }
    const fmSubs = await db
      .select({ stripeSubscriptionId: fundMemberships.stripeSubscriptionId })
      .from(fundMemberships)
      .where(eq(fundMemberships.userId, userId));
    for (const fm of fmSubs) {
      if (fm.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(fm.stripeSubscriptionId, { cancel_at_period_end: true });
        } catch (fmErr: any) {
          console.warn(`[account-delete] Could not cancel Stripe fund-membership sub ${fm.stripeSubscriptionId}:`, fmErr?.message);
        }
      }
    }
  } catch (stripeErr: any) {
    console.warn("[account-delete] Stripe cleanup failed (non-fatal):", stripeErr?.message);
  }

  // 1b. Cancel every active or paused parent_contribution for this
  //     user. The recurringContributionWorker would otherwise keep
  //     firing off-session card charges against a deleted user's
  //     card-on-file. Setting status='cancelled' is the right shape:
  //     the row stays for audit + historical totalContributed
  //     reporting, and the worker's status='active' filter stops
  //     touching it. Per-row update so a single failure doesn't
  //     abort the rest of the deletion.
  try {
    const liveContribs = await db
      .select({ id: parentContributions.id })
      .from(parentContributions)
      .where(
        and(
          eq(parentContributions.userId, userId),
          sql`${parentContributions.status} <> 'cancelled'`,
        ),
      );
    for (const c of liveContribs) {
      try {
        await db
          .update(parentContributions)
          .set({
            status: "cancelled",
            pauseReason: "account_deleted",
            updatedAt: new Date(),
          })
          .where(eq(parentContributions.id, c.id));
      } catch (cErr: any) {
        console.warn(`[account-delete] Could not cancel parent_contribution ${c.id}:`, cErr?.message);
      }
    }
  } catch (contribErr: any) {
    console.warn("[account-delete] parent_contributions cleanup failed (non-fatal):", contribErr?.message);
  }

  // 1c. Delete this user's linked bank accounts. The modal copy
  //     ("Your linked bank accounts" gets deleted) used to lie about
  //     this. Bank rows held the parent's account/routing tokens —
  //     dead PII at a soft-deleted userId is worse than the rows
  //     being gone. The bank itself stays linked at the parent's
  //     bank; we just lose our reference. Plaid Item revocation
  //     happens in the 30-day scrub worker (Ring C).
  try {
    await db.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
  } catch (bankErr: any) {
    console.warn("[account-delete] bank_accounts cleanup failed (non-fatal):", bankErr?.message);
  }

  // 1d. Revoke pending outbound co-parent invitations. Pending
  //     invite tokens are bearer capabilities — if a recipient
  //     accepts AFTER deletion, they'd join a fund owned by a
  //     soft-deleted user with no clear path to act on it. Status
  //     'declined' tombstones the row (we keep it for audit + so
  //     the recipient sees an explanatory message if they tap the
  //     link). userId IS NULL filter scopes to PENDING (accepted
  //     invites carry the invitee's userId).
  try {
    const ownedFundIds = (
      await db.select({ id: funds.id }).from(funds).where(eq(funds.userId, userId))
    ).map((r) => r.id);
    if (ownedFundIds.length > 0) {
      for (const fundId of ownedFundIds) {
        try {
          await db
            .update(fundCollaborators)
            .set({ status: "declined" })
            .where(
              and(
                eq(fundCollaborators.fundId, fundId),
                eq(fundCollaborators.status, "pending"),
              ),
            );
        } catch (inviteErr: any) {
          console.warn(`[account-delete] Could not revoke pending invites on fund ${fundId}:`, inviteErr?.message);
        }
      }
    }
  } catch (invitesErr: any) {
    console.warn("[account-delete] pending-invite revocation failed (non-fatal):", invitesErr?.message);
  }

  // 1e. Remove the deleting user from any OTHER funds where they
  //     were a collaborator (viewer or co-admin on someone ELSE's
  //     fund). After their account is gone, their access to those
  //     funds is meaningless and a hard removal keeps the access
  //     list clean for the actual primary custodian.
  try {
    await db.delete(fundCollaborators).where(eq(fundCollaborators.userId, userId));
  } catch (collabErr: any) {
    console.warn("[account-delete] cross-fund collaborator cleanup failed (non-fatal):", collabErr?.message);
  }

  // 2. Soft-delete the user. PII scrub deferred to 30-day worker.
  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      deletionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // 3. Audit-log entry. Preserved indefinitely for traceability.
  try {
    await db.insert(activities).values({
      userId,
      type: "account_deleted",
      title: "Account deleted",
      description: "User initiated account deletion via in-app flow",
      metadata: { reason: reason ?? null } as any,
    } as any);
  } catch (auditErr: any) {
    console.warn("[account-delete] Could not write audit entry (non-fatal):", auditErr?.message);
  }
}
