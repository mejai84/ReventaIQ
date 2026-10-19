-- Radar R2a: diagnosticos por fila de importaciones CSV.
-- Migracion aditiva: agrega una columna nullable y no toca filas existentes.
ALTER TABLE "scan_source_runs" ADD COLUMN "error_details" JSONB;
