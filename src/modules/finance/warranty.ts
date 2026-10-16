import type {
  WarrantyReserveBreakdown,
  WarrantySettings,
} from "./contracts";
import {
  assertNonNegative,
  assertRate,
  roundCopCost,
} from "./decimal";

export function calculateWarrantyReserve(args: {
  readonly landedCostCOP: import("decimal.js").default;
  readonly salePriceCOP: import("decimal.js").default;
  readonly settings: WarrantySettings;
}): WarrantyReserveBreakdown {
  assertNonNegative(args.landedCostCOP, "landedCostCOP");
  assertNonNegative(args.salePriceCOP, "salePriceCOP");
  assertRate(args.settings.rate, "warrantyRate");

  const basisAmountCOP =
    args.settings.basis === "LANDED_COST"
      ? args.landedCostCOP
      : args.salePriceCOP;

  return {
    basis: args.settings.basis,
    basisAmountCOP,
    rate: args.settings.rate,
    reserveCOP: roundCopCost(basisAmountCOP.times(args.settings.rate)),
  };
}
