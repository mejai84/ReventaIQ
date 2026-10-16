import type Decimal from "decimal.js";

export type Currency = "USD" | "COP";
export type CostTiming = "UPFRONT" | "AT_SALE";

export interface Money<C extends Currency = Currency> {
  readonly currency: C;
  readonly amount: Decimal;
}

/** DTOs deliberately use strings so JSON never passes monetary IEEE-754 numbers. */
export interface MoneyDto<C extends Currency = Currency> {
  readonly currency: C;
  readonly amount: string;
}

export interface NamedUsdCost {
  readonly code: string;
  readonly label: string;
  readonly amountUSD: Decimal;
  readonly subjectToFxSpread: boolean;
}

export interface NamedCopCost {
  readonly code: string;
  readonly label: string;
  readonly amountCOP: Decimal;
  readonly timing: CostTiming;
  readonly countsAsEconomicCost: boolean;
}

export interface ExchangeRate {
  readonly id: string;
  readonly trmCopPerUsd: Decimal;
  readonly cardSpreadRate: Decimal;
  readonly fixedConversionFeeCOP: Decimal;
  readonly observedAt: string;
  readonly expiresAt?: string | undefined;
  readonly source: "AUTOMATIC" | "MANUAL";
}

export interface UsdCostLine {
  readonly code: string;
  readonly label: string;
  readonly amountUSD: Decimal;
  readonly subjectToFxSpread: boolean;
}

export interface ConvertedUsdCostLine extends UsdCostLine {
  readonly convertedAtTrmCOP: Decimal;
}

export interface ExchangeCostBreakdown {
  readonly lines: readonly ConvertedUsdCostLine[];
  readonly totalUSD: Decimal;
  readonly spreadEligibleUSD: Decimal;
  readonly baseConvertedCOP: Decimal;
  readonly spreadCostCOP: Decimal;
  readonly fixedConversionFeeCOP: Decimal;
  readonly currencyConversionCostCOP: Decimal;
  readonly totalConvertedCOP: Decimal;
  readonly effectiveRateCopPerUsd?: Decimal | undefined;
}

export interface ShippingQuote {
  readonly id: string;
  readonly providerId: string;
  readonly offerId: string;
  readonly internationalShippingCOP: Decimal;
  readonly insuranceCOP: Decimal;
  readonly customsCOP: Decimal;
  readonly vatCOP: Decimal;
  readonly handlingCOP: Decimal;
  readonly nationalizationCOP: Decimal;
  readonly localDeliveryCOP: Decimal;
  readonly otherCostsCOP: readonly NamedCopCost[];
  readonly estimatedDeliveryDays: number;
  readonly observedAt: string;
  readonly expiresAt?: string | undefined;
  readonly completeness: "COMPLETE" | "INCOMPLETE";
}

export interface ShippingCostBreakdown {
  readonly quoteId: string;
  readonly providerId: string;
  readonly internationalShippingCOP: Decimal;
  readonly insuranceCOP: Decimal;
  readonly customsCOP: Decimal;
  readonly vatCOP: Decimal;
  readonly handlingCOP: Decimal;
  readonly nationalizationCOP: Decimal;
  readonly localDeliveryCOP: Decimal;
  readonly otherCostsCOP: readonly NamedCopCost[];
  readonly totalShippingAndImportCOP: Decimal;
}

export interface LandedCostBreakdown {
  readonly acquisition: ExchangeCostBreakdown;
  readonly shipping: ShippingCostBreakdown;
  readonly landedCostCOP: Decimal;
}

export interface RejectedShippingQuote {
  readonly quoteId: string;
  readonly reason: "INCOMPLETE" | "EXPIRED" | "OFFER_MISMATCH";
}

export interface ShippingSelection {
  readonly selected?: {
    readonly quote: ShippingQuote;
    readonly breakdown: LandedCostBreakdown;
  } | undefined;
  readonly eligible: readonly {
    readonly quote: ShippingQuote;
    readonly breakdown: LandedCostBreakdown;
  }[];
  readonly rejected: readonly RejectedShippingQuote[];
}

export interface ComparablePrice {
  readonly id: string;
  readonly deduplicationKey?: string | undefined;
  readonly sellerGrossPriceCOP: Decimal;
  readonly observedAt: string;
  readonly active: boolean;
}

export type MarketPricingMethod =
  | "MEDIAN"
  | "NEAREST_RANK_PERCENTILE"
  | "LOWER_OF_MEDIAN_AND_PERCENTILE";

export interface MarketPricingSettings {
  readonly method: MarketPricingMethod;
  readonly percentile?: Decimal | undefined;
  readonly safetyMarginRate: Decimal;
  readonly minComparablesForRecommendation: number;
  readonly maxListingAgeDays: number;
}

export interface MarketPriceStatistics {
  readonly count: number;
  readonly minimumCOP: Decimal;
  readonly maximumCOP: Decimal;
  readonly averageCOP: Decimal;
  readonly medianCOP: Decimal;
  readonly percentileCOP?: Decimal | undefined;
}

export interface ExcludedComparable {
  readonly comparableId: string;
  readonly reason: "INACTIVE" | "STALE" | "FUTURE" | "DUPLICATE";
}

export type MarketPriceResult =
  | {
    readonly status: "NO_COMPARABLES";
    readonly includedComparableIds: readonly string[];
    readonly excluded: readonly ExcludedComparable[];
  }
  | {
    readonly status: "READY" | "LOW_CONFIDENCE";
    readonly includedComparableIds: readonly string[];
    readonly excluded: readonly ExcludedComparable[];
    readonly statistics: MarketPriceStatistics;
    readonly baseEstimatorCOP: Decimal;
    readonly conservativeSalePriceCOP: Decimal;
  };

export interface PercentageSellingCost {
  readonly code: string;
  readonly label: string;
  readonly rate: Decimal;
  readonly timing: CostTiming;
  readonly countsAsEconomicCost: boolean;
}

export interface SalesChannelCostConfig<Channel extends string = string> {
  readonly channel: Channel;
  readonly percentageCosts: readonly PercentageSellingCost[];
  readonly fixedCosts: readonly NamedCopCost[];
}

export interface CalculatedSellingCostLine {
  readonly code: string;
  readonly label: string;
  readonly amountCOP: Decimal;
  readonly timing: CostTiming;
  readonly countsAsEconomicCost: boolean;
  readonly source: "PERCENTAGE" | "FIXED";
}

export interface SellingCostBreakdown {
  readonly lines: readonly CalculatedSellingCostLine[];
  readonly upfrontEconomicCostsCOP: Decimal;
  readonly atSaleEconomicCostsCOP: Decimal;
  readonly totalEconomicCostsCOP: Decimal;
  readonly totalCashDeductionsCOP: Decimal;
}

export interface WarrantySettings {
  readonly rate: Decimal;
  readonly basis: "LANDED_COST" | "SALE_PRICE";
}

export interface WarrantyReserveBreakdown {
  readonly basis: WarrantySettings["basis"];
  readonly basisAmountCOP: Decimal;
  readonly rate: Decimal;
  readonly reserveCOP: Decimal;
}

export interface FinancingSettings {
  readonly monthlyRate: Decimal;
  readonly dayBasis: number;
  readonly debtFundingRate: Decimal;
  readonly annualizationMethod: "SIMPLE" | "COMPOUNDED";
}

export interface FinancingCostBreakdown {
  readonly financedCapitalCOP: Decimal;
  readonly dailyFinancingCostCOP: Decimal;
  readonly holdingDays: number;
  readonly financingCostCOP: Decimal;
}

export interface ProfitabilityInput {
  readonly salePriceCOP: Decimal;
  readonly landedCostCOP: Decimal;
  readonly sellingCosts: SellingCostBreakdown;
  readonly warrantyReserveCOP: Decimal;
  readonly financingCostCOP: Decimal;
  readonly otherUpfrontCostsCOP?: readonly Decimal[] | undefined;
  readonly otherAtSaleCostsCOP?: readonly Decimal[] | undefined;
}

export interface ProfitabilityResult {
  readonly salePriceCOP: Decimal;
  readonly grossProfitCOP: Decimal;
  readonly contributionProfitCOP: Decimal;
  readonly realCostCOP: Decimal;
  readonly riskAdjustedNetProfitCOP: Decimal;
  readonly capitalRequiredCOP: Decimal;
  readonly margin?: Decimal | undefined;
  readonly roi?: Decimal | undefined;
}

export interface VelocitySettings {
  readonly badMonthlyRoi: Decimal;
  readonly goodMonthlyRoi: Decimal;
}

export interface ReturnVelocityResult {
  readonly monthlyizedRoi?: Decimal | undefined;
  readonly annualizedRoi?: Decimal | undefined;
  readonly capitalVelocityScore?: number | undefined;
}

export type ScoreMetricKey =
  | "ROI"
  | "PROFIT_COP"
  | "CAPITAL_REQUIRED"
  | "MARKET_LIQUIDITY"
  | "COMPARABLE_COUNT"
  | "CONDITION"
  | "BATTERY_HEALTH"
  | "SELLER_REPUTATION"
  | "WARRANTY"
  | "SELLING_SPEED"
  | "PRICE_VOLATILITY"
  | "CAPITAL_CONCENTRATION";

export interface LinearScoreRange {
  /** Value that maps to zero. Can be greater than `good` for lower-is-better metrics. */
  readonly bad: Decimal;
  /** Value that maps to one hundred. */
  readonly good: Decimal;
  readonly missingScore: Decimal;
}

export interface SellerReputationScoreSettings {
  readonly ratingRange: LinearScoreRange;
  readonly reviewCountRange: LinearScoreRange;
  readonly ratingWeight: Decimal;
  readonly reviewCountWeight: Decimal;
}

export interface OpportunityScoringSettings<Condition extends string = string> {
  readonly weights: Readonly<Record<ScoreMetricKey, Decimal>>;
  readonly ranges: Readonly<
    Record<
      Exclude<ScoreMetricKey, "CONDITION" | "SELLER_REPUTATION">,
      LinearScoreRange
    >
  >;
  readonly conditionScores: Readonly<Record<Condition, Decimal>>;
  readonly missingConditionScore: Decimal;
  readonly sellerReputation: SellerReputationScoreSettings;
}

export interface OpportunityScoreInput<Condition extends string = string> {
  readonly roi?: Decimal | undefined;
  readonly profitCOP?: Decimal | undefined;
  readonly capitalRequiredRate?: Decimal | undefined;
  readonly marketLiquidityIndex?: Decimal | undefined;
  readonly comparableCount?: number | undefined;
  readonly condition?: Condition | undefined;
  readonly batteryHealthRate?: Decimal | undefined;
  readonly sellerRatingRate?: Decimal | undefined;
  readonly sellerReviewCount?: number | undefined;
  readonly warrantyDays?: number | undefined;
  readonly expectedDaysToSell?: number | undefined;
  readonly priceVolatilityRate?: Decimal | undefined;
  readonly capitalConcentrationRate?: Decimal | undefined;
}

export interface OpportunityScoreComponent {
  readonly metric: ScoreMetricKey;
  readonly rawValue?: Decimal | undefined;
  readonly normalizedScore: Decimal;
  readonly weight: Decimal;
  readonly weightedContribution: Decimal;
  readonly usedMissingFallback: boolean;
}

export interface OpportunityScoreResult {
  readonly components: readonly OpportunityScoreComponent[];
  readonly totalWeight: Decimal;
  readonly rawScore: Decimal;
  readonly score: number;
}

export type OpportunitySignal = "STRONG_BUY" | "BUY" | "WATCH" | "REJECT";

export type DecisionMetric =
  | "ROI"
  | "MARGIN"
  | "NET_PROFIT_COP"
  | "SCORE"
  | "CAPITAL_REQUIRED_COP"
  | "EXPECTED_DAYS_TO_SELL"
  | "CAPITAL_CONCENTRATION_RATE";

export type RuleOperator = "GT" | "GTE" | "LT" | "LTE" | "EQ";

export interface RulePredicate {
  readonly metric: DecisionMetric;
  readonly operator: RuleOperator;
  readonly value: Decimal;
}

export interface ClassificationRule {
  readonly id: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly signal: Exclude<OpportunitySignal, "REJECT">;
  readonly all: readonly RulePredicate[];
}

export type ClassificationMetrics = Readonly<
  Partial<Record<DecisionMetric, Decimal>>
>;

export interface PredicateEvaluation {
  readonly predicate: RulePredicate;
  readonly actual?: Decimal | undefined;
  readonly passed: boolean;
}

export interface RuleEvaluation {
  readonly ruleId: string;
  readonly signal: Exclude<OpportunitySignal, "REJECT">;
  readonly passed: boolean;
  readonly predicates: readonly PredicateEvaluation[];
}

export interface ClassificationResult {
  readonly candidateSignal: OpportunitySignal;
  readonly signal: OpportunitySignal;
  readonly matchedRuleId?: string | undefined;
  readonly evaluations: readonly RuleEvaluation[];
  readonly appliedCap?: OpportunitySignal | undefined;
  readonly forcedRejectReason?: string | undefined;
}
