import type Decimal from "decimal.js";

import type {
  ClassificationResult,
  ClassificationRule,
  ExchangeCostBreakdown,
  ExchangeRate,
  FinancingCostBreakdown,
  FinancingSettings,
  MarketPriceResult,
  MarketPricingSettings,
  NamedUsdCost,
  OpportunityScoreResult,
  OpportunityScoringSettings,
  OpportunitySignal,
  ProfitabilityResult,
  ReturnVelocityResult,
  SalesChannelCostConfig,
  SellingCostBreakdown,
  ShippingQuote,
  ShippingSelection,
  VelocitySettings,
  WarrantyReserveBreakdown,
  WarrantySettings,
} from "../../finance/contracts";

export type ConditionCode =
  | "NEW"
  | "SEALED"
  | "OPEN_BOX"
  | "PREMIUM"
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "USED";

export type SaleChannel =
  | "FACEBOOK_MARKETPLACE"
  | "MERCADO_LIBRE"
  | "DIRECT_SALE";

export interface ProductOffer {
  readonly id: string;
  readonly productVariantId: string;
  readonly supplierId: string;
  readonly condition: ConditionCode;
  readonly batteryHealthRate?: Decimal;
  readonly sellerRatingRate?: Decimal;
  readonly sellerReviewCount?: number;
  readonly supplierWarrantyDays?: number;
  readonly purchasePriceUSD: Decimal;
  readonly usShippingUSD: Decimal;
  readonly usSalesTaxUSD: Decimal;
  readonly paymentFeeUSD: Decimal;
  readonly otherPurchaseCostsUSD: readonly NamedUsdCost[];
  readonly observedAt: string;
  readonly expiresAt?: string;
  readonly productUrl: string;
}

export interface MarketListing {
  readonly id: string;
  readonly externalListingId?: string;
  readonly sourceId: string;
  readonly productVariantId: string;
  readonly condition: ConditionCode;
  readonly channel: SaleChannel;
  readonly sellerGrossPriceCOP: Decimal;
  readonly observedAt: string;
  readonly active: boolean;
}

export interface MarketData {
  readonly listings: readonly MarketListing[];
  readonly expectedDaysToSell: Readonly<
    Partial<Record<SaleChannel, number>>
  >;
  readonly liquidityIndex: Readonly<
    Partial<Record<SaleChannel, Decimal>>
  >;
  readonly priceVolatilityRate: Readonly<
    Partial<Record<SaleChannel, Decimal>>
  >;
}

export interface CapitalContext {
  readonly availableCapitalCOP: Decimal;
  readonly totalWorkingCapitalCOP: Decimal;
  readonly currentExposureForConcentrationKeyCOP: Decimal;
  readonly concentrationKey: string;
}

export interface RecommendationPolicy {
  readonly lowConfidenceSignalCap?: OpportunitySignal;
  readonly rejectWhenUnaffordable: boolean;
  readonly rejectWhenConcentrationExceeded: boolean;
}

export interface BusinessSettings {
  readonly id: string;
  readonly version: number;
  readonly finance: FinancingSettings;
  readonly warranty: WarrantySettings;
  readonly marketPricing: MarketPricingSettings;
  readonly salesChannels: readonly SalesChannelCostConfig<SaleChannel>[];
  readonly velocity: VelocitySettings;
  readonly scoring: OpportunityScoringSettings<ConditionCode>;
  readonly classificationRules: readonly ClassificationRule[];
  readonly maxCapitalPerProductRate: Decimal;
  readonly recommendationPolicy: RecommendationPolicy;
}

export interface OpportunityEngineInput {
  readonly offer: ProductOffer;
  readonly marketData: MarketData;
  readonly shippingQuotes: readonly ShippingQuote[];
  readonly exchangeRate: ExchangeRate;
  readonly settings: BusinessSettings;
  readonly capital: CapitalContext;
  /** Explicit evaluation time keeps the engine deterministic and clock-free. */
  readonly evaluatedAt: string;
}

export interface AnalysisIssue {
  readonly code:
    | "OFFER_EXPIRED"
    | "OFFER_FROM_FUTURE"
    | "EXCHANGE_RATE_EXPIRED"
    | "EXCHANGE_RATE_FROM_FUTURE"
    | "NO_ELIGIBLE_SHIPPING_QUOTE"
    | "NO_MARKET_COMPARABLES"
    | "LOW_MARKET_CONFIDENCE"
    | "MISSING_EXPECTED_DAYS"
    | "INVALID_CAPITAL_CONTEXT"
    | "INSUFFICIENT_CAPITAL"
    | "CAPITAL_CONCENTRATION_EXCEEDED";
  readonly severity: "ERROR" | "WARNING";
  readonly message: string;
  readonly channel?: SaleChannel;
}

export interface OpportunityScenario {
  readonly channel: SaleChannel;
  readonly marketPrice: Exclude<MarketPriceResult, { status: "NO_COMPARABLES" }>;
  readonly sellingCosts: SellingCostBreakdown;
  readonly warrantyReserve: WarrantyReserveBreakdown;
  readonly financing: FinancingCostBreakdown;
  readonly profitability: ProfitabilityResult;
  readonly returnVelocity: ReturnVelocityResult;
  readonly capitalConsumptionRate: Decimal;
  readonly capitalConcentrationRate: Decimal;
  readonly score: OpportunityScoreResult;
  readonly classification: ClassificationResult;
  readonly issues: readonly AnalysisIssue[];
}

export interface OpportunityAudit {
  readonly offerId: string;
  readonly exchangeRateId: string;
  readonly shippingQuoteIds: readonly string[];
  readonly marketListingIds: readonly string[];
  readonly settingsId: string;
  readonly settingsVersion: number;
  readonly evaluatedAt: string;
}

export interface OpportunityAnalysis {
  readonly status: "COMPLETE" | "INCOMPLETE";
  readonly engineVersion: string;
  readonly acquisition?: ExchangeCostBreakdown;
  readonly shipping?: ShippingSelection;
  readonly scenarios: readonly OpportunityScenario[];
  readonly selectedScenario?: OpportunityScenario;
  readonly issues: readonly AnalysisIssue[];
  readonly audit: OpportunityAudit;
}
