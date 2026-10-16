-- Additive inputs required by the opportunity engine.
ALTER TABLE "market_listings" ADD COLUMN "sales_channel_id" BIGINT;

ALTER TABLE "shipping_quotes" ADD COLUMN "estimated_delivery_days" INTEGER;

CREATE INDEX "market_listings_sales_channel_id_idx" ON "market_listings"("sales_channel_id");

ALTER TABLE "market_listings"
  ADD CONSTRAINT "market_listings_sales_channel_id_fkey"
  FOREIGN KEY ("sales_channel_id") REFERENCES "sales_channels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
