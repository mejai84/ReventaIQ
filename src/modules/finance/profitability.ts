import Decimal from "decimal.js";

import type {
  ProfitabilityInput,
  ProfitabilityResult,
} from "./contracts";
import {
  assertNonNegative,
  roundCopCost,
  roundCopRevenue,
  sumDecimals,
} from "./decimal";

export function calculateProfitability(
  input: ProfitabilityInput,
): ProfitabilityResult {
  const salePriceCOP = roundCopRevenue(input.salePriceCOP);
  const landedCostCOP = roundCopCost(input.landedCostCOP);
  const warrantyReserveCOP = roundCopCost(input.warrantyReserveCOP);
  const financingCostCOP = roundCopCost(input.financingCostCOP);
  const otherUpfrontCostsCOP = (input.otherUpfrontCostsCOP ?? []).map(
    (cost, index) => {
      assertNonNegative(cost, `otherUpfrontCostsCOP[${index}]`);
      return roundCopCost(cost);
    },
  );
  const otherAtSaleCostsCOP = (input.otherAtSaleCostsCOP ?? []).map(
    (cost, index) => {
      assertNonNegative(cost, `otherAtSaleCostsCOP[${index}]`);
      return roundCopCost(cost);
    },
  );
  const otherCostsCOP = sumDecimals([
    ...otherUpfrontCostsCOP,
    ...otherAtSaleCostsCOP,
  ]);

  const grossProfitCOP = salePriceCOP.minus(landedCostCOP);
  const contributionProfitCOP = grossProfitCOP
    .minus(input.sellingCosts.totalEconomicCostsCOP)
    .minus(otherCostsCOP);
  const realCostCOP = sumDecimals([
    landedCostCOP,
    input.sellingCosts.totalEconomicCostsCOP,
    warrantyReserveCOP,
    financingCostCOP,
    otherCostsCOP,
  ]);
  const riskAdjustedNetProfitCOP = salePriceCOP.minus(realCostCOP);
  const capitalRequiredCOP = sumDecimals([
    landedCostCOP,
    warrantyReserveCOP,
    input.sellingCosts.upfrontEconomicCostsCOP,
    ...otherUpfrontCostsCOP,
  ]);

  return {
    salePriceCOP,
    grossProfitCOP,
    contributionProfitCOP,
    realCostCOP,
    riskAdjustedNetProfitCOP,
    capitalRequiredCOP,
    margin: salePriceCOP.isZero()
      ? undefined
      : riskAdjustedNetProfitCOP.dividedBy(salePriceCOP),
    roi: capitalRequiredCOP.isZero()
      ? undefined
      : riskAdjustedNetProfitCOP.dividedBy(capitalRequiredCOP),
  };
}

export function emptySellingCosts(): ProfitabilityInput["sellingCosts"] {
  const zero = new Decimal(0);
  return {
    lines: [],
    upfrontEconomicCostsCOP: zero,
    atSaleEconomicCostsCOP: zero,
    totalEconomicCostsCOP: zero,
    totalCashDeductionsCOP: zero,
  };
}
