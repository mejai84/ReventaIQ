import Decimal from "decimal.js";

import type {
  ExchangeCostBreakdown,
  ExchangeRate,
  UsdCostLine,
} from "./contracts";
import {
  assertNonNegative,
  assertPositive,
  assertRate,
  roundCopCost,
  sumDecimals,
} from "./decimal";

/**
 * Converts a set of USD charges into COP and exposes the FX spread separately.
 * Each base charge is rounded as its own payable line; the spread is rounded once.
 */
export function calculateExchangeCost(
  lines: readonly UsdCostLine[],
  exchangeRate: ExchangeRate,
): ExchangeCostBreakdown {
  assertPositive(exchangeRate.trmCopPerUsd, "trmCopPerUsd");
  assertRate(exchangeRate.cardSpreadRate, "cardSpreadRate");
  assertNonNegative(
    exchangeRate.fixedConversionFeeCOP,
    "fixedConversionFeeCOP",
  );

  const convertedLines = lines.map((line) => {
    assertNonNegative(line.amountUSD, `${line.code}.amountUSD`);
    return {
      ...line,
      convertedAtTrmCOP: roundCopCost(
        line.amountUSD.times(exchangeRate.trmCopPerUsd),
      ),
    };
  });

  const totalUSD = sumDecimals(lines.map((line) => line.amountUSD));
  const spreadEligibleUSD = sumDecimals(
    lines
      .filter((line) => line.subjectToFxSpread)
      .map((line) => line.amountUSD),
  );
  const baseConvertedCOP = sumDecimals(
    convertedLines.map((line) => line.convertedAtTrmCOP),
  );
  const spreadCostCOP = roundCopCost(
    spreadEligibleUSD
      .times(exchangeRate.trmCopPerUsd)
      .times(exchangeRate.cardSpreadRate),
  );
  const fixedConversionFeeCOP = totalUSD.isZero()
    ? new Decimal(0)
    : roundCopCost(exchangeRate.fixedConversionFeeCOP);
  const currencyConversionCostCOP = spreadCostCOP.plus(
    fixedConversionFeeCOP,
  );
  const totalConvertedCOP = baseConvertedCOP.plus(
    currencyConversionCostCOP,
  );

  return {
    lines: convertedLines,
    totalUSD,
    spreadEligibleUSD,
    baseConvertedCOP,
    spreadCostCOP,
    fixedConversionFeeCOP,
    currencyConversionCostCOP,
    totalConvertedCOP,
    effectiveRateCopPerUsd: totalUSD.isZero()
      ? undefined
      : totalConvertedCOP.dividedBy(totalUSD),
  };
}
