import type {
  ExchangeCostBreakdown,
  LandedCostBreakdown,
  ShippingCostBreakdown,
  ShippingQuote,
  ShippingSelection,
} from "./contracts";
import { assertNonNegative, roundCopCost, sumDecimals } from "./decimal";
import { isExpired } from "./time";

export function calculateShippingCost(
  quote: ShippingQuote,
): ShippingCostBreakdown {
  if (
    !Number.isInteger(quote.estimatedDeliveryDays) ||
    quote.estimatedDeliveryDays < 0
  ) {
    throw new RangeError("estimatedDeliveryDays must be a non-negative integer");
  }

  const fixedComponents = [
    ["internationalShippingCOP", quote.internationalShippingCOP],
    ["insuranceCOP", quote.insuranceCOP],
    ["customsCOP", quote.customsCOP],
    ["vatCOP", quote.vatCOP],
    ["handlingCOP", quote.handlingCOP],
    ["nationalizationCOP", quote.nationalizationCOP],
    ["localDeliveryCOP", quote.localDeliveryCOP],
  ] as const;

  for (const [name, value] of fixedComponents) {
    assertNonNegative(value, name);
  }
  for (const cost of quote.otherCostsCOP) {
    assertNonNegative(cost.amountCOP, `${cost.code}.amountCOP`);
  }

  const roundedFixed = fixedComponents.map(([, value]) => roundCopCost(value));
  const roundedOther = quote.otherCostsCOP.map((cost) => ({
    ...cost,
    amountCOP: roundCopCost(cost.amountCOP),
  }));

  return {
    quoteId: quote.id,
    providerId: quote.providerId,
    internationalShippingCOP: roundedFixed[0]!,
    insuranceCOP: roundedFixed[1]!,
    customsCOP: roundedFixed[2]!,
    vatCOP: roundedFixed[3]!,
    handlingCOP: roundedFixed[4]!,
    nationalizationCOP: roundedFixed[5]!,
    localDeliveryCOP: roundedFixed[6]!,
    otherCostsCOP: roundedOther,
    totalShippingAndImportCOP: sumDecimals([
      ...roundedFixed,
      ...roundedOther.map((cost) => cost.amountCOP),
    ]),
  };
}

export function calculateLandedCost(
  acquisition: ExchangeCostBreakdown,
  quote: ShippingQuote,
): LandedCostBreakdown {
  const shipping = calculateShippingCost(quote);
  return {
    acquisition,
    shipping,
    landedCostCOP: acquisition.totalConvertedCOP.plus(
      shipping.totalShippingAndImportCOP,
    ),
  };
}

export function selectBestShippingQuote(args: {
  readonly acquisition: ExchangeCostBreakdown;
  readonly quotes: readonly ShippingQuote[];
  readonly offerId: string;
  readonly evaluatedAt: string;
}): ShippingSelection {
  const eligible: NonNullable<ShippingSelection["selected"]>[] = [];
  const rejected: ShippingSelection["rejected"] extends readonly (infer Item)[]
    ? Item[]
    : never = [];

  for (const quote of args.quotes) {
    if (quote.offerId !== args.offerId) {
      rejected.push({ quoteId: quote.id, reason: "OFFER_MISMATCH" });
      continue;
    }
    if (quote.completeness !== "COMPLETE") {
      rejected.push({ quoteId: quote.id, reason: "INCOMPLETE" });
      continue;
    }
    if (isExpired(quote.expiresAt, args.evaluatedAt)) {
      rejected.push({ quoteId: quote.id, reason: "EXPIRED" });
      continue;
    }

    eligible.push({
      quote,
      breakdown: calculateLandedCost(args.acquisition, quote),
    });
  }

  eligible.sort((left, right) => {
    const costComparison = left.breakdown.landedCostCOP.comparedTo(
      right.breakdown.landedCostCOP,
    );
    if (costComparison !== 0) return costComparison;

    const daysComparison =
      left.quote.estimatedDeliveryDays - right.quote.estimatedDeliveryDays;
    if (daysComparison !== 0) return daysComparison;

    const providerComparison = left.quote.providerId.localeCompare(
      right.quote.providerId,
    );
    if (providerComparison !== 0) return providerComparison;
    return left.quote.id.localeCompare(right.quote.id);
  });

  return {
    selected: eligible[0],
    eligible,
    rejected,
  };
}
