import type {
  CalculatedSellingCostLine,
  SalesChannelCostConfig,
  SellingCostBreakdown,
} from "./contracts";
import {
  assertNonNegative,
  assertRate,
  roundCopCost,
  roundCopRevenue,
  sumDecimals,
} from "./decimal";

export function calculateSellingCosts<Channel extends string>(
  salePriceCOP: import("decimal.js").default,
  config: SalesChannelCostConfig<Channel>,
): SellingCostBreakdown {
  const normalizedSalePriceCOP = roundCopRevenue(salePriceCOP);

  const percentageLines: CalculatedSellingCostLine[] =
    config.percentageCosts.map((cost) => {
      assertRate(cost.rate, `${cost.code}.rate`);
      return {
        code: cost.code,
        label: cost.label,
        amountCOP: roundCopCost(normalizedSalePriceCOP.times(cost.rate)),
        timing: cost.timing,
        countsAsEconomicCost: cost.countsAsEconomicCost,
        source: "PERCENTAGE",
      };
    });

  const fixedLines: CalculatedSellingCostLine[] = config.fixedCosts.map(
    (cost) => {
      assertNonNegative(cost.amountCOP, `${cost.code}.amountCOP`);
      return {
        code: cost.code,
        label: cost.label,
        amountCOP: roundCopCost(cost.amountCOP),
        timing: cost.timing,
        countsAsEconomicCost: cost.countsAsEconomicCost,
        source: "FIXED",
      };
    },
  );

  const lines = [...percentageLines, ...fixedLines];
  const economicLines = lines.filter((line) => line.countsAsEconomicCost);

  return {
    lines,
    upfrontEconomicCostsCOP: sumDecimals(
      economicLines
        .filter((line) => line.timing === "UPFRONT")
        .map((line) => line.amountCOP),
    ),
    atSaleEconomicCostsCOP: sumDecimals(
      economicLines
        .filter((line) => line.timing === "AT_SALE")
        .map((line) => line.amountCOP),
    ),
    totalEconomicCostsCOP: sumDecimals(
      economicLines.map((line) => line.amountCOP),
    ),
    totalCashDeductionsCOP: sumDecimals(lines.map((line) => line.amountCOP)),
  };
}
