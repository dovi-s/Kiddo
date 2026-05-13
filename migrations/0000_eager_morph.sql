ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "gift_code" text;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "gift_link_token" text;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "coverage_state" text;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "drivewealth_account_id" text;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "age_18_notified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "last_contribution_at" timestamp;
--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN IF NOT EXISTS "dormant_notification_sent_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gifters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"milestone_notifications" boolean DEFAULT true NOT NULL,
	"opted_in_at" timestamp,
	"opted_in_ip" text,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"unsubscribed_at" timestamp,
	"unsubscribe_token" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gifter_funds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gifter_id" varchar NOT NULL,
	"fund_id" varchar NOT NULL,
	"total_contributed" numeric(12, 2) DEFAULT '0' NOT NULL,
	"contribution_count" integer DEFAULT 0 NOT NULL,
	"last_contributed_at" timestamp,
	"last_birthday_reminder_year" integer,
	"last_birthday_reminder_sent_at" timestamp,
	"age_18_notified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "gifter_funds_gifter_id_gifters_id_fk" FOREIGN KEY ("gifter_id") REFERENCES "public"."gifters"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "gifter_funds_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"gifter_id" varchar,
	"fund_id" varchar,
	"gifter_fund_id" varchar,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "notifications_gifter_id_gifters_id_fk" FOREIGN KEY ("gifter_id") REFERENCES "public"."gifters"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "notifications_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "notifications_gifter_fund_id_gifter_funds_id_fk" FOREIGN KEY ("gifter_fund_id") REFERENCES "public"."gifter_funds"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "funds_gift_code_unique" ON "funds" USING btree ("gift_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "funds_gift_link_token_unique" ON "funds" USING btree ("gift_link_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funds_coverage_state_idx" ON "funds" USING btree ("coverage_state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funds_trial_ends_at_idx" ON "funds" USING btree ("trial_ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "funds_last_contribution_at_idx" ON "funds" USING btree ("last_contribution_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gifters_email_unique" ON "gifters" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gifters_unsubscribe_token_unique" ON "gifters" USING btree ("unsubscribe_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifters_unsubscribed_idx" ON "gifters" USING btree ("unsubscribed");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gifter_funds_gifter_fund_unique" ON "gifter_funds" USING btree ("gifter_id","fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifter_funds_gifter_id_idx" ON "gifter_funds" USING btree ("gifter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifter_funds_fund_id_idx" ON "gifter_funds" USING btree ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gifter_funds_last_contributed_at_idx" ON "gifter_funds" USING btree ("last_contributed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_gifter_id_idx" ON "notifications" USING btree ("gifter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_fund_id_idx" ON "notifications" USING btree ("fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_gifter_fund_id_idx" ON "notifications" USING btree ("gifter_fund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_channel_idx" ON "notifications" USING btree ("channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
