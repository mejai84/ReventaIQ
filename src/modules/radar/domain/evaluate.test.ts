import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { evaluateRadarObservation, type RadarEvaluationProfile } from "./evaluate";

const profile: RadarEvaluationProfile = {
  maxPurchasePriceUsd: new Decimal("150"),
  minimumConfidence: new Decimal("50"),
  minNetProfitCop: new Decimal("50000"),
  minRoiRate: new Decimal("0.15"),
};

const baseObservation = {
  price: new Decimal("100"),
  currencyCode: "USD",
  availability: "IN_STOCK" as const,
  attributes: { confidence: 80 },
};

describe("evaluateRadarObservation", () => {
  it("passes the available gates and reports profit/ROI as unknown", () => {
    const result = evaluateRadarObservation(baseObservation, profile);
    expect(result.status).toBe("PASS");
    expect(result.reasons).toEqual([
      { code: "price-cap", outcome: "PASS" },
      { code: "currency", outcome: "PASS" },
      { code: "availability", outcome: "PASS" },
      { code: "confidence", outcome: "PASS" },
      { code: "net-profit", outcome: "UNKNOWN" },
      { code: "roi", outcome: "UNKNOWN" },
    ]);
  });

  it("fails when the price exceeds the cap", () => {
    const result = evaluateRadarObservation({ ...baseObservation, price: new Decimal("150.01") }, profile);
    expect(result.status).toBe("FAIL");
    expect(result.reasons).toContainEqual({ code: "price-cap", outcome: "FAIL" });
  });

  it("fails when the listing is not in stock", () => {
    const result = evaluateRadarObservation({ ...baseObservation, availability: "OUT_OF_STOCK" }, profile);
    expect(result.status).toBe("FAIL");
    expect(result.reasons).toContainEqual({ code: "availability", outcome: "FAIL" });
  });

  it("is unknown when confidence or currency cannot be compared", () => {
    const noConfidence = evaluateRadarObservation({ ...baseObservation, attributes: {} }, profile);
    expect(noConfidence.status).toBe("UNKNOWN");
    expect(noConfidence.reasons).toContainEqual({ code: "confidence", outcome: "UNKNOWN" });

    const nonUsd = evaluateRadarObservation({ ...baseObservation, currencyCode: "COP" }, profile);
    expect(nonUsd.status).toBe("UNKNOWN");
    expect(nonUsd.reasons).toContainEqual({ code: "price-cap", outcome: "UNKNOWN" });
    expect(nonUsd.reasons).toContainEqual({ code: "currency", outcome: "UNKNOWN" });
  });

  it("skips the price rule when the profile has no cap", () => {
    const result = evaluateRadarObservation(baseObservation, { ...profile, maxPurchasePriceUsd: null });
    expect(result.reasons.some((reason) => reason.code === "price-cap")).toBe(false);
    expect(result.status).toBe("PASS");
  });

  it("fails confidence below the minimum", () => {
    const result = evaluateRadarObservation({ ...baseObservation, attributes: { confidence: "49.9" } }, profile);
    expect(result.status).toBe("FAIL");
    expect(result.reasons).toContainEqual({ code: "confidence", outcome: "FAIL" });
  });
});
