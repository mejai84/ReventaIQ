import Decimal from "decimal.js";

import type {
  LinearScoreRange,
  OpportunityScoreComponent,
  OpportunityScoreInput,
  OpportunityScoreResult,
  OpportunityScoringSettings,
  ScoreMetricKey,
} from "./contracts";
import {
  assertFiniteDecimal,
  assertNonNegative,
  clampDecimal,
  roundHalfUp,
  sumDecimals,
} from "./decimal";

const SCORE_METRICS: readonly ScoreMetricKey[] = [
  "ROI",
  "PROFIT_COP",
  "CAPITAL_REQUIRED",
  "MARKET_LIQUIDITY",
  "COMPARABLE_COUNT",
  "CONDITION",
  "BATTERY_HEALTH",
  "SELLER_REPUTATION",
  "WARRANTY",
  "SELLING_SPEED",
  "PRICE_VOLATILITY",
  "CAPITAL_CONCENTRATION",
];

function validateScore(value: Decimal, name: string): void {
  assertFiniteDecimal(value, name);
  if (value.lessThan(0) || value.greaterThan(100)) {
    throw new RangeError(`${name} must be between zero and one hundred`);
  }
}

function normalizeLinear(
  value: Decimal | undefined,
  range: LinearScoreRange,
): { readonly score: Decimal; readonly usedMissingFallback: boolean } {
  validateScore(range.missingScore, "missingScore");
  if (range.good.equals(range.bad)) {
    throw new RangeError("A score range's good and bad values must differ");
  }
  if (value === undefined) {
    return { score: range.missingScore, usedMissingFallback: true };
  }
  assertFiniteDecimal(value, "score input");
  const normalized = value
    .minus(range.bad)
    .dividedBy(range.good.minus(range.bad));
  return {
    score: clampDecimal(normalized, new Decimal(0), new Decimal(1)).times(
      100,
    ),
    usedMissingFallback: false,
  };
}

export function calculateOpportunityScore<Condition extends string>(
  input: OpportunityScoreInput<Condition>,
  settings: OpportunityScoringSettings<Condition>,
): OpportunityScoreResult {
  const totalWeight = sumDecimals(
    SCORE_METRICS.map((metric) => {
      const weight = settings.weights[metric];
      assertNonNegative(weight, `${metric}.weight`);
      return weight;
    }),
  );
  if (totalWeight.isZero()) {
    throw new RangeError("Opportunity score must have a positive total weight");
  }

  const rawValues: Readonly<
    Record<
      Exclude<ScoreMetricKey, "CONDITION" | "SELLER_REPUTATION">,
      Decimal | undefined
    >
  > = {
    ROI: input.roi,
    PROFIT_COP: input.profitCOP,
    CAPITAL_REQUIRED: input.capitalRequiredRate,
    MARKET_LIQUIDITY: input.marketLiquidityIndex,
    COMPARABLE_COUNT:
      input.comparableCount === undefined
        ? undefined
        : new Decimal(input.comparableCount),
    BATTERY_HEALTH: input.batteryHealthRate,
    WARRANTY:
      input.warrantyDays === undefined
        ? undefined
        : new Decimal(input.warrantyDays),
    SELLING_SPEED:
      input.expectedDaysToSell === undefined
        ? undefined
        : new Decimal(input.expectedDaysToSell),
    PRICE_VOLATILITY: input.priceVolatilityRate,
    CAPITAL_CONCENTRATION: input.capitalConcentrationRate,
  };

  const components: OpportunityScoreComponent[] = [];
  for (const metric of SCORE_METRICS) {
    let rawValue: Decimal | undefined;
    let normalizedScore: Decimal;
    let usedMissingFallback: boolean;

    if (metric === "CONDITION") {
      validateScore(settings.missingConditionScore, "missingConditionScore");
      const configuredScore =
        input.condition === undefined
          ? undefined
          : settings.conditionScores[input.condition];
      if (configuredScore === undefined) {
        normalizedScore = settings.missingConditionScore;
        usedMissingFallback = true;
      } else {
        validateScore(configuredScore, `${input.condition}.conditionScore`);
        normalizedScore = configuredScore;
        usedMissingFallback = false;
      }
    } else if (metric === "SELLER_REPUTATION") {
      const sellerSettings = settings.sellerReputation;
      assertNonNegative(sellerSettings.ratingWeight, "seller.ratingWeight");
      assertNonNegative(
        sellerSettings.reviewCountWeight,
        "seller.reviewCountWeight",
      );
      const sellerWeight = sellerSettings.ratingWeight.plus(
        sellerSettings.reviewCountWeight,
      );
      if (sellerWeight.isZero()) {
        throw new RangeError("Seller reputation weights must sum above zero");
      }
      const rating = normalizeLinear(
        input.sellerRatingRate,
        sellerSettings.ratingRange,
      );
      const reviews = normalizeLinear(
        input.sellerReviewCount === undefined
          ? undefined
          : new Decimal(input.sellerReviewCount),
        sellerSettings.reviewCountRange,
      );
      normalizedScore = rating.score
        .times(sellerSettings.ratingWeight)
        .plus(reviews.score.times(sellerSettings.reviewCountWeight))
        .dividedBy(sellerWeight);
      usedMissingFallback =
        rating.usedMissingFallback || reviews.usedMissingFallback;
    } else {
      rawValue = rawValues[metric];
      const normalized = normalizeLinear(rawValue, settings.ranges[metric]);
      normalizedScore = normalized.score;
      usedMissingFallback = normalized.usedMissingFallback;
    }

    const weight = settings.weights[metric];
    components.push({
      metric,
      rawValue,
      normalizedScore,
      weight,
      weightedContribution: normalizedScore.times(weight),
      usedMissingFallback,
    });
  }

  const rawScore = sumDecimals(
    components.map((component) => component.weightedContribution),
  ).dividedBy(totalWeight);
  const boundedRawScore = clampDecimal(
    rawScore,
    new Decimal(0),
    new Decimal(100),
  );

  return {
    components,
    totalWeight,
    rawScore: boundedRawScore,
    score: roundHalfUp(boundedRawScore, 0).toNumber(),
  };
}
