CREATE TYPE "public"."cash_session_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."income_source" AS ENUM('SALE', 'OTHER', 'SERVICE', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."income_status" AS ENUM('ACTIVE', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'TRANSFER', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "cash_session" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"opened_by" text NOT NULL,
	"closed_by" text,
	"opening_amount_cents" bigint NOT NULL,
	"expected_cash_cents" bigint NOT NULL,
	"declared_cash_cents" bigint,
	"difference_cents" bigint,
	"status" "cash_session_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_session_opening_nonnegative" CHECK ("cash_session"."opening_amount_cents" >= 0),
	CONSTRAINT "cash_session_expected_nonnegative" CHECK ("cash_session"."expected_cash_cents" >= 0),
	CONSTRAINT "cash_session_closed_values" CHECK (("cash_session"."status" = 'OPEN' and "cash_session"."closed_at" is null and "cash_session"."closed_by" is null and "cash_session"."declared_cash_cents" is null and "cash_session"."difference_cents" is null)
        or ("cash_session"."status" = 'CLOSED' and "cash_session"."closed_at" is not null and "cash_session"."closed_by" is not null and "cash_session"."declared_cash_cents" is not null and "cash_session"."difference_cents" is not null))
);
--> statement-breakpoint
CREATE TABLE "income" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"sale_id" text,
	"cash_session_id" text,
	"amount_cents" bigint NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"source" "income_source" NOT NULL,
	"status" "income_status" DEFAULT 'ACTIVE' NOT NULL,
	"reversed_by" text,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_amount_positive" CHECK ("income"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"cash_session_id" text,
	"total_cents" bigint NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "sale_status" DEFAULT 'COMPLETED' NOT NULL,
	"created_by" text NOT NULL,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_total_positive" CHECK ("sale"."total_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "sale_item" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"unit_cost_cents" bigint NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_item_quantity_positive" CHECK ("sale_item"."quantity" > 0),
	CONSTRAINT "sale_item_price_nonnegative" CHECK ("sale_item"."unit_price_cents" >= 0),
	CONSTRAINT "sale_item_cost_nonnegative" CHECK ("sale_item"."unit_cost_cents" >= 0),
	CONSTRAINT "sale_item_subtotal_nonnegative" CHECK ("sale_item"."subtotal_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cash_session_id_business_unique" ON "cash_session" USING btree ("id","business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_id_business_unique" ON "sale" USING btree ("id","business_id");--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_opened_by_user_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_sale_business_fk" FOREIGN KEY ("sale_id","business_id") REFERENCES "public"."sale"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_cash_session_business_fk" FOREIGN KEY ("cash_session_id","business_id") REFERENCES "public"."cash_session"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_cash_session_business_fk" FOREIGN KEY ("cash_session_id","business_id") REFERENCES "public"."cash_session"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_business_fk" FOREIGN KEY ("sale_id","business_id") REFERENCES "public"."sale"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_business_fk" FOREIGN KEY ("product_id","business_id") REFERENCES "public"."product"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_session_one_open_per_business" ON "cash_session" USING btree ("business_id") WHERE "cash_session"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "cash_session_business_opened_idx" ON "cash_session" USING btree ("business_id","opened_at");--> statement-breakpoint
CREATE UNIQUE INDEX "income_sale_unique" ON "income" USING btree ("sale_id") WHERE "income"."sale_id" is not null;--> statement-breakpoint
CREATE INDEX "income_business_created_idx" ON "income" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "income_cash_session_idx" ON "income" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "sale_business_created_idx" ON "sale" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_cash_session_idx" ON "sale" USING btree ("cash_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_item_sale_product_unique" ON "sale_item" USING btree ("sale_id","product_id");--> statement-breakpoint
CREATE INDEX "sale_item_product_idx" ON "sale_item" USING btree ("product_id");
