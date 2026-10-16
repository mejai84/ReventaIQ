import type {
  FinancingCostBreakdown,
  FinancingSettings,
} from "./contracts";
import {
  assertNonNegative,
  assertPositive,
  assertRate,
  roundCopCost,
} from "./decimal";

export function calculateFinancingCost(args: {
  readonly capitalRequiredCOP: import("decimal.js").default;
  readonly holdingDays: number;
  readonly settings: FinancingSettings;
}): FinancingCostBreakdown {
  assertNonNegative(args.capitalRequiredCOP, "capitalRequiredCOP");
  assertNonNegative(args.settings.monthlyRate, "monthlyRate");
  assertRate(args.settings.debtFundingRate, "debtFundingRate");
  assertPositive(
    new (args.capitalRequiredCOP.constructor as typeof import("decimal.js").default)(
      args.settings.dayBasis,
    ),
    "dayBasis",
  );
  if (!Number.isInteger(args.settings.dayBasis)) {
    throw new RangeError("dayBasis must be a positive integer");
  }
  if (!Number.isInteger(args.holdingDays) || args.holdingDays < 0) {
    throw new RangeError("holdingDays must be a non-negative integer");
  }

  const financedCapitalCOP = roundCopCost(
    args.capitalRequiredCOP.times(args.settings.debtFundingRate),
  );
  const dailyFinancingCostCOP = financedCapitalCOP
    .times(args.settings.monthlyRate)
    .dividedBy(args.settings.dayBasis);
  const financingCostCOP = roundCopCost(
    dailyFinancingCostCOP.times(args.holdingDays),
  );

  return {
    financedCapitalCOP,
    dailyFinancingCostCOP,
    holdingDays: args.holdingDays,
    financingCostCOP,
  };
}
