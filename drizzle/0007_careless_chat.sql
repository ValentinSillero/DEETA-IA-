CREATE INDEX "product_business_active_created_idx" ON "product" USING btree ("business_id","is_active","created_at");--> statement-breakpoint
CREATE INDEX "sale_business_status_created_idx" ON "sale" USING btree ("business_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sale_item_business_product_idx" ON "sale_item" USING btree ("business_id","product_id");