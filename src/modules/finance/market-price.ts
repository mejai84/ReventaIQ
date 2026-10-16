import Decimal from "decimal.js";

import type {
  ComparablePrice,
  ExcludedComparable,
  MarketPriceResult,
  MarketPricingSettings,
} from "./contracts";
import {
  assertPositive,
  assertRate,
  roundCopRevenue,
  sumDecimals,
} from "./decimal";
import { ageInDays, timestampToMilliseconds } from "./time";

export function calculateMedian(sortedValues: readonly Decimal[]): Decimal {
  if (sortedValues.length === 0) {
    throw new RangeError("At least one value is required to calculate a median");
  }
  const middle = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle]!;
  }
  return sortedValues[middle - 1]!.plus(sortedValues[middle]!).dividedBy(2);
}

/** Nearest-rank percentile. A percentile of zero deliberately maps to the minimum. */
export function calculateNearestRankPercentile(
  sortedValues: readonly Decimal[],
  percentile: Decimal,
): Decimal {
  if (sortedValues.length === 0) {
    throw new RangeError("At least one value is required to calculate a percentile");
  }
  assertRate(percentile, "percentile");
  const rank = Decimal.max(
    1,
    percentile.times(sortedValues.length).ceil(),
  ).toNumber();
  return sortedValues[rank - 1]!;
}

export function calculateConservativeMarketPrice(args: {
  readonly comparables: readonly ComparablePrice[];
  readonly settings: MarketPricingSettings;
  readonly evaluatedAt: string;
}): MarketPriceResult {
  const { comparables, evaluatedAt, settings } = args;
  assertRate(settings.safetyMarginRate, "safetyMarginRate");
  if (
    !Number.isInteger(settings.minComparablesForRecommendation) ||
    settings.minComparablesForRecommendation < 1
  ) {
    throw new RangeError(
      "minComparablesForRecommendation must be a positive integer",
    );
  }
  if (
    !Number.isInteger(settings.maxListingAgeDays) ||
    settings.maxListingAgeDays < 0
  ) {
    throw new RangeError("maxListingAgeDays must be a non-negative integer");
  }

  const needsPercentile =
    settings.method === "NEAREST_RANK_PERCENTILE" ||
    settings.method === "LOWER_OF_MEDIAN_AND_PERCENTILE";
  if (needsPercentile && settings.percentile === undefined) {
    throw new RangeError(`${settings.method} requires a percentile`);
  }
  if (settings.percentile !== undefined) {
    assertRate(settings.percentile, "percentile");
  }

  const excluded: ExcludedComparable[] = [];
  const candidates = comparables
    .map((comparable) => {
      assertPositive(
        comparable.sellerGrossPriceCOP,
        `${comparable.id}.sellerGrossPriceCOP`,
      );
      return {
        comparable,
        observedAtMilliseconds: timestampToMilliseconds(
          comparable.observedAt,
          `${comparable.id}.observedAt`,
        ),
      };
    })
    .filter(({ comparable }) => {
      if (!comparable.active) {
        excluded.push({ comparableId: comparable.id, reason: "INACTIVE" });
        return false;
      }
      const age = ageInDays(comparable.observedAt, evaluatedAt);
      if (age < 0) {
        excluded.push({ comparableId: comparable.id, reason: "FUTURE" });
        return false;
      }
      if (age > settings.maxListingAgeDays) {
        excluded.push({ comparableId: comparable.id, reason: "STALE" });
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftKey = left.comparable.deduplicationKey ?? left.comparable.id;
      const rightKey = right.comparable.deduplicationKey ?? right.comparable.id;
      const keyComparison = leftKey.localeCompare(rightKey);
      if (keyComparison !== 0) return keyComparison;
      const timeComparison =
        right.observedAtMilliseconds - left.observedAtMilliseconds;
      if (timeComparison !== 0) return timeComparison;
      return left.comparable.id.localeCompare(right.comparable.id);
    });

  const seenKeys = new Set<string>();
  const included: ComparablePrice[] = [];
  for (const { comparable } of candidates) {
    const key = comparable.deduplicationKey ?? comparable.id;
    if (seenKeys.has(key)) {
      excluded.push({ comparableId: comparable.id, reason: "DUPLICATE" });
      continue;
    }
    seenKeys.add(key);
    included.push(comparable);
  }

  if (included.length === 0) {
    return {
      status: "NO_COMPARABLES",
      includedComparableIds: [],
      excluded,
    };
  }

  const sortedPrices = included
    .map((comparable) => comparable.sellerGrossPriceCOP)
    .sort((left, right) => left.comparedTo(right));
  const medianCOP = calculateMedian(sortedPrices);
  const percentileCOP =
    settings.percentile === undefined
      ? undefined
      : calculateNearestRankPercentile(sortedPrices, settings.percentile);

  let baseEstimatorCOP: Decimal;
  switch (settings.method) {
    case "MEDIAN":
      baseEstimatorCOP = medianCOP;
      break;
    case "NEAREST_RANK_PERCENTILE":
      baseEstimatorCOP = percentileCOP as Decimal;
      break;
    case "LOWER_OF_MEDIAN_AND_PERCENTILE":
      baseEstimatorCOP = Decimal.min(medianCOP, percentileCOP as Decimal);
      break;
  }

  return {
    status:
      included.length < settings.minComparablesForRecommendation
        ? "LOW_CONFIDENCE"
        : "READY",
    includedComparableIds: included.map((comparable) => comparable.id).sort(),
    excluded,
    statistics: {
      count: included.length,
      minimumCOP: sortedPrices[0]!,
      maximumCOP: sortedPrices[sortedPrices.length - 1]!,
      averageCOP: sumDecimals(sortedPrices).dividedBy(sortedPrices.length),
      medianCOP,
      percentileCOP,
    },
    baseEstimatorCOP,
    conservativeSalePriceCOP: roundCopRevenue(
      baseEstimatorCOP.times(new Decimal(1).minus(settings.safetyMarginRate)),
    ),
  };
}
