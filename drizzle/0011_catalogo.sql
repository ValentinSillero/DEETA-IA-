CREATE TABLE "catalog_product" (
	"barcode" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"size" text,
	"category" text NOT NULL,
	"brand" text,
	"is_kiosk" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_product_barcode_format" CHECK ("catalog_product"."barcode" ~ '^[0-9]{8,14}$')
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "category" text;--> statement-breakpoint
CREATE INDEX "catalog_product_category_idx" ON "catalog_product" USING btree ("category");--> statement-breakpoint
CREATE INDEX "catalog_product_name_idx" ON "catalog_product" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "catalog_product_brand_idx" ON "catalog_product" USING gin (lower(coalesce("brand", '')) gin_trgm_ops);