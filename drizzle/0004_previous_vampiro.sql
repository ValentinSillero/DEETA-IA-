CREATE TYPE "public"."expense_payment_method" AS ENUM('CASH', 'TRANSFER', 'CARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"category_id" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"payment_method" "expense_payment_method" NOT NULL,
	"cash_session_id" text,
	"expense_date" date NOT NULL,
	"status" "expense_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by" text NOT NULL,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_amount_positive" CHECK ("expense"."amount_cents" > 0),
	CONSTRAINT "expense_description_length" CHECK (char_length("expense"."description") between 2 and 200),
	CONSTRAINT "expense_cancellation_state" CHECK (("expense"."status" = 'ACTIVE' and "expense"."cancelled_at" is null and "expense"."cancelled_by" is null)
        or ("expense"."status" = 'CANCELLED' and "expense"."cancelled_at" is not null and "expense"."cancelled_by" is not null))
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_category_name_length" CHECK (char_length("expense_category"."name") between 2 and 80)
);
--> statement-breakpoint
ALTER TABLE "business" ADD COLUMN "timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_id_business_unique" ON "expense_category" USING btree ("id","business_id");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_business_fk" FOREIGN KEY ("category_id","business_id") REFERENCES "public"."expense_category"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_cash_session_business_fk" FOREIGN KEY ("cash_session_id","business_id") REFERENCES "public"."cash_session"("id","business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_business_date_status_idx" ON "expense" USING btree ("business_id","expense_date","status");--> statement-breakpoint
CREATE INDEX "expense_business_category_date_idx" ON "expense" USING btree ("business_id","category_id","expense_date");--> statement-breakpoint
CREATE INDEX "expense_cash_session_idx" ON "expense" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "expense_created_at_idx" ON "expense" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_business_name_unique" ON "expense_category" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "expense_category_business_active_idx" ON "expense_category" USING btree ("business_id","is_active");--> statement-breakpoint
INSERT INTO "expense_category" ("id", "business_id", "name")
SELECT 'expense-category-' || md5(b.id || ':' || seed.name), b.id, seed.name
FROM "business" b
CROSS JOIN (VALUES
	('Alquiler'), ('Luz'), ('Agua'), ('Internet'), ('Sueldos'), ('Transporte'),
	('Limpieza'), ('Mantenimiento'), ('Impuestos'), ('Marketing'), ('Otros')
) AS seed(name)
ON CONFLICT ("business_id", "name") DO NOTHING;
