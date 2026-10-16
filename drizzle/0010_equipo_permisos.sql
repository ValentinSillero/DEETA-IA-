CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'MANAGER';--> statement-breakpoint
ALTER TYPE "public"."member_role" ADD VALUE 'SELLER';--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" text NOT NULL,
	"accepted_by" text,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_invitation_email_lowercase" CHECK ("business_invitation"."email" = lower("business_invitation"."email")),
	CONSTRAINT "business_invitation_role_assignable" CHECK ("business_invitation"."role" <> 'EMPLOYEE')
);
--> statement-breakpoint
DROP INDEX "business_member_user_unique";--> statement-breakpoint
ALTER TABLE "business_member" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invitation" ADD CONSTRAINT "business_invitation_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invitation" ADD CONSTRAINT "business_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_invitation" ADD CONSTRAINT "business_invitation_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_business_created_idx" ON "audit_log" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_business_entity_idx" ON "audit_log" USING btree ("business_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_invitation_token_hash_unique" ON "business_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "business_invitation_pending_email_unique" ON "business_invitation" USING btree ("business_id","email") WHERE "business_invitation"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "business_invitation_business_status_idx" ON "business_invitation" USING btree ("business_id","status");--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_member_user_current_unique" ON "business_member" USING btree ("user_id") WHERE "business_member"."is_current";--> statement-breakpoint
CREATE INDEX "business_member_user_idx" ON "business_member" USING btree ("user_id");--> statement-breakpoint
CREATE VIEW "active_membership" AS SELECT "id", "business_id", "user_id", "role", "is_current" FROM "business_member" WHERE "is_current";
