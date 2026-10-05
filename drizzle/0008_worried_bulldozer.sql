CREATE TYPE "public"."product_import_existing_strategy" AS ENUM('SKIP', 'UPDATE_PRICES', 'UPDATE_PRICES_STOCK');--> statement-breakpoint
CREATE TYPE "public"."product_import_row_status" AS ENUM('PENDING', 'READY', 'WARNING', 'ERROR', 'IMPORTED', 'UPDATED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."product_import_status" AS ENUM('UPLOADED', 'READY', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TABLE "product_import" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"created_by" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"status" "product_import_status" DEFAULT 'UPLOADED' NOT NULL,
	"headers" jsonb NOT NULL,
	"mapping" jsonb,
	"existing_strategy" "product_import_existing_strategy" DEFAULT 'SKIP' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"ready_rows" integer DEFAULT 0 NOT NULL,
	"warning_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"updated_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_import_file_type_supported" CHECK ("product_import"."file_type" in ('CSV', 'XLSX')),
	CONSTRAINT "product_import_file_size_positive" CHECK ("product_import"."file_size" > 0),
	CONSTRAINT "product_import_counts_nonnegative" CHECK ("product_import"."total_rows" >= 0 and "product_import"."ready_rows" >= 0 and "product_import"."warning_rows" >= 0 and "product_import"."error_rows" >= 0 and "product_import"."imported_rows" >= 0 and "product_import"."updated_rows" >= 0 and "product_import"."skipped_rows" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_import_row" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"import_id" text NOT NULL,
	"row_number" integer NOT NULL,
	"raw_values" jsonb NOT NULL,
	"overrides" jsonb,
	"status" "product_import_row_status" DEFAULT 'PENDING' NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"name" text,
	"description" text,
	"barcode" text,
	"cost_price_cents" bigint,
	"sale_price_cents" bigint,
	"initial_stock" integer,
	"minimum_stock" integer,
	"existing_product_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_import_row_number_positive" CHECK ("product_import_row"."row_number" > 1),
	CONSTRAINT "product_import_row_cost_nonnegative" CHECK ("product_import_row"."cost_price_cents" is null or "product_import_row"."cost_price_cents" >= 0),
	CONSTRAINT "product_import_row_sale_nonnegative" CHECK ("product_import_row"."sale_price_cents" is null or "product_import_row"."sale_price_cents" >= 0),
	CONSTRAINT "product_import_row_stock_nonnegative" CHECK ("product_import_row"."initial_stock" is null or "product_import_row"."initial_stock" >= 0),
	CONSTRAINT "product_import_row_minimum_nonnegative" CHECK ("product_import_row"."minimum_stock" is null or "product_import_row"."minimum_stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_import" ADD CONSTRAINT "product_import_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import" ADD CONSTRAINT "product_import_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_import_id_business_unique" ON "product_import" USING btree ("id","business_id");--> statement-breakpoint
ALTER TABLE "product_import_row" ADD CONSTRAINT "product_import_row_import_business_fk" FOREIGN KEY ("import_id","business_id") REFERENCES "public"."product_import"("id","business_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_import_business_created_idx" ON "product_import" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "product_import_created_by_idx" ON "product_import" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "product_import_row_import_number_unique" ON "product_import_row" USING btree ("import_id","row_number");--> statement-breakpoint
CREATE INDEX "product_import_row_business_import_status_idx" ON "product_import_row" USING btree ("business_id","import_id","status");--> statement-breakpoint
CREATE INDEX "product_import_row_import_barcode_idx" ON "product_import_row" USING btree ("import_id","barcode");
