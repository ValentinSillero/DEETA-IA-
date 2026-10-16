CREATE TYPE "public"."customer_movement_type" AS ENUM('CREDIT_SALE', 'PAYMENT', 'SALE_CANCELLATION', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."sale_payment_method" AS ENUM('CASH', 'TRANSFER', 'CARD', 'CREDIT');--> statement-breakpoint
ALTER TYPE "public"."income_source" ADD VALUE 'CUSTOMER_PAYMENT';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'CREDIT';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'MIXED';--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"document" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"last_movement_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_name_length" CHECK (char_length("customer"."name") between 2 and 120),
	CONSTRAINT "customer_balance_nonnegative" CHECK ("customer"."balance_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_id_business_unique" ON "customer" USING btree ("id","business_id");--> statement-breakpoint
CREATE TABLE "customer_account_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"type" "customer_movement_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"balance_after_cents" bigint NOT NULL,
	"sale_id" text,
	"payment_method" "payment_method",
	"cash_session_id" text,
	"note" text,
	"idempotency_key" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_movement_balance_nonnegative" CHECK ("customer_account_movement"."balance_after_cents" >= 0),
	CONSTRAINT "customer_movement_sign_by_type" CHECK (("customer_account_movement"."type" = 'CREDIT_SALE' and "customer_account_movement"."amount_cents" > 0)
        or ("customer_account_movement"."type" in ('PAYMENT', 'SALE_CANCELLATION') and "customer_account_movement"."amount_cents" < 0)
        or ("customer_account_movement"."type" = 'ADJUSTMENT' and "customer_account_movement"."amount_cents" <> 0)),
	CONSTRAINT "customer_movement_payment_method" CHECK (("customer_account_movement"."type" = 'PAYMENT' and "customer_account_movement"."payment_method" in ('CASH', 'TRANSFER', 'CARD'))
        or ("customer_account_movement"."type" <> 'PAYMENT' and "customer_account_movement"."payment_method" is null))
);
--> statement-breakpoint
CREATE TABLE "sale_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"method" "sale_payment_method" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_payment_amount_positive" CHECK ("sale_payment"."amount_cents" > 0)
);
--> statement-breakpoint
DROP INDEX "income_sale_unique";--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "client_request_id" text;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_account_movement" ADD CONSTRAINT "customer_account_movement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_account_movement" ADD CONSTRAINT "customer_movement_customer_business_fk" FOREIGN KEY ("customer_id","business_id") REFERENCES "public"."customer"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_account_movement" ADD CONSTRAINT "customer_movement_sale_business_fk" FOREIGN KEY ("sale_id","business_id") REFERENCES "public"."sale"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_account_movement" ADD CONSTRAINT "customer_movement_cash_session_business_fk" FOREIGN KEY ("cash_session_id","business_id") REFERENCES "public"."cash_session"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payment" ADD CONSTRAINT "sale_payment_sale_business_fk" FOREIGN KEY ("sale_id","business_id") REFERENCES "public"."sale"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_business_active_name_idx" ON "customer" USING btree ("business_id","is_active","name");--> statement-breakpoint
CREATE INDEX "customer_business_balance_idx" ON "customer" USING btree ("business_id","balance_cents");--> statement-breakpoint
CREATE INDEX "customer_movement_business_customer_created_idx" ON "customer_account_movement" USING btree ("business_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_movement_business_type_created_idx" ON "customer_account_movement" USING btree ("business_id","type","created_at");--> statement-breakpoint
CREATE INDEX "customer_movement_sale_idx" ON "customer_account_movement" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "customer_movement_cash_session_idx" ON "customer_account_movement" USING btree ("cash_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_movement_business_idempotency_unique" ON "customer_account_movement" USING btree ("business_id","idempotency_key") WHERE "customer_account_movement"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_payment_sale_method_unique" ON "sale_payment" USING btree ("sale_id","method");--> statement-breakpoint
CREATE INDEX "sale_payment_business_method_idx" ON "sale_payment" USING btree ("business_id","method");--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_business_fk" FOREIGN KEY ("customer_id","business_id") REFERENCES "public"."customer"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "income_sale_method_unique" ON "income" USING btree ("sale_id","payment_method") WHERE "income"."sale_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_business_client_request_unique" ON "sale" USING btree ("business_id","client_request_id") WHERE "sale"."client_request_id" is not null;--> statement-breakpoint
CREATE INDEX "sale_business_customer_idx" ON "sale" USING btree ("business_id","customer_id");