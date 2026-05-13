-- Base schema migration: creates all core tables that were previously applied
-- via db:push but not tracked in migrations. All statements use IF NOT EXISTS
-- so this is safe to run against a database that already has some or all of
-- these tables.
-- statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar UNIQUE,
	"referral_code" varchar(16) UNIQUE,
	"referred_by" varchar REFERENCES "users"("id"),
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"password_hash" varchar,
	"google_id" varchar UNIQUE,
	"is_admin" boolean NOT NULL DEFAULT false,
	"kyc_status" text DEFAULT 'none',
	"kyc_submitted_at" timestamp,
	"kyc_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "funds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"gift_code" text UNIQUE,
	"gift_link_token" text UNIQUE,
	"account_type" text NOT NULL DEFAULT 'UTMA',
	"status" text NOT NULL DEFAULT 'draft',
	"coverage_state" text,
	"trial_ends_at" timestamp,
	"drivewealth_account_id" text,
	"balance" numeric(12,2) NOT NULL DEFAULT '0',
	"pending_balance" numeric(12,2) NOT NULL DEFAULT '0',
	"total_gain" numeric(12,2) NOT NULL DEFAULT '0',
	"gain_percent" numeric(6,2) NOT NULL DEFAULT '0',
	"contributor_count" integer NOT NULL DEFAULT 0,
	"projected_value" numeric(12,2) NOT NULL DEFAULT '0',
	"years_until_maturity" integer,
	"recipient_first_name" text,
	"recipient_relation" text,
	"recipient_birthdate" timestamp,
	"age_18_notified_at" timestamp,
	"investment_strategy" text DEFAULT 'auto_invest',
	"is_discoverable" boolean NOT NULL DEFAULT false,
	"last_contribution_at" timestamp,
	"dormant_notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "funds_gift_code_unique" ON "funds" ("gift_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "funds_gift_link_token_unique" ON "funds" ("gift_link_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funds_coverage_state_idx" ON "funds" ("coverage_state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funds_trial_ends_at_idx" ON "funds" ("trial_ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funds_last_contribution_at_idx" ON "funds" ("last_contribution_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"event_type" text DEFAULT 'birthday',
	"theme" text DEFAULT 'default',
	"goal_amount" numeric(12,2),
	"event_date" timestamp,
	"is_permanent" boolean NOT NULL DEFAULT false,
	"has_event_pass" boolean NOT NULL DEFAULT false,
	"event_pass_purchased_at" timestamp,
	"gift_volume" numeric(12,2) NOT NULL DEFAULT '0',
	"gift_count" integer NOT NULL DEFAULT 0,
	"status" text NOT NULL DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "events_fund_id_idx" ON "events" ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_slug_idx" ON "events" ("slug");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "holdings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"ticker" text NOT NULL,
	"name" text NOT NULL,
	"shares" numeric(12,6) NOT NULL DEFAULT '0',
	"cost_basis" numeric(12,2) NOT NULL DEFAULT '0',
	"current_value" numeric(12,2) NOT NULL DEFAULT '0',
	"gain" numeric(12,2) NOT NULL DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "holdings_fund_id_idx" ON "holdings" ("fund_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fund_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"snapshot_date" timestamp NOT NULL DEFAULT now(),
	"invested_value" numeric(12,2) NOT NULL DEFAULT '0',
	"cash_value" numeric(12,2) NOT NULL DEFAULT '0',
	"total_value" numeric(12,2) NOT NULL DEFAULT '0',
	"principal_basis" numeric(12,2) NOT NULL DEFAULT '0',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fund_snapshots_fund_id_idx" ON "fund_snapshots" ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_snapshots_fund_date_idx" ON "fund_snapshots" ("fund_id", "snapshot_date");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"event_id" varchar REFERENCES "events"("id"),
	"sender_name" text NOT NULL,
	"sender_email" text,
	"amount" numeric(12,2) NOT NULL,
	"processing_fee" numeric(12,2) NOT NULL DEFAULT '0',
	"kora_fee" numeric(12,2) NOT NULL DEFAULT '0',
	"net_amount" numeric(12,2) NOT NULL,
	"message" text,
	"photo_url" text,
	"execution_model" text DEFAULT 'auto_invest',
	"selected_ticker" text,
	"status" text NOT NULL DEFAULT 'pending',
	"stripe_payment_intent_id" text,
	"invested_at" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "gifts_fund_id_idx" ON "gifts" ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifts_event_id_idx" ON "gifts" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifts_status_idx" ON "gifts" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "memory_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"gift_id" varchar REFERENCES "gifts"("id"),
	"type" text NOT NULL DEFAULT 'gift_message',
	"content" text,
	"author_name" text,
	"photo_url" text,
	"video_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "memory_entries_fund_id_idx" ON "memory_entries" ("fund_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"fund_id" varchar REFERENCES "funds"("id"),
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(12,2),
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "activities_user_id_idx" ON "activities" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_fund_id_idx" ON "activities" ("fund_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"stripe_subscription_id" text UNIQUE,
	"stripe_customer_id" text,
	"plan" text NOT NULL DEFAULT 'free',
	"billing_interval" text DEFAULT 'none',
	"status" text NOT NULL DEFAULT 'active',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fund_memberships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"stripe_subscription_id" text UNIQUE,
	"stripe_customer_id" text,
	"plan" text NOT NULL DEFAULT 'starter',
	"billing_interval" text DEFAULT 'monthly',
	"status" text NOT NULL DEFAULT 'active',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fund_memberships_user_id_idx" ON "fund_memberships" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_memberships_fund_id_idx" ON "fund_memberships" ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_memberships_status_idx" ON "fund_memberships" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_memberships_fund_plan_idx" ON "fund_memberships" ("fund_id", "plan");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar REFERENCES "users"("id"),
	"type" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"stripe_invoice_id" text,
	"amount" numeric(12,2) NOT NULL,
	"currency" text NOT NULL DEFAULT 'usd',
	"status" text NOT NULL DEFAULT 'pending',
	"description" text,
	"metadata" text,
	"gift_id" varchar REFERENCES "gifts"("id"),
	"event_id" varchar REFERENCES "events"("id"),
	"fund_id" varchar REFERENCES "funds"("id"),
	"failure_reason" text,
	"refunded_amount" numeric(12,2),
	"refunded_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_stripe_payment_intent_idx" ON "transactions" ("stripe_payment_intent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions" ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL REFERENCES "users"("id"),
	"bank_name" text NOT NULL,
	"account_last4" text NOT NULL,
	"routing_last4" text,
	"account_type" text DEFAULT 'checking',
	"status" text NOT NULL DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bank_accounts_user_id_idx" ON "bank_accounts" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "thank_yous" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"gift_id" varchar REFERENCES "gifts"("id"),
	"sender_name" text NOT NULL,
	"sender_email" text,
	"message" text NOT NULL,
	"status" text NOT NULL DEFAULT 'draft',
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "thank_yous_fund_id_idx" ON "thank_yous" ("fund_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recurring_gifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"sender_name" text NOT NULL,
	"sender_email" text,
	"amount" numeric(12,2) NOT NULL,
	"frequency" text NOT NULL DEFAULT 'monthly',
	"stripe_subscription_id" text,
	"status" text NOT NULL DEFAULT 'active',
	"next_charge_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "recurring_gifts_fund_id_idx" ON "recurring_gifts" ("fund_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fund_collaborators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" varchar NOT NULL REFERENCES "funds"("id"),
	"user_id" varchar REFERENCES "users"("id"),
	"email" text NOT NULL,
	"role" text NOT NULL DEFAULT 'viewer',
	"status" text NOT NULL DEFAULT 'pending',
	"invited_at" timestamp DEFAULT now(),
	"accepted_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fund_collaborators_fund_id_idx" ON "fund_collaborators" ("fund_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "referral_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_code" text NOT NULL,
	"fund_id" varchar REFERENCES "funds"("id"),
	"event_id" varchar REFERENCES "events"("id"),
	"action" text NOT NULL,
	"channel" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "referral_events_ref_code_idx" ON "referral_events" ("ref_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_events_fund_id_idx" ON "referral_events" ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referral_events_action_idx" ON "referral_events" ("action");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL UNIQUE,
	"event_type" text NOT NULL,
	"status" text NOT NULL DEFAULT 'processing',
	"attempts" integer NOT NULL DEFAULT 1,
	"error" text,
	"received_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "webhook_events_type_idx" ON "webhook_events" ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_status_idx" ON "webhook_events" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar REFERENCES "users"("id"),
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" ("resource_type");
