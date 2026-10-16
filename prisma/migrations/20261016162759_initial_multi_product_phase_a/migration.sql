-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('MANUAL', 'API', 'FEED', 'CSV');

-- CreateEnum
CREATE TYPE "AttributeValueType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'DISPATCHED', 'IN_CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('USER', 'SYSTEM', 'IMPORT');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SOLD_OUT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISMISSED', 'PURCHASED');

-- CreateEnum
CREATE TYPE "OpportunitySignal" AS ENUM ('STRONG_BUY', 'BUY', 'WATCH', 'REJECT');

-- CreateEnum
CREATE TYPE "PartAuthenticity" AS ENUM ('ORIGINAL', 'REPLACED_OEM', 'REPLACED_THIRD_PARTY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FeatureState" AS ENUM ('PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ImeiStatus" AS ENUM ('CLEAN', 'BLOCKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CarrierLockStatus" AS ENUM ('UNLOCKED', 'LOCKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IcloudStatus" AS ENUM ('CLEAR', 'LOCKED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WarrantyReserveBasis" AS ENUM ('LANDED_COST', 'SALE_PRICE');

-- CreateEnum
CREATE TYPE "ConservativePriceStrategy" AS ENUM ('MEDIAN_DISCOUNT', 'PERCENTILE', 'MINIMUM');

-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "CommercialIdentifierType" AS ENUM ('GTIN', 'UPC', 'EAN', 'MPN', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalIdentifierSource" AS ENUM ('CONNECTOR', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "IdentifierPromotionStatus" AS ENUM ('OBSERVED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "auth_subject" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "initial_capital_cop" DECIMAL(20,4) NOT NULL,
    "available_capital_cop" DECIMAL(20,4) NOT NULL,
    "financed_principal_cop" DECIMAL(20,4) NOT NULL,
    "monthly_financing_rate" DECIMAL(18,8) NOT NULL,
    "financing_days_per_month" INTEGER NOT NULL,
    "minimum_profit_cop" DECIMAL(20,4) NOT NULL,
    "minimum_roi_rate" DECIMAL(18,8) NOT NULL,
    "target_monthly_sales" INTEGER,
    "cash_reserve_rate" DECIMAL(18,8) NOT NULL,
    "warranty_reserve_rate" DECIMAL(18,8) NOT NULL,
    "warranty_reserve_basis" "WarrantyReserveBasis" NOT NULL,
    "fx_spread_rate" DECIMAL(18,8) NOT NULL,
    "safety_margin_rate" DECIMAL(18,8) NOT NULL,
    "default_expected_days_to_sell" INTEGER,
    "max_capital_per_product_rate" DECIMAL(18,8) NOT NULL,
    "conservative_price_strategy" "ConservativePriceStrategy" NOT NULL,
    "conservative_price_parameter" DECIMAL(18,8),
    "signal_rules" JSONB NOT NULL,
    "score_config" JSONB NOT NULL,
    "calculation_policy_version" TEXT NOT NULL,
    "score_policy_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condition_grades" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score_value" DECIMAL(7,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "condition_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "brand_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "release_year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "manufacturer_sku" TEXT,
    "gtin" TEXT,
    "manufacturer_part_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "product_weight_g" DECIMAL(10,3),
    "product_length_cm" DECIMAL(10,3),
    "product_width_cm" DECIMAL(10,3),
    "product_height_cm" DECIMAL(10,3),
    "product_volume_cm3" DECIMAL(12,3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_external_identifiers" (
    "id" BIGSERIAL NOT NULL,
    "product_variant_id" BIGINT,
    "identifier_type" "CommercialIdentifierType" NOT NULL,
    "identifier_value" TEXT NOT NULL,
    "normalized_value" TEXT,
    "source_key" TEXT NOT NULL,
    "source_kind" "ExternalIdentifierSource" NOT NULL DEFAULT 'CONNECTOR',
    "external_listing_key" TEXT,
    "supplier_offer_id" BIGINT,
    "market_listing_id" BIGINT,
    "promotion_status" "IdentifierPromotionStatus" NOT NULL DEFAULT 'OBSERVED',
    "promoted_at" TIMESTAMPTZ(3),
    "reviewed_by_user_id" BIGINT,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variant_external_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" BIGSERIAL NOT NULL,
    "category_id" BIGINT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value_type" "AttributeValueType" NOT NULL,
    "is_comparable" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_attribute_values" (
    "id" BIGSERIAL NOT NULL,
    "product_variant_id" BIGINT NOT NULL,
    "attribute_definition_id" BIGINT NOT NULL,
    "value_text" TEXT,
    "value_number" DECIMAL(18,8),
    "value_boolean" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variant_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "website_url" TEXT,
    "connector_key" TEXT NOT NULL,
    "integration_mode" "IntegrationMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_offers" (
    "id" BIGSERIAL NOT NULL,
    "created_by_user_id" BIGINT NOT NULL,
    "supplier_id" BIGINT NOT NULL,
    "product_variant_id" BIGINT NOT NULL,
    "condition_grade_id" BIGINT NOT NULL,
    "external_id" TEXT,
    "source_url" TEXT,
    "raw_title" TEXT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "purchase_price" DECIMAL(20,4) NOT NULL,
    "us_shipping" DECIMAL(20,4),
    "us_sales_tax" DECIMAL(20,4),
    "payment_fee" DECIMAL(20,4),
    "other_purchase_cost" DECIMAL(20,4),
    "available_quantity" INTEGER,
    "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "battery_health_percent" DECIMAL(7,4),
    "screen_authenticity" "PartAuthenticity",
    "battery_authenticity" "PartAuthenticity",
    "face_id_state" "FeatureState",
    "true_tone_state" "FeatureState",
    "cameras_state" "FeatureState",
    "imei_status" "ImeiStatus",
    "carrier_lock_status" "CarrierLockStatus",
    "icloud_status" "IcloudStatus",
    "dents_notes" TEXT,
    "scratches_notes" TEXT,
    "supplier_warranty_days" INTEGER,
    "seller_reputation_rate" DECIMAL(7,4),
    "seller_review_count" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplaces" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "website_url" TEXT,
    "connector_key" TEXT NOT NULL,
    "integration_mode" "IntegrationMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_listings" (
    "id" BIGSERIAL NOT NULL,
    "created_by_user_id" BIGINT NOT NULL,
    "marketplace_id" BIGINT NOT NULL,
    "product_variant_id" BIGINT NOT NULL,
    "condition_grade_id" BIGINT NOT NULL,
    "external_id" TEXT,
    "source_url" TEXT,
    "raw_title" TEXT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "battery_health_percent" DECIMAL(7,4),
    "screen_authenticity" "PartAuthenticity",
    "battery_authenticity" "PartAuthenticity",
    "face_id_state" "FeatureState",
    "true_tone_state" "FeatureState",
    "cameras_state" "FeatureState",
    "imei_status" "ImeiStatus",
    "carrier_lock_status" "CarrierLockStatus",
    "icloud_status" "IcloudStatus",
    "seller_name" TEXT,
    "seller_reputation_rate" DECIMAL(7,4),
    "location" TEXT,
    "is_comparable" BOOLEAN NOT NULL DEFAULT true,
    "exclusion_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_providers" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website_url" TEXT,
    "connector_key" TEXT NOT NULL,
    "integration_mode" "IntegrationMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipping_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_quotes" (
    "id" BIGSERIAL NOT NULL,
    "created_by_user_id" BIGINT NOT NULL,
    "supplier_offer_id" BIGINT NOT NULL,
    "shipping_provider_id" BIGINT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "item_weight_lb" DECIMAL(10,3),
    "weight_source" TEXT,
    "volumetric_divisor" DECIMAL(18,8),
    "international_shipping" DECIMAL(20,4) NOT NULL,
    "handling" DECIMAL(20,4) NOT NULL,
    "insurance" DECIMAL(20,4),
    "customs" DECIMAL(20,4),
    "tariff" DECIMAL(20,4),
    "vat" DECIMAL(20,4),
    "fuel_surcharge" DECIMAL(20,4),
    "logistics" DECIMAL(20,4),
    "nationalization" DECIMAL(20,4),
    "local_delivery" DECIMAL(20,4),
    "other_cost" DECIMAL(20,4),
    "total_amount" DECIMAL(20,4) NOT NULL,
    "quoted_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipping_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" BIGSERIAL NOT NULL,
    "created_by_user_id" BIGINT,
    "base_currency_code" CHAR(3) NOT NULL,
    "quote_currency_code" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" "ExchangeRateSource" NOT NULL,
    "provider_name" TEXT,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_channels" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_cost_profiles" (
    "id" BIGSERIAL NOT NULL,
    "sales_channel_id" BIGINT NOT NULL,
    "version" INTEGER NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_to" TIMESTAMPTZ(3),
    "selling_fee_rate" DECIMAL(18,8) NOT NULL,
    "withholding_rate" DECIMAL(18,8) NOT NULL,
    "fixed_fee_cop" DECIMAL(20,4) NOT NULL,
    "shipping_cost_cop" DECIMAL(20,4) NOT NULL,
    "advertising_cost_cop" DECIMAL(20,4) NOT NULL,
    "other_cost_cop" DECIMAL(20,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_cost_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" BIGSERIAL NOT NULL,
    "supplier_offer_id" BIGINT NOT NULL,
    "business_settings_id" BIGINT NOT NULL,
    "exchange_rate_id" BIGINT NOT NULL,
    "selected_shipping_quote_id" BIGINT,
    "sales_cost_profile_id" BIGINT NOT NULL,
    "analysis_version" TEXT NOT NULL,
    "calculation_policy_version" TEXT NOT NULL,
    "score_policy_version" TEXT NOT NULL,
    "analyzed_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "status" "OpportunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersedes_opportunity_id" BIGINT,
    "market_sample_count" INTEGER NOT NULL,
    "market_min_cop" DECIMAL(20,4),
    "market_average_cop" DECIMAL(20,4),
    "market_median_cop" DECIMAL(20,4),
    "market_max_cop" DECIMAL(20,4),
    "conservative_sale_price_cop" DECIMAL(20,4),
    "exchange_rate_applied" DECIMAL(18,8) NOT NULL,
    "fx_spread_rate_applied" DECIMAL(18,8) NOT NULL,
    "product_cost_cop" DECIMAL(20,4) NOT NULL,
    "landed_cost_cop" DECIMAL(20,4) NOT NULL,
    "selling_costs_cop" DECIMAL(20,4) NOT NULL,
    "warranty_reserve_cop" DECIMAL(20,4) NOT NULL,
    "financing_cost_cop" DECIMAL(20,4) NOT NULL,
    "other_costs_cop" DECIMAL(20,4) NOT NULL,
    "real_cost_cop" DECIMAL(20,4) NOT NULL,
    "capital_required_cop" DECIMAL(20,4) NOT NULL,
    "gross_profit_cop" DECIMAL(20,4) NOT NULL,
    "risk_adjusted_profit_cop" DECIMAL(20,4) NOT NULL,
    "margin_rate" DECIMAL(18,8) NOT NULL,
    "roi_rate" DECIMAL(18,8) NOT NULL,
    "monthly_equivalent_roi_rate" DECIMAL(18,8),
    "annualized_roi_rate" DECIMAL(18,8),
    "expected_days_to_sell" INTEGER,
    "capital_velocity_score" DECIMAL(7,4),
    "opportunity_score" DECIMAL(7,4) NOT NULL,
    "signal" "OpportunitySignal" NOT NULL,
    "calculation_snapshot" JSONB NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "risk_flags" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_comparables" (
    "opportunity_id" BIGINT NOT NULL,
    "market_listing_id" BIGINT NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "exclusion_reason" TEXT,
    "price_at_analysis_cop" DECIMAL(20,4) NOT NULL,
    "condition_code_at_analysis" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_comparables_pkey" PRIMARY KEY ("opportunity_id","market_listing_id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" BIGSERIAL NOT NULL,
    "created_by_user_id" BIGINT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_id" BIGINT NOT NULL,
    "supplier_offer_id" BIGINT NOT NULL,
    "opportunity_id" BIGINT,
    "product_variant_id" BIGINT NOT NULL,
    "condition_grade_id" BIGINT NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "purchase_price_usd" DECIMAL(20,4),
    "us_shipping_usd" DECIMAL(20,4),
    "us_sales_tax_usd" DECIMAL(20,4),
    "payment_fee_usd" DECIMAL(20,4),
    "other_cost_usd" DECIMAL(20,4),
    "paid_amount_usd" DECIMAL(20,4),
    "total_paid_usd" DECIMAL(20,4),
    "ordered_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "estimated_delivery_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" TEXT,
    "source_url" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_events" (
    "id" BIGSERIAL NOT NULL,
    "purchase_id" BIGINT NOT NULL,
    "event_code" TEXT NOT NULL,
    "source" "EventSource" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" BIGINT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" BIGSERIAL NOT NULL,
    "purchase_id" BIGINT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shipping_provider_id" BIGINT,
    "shipping_quote_id" BIGINT,
    "carrier_name" TEXT,
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "dispatched_at" TIMESTAMPTZ(3),
    "estimated_delivery_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "actual_cost_usd" DECIMAL(20,4),
    "actual_weight_lb" DECIMAL(10,3),
    "weight_source" TEXT,
    "volumetric_divisor" DECIMAL(18,8),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "business_settings_user_id_idx" ON "business_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_user_id_version_key" ON "business_settings"("user_id", "version");

-- CreateIndex
CREATE INDEX "condition_grades_category_id_user_id_rank_idx" ON "condition_grades"("category_id", "user_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "condition_grades_user_id_category_id_code_key" ON "condition_grades"("user_id", "category_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_code_key" ON "product_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_normalized_key_key" ON "products"("normalized_key");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_active_idx" ON "product_variants"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "product_variant_external_identifiers_product_variant_id_idx" ON "product_variant_external_identifiers"("product_variant_id");

-- CreateIndex
CREATE INDEX "product_variant_external_identifiers_supplier_offer_id_idx" ON "product_variant_external_identifiers"("supplier_offer_id");

-- CreateIndex
CREATE INDEX "product_variant_external_identifiers_market_listing_id_idx" ON "product_variant_external_identifiers"("market_listing_id");

-- CreateIndex
CREATE INDEX "product_variant_external_identifiers_reviewed_by_user_id_idx" ON "product_variant_external_identifiers"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "pvei_normalized_value_idx" ON "product_variant_external_identifiers"("normalized_value");

-- CreateIndex
CREATE INDEX "pvei_identifier_value_idx" ON "product_variant_external_identifiers"("identifier_value");

-- CreateIndex
CREATE INDEX "pvei_promotion_status_observed_at_idx" ON "product_variant_external_identifiers"("promotion_status", "observed_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_external_identifiers_source_key_source_kind_key" ON "product_variant_external_identifiers"("source_key", "source_kind", "identifier_type", "identifier_value");

-- CreateIndex
CREATE INDEX "attribute_definitions_category_id_is_comparable_idx" ON "attribute_definitions"("category_id", "is_comparable");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_category_id_key_key" ON "attribute_definitions"("category_id", "key");

-- CreateIndex
CREATE INDEX "product_variant_attribute_values_product_variant_id_attribu_idx" ON "product_variant_attribute_values"("product_variant_id", "attribute_definition_id");

-- CreateIndex
CREATE INDEX "pvav_attribute_definition_id_value_number_idx" ON "product_variant_attribute_values"("attribute_definition_id", "value_number");

-- CreateIndex
CREATE INDEX "pvav_attribute_definition_id_value_text_idx" ON "product_variant_attribute_values"("attribute_definition_id", "value_text");

-- CreateIndex
CREATE INDEX "pvav_attribute_definition_id_value_boolean_idx" ON "product_variant_attribute_values"("attribute_definition_id", "value_boolean");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_attribute_values_product_variant_id_attribu_key" ON "product_variant_attribute_values"("product_variant_id", "attribute_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers"("slug");

-- CreateIndex
CREATE INDEX "supplier_offers_created_by_user_id_idx" ON "supplier_offers"("created_by_user_id");

-- CreateIndex
CREATE INDEX "supplier_offers_supplier_id_idx" ON "supplier_offers"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_offers_product_variant_id_idx" ON "supplier_offers"("product_variant_id");

-- CreateIndex
CREATE INDEX "supplier_offers_condition_grade_id_idx" ON "supplier_offers"("condition_grade_id");

-- CreateIndex
CREATE INDEX "supplier_offers_product_variant_id_status_observed_at_id_idx" ON "supplier_offers"("product_variant_id", "status", "observed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "supplier_offers_supplier_id_status_observed_at_id_idx" ON "supplier_offers"("supplier_id", "status", "observed_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "marketplaces_slug_key" ON "marketplaces"("slug");

-- CreateIndex
CREATE INDEX "market_listings_created_by_user_id_idx" ON "market_listings"("created_by_user_id");

-- CreateIndex
CREATE INDEX "market_listings_marketplace_id_idx" ON "market_listings"("marketplace_id");

-- CreateIndex
CREATE INDEX "market_listings_product_variant_id_idx" ON "market_listings"("product_variant_id");

-- CreateIndex
CREATE INDEX "market_listings_condition_grade_id_idx" ON "market_listings"("condition_grade_id");

-- CreateIndex
CREATE INDEX "market_listings_product_variant_id_status_observed_at_id_idx" ON "market_listings"("product_variant_id", "status", "observed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "market_listings_product_variant_id_condition_grade_id_statu_idx" ON "market_listings"("product_variant_id", "condition_grade_id", "status", "observed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_providers_slug_key" ON "shipping_providers"("slug");

-- CreateIndex
CREATE INDEX "shipping_quotes_created_by_user_id_idx" ON "shipping_quotes"("created_by_user_id");

-- CreateIndex
CREATE INDEX "shipping_quotes_supplier_offer_id_idx" ON "shipping_quotes"("supplier_offer_id");

-- CreateIndex
CREATE INDEX "shipping_quotes_shipping_provider_id_idx" ON "shipping_quotes"("shipping_provider_id");

-- CreateIndex
CREATE INDEX "shipping_quotes_supplier_offer_id_quoted_at_id_idx" ON "shipping_quotes"("supplier_offer_id", "quoted_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "exchange_rates_created_by_user_id_idx" ON "exchange_rates"("created_by_user_id");

-- CreateIndex
CREATE INDEX "exchange_rates_base_currency_code_quote_currency_code_obser_idx" ON "exchange_rates"("base_currency_code", "quote_currency_code", "observed_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sales_channels_code_key" ON "sales_channels"("code");

-- CreateIndex
CREATE INDEX "sales_cost_profiles_sales_channel_id_idx" ON "sales_cost_profiles"("sales_channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_cost_profiles_sales_channel_id_version_key" ON "sales_cost_profiles"("sales_channel_id", "version");

-- CreateIndex
CREATE INDEX "opportunities_supplier_offer_id_idx" ON "opportunities"("supplier_offer_id");

-- CreateIndex
CREATE INDEX "opportunities_business_settings_id_idx" ON "opportunities"("business_settings_id");

-- CreateIndex
CREATE INDEX "opportunities_exchange_rate_id_idx" ON "opportunities"("exchange_rate_id");

-- CreateIndex
CREATE INDEX "opportunities_selected_shipping_quote_id_idx" ON "opportunities"("selected_shipping_quote_id");

-- CreateIndex
CREATE INDEX "opportunities_sales_cost_profile_id_idx" ON "opportunities"("sales_cost_profile_id");

-- CreateIndex
CREATE INDEX "opportunities_supersedes_opportunity_id_idx" ON "opportunities"("supersedes_opportunity_id");

-- CreateIndex
CREATE INDEX "opportunities_supplier_offer_id_analyzed_at_id_idx" ON "opportunities"("supplier_offer_id", "analyzed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "opportunity_comparables_market_listing_id_idx" ON "opportunity_comparables"("market_listing_id");

-- CreateIndex
CREATE INDEX "purchases_supplier_id_idx" ON "purchases"("supplier_id");

-- CreateIndex
CREATE INDEX "purchases_supplier_offer_id_idx" ON "purchases"("supplier_offer_id");

-- CreateIndex
CREATE INDEX "purchases_opportunity_id_idx" ON "purchases"("opportunity_id");

-- CreateIndex
CREATE INDEX "purchases_product_variant_id_idx" ON "purchases"("product_variant_id");

-- CreateIndex
CREATE INDEX "purchases_condition_grade_id_idx" ON "purchases"("condition_grade_id");

-- CreateIndex
CREATE INDEX "purchases_status_created_at_id_idx" ON "purchases"("status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "purchases_supplier_offer_id_created_at_id_idx" ON "purchases"("supplier_offer_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_created_by_user_id_reference_code_key" ON "purchases"("created_by_user_id", "reference_code");

-- CreateIndex
CREATE INDEX "purchase_events_purchase_id_idx" ON "purchase_events"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_events_created_by_user_id_idx" ON "purchase_events"("created_by_user_id");

-- CreateIndex
CREATE INDEX "purchase_events_purchase_id_occurred_at_id_idx" ON "purchase_events"("purchase_id", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "shipments_shipping_provider_id_idx" ON "shipments"("shipping_provider_id");

-- CreateIndex
CREATE INDEX "shipments_shipping_quote_id_idx" ON "shipments"("shipping_quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_purchase_id_sequence_key" ON "shipments"("purchase_id", "sequence");

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_grades" ADD CONSTRAINT "condition_grades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_grades" ADD CONSTRAINT "condition_grades_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_external_identifiers" ADD CONSTRAINT "product_variant_external_identifiers_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_external_identifiers" ADD CONSTRAINT "product_variant_external_identifiers_supplier_offer_id_fkey" FOREIGN KEY ("supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_external_identifiers" ADD CONSTRAINT "product_variant_external_identifiers_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "market_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_external_identifiers" ADD CONSTRAINT "product_variant_external_identifiers_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_attribute_definition_id_fkey" FOREIGN KEY ("attribute_definition_id") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_condition_grade_id_fkey" FOREIGN KEY ("condition_grade_id") REFERENCES "condition_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "marketplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_condition_grade_id_fkey" FOREIGN KEY ("condition_grade_id") REFERENCES "condition_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "shipping_quotes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "shipping_quotes_supplier_offer_id_fkey" FOREIGN KEY ("supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "shipping_quotes_shipping_provider_id_fkey" FOREIGN KEY ("shipping_provider_id") REFERENCES "shipping_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_cost_profiles" ADD CONSTRAINT "sales_cost_profiles_sales_channel_id_fkey" FOREIGN KEY ("sales_channel_id") REFERENCES "sales_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_supplier_offer_id_fkey" FOREIGN KEY ("supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_business_settings_id_fkey" FOREIGN KEY ("business_settings_id") REFERENCES "business_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_selected_shipping_quote_id_fkey" FOREIGN KEY ("selected_shipping_quote_id") REFERENCES "shipping_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_sales_cost_profile_id_fkey" FOREIGN KEY ("sales_cost_profile_id") REFERENCES "sales_cost_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_supersedes_opportunity_id_fkey" FOREIGN KEY ("supersedes_opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_comparables" ADD CONSTRAINT "opportunity_comparables_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_comparables" ADD CONSTRAINT "opportunity_comparables_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "market_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_offer_id_fkey" FOREIGN KEY ("supplier_offer_id") REFERENCES "supplier_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_condition_grade_id_fkey" FOREIGN KEY ("condition_grade_id") REFERENCES "condition_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_events" ADD CONSTRAINT "purchase_events_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_events" ADD CONSTRAINT "purchase_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipping_provider_id_fkey" FOREIGN KEY ("shipping_provider_id") REFERENCES "shipping_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipping_quote_id_fkey" FOREIGN KEY ("shipping_quote_id") REFERENCES "shipping_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
