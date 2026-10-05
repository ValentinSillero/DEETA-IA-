CREATE TYPE "public"."scanner_event_status" AS ENUM('FOUND', 'NOT_FOUND', 'OUT_OF_STOCK');--> statement-breakpoint
CREATE TYPE "public"."scanner_pairing_status" AS ENUM('WAITING', 'CONNECTED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TABLE "scanner_pairing_session" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"created_by" text NOT NULL,
	"target_cart_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "scanner_pairing_status" DEFAULT 'WAITING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanner_scan_event" (
	"id" text PRIMARY KEY NOT NULL,
	"sequence" bigserial NOT NULL,
	"business_id" text NOT NULL,
	"pairing_session_id" text NOT NULL,
	"product_id" text,
	"barcode" text NOT NULL,
	"format" text,
	"status" "scanner_event_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scanner_event_barcode_length" CHECK (char_length("scanner_scan_event"."barcode") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "scanner_pairing_session" ADD CONSTRAINT "scanner_pairing_session_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_pairing_session" ADD CONSTRAINT "scanner_pairing_session_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scanner_pairing_id_business_unique" ON "scanner_pairing_session" USING btree ("id","business_id");--> statement-breakpoint
ALTER TABLE "scanner_scan_event" ADD CONSTRAINT "scanner_event_pairing_business_fk" FOREIGN KEY ("pairing_session_id","business_id") REFERENCES "public"."scanner_pairing_session"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_scan_event" ADD CONSTRAINT "scanner_event_product_business_fk" FOREIGN KEY ("product_id","business_id") REFERENCES "public"."product"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scanner_pairing_token_hash_unique" ON "scanner_pairing_session" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "scanner_pairing_active_cart_unique" ON "scanner_pairing_session" USING btree ("business_id","target_cart_id") WHERE "scanner_pairing_session"."status" in ('WAITING', 'CONNECTED');--> statement-breakpoint
CREATE INDEX "scanner_pairing_business_status_idx" ON "scanner_pairing_session" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "scanner_pairing_expires_idx" ON "scanner_pairing_session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scanner_event_sequence_unique" ON "scanner_scan_event" USING btree ("sequence");--> statement-breakpoint
CREATE INDEX "scanner_event_pairing_sequence_idx" ON "scanner_scan_event" USING btree ("pairing_session_id","sequence");--> statement-breakpoint
CREATE INDEX "scanner_event_business_created_idx" ON "scanner_scan_event" USING btree ("business_id","created_at");
