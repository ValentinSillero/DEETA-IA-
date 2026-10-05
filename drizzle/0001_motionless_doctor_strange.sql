CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('INITIAL', 'IN', 'OUT', 'ADJUSTMENT', 'SALE', 'PURCHASE', 'RETURN');--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cost_price_cents" bigint NOT NULL,
	"sale_price_cents" bigint NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"minimum_stock" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_cost_price_nonnegative" CHECK ("product"."cost_price_cents" >= 0),
	CONSTRAINT "product_sale_price_nonnegative" CHECK ("product"."sale_price_cents" >= 0),
	CONSTRAINT "product_current_stock_nonnegative" CHECK ("product"."current_stock" >= 0),
	CONSTRAINT "product_minimum_stock_nonnegative" CHECK ("product"."minimum_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"product_id" text NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"resulting_stock" integer NOT NULL,
	"reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_previous_nonnegative" CHECK ("stock_movement"."previous_stock" >= 0),
	CONSTRAINT "stock_movement_resulting_nonnegative" CHECK ("stock_movement"."resulting_stock" >= 0),
	CONSTRAINT "stock_movement_quantity_direction" CHECK ((("stock_movement"."type" in ('INITIAL', 'IN', 'PURCHASE', 'RETURN') and "stock_movement"."quantity" > 0) or ("stock_movement"."type" in ('OUT', 'SALE') and "stock_movement"."quantity" < 0) or "stock_movement"."type" = 'ADJUSTMENT'))
);
--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_id_business_unique" ON "product" USING btree ("id","business_id");--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_business_fk" FOREIGN KEY ("product_id","business_id") REFERENCES "public"."product"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_business_barcode_unique" ON "product" USING btree ("business_id","barcode") WHERE "product"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "product_business_active_idx" ON "product" USING btree ("business_id","is_active");--> statement-breakpoint
CREATE INDEX "product_business_name_idx" ON "product" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "product_name_search_idx" ON "product" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "product_barcode_search_idx" ON "product" USING gin ("barcode" gin_trgm_ops) WHERE "barcode" is not null;--> statement-breakpoint
CREATE INDEX "stock_movement_business_product_created_idx" ON "stock_movement" USING btree ("business_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_created_by_idx" ON "stock_movement" USING btree ("created_by");
