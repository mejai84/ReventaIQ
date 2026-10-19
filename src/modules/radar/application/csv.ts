import { z } from "zod";

/**
 * Radar CSV boundary.
 *
 * The UI never parses CSV by hand: this module owns the strict template, the
 * 1.000-row limit and the per-row diagnostic codes. A diagnostic carries only
 * the spreadsheet line and a stable code, never the offending value, so a
 * pasted CSV can never leak into a log, an error message or a commit.
 */

export const RADAR_CSV_HEADERS = [
  "source_key",
  "external_listing_id",
  "canonical_url",
  "title",
  "price",
  "currency",
  "availability",
  "observed_at",
] as const;

export const MAX_RADAR_CSV_ROWS = 1_000;

export const RADAR_CSV_EXAMPLE_ROW =
  "manual,PS5-001,https://ejemplo.co/ps5,PS5 Slim,399.99,USD,IN_STOCK,2026-10-19T12:00:00Z";

export type RadarCsvAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "REMOVED" | "UNKNOWN";

export interface RadarCsvRow {
  readonly sourceKey: string;
  readonly externalListingId?: string;
  readonly canonicalUrl?: string;
  readonly title: string;
  readonly price?: string;
  readonly currencyCode?: string;
  readonly availability: RadarCsvAvailability;
  readonly observedAt: string;
}

/** 1-based spreadsheet line: the header is line 1, never reported as an error. */
export interface RadarCsvRowError {
  readonly row: number;
  readonly code: string;
}

export interface RadarCsvParseResult {
  readonly rows: readonly RadarCsvRow[];
  readonly errors: readonly RadarCsvRowError[];
  readonly totalRows: number;
}

export type RadarCsvFatalCode = "empty" | "too-many-rows" | "headers" | "quotes";

export class RadarCsvError extends Error {
  readonly code: RadarCsvFatalCode;

  constructor(code: RadarCsvFatalCode) {
    super(code);
    this.name = "RadarCsvError";
    this.code = code;
  }
}

const sourceKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
  .max(80);

const rowSchema = z.object({
  sourceKey: sourceKeySchema,
  externalListingId: z.string().trim().max(200).optional(),
  canonicalUrl: z.string().trim().url().max(2000).optional(),
  title: z.string().trim().min(2).max(500),
  price: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,4})?$/)
    .optional(),
  currencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  availability: z.enum(["IN_STOCK", "OUT_OF_STOCK", "REMOVED", "UNKNOWN"]),
  observedAt: z.string().datetime({ offset: true }),
});

const CODE_BY_FIELD: Readonly<Record<string, string>> = {
  sourceKey: "source_key",
  externalListingId: "external_listing_id",
  canonicalUrl: "canonical_url",
  title: "title",
  price: "price",
  currencyCode: "currency",
  availability: "availability",
  observedAt: "observed_at",
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw new RadarCsvError("quotes");
  cells.push(value.trim());
  return cells;
}

function codeForIssue(issues: readonly z.ZodIssue[]): string {
  const field = issues[0]?.path[0];
  return typeof field === "string" ? (CODE_BY_FIELD[field] ?? "row") : "row";
}

export function parseRadarCsv(text: string): RadarCsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) throw new RadarCsvError("empty");

  const header = parseCsvLine(lines[0]!).map((name) => name.trim().toLowerCase());
  if (
    header.length !== RADAR_CSV_HEADERS.length ||
    header.some((name, index) => name !== RADAR_CSV_HEADERS[index])
  ) {
    throw new RadarCsvError("headers");
  }

  if (lines.length === 1) throw new RadarCsvError("empty");

  if (lines.length - 1 > MAX_RADAR_CSV_ROWS) throw new RadarCsvError("too-many-rows");

  const rows: RadarCsvRow[] = [];
  const errors: RadarCsvRowError[] = [];

  lines.slice(1).forEach((line, index) => {
    const row = index + 2;
    const cells = parseCsvLine(line);
    const raw = Object.fromEntries(header.map((name, cellIndex) => [name, cells[cellIndex] ?? ""]));

    const parsed = rowSchema.safeParse({
      sourceKey: raw.source_key ?? "",
      externalListingId: raw.external_listing_id ? raw.external_listing_id : undefined,
      canonicalUrl: raw.canonical_url ? raw.canonical_url : undefined,
      title: raw.title ?? "",
      price: raw.price ? raw.price : undefined,
      currencyCode: raw.currency ? raw.currency : undefined,
      availability: (raw.availability ?? "").toUpperCase(),
      observedAt: raw.observed_at ?? "",
    });

    if (!parsed.success) {
      errors.push({ row, code: codeForIssue(parsed.error.issues) });
      return;
    }

    const value = parsed.data;
    if (value.externalListingId === undefined && value.canonicalUrl === undefined) {
      errors.push({ row, code: "identity" });
      return;
    }

    rows.push({
      sourceKey: value.sourceKey,
      ...(value.externalListingId === undefined ? {} : { externalListingId: value.externalListingId }),
      ...(value.canonicalUrl === undefined ? {} : { canonicalUrl: value.canonicalUrl }),
      title: value.title,
      ...(value.price === undefined ? {} : { price: value.price }),
      ...(value.currencyCode === undefined ? {} : { currencyCode: value.currencyCode }),
      availability: value.availability,
      observedAt: value.observedAt,
    });
  });

  return { rows, errors, totalRows: lines.length - 1 };
}

export function buildRadarCsvTemplate(): string {
  return `${RADAR_CSV_HEADERS.join(",")}\n${RADAR_CSV_EXAMPLE_ROW}\n`;
}

export const RADAR_CSV_ERROR_LABELS: Readonly<Record<string, string>> = {
  source_key: "fuente inválida",
  external_listing_id: "identificador externo inválido",
  canonical_url: "URL inválida",
  title: "título inválido o vacío",
  price: "precio inválido",
  currency: "moneda inválida",
  availability: "disponibilidad inválida",
  observed_at: "fecha observada inválida",
  identity: "falta identificador externo o URL",
  empty: "archivo vacío o solo con cabecera",
  headers: "cabeceras distintas a la plantilla",
  "too-many-rows": "más de 1.000 filas",
  quotes: "comillas sin cerrar",
  row: "fila inválida",
};

export function describeRadarCsvError(code: string): string {
  return RADAR_CSV_ERROR_LABELS[code] ?? "fila inválida";
}

/**
 * Reads persisted diagnostics defensively. Only `{ row, code }` survives, so a
 * malformed JSON column can never render arbitrary stored values.
 */
export function readRadarCsvErrors(value: unknown): RadarCsvRowError[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const row = (item as { row?: unknown }).row;
    const code = (item as { code?: unknown }).code;
    if (
      typeof row !== "number" ||
      !Number.isInteger(row) ||
      row < 1 ||
      typeof code !== "string" ||
      code.length === 0 ||
      code.length > 40
    ) {
      return [];
    }
    return [{ row, code }];
  });
}
