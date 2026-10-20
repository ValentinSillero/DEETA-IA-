ALTER TABLE "catalog_product" ADD COLUMN "relevance" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD COLUMN "excluded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD COLUMN "excluded_reason" text;