import Decimal from "decimal.js";

import type {
  FinancingSettings,
  ReturnVelocityResult,
  VelocitySettings,
} from "./contracts";
import {
  assertFiniteDecimal,
  clampDecimal,
  roundHalfUp,
} from "./decimal";

export function calculateReturnVelocity(args: {
  readonly roi: Decimal | undefined;
  readonly holdingDays: number;
  readonly financeSettings: FinancingSettings;
  readonly velocitySettings: VelocitySettings;
}): ReturnVelocityResult {
  if (args.roi === undefined || args.holdingDays <= 0) {
    return {};
  }
  if (!Number.isInteger(args.holdingDays)) {
    throw new RangeError("holdingDays must be an integer");
  }
  if (
    !Number.isInteger(args.financeSettings.dayBasis) ||
    args.financeSettings.dayBasis <= 0
  ) {
    throw new RangeError("dayBasis must be a positive integer");
  }
  assertFiniteDecimal(args.roi, "roi");
  if (args.velocitySettings.goodMonthlyRoi.equals(
    args.velocitySettings.badMonthlyRoi,
  )) {
    throw new RangeError("Velocity good and bad thresholds must differ");
  }

  const monthlyPeriods = new Decimal(args.financeSettings.dayBasis).dividedBy(
    args.holdingDays,
  );
  const annualPeriods = new Decimal(365).dividedBy(args.holdingDays);

  let monthlyizedRoi: Decimal;
  let annualizedRoi: Decimal;
  if (args.financeSettings.annualizationMethod === "COMPOUNDED") {
    if (args.roi.lessThanOrEqualTo(-1)) {
      return {};
    }
    monthlyizedRoi = args.roi.plus(1).pow(monthlyPeriods).minus(1);
    annualizedRoi = args.roi.plus(1).pow(annualPeriods).minus(1);
  } else {
    monthlyizedRoi = args.roi.times(monthlyPeriods);
    annualizedRoi = args.roi.times(annualPeriods);
  }

  const normalized = monthlyizedRoi
    .minus(args.velocitySettings.badMonthlyRoi)
    .dividedBy(
      args.velocitySettings.goodMonthlyRoi.minus(
        args.velocitySettings.badMonthlyRoi,
      ),
    );
  const score = clampDecimal(normalized, new Decimal(0), new Decimal(1)).times(
    100,
  );

  return {
    monthlyizedRoi,
    annualizedRoi,
    capitalVelocityScore: roundHalfUp(score, 0).toNumber(),
  };
}
