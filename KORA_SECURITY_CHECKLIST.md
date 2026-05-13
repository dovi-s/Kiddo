# Kora Security Checklist

This repo does not use the exact `Clerk + Next.js + Supabase + Upstash` stack from the strategy examples.

This checklist translates the same intent into the stack that actually exists here:

- Express + Vite
- Passport local auth + OAuth providers
- `express-session` with Postgres-backed sessions
- Drizzle + Postgres
- Stripe webhooks
- Zod / drizzle-zod validation

## Authentication

- [x] Session secret required at startup in `server/env.ts`
- [x] Sessions stored in Postgres by default in `server/auth.ts`
- [x] Cookies are `httpOnly`
- [x] Cookies are `secure` in production
- [x] Cookies use `sameSite: "lax"` for reliable login flows
- [x] Local auth login uses brute-force lockout after repeated failures
- [x] OAuth login supports Google and Apple when configured
- [x] Auth endpoints validate input with Zod before touching the database

## API Validation

- [x] Core auth routes validate request bodies with Zod in `server/auth.ts`
- [x] Fund, event, gift, memory, referral, and recurring gift flows already use Drizzle/Zod schemas in `server/routes.ts`
- [ ] New write endpoints should use `safeParse` or `parse` before business logic
- [ ] Avoid ad hoc request parsing when a schema can express the contract

## Database Safety

- [x] Drizzle query builder is the default path for database access
- [x] Case-insensitive email lookups are parameterized in auth flows
- [ ] Avoid string-built SQL in any new code
- [ ] Review existing raw JSON parsing helpers when touching related files

## Webhooks And Payments

- [x] Stripe webhook handling verifies signatures before processing
- [x] Production env validation requires Stripe webhook/config keys
- [ ] Keep payment operations idempotent when adding new Stripe actions
- [ ] Never log sensitive payment payloads beyond what is needed for debugging

## Headers And Runtime

- [x] Security headers are set in `server/index.ts`
- [x] CSP is applied at the Express layer
- [x] HSTS is enabled in production
- [x] Referrer, frame, MIME sniffing, and permissions protections are enabled
- [ ] Revisit CSP when adding third-party scripts or embeds

## Secrets And Environment

- [x] Environment variables are validated at startup in `server/env.ts`
- [x] Placeholder session secrets are rejected
- [x] Production startup fails when critical payment keys are missing
- [ ] Do not expose server-only env vars to client code
- [ ] Do not commit real `.env` files

## Content And Trust

- [x] User-facing content is checked by `script/lint-content.cjs`
- [x] Repo voice guide lives in `KORA_VOICE.md`
- [ ] Fix any content-lint failures before shipping
- [ ] Avoid generic trust copy when a concrete fact can be stated instead

## Before Production Deploys

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] Verify auth register/login/forgot-password manually
- [ ] Verify Stripe webhook configuration in the target environment
- [ ] Verify `SESSION_SECRET` is real and unique
- [ ] Verify `DATABASE_URL` points at the intended environment
- [ ] Review any newly added routes for validation and auth coverage
