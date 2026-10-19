import { describe, expect, it } from "vitest";
import {
  buildRadarCsvTemplate,
  describeRadarCsvError,
  MAX_RADAR_CSV_ROWS,
  parseRadarCsv,
  RadarCsvError,
  RADAR_CSV_HEADERS,
  readRadarCsvErrors,
} from "./csv";

const valid = "source_key,external_listing_id,canonical_url,title,price,currency,availability,observed_at\nmanual,PS5-001,https://ejemplo.co/ps5,PS5 Slim,399.99,USD,IN_STOCK,2026-10-19T12:00:00Z";

describe("parseRadarCsv", () => {
  it("parses a valid row and tolerates BOM, CRLF and quoted commas", () => {
    const text = `\uFEFF${valid.replace("PS5 Slim", '"PS5 Slim, Disc"')}\r\n`;
    const result = parseRadarCsv(text);
    expect(result.totalRows).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      {
        sourceKey: "manual",
        externalListingId: "PS5-001",
        canonicalUrl: "https://ejemplo.co/ps5",
        title: "PS5 Slim, Disc",
        price: "399.99",
        currencyCode: "USD",
        availability: "IN_STOCK",
        observedAt: "2026-10-19T12:00:00Z",
      },
    ]);
  });

  it("accepts a row identified only by canonical URL", () => {
    const text = valid.replace("manual,PS5-001,", "manual,,");
    expect(parseRadarCsv(text).rows).toHaveLength(1);
  });

  it("reports per-row codes and spreadsheet line numbers without echoing values", () => {
    const text = [
      RADAR_CSV_HEADERS.join(","),
      "manual,OK,https://ejemplo.co/ok,Valid,10.00,USD,IN_STOCK,2026-10-19T12:00:00Z",
      "manual,BAD1,https://ejemplo.co/1,,10.00,USD,IN_STOCK,2026-10-19T12:00:00Z",
      "manual,BAD2,https://ejemplo.co/2,Title,not-a-price,USD,IN_STOCK,2026-10-19T12:00:00Z",
      "manual,BAD3,https://ejemplo.co/3,Title,10.00,US,IN_STOCK,2026-10-19T12:00:00Z",
      "manual,BAD4,https://ejemplo.co/4,Title,10.00,USD,MAYBE,2026-10-19T12:00:00Z",
      "manual,BAD5,https://ejemplo.co/5,Title,10.00,USD,IN_STOCK,yesterday",
      "manual,,,No identity,10.00,USD,IN_STOCK,2026-10-19T12:00:00Z",
    ].join("\n");

    const result = parseRadarCsv(text);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 3, code: "title" },
      { row: 4, code: "price" },
      { row: 5, code: "currency" },
      { row: 6, code: "availability" },
      { row: 7, code: "observed_at" },
      { row: 8, code: "identity" },
    ]);
    expect(JSON.stringify(result.errors)).not.toContain("not-a-price");
    expect(JSON.stringify(result.errors)).not.toContain("MAYBE");
  });

  it("rejects a different header", () => {
    expect(() => parseRadarCsv("source_key,title\nmanual,PS5")).toThrowError(RadarCsvError);
    try {
      parseRadarCsv("source_key,title\nmanual,PS5");
    } catch (error) {
      expect((error as RadarCsvError).code).toBe("headers");
    }
  });

  it("rejects empty input and more than the row limit", () => {
    expect(() => parseRadarCsv("")).toThrowError(RadarCsvError);
    expect(() => parseRadarCsv(RADAR_CSV_HEADERS.join(","))).toThrowError(RadarCsvError);
    const rows = Array.from({ length: MAX_RADAR_CSV_ROWS + 1 }, (_, index) =>
      `manual,X${index},https://ejemplo.co/${index},Title,10.00,USD,IN_STOCK,2026-10-19T12:00:00Z`,
    );
    const text = `${RADAR_CSV_HEADERS.join(",")}\n${rows.join("\n")}`;
    try {
      parseRadarCsv(text);
      throw new Error("expected too-many-rows");
    } catch (error) {
      expect(error).toBeInstanceOf(RadarCsvError);
      expect((error as RadarCsvError).code).toBe("too-many-rows");
    }
  });

  it("ships a template that parses without diagnostics", () => {
    const result = parseRadarCsv(buildRadarCsvTemplate());
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(buildRadarCsvTemplate().split("\n")[0]).toBe(RADAR_CSV_HEADERS.join(","));
  });

  it("accepts an optional confidence column and rejects out-of-range values", () => {
    const withConfidence = parseRadarCsv(
      `${RADAR_CSV_HEADERS.join(",")}\nmanual,PS5-001,https://ejemplo.co/ps5,PS5 Slim,399.99,USD,IN_STOCK,2026-10-19T12:00:00Z,80`,
    );
    expect(withConfidence.errors).toHaveLength(0);
    expect(withConfidence.rows[0]?.confidence).toBe("80");

    const outOfRange = parseRadarCsv(
      `${RADAR_CSV_HEADERS.join(",")}\nmanual,PS5-001,https://ejemplo.co/ps5,PS5 Slim,399.99,USD,IN_STOCK,2026-10-19T12:00:00Z,120`,
    );
    expect(outOfRange.errors).toEqual([{ row: 2, code: "confidence" }]);

    const requiredOnly = parseRadarCsv(valid);
    expect(requiredOnly.errors).toHaveLength(0);
    expect(requiredOnly.rows[0]?.confidence).toBeUndefined();
  });

  it("reads persisted diagnostics defensively", () => {
    expect(
      readRadarCsvErrors([
        { row: 3, code: "price" },
        { row: 1, code: "headers" },
        { row: 4, code: "x".repeat(41) },
        { row: "5", code: "title" },
        null,
      ]),
    ).toEqual([
      { row: 3, code: "price" },
      { row: 1, code: "headers" },
    ]);
    expect(describeRadarCsvError("price")).toBe("precio inválido");
    expect(describeRadarCsvError("unknown")).toBe("fila inválida");
  });
});
