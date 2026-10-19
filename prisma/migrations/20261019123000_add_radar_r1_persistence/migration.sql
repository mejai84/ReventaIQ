-- Radar R1: profiles, idempotent runs and immutable market evidence.
CREATE TYPE "RadarSourceMode" AS ENUM ('API', 'WEB_PUBLIC', 'FEED', 'MANUAL', 'CSV');
CREATE TYPE "ScanRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "RadarListingAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'REMOVED', 'UNKNOWN');

CREATE TABLE "scan_profiles" (
  "id" BIGSERIAL NOT NULL,
  "user_id" BIGINT NOT NULL,
  "category_id" BIGINT NOT NULL,
  "brand_id" BIGINT,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "frequency_minutes" INTEGER NOT NULL DEFAULT 1440,
  "min_net_profit_cop" DECIMAL(20,4) NOT NULL,
  "min_roi_rate" DECIMAL(18,8) NOT NULL,
  "max_purchase_price_usd" DECIMAL(20,4),
  "minimum_confidence" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "scan_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scan_profile_sources" (
  "id" BIGSERIAL NOT NULL,
  "scan_profile_id" BIGINT NOT NULL,
  "source_key" TEXT NOT NULL,
  "mode" "RadarSourceMode" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "scan_profile_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scan_profile_targets" (
  "id" BIGSERIAL NOT NULL,
  "scan_profile_id" BIGINT NOT NULL,
  "category_id" BIGINT NOT NULL,
  "product_id" BIGINT,
  "product_variant_id" BIGINT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scan_profile_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scan_runs" (
  "id" BIGSERIAL NOT NULL,
  "scan_profile_id" BIGINT NOT NULL,
  "mode" "RadarSourceMode" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "status" "ScanRunStatus" NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scan_source_runs" (
  "id" BIGSERIAL NOT NULL,
  "scan_run_id" BIGINT NOT NULL,
  "source_key" TEXT NOT NULL,
  "mode" "RadarSourceMode" NOT NULL,
  "status" "ScanRunStatus" NOT NULL DEFAULT 'PENDING',
  "candidate_count" INTEGER NOT NULL DEFAULT 0,
  "accepted_count" INTEGER NOT NULL DEFAULT 0,
  "rejected_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "scan_source_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "radar_listings" (
  "id" BIGSERIAL NOT NULL,
  "source_key" TEXT NOT NULL,
  "external_listing_id" TEXT,
  "canonical_url" TEXT,
  "seller_external_id" TEXT,
  "product_variant_id" BIGINT,
  "availability" "RadarListingAvailability" NOT NULL DEFAULT 'UNKNOWN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "radar_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "radar_listing_observations" (
  "id" BIGSERIAL NOT NULL,
  "radar_listing_id" BIGINT NOT NULL,
  "scan_source_run_id" BIGINT NOT NULL,
  "condition_grade_id" BIGINT,
  "title" TEXT NOT NULL,
  "source_condition" TEXT,
  "price" DECIMAL(20,4),
  "currency_code" CHAR(3),
  "availability" "RadarListingAvailability" NOT NULL DEFAULT 'UNKNOWN',
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "raw_payload" JSONB,
  "content_fingerprint" TEXT NOT NULL,
  "event_code" TEXT,
  "observed_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "radar_listing_observations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scan_profiles_user_id_name_key" ON "scan_profiles"("user_id", "name");
CREATE INDEX "scan_profiles_user_id_is_active_idx" ON "scan_profiles"("user_id", "is_active");
CREATE INDEX "scan_profiles_category_id_idx" ON "scan_profiles"("category_id");
CREATE INDEX "scan_profiles_brand_id_idx" ON "scan_profiles"("brand_id");
CREATE UNIQUE INDEX "scan_profile_sources_scan_profile_id_source_key_key" ON "scan_profile_sources"("scan_profile_id", "source_key");
CREATE INDEX "scan_profile_sources_source_key_is_active_idx" ON "scan_profile_sources"("source_key", "is_active");
CREATE INDEX "scan_profile_targets_scan_profile_id_idx" ON "scan_profile_targets"("scan_profile_id");
CREATE INDEX "scan_profile_targets_category_id_idx" ON "scan_profile_targets"("category_id");
CREATE INDEX "scan_profile_targets_product_id_idx" ON "scan_profile_targets"("product_id");
CREATE INDEX "scan_profile_targets_product_variant_id_idx" ON "scan_profile_targets"("product_variant_id");
CREATE UNIQUE INDEX "scan_runs_scan_profile_id_mode_idempotency_key_key" ON "scan_runs"("scan_profile_id", "mode", "idempotency_key");
CREATE INDEX "scan_runs_scan_profile_id_status_started_at_idx" ON "scan_runs"("scan_profile_id", "status", "started_at" DESC);
CREATE UNIQUE INDEX "scan_source_runs_scan_run_id_source_key_key" ON "scan_source_runs"("scan_run_id", "source_key");
CREATE INDEX "scan_source_runs_source_key_status_idx" ON "scan_source_runs"("source_key", "status");
CREATE UNIQUE INDEX "radar_listings_source_key_external_listing_id_key" ON "radar_listings"("source_key", "external_listing_id");
CREATE UNIQUE INDEX "radar_listings_source_key_canonical_url_key" ON "radar_listings"("source_key", "canonical_url");
CREATE INDEX "radar_listings_product_variant_id_last_seen_at_idx" ON "radar_listings"("product_variant_id", "last_seen_at" DESC);
CREATE INDEX "radar_listings_source_key_last_seen_at_idx" ON "radar_listings"("source_key", "last_seen_at" DESC);
CREATE UNIQUE INDEX "radar_listing_observations_radar_listing_id_content_fingerprint_key" ON "radar_listing_observations"("radar_listing_id", "content_fingerprint");
CREATE INDEX "radar_listing_observations_scan_source_run_id_idx" ON "radar_listing_observations"("scan_source_run_id");
CREATE INDEX "radar_listing_observations_radar_listing_id_observed_at_idx" ON "radar_listing_observations"("radar_listing_id", "observed_at" DESC);
CREATE INDEX "radar_listing_observations_condition_grade_id_idx" ON "radar_listing_observations"("condition_grade_id");

ALTER TABLE "scan_profiles" ADD CONSTRAINT "scan_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profiles" ADD CONSTRAINT "scan_profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profiles" ADD CONSTRAINT "scan_profiles_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profile_sources" ADD CONSTRAINT "scan_profile_sources_scan_profile_id_fkey" FOREIGN KEY ("scan_profile_id") REFERENCES "scan_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profile_targets" ADD CONSTRAINT "scan_profile_targets_scan_profile_id_fkey" FOREIGN KEY ("scan_profile_id") REFERENCES "scan_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profile_targets" ADD CONSTRAINT "scan_profile_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profile_targets" ADD CONSTRAINT "scan_profile_targets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_profile_targets" ADD CONSTRAINT "scan_profile_targets_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_scan_profile_id_fkey" FOREIGN KEY ("scan_profile_id") REFERENCES "scan_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_source_runs" ADD CONSTRAINT "scan_source_runs_scan_run_id_fkey" FOREIGN KEY ("scan_run_id") REFERENCES "scan_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "radar_listings" ADD CONSTRAINT "radar_listings_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "radar_listing_observations" ADD CONSTRAINT "radar_listing_observations_radar_listing_id_fkey" FOREIGN KEY ("radar_listing_id") REFERENCES "radar_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "radar_listing_observations" ADD CONSTRAINT "radar_listing_observations_scan_source_run_id_fkey" FOREIGN KEY ("scan_source_run_id") REFERENCES "scan_source_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "radar_listing_observations" ADD CONSTRAINT "radar_listing_observations_condition_grade_id_fkey" FOREIGN KEY ("condition_grade_id") REFERENCES "condition_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;