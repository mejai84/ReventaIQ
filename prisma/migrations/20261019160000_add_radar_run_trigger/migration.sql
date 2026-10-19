-- Radar R2b: origen de las corridas y usuario que las disparo.
-- Migracion aditiva: un valor de enum nuevo, un enum nuevo y dos columnas
-- (una con default, una nullable). No modifica ni rehace la migracion R1.

ALTER TYPE "ScanRunStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

CREATE TYPE "RadarRunTrigger" AS ENUM ('MANUAL', 'CSV', 'SCHEDULED');

ALTER TABLE "scan_runs" ADD COLUMN "trigger" "RadarRunTrigger" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "scan_runs" ADD COLUMN "triggered_by_user_id" BIGINT;
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_triggered_by_user_id_fkey"
  FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
