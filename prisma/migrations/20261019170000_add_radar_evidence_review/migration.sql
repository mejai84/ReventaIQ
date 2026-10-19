-- Radar R2c: revision explicita de evidencia con instantanea de evaluacion.
-- Migracion aditiva: dos enums y una tabla nueva. No modifica R1 ni R2a/R2b.

CREATE TYPE "RadarEvaluationStatus" AS ENUM ('PASS', 'FAIL', 'UNKNOWN');
CREATE TYPE "RadarReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

CREATE TABLE "radar_evidence_reviews" (
    "id" BIGSERIAL NOT NULL,
    "observation_id" BIGINT NOT NULL,
    "scan_profile_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "status" "RadarReviewStatus" NOT NULL DEFAULT 'PENDING',
    "evaluation_status" "RadarEvaluationStatus" NOT NULL,
    "evaluation_reasons" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "radar_evidence_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "radar_evidence_reviews_observation_id_scan_profile_id_key"
  ON "radar_evidence_reviews"("observation_id", "scan_profile_id");

CREATE INDEX "radar_evidence_reviews_user_id_status_updated_at_idx"
  ON "radar_evidence_reviews"("user_id", "status", "updated_at" DESC);

ALTER TABLE "radar_evidence_reviews" ADD CONSTRAINT "radar_evidence_reviews_observation_id_fkey"
  FOREIGN KEY ("observation_id") REFERENCES "radar_listing_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "radar_evidence_reviews" ADD CONSTRAINT "radar_evidence_reviews_scan_profile_id_fkey"
  FOREIGN KEY ("scan_profile_id") REFERENCES "scan_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "radar_evidence_reviews" ADD CONSTRAINT "radar_evidence_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
