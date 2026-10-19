import Decimal from "decimal.js";
import type { Availability } from "./radar";

export type RadarEvaluationOutcome = "PASS" | "FAIL" | "UNKNOWN";

export type RadarEvaluationReasonCode =
  | "price-cap"
  | "currency"
  | "availability"
  | "confidence"
  | "net-profit"
  | "roi";

export interface RadarEvaluationReason {
  readonly code: RadarEvaluationReasonCode;
  readonly outcome: RadarEvaluationOutcome;
}

export interface RadarEvaluationObservation {
  readonly price: Decimal | string | null;
  readonly currencyCode: string | null;
  readonly availability: Availability;
  readonly attributes: unknown;
}

export interface RadarEvaluationProfile {
  readonly maxPurchasePriceUsd: Decimal | string | null;
  readonly minimumConfidence: Decimal | string | number;
  readonly minNetProfitCop: Decimal | string | number;
  readonly minRoiRate: Decimal | string | number;
}

export interface RadarEvaluation {
  /**
   * Result of the rules Radar can actually evaluate today: price cap,
   * currency, availability and confidence. Profit and ROI are reported as
   * UNKNOWN reasons because the CSV does not carry sale price, fees or costs,
   * so they never turn an otherwise valid observation into a false pass.
   */
  readonly status: RadarEvaluationOutcome;
  readonly reasons: readonly RadarEvaluationReason[];
}

function readConfidence(attributes: unknown): Decimal | undefined {
  if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) {
    return undefined;
  }
  const value = (attributes as Record<string, unknown>).confidence;
  if (typeof value === "number" && Number.isFinite(value)) return new Decimal(value);
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      return new Decimal(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function evaluateRadarObservation(
  observation: RadarEvaluationObservation,
  profile: RadarEvaluationProfile,
): RadarEvaluation {
  const reasons: RadarEvaluationReason[] = [];
  const currency = observation.currencyCode?.trim().toUpperCase() ?? null;

  if (profile.maxPurchasePriceUsd !== null) {
    if (observation.price === null || currency !== "USD") {
      reasons.push({ code: "price-cap", outcome: "UNKNOWN" });
    } else {
      const price = new Decimal(observation.price);
      const cap = new Decimal(profile.maxPurchasePriceUsd);
      reasons.push({ code: "price-cap", outcome: price.lte(cap) ? "PASS" : "FAIL" });
    }
  }

  reasons.push({
    code: "currency",
    outcome: currency === null ? "UNKNOWN" : currency === "USD" ? "PASS" : "UNKNOWN",
  });

  reasons.push({
    code: "availability",
    outcome:
      observation.availability === "IN_STOCK"
        ? "PASS"
        : observation.availability === "UNKNOWN"
          ? "UNKNOWN"
          : "FAIL",
  });

  const confidence = readConfidence(observation.attributes);
  reasons.push({
    code: "confidence",
    outcome:
      confidence === undefined
        ? "UNKNOWN"
        : confidence.gte(new Decimal(profile.minimumConfidence))
          ? "PASS"
          : "FAIL",
  });

  // No sale price, marketplace fees, shipping or tax basis in the observation:
  // these two rules are auditable unknowns, not silent passes.
  reasons.push({ code: "net-profit", outcome: "UNKNOWN" });
  reasons.push({ code: "roi", outcome: "UNKNOWN" });

  const gates = reasons.filter((reason) => reason.code !== "net-profit" && reason.code !== "roi");
  const status: RadarEvaluationOutcome = gates.some((reason) => reason.outcome === "FAIL")
    ? "FAIL"
    : gates.some((reason) => reason.outcome === "UNKNOWN")
      ? "UNKNOWN"
      : "PASS";

  return { status, reasons };
}

export const RADAR_EVALUATION_REASON_LABELS: Record<RadarEvaluationReasonCode, string> = {
  "price-cap": "Precio máximo",
  currency: "Moneda",
  availability: "Disponibilidad",
  confidence: "Confianza",
  "net-profit": "Utilidad neta",
  roi: "ROI",
};

export const RADAR_EVALUATION_OUTCOME_LABELS: Record<RadarEvaluationOutcome, string> = {
  PASS: "OK",
  FAIL: "No",
  UNKNOWN: "Sin datos",
};
