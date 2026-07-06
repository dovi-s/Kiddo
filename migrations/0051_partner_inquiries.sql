-- 0051: partner_inquiries — inbound partnership interest from /partners. 2026-07-06.
--
-- Replaces the raw mailto on the (unlisted, noindex) /partners page with a persisted
-- lead, so partner interest survives email deliverability and is retrievable. Public
-- form, rate-limited at the route. Holds a business contact email + a short message;
-- no minor data, no secrets. Reviewed from the admin side via the `status` column.
--
-- IF NOT EXISTS so a re-run — or the dev DB, where this table may already be created
-- via targeted SQL during the build — is a safe no-op.
-- ⚠️ After applying, run `npm run db:secure`: new Supabase tables default to RLS-off.

CREATE TABLE IF NOT EXISTS "partner_inquiries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_name" text NOT NULL,
	"org_type" text,
	"contact_name" text,
	"email" text NOT NULL,
	"message" text,
	"status" text NOT NULL DEFAULT 'new',
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_inquiries_status_idx" ON "partner_inquiries" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_inquiries_created_idx" ON "partner_inquiries" ("created_at");
