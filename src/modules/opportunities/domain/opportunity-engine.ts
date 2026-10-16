import Decimal from "decimal.js";

import { calculateReturnVelocity } from "../../finance/capital-velocity";
import {
  classifyOpportunity,
  opportunitySignalRank,
} from "../../finance/classification";
import { assertNonNegative, assertPositive, assertRate } from "../../finance/decimal";
import { calculateExchangeCost } from "../../finance/exchange";
import { calculateFinancingCost } from "../../finance/financing";
import { selectBestShippingQuote } from "../../finance/landed-cost";
import { calculateConservativeMarketPrice } from "../../finance/market-price";
import { calculateOpportunityScore } from "../../finance/opportunity-score";
import { calculateProfitability } from "../../finance/profitability";
import { calculateSellingCosts } from "../../finance/selling-costs";
import { ageInDays, isExpired, timestampToMilliseconds } from "../../finance/time";
import { calculateWarrantyReserve } from "../../finance/warranty";
import type {
  AnalysisIssue,
  OpportunityAnalysis,
  OpportunityAudit,
  OpportunityEngineInput,
  OpportunityScenario,
  SaleChannel,
} from "./contracts";

export const OPPORTUNITY_ENGINE_VERSION = "1.0.0";

function buildAudit(input: OpportunityEngineInput): OpportunityAudit {
  return {
    offerId: input.offer.id,
    exchangeRateId: input.exchangeRate.id,
    shippingQuoteIds: input.shippingQuotes.map((quote) => quote.id).sort(),
    marketListingIds: input.marketData.listings
      .map((listing) => listing.id)
      .sort(),
    settingsId: input.settings.id,
    settingsVersion: input.settings.version,
    evaluatedAt: input.evaluatedAt,
  };
}

function incomplete(
  input: OpportunityEngineInput,
  issues: readonly AnalysisIssue[],
  partial?: Pick<OpportunityAnalysis, "acquisition" | "shipping">,
): OpportunityAnalysis {
  return {
    status: "INCOMPLETE",
    engineVersion: OPPORTUNITY_ENGINE_VERSION,
    ...(partial?.acquisition === undefined
      ? {}
      : { acquisition: partial.acquisition }),
    ...(partial?.shipping === undefined ? {} : { shipping: partial.shipping }),
    scenarios: [],
    issues,
    audit: buildAudit(input),
  };
}

function validateStaticSettings(input: OpportunityEngineInput): void {
  assertRate(
    input.settings.maxCapitalPerProductRate,
    "maxCapitalPerProductRate",
  );
  assertNonNegative(input.capital.availableCapitalCOP, "availableCapitalCOP");
  assertNonNegative(
    input.capital.currentExposureForConcentrationKeyCOP,
    "currentExposureForConcentrationKeyCOP",
  );
  assertPositive(
    input.capital.totalWorkingCapitalCOP,
    "totalWorkingCapitalCOP",
  );
  const channels = new Set<SaleChannel>();
  for (const config of input.settings.salesChannels) {
    if (channels.has(config.channel)) {
      throw new RangeError(`Duplicate sales channel config: ${config.channel}`);
    }
    channels.add(config.channel);
  }
}

function sortScenarios(
  scenarios: readonly OpportunityScenario[],
): OpportunityScenario[] {
  return [...scenarios].sort((left, right) => {
    const signalComparison =
      opportunitySignalRank(right.classification.signal) -
      opportunitySignalRank(left.classification.signal);
    if (signalComparison !== 0) return signalComparison;

    const scoreComparison = right.score.score - left.score.score;
    if (scoreComparison !== 0) return scoreComparison;

    const profitComparison =
      right.profitability.riskAdjustedNetProfitCOP.comparedTo(
        left.profitability.riskAdjustedNetProfitCOP,
      );
    if (profitComparison !== 0) return profitComparison;

    const leftRoi = left.profitability.roi ?? new Decimal(-1);
    const rightRoi = right.profitability.roi ?? new Decimal(-1);
    const roiComparison = rightRoi.comparedTo(leftRoi);
    if (roiComparison !== 0) return roiComparison;
    return left.channel.localeCompare(right.channel);
  });
}

export function analyzeOpportunity(
  input: OpportunityEngineInput,
): OpportunityAnalysis {
  timestampToMilliseconds(input.evaluatedAt, "evaluatedAt");
  validateStaticSettings(input);
  const issues: AnalysisIssue[] = [];

  if (isExpired(input.offer.expiresAt, input.evaluatedAt)) {
    issues.push({
      code: "OFFER_EXPIRED",
      severity: "ERROR",
      message: "The supplier offer was expired at evaluation time.",
    });
  }
  if (ageInDays(input.offer.observedAt, input.evaluatedAt) < 0) {
    issues.push({
      code: "OFFER_FROM_FUTURE",
      severity: "ERROR",
      message: "The supplier offer observation is after evaluation time.",
    });
  }
  if (isExpired(input.exchangeRate.expiresAt, input.evaluatedAt)) {
    issues.push({
      code: "EXCHANGE_RATE_EXPIRED",
      severity: "ERROR",
      message: "The exchange-rate snapshot was expired at evaluation time.",
    });
  }
  if (ageInDays(input.exchangeRate.observedAt, input.evaluatedAt) < 0) {
    issues.push({
      code: "EXCHANGE_RATE_FROM_FUTURE",
      severity: "ERROR",
      message: "The exchange-rate observation is after evaluation time.",
    });
  }
  if (issues.some((issue) => issue.severity === "ERROR")) {
    return incomplete(input, issues);
  }

  const acquisition = calculateExchangeCost(
    [
      {
        code: "PURCHASE_PRICE",
        label: "Purchase price",
        amountUSD: input.offer.purchasePriceUSD,
        subjectToFxSpread: true,
      },
      {
        code: "US_SHIPPING",
        label: "US shipping",
        amountUSD: input.offer.usShippingUSD,
        subjectToFxSpread: true,
      },
      {
        code: "US_SALES_TAX",
        label: "US sales tax",
        amountUSD: input.offer.usSalesTaxUSD,
        subjectToFxSpread: true,
      },
      {
        code: "PAYMENT_FEE",
        label: "Payment fee",
        amountUSD: input.offer.paymentFeeUSD,
        subjectToFxSpread: true,
      },
      ...input.offer.otherPurchaseCostsUSD,
    ],
    input.exchangeRate,
  );
  const shipping = selectBestShippingQuote({
    acquisition,
    quotes: input.shippingQuotes,
    offerId: input.offer.id,
    evaluatedAt: input.evaluatedAt,
  });
  if (shipping.selected === undefined) {
    issues.push({
      code: "NO_ELIGIBLE_SHIPPING_QUOTE",
      severity: "ERROR",
      message: "No complete, current shipping quote matches this offer.",
    });
    return incomplete(input, issues, { acquisition, shipping });
  }

  const landedCostCOP = shipping.selected.breakdown.landedCostCOP;
  const scenarios: OpportunityScenario[] = [];

  for (const channelConfig of input.settings.salesChannels) {
    const channelIssues: AnalysisIssue[] = [];
    const matchingListings = input.marketData.listings.filter(
      (listing) =>
        listing.productVariantId === input.offer.productVariantId &&
        listing.condition === input.offer.condition &&
        listing.channel === channelConfig.channel,
    );
    const marketPrice = calculateConservativeMarketPrice({
      comparables: matchingListings.map((listing) => ({
        id: listing.id,
        deduplicationKey:
          listing.externalListingId === undefined
            ? `${listing.sourceId}:${listing.id}`
            : `${listing.sourceId}:${listing.externalListingId}`,
        sellerGrossPriceCOP: listing.sellerGrossPriceCOP,
        observedAt: listing.observedAt,
        active: listing.active,
      })),
      settings: input.settings.marketPricing,
      evaluatedAt: input.evaluatedAt,
    });
    if (marketPrice.status === "NO_COMPARABLES") {
      channelIssues.push({
        code: "NO_MARKET_COMPARABLES",
        severity: "WARNING",
        channel: channelConfig.channel,
        message: `No eligible market comparables for ${channelConfig.channel}.`,
      });
      issues.push(...channelIssues);
      continue;
    }
    if (marketPrice.status === "LOW_CONFIDENCE") {
      channelIssues.push({
        code: "LOW_MARKET_CONFIDENCE",
        severity: "WARNING",
        channel: channelConfig.channel,
        message: `Market evidence for ${channelConfig.channel} is below the configured minimum.`,
      });
    }

    const expectedDaysToSell =
      input.marketData.expectedDaysToSell[channelConfig.channel];
    if (
      expectedDaysToSell === undefined ||
      !Number.isInteger(expectedDaysToSell) ||
      expectedDaysToSell <= 0
    ) {
      channelIssues.push({
        code: "MISSING_EXPECTED_DAYS",
        severity: "WARNING",
        channel: channelConfig.channel,
        message: `A positive expected selling time is required for ${channelConfig.channel}.`,
      });
      issues.push(...channelIssues);
      continue;
    }

    const sellingCosts = calculateSellingCosts(
      marketPrice.conservativeSalePriceCOP,
      channelConfig,
    );
    const warrantyReserve = calculateWarrantyReserve({
      landedCostCOP,
      salePriceCOP: marketPrice.conservativeSalePriceCOP,
      settings: input.settings.warranty,
    });
    const beforeFinancing = calculateProfitability({
      salePriceCOP: marketPrice.conservativeSalePriceCOP,
      landedCostCOP,
      sellingCosts,
      warrantyReserveCOP: warrantyReserve.reserveCOP,
      financingCostCOP: new Decimal(0),
    });
    const financing = calculateFinancingCost({
      capitalRequiredCOP: beforeFinancing.capitalRequiredCOP,
      holdingDays: expectedDaysToSell,
      settings: input.settings.finance,
    });
    const profitability = calculateProfitability({
      salePriceCOP: marketPrice.conservativeSalePriceCOP,
      landedCostCOP,
      sellingCosts,
      warrantyReserveCOP: warrantyReserve.reserveCOP,
      financingCostCOP: financing.financingCostCOP,
    });
    const returnVelocity = calculateReturnVelocity({
      roi: profitability.roi,
      holdingDays: expectedDaysToSell,
      financeSettings: input.settings.finance,
      velocitySettings: input.settings.velocity,
    });
    const capitalConsumptionRate = profitability.capitalRequiredCOP.dividedBy(
      input.capital.totalWorkingCapitalCOP,
    );
    const capitalConcentrationRate = input.capital
      .currentExposureForConcentrationKeyCOP
      .plus(profitability.capitalRequiredCOP)
      .dividedBy(input.capital.totalWorkingCapitalCOP);

    const score = calculateOpportunityScore(
      {
        roi: profitability.roi,
        profitCOP: profitability.riskAdjustedNetProfitCOP,
        capitalRequiredRate: capitalConsumptionRate,
        marketLiquidityIndex:
          input.marketData.liquidityIndex[channelConfig.channel],
        comparableCount: marketPrice.statistics.count,
        condition: input.offer.condition,
        batteryHealthRate: input.offer.batteryHealthRate,
        sellerRatingRate: input.offer.sellerRatingRate,
        sellerReviewCount: input.offer.sellerReviewCount,
        warrantyDays: input.offer.supplierWarrantyDays,
        expectedDaysToSell,
        priceVolatilityRate:
          input.marketData.priceVolatilityRate[channelConfig.channel],
        capitalConcentrationRate,
      },
      input.settings.scoring,
    );

    const forcedRejectReasons: string[] = [];
    if (
      profitability.capitalRequiredCOP.greaterThan(
        input.capital.availableCapitalCOP,
      )
    ) {
      channelIssues.push({
        code: "INSUFFICIENT_CAPITAL",
        severity: "WARNING",
        channel: channelConfig.channel,
        message: "The opportunity requires more capital than is available.",
      });
      if (input.settings.recommendationPolicy.rejectWhenUnaffordable) {
        forcedRejectReasons.push("INSUFFICIENT_CAPITAL");
      }
    }
    if (
      capitalConcentrationRate.greaterThan(
        input.settings.maxCapitalPerProductRate,
      )
    ) {
      channelIssues.push({
        code: "CAPITAL_CONCENTRATION_EXCEEDED",
        severity: "WARNING",
        channel: channelConfig.channel,
        message: "Post-purchase product concentration exceeds the configured limit.",
      });
      if (
        input.settings.recommendationPolicy
          .rejectWhenConcentrationExceeded
      ) {
        forcedRejectReasons.push("CAPITAL_CONCENTRATION_EXCEEDED");
      }
    }

    const classification = classifyOpportunity({
      metrics: {
        ...(profitability.roi === undefined ? {} : { ROI: profitability.roi }),
        ...(profitability.margin === undefined
          ? {}
          : { MARGIN: profitability.margin }),
        NET_PROFIT_COP: profitability.riskAdjustedNetProfitCOP,
        SCORE: new Decimal(score.score),
        CAPITAL_REQUIRED_COP: profitability.capitalRequiredCOP,
        EXPECTED_DAYS_TO_SELL: new Decimal(expectedDaysToSell),
        CAPITAL_CONCENTRATION_RATE: capitalConcentrationRate,
      },
      rules: input.settings.classificationRules,
      ...(marketPrice.status === "LOW_CONFIDENCE" &&
      input.settings.recommendationPolicy.lowConfidenceSignalCap !== undefined
        ? {
            signalCap:
              input.settings.recommendationPolicy.lowConfidenceSignalCap,
          }
        : {}),
      ...(forcedRejectReasons.length === 0
        ? {}
        : { forcedRejectReason: forcedRejectReasons.join(",") }),
    });

    const scenario: OpportunityScenario = {
      channel: channelConfig.channel,
      marketPrice,
      sellingCosts,
      warrantyReserve,
      financing,
      profitability,
      returnVelocity,
      capitalConsumptionRate,
      capitalConcentrationRate,
      score,
      classification,
      issues: channelIssues,
    };
    scenarios.push(scenario);
    issues.push(...channelIssues);
  }

  if (scenarios.length === 0) {
    return {
      ...incomplete(input, issues, { acquisition, shipping }),
      scenarios,
    };
  }

  const sortedScenarios = sortScenarios(scenarios);
  return {
    status: "COMPLETE",
    engineVersion: OPPORTUNITY_ENGINE_VERSION,
    acquisition,
    shipping,
    scenarios: sortedScenarios,
    selectedScenario: sortedScenarios[0]!,
    issues,
    audit: buildAudit(input),
  };
}
