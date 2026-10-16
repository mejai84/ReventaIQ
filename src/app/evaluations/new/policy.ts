import Decimal from "decimal.js";
import { z } from "zod";

import type { ClassificationRule, OpportunityScoringSettings } from "@/modules/finance/contracts";
import type { SaleChannel } from "@/modules/opportunities/domain";

const decimalText = z.string().regex(/^-?\d+(?:\.\d{1,8})?$/).transform((value) => new Decimal(value));
const nonNegative = decimalText.refine((value) => value.greaterThanOrEqualTo(0));
const rate = nonNegative.refine((value) => value.lessThanOrEqualTo(1));
const positiveInteger = z.number().int().positive();
const signal = z.enum(["STRONG_BUY", "BUY", "WATCH", "REJECT"]);
const channel = z.enum(["FACEBOOK_MARKETPLACE", "MERCADO_LIBRE", "DIRECT_SALE"]);
const condition = z.enum(["NEW", "SEALED", "OPEN_BOX", "PREMIUM", "EXCELLENT", "GOOD", "FAIR", "USED"]);
const metric = z.enum(["ROI", "MARGIN", "NET_PROFIT_COP", "SCORE", "CAPITAL_REQUIRED_COP", "EXPECTED_DAYS_TO_SELL", "CAPITAL_CONCENTRATION_RATE"]);
const scoreMetric = z.enum(["ROI", "PROFIT_COP", "CAPITAL_REQUIRED", "MARKET_LIQUIDITY", "COMPARABLE_COUNT", "CONDITION", "BATTERY_HEALTH", "SELLER_REPUTATION", "WARRANTY", "SELLING_SPEED", "PRICE_VOLATILITY", "CAPITAL_CONCENTRATION"]);
const rangedScoreMetric = z.enum(["ROI", "PROFIT_COP", "CAPITAL_REQUIRED", "MARKET_LIQUIDITY", "COMPARABLE_COUNT", "BATTERY_HEALTH", "WARRANTY", "SELLING_SPEED", "PRICE_VOLATILITY", "CAPITAL_CONCENTRATION"]);
const scoreRange = z.object({ bad: decimalText, good: decimalText, missingScore: nonNegative.refine((value) => value.lessThanOrEqualTo(100)) });

const scoreConfigSchema = z.object({
  exchange: z.object({ fixedConversionFeeCop: nonNegative }),
  finance: z.object({ annualizationMethod: z.enum(["SIMPLE", "COMPOUNDED"]) }),
  market: z.object({ minComparablesForRecommendation: positiveInteger, maxListingAgeDays: z.number().int().nonnegative() }),
  velocity: z.object({ badMonthlyRoi: decimalText, goodMonthlyRoi: decimalText }),
  marketSignals: z.record(channel, z.object({ liquidityIndex: rate, priceVolatilityRate: rate, expectedDaysToSell: positiveInteger.optional() })),
  scoring: z.object({
    weights: z.record(scoreMetric, nonNegative),
    ranges: z.record(rangedScoreMetric, scoreRange),
    conditionScores: z.record(condition, nonNegative.refine((value) => value.lessThanOrEqualTo(100))),
    missingConditionScore: nonNegative.refine((value) => value.lessThanOrEqualTo(100)),
    sellerReputation: z.object({ ratingRange: scoreRange, reviewCountRange: scoreRange, ratingWeight: nonNegative, reviewCountWeight: nonNegative }),
  }),
  recommendation: z.object({ lowConfidenceSignalCap: signal.optional(), rejectWhenUnaffordable: z.boolean(), rejectWhenConcentrationExceeded: z.boolean() }),
});

const rulesSchema = z.object({ rules: z.array(z.object({ id: z.string().min(1).max(120), enabled: z.boolean(), priority: z.number().finite(), signal: z.enum(["STRONG_BUY", "BUY", "WATCH"]), all: z.array(z.object({ metric, operator: z.enum(["GT", "GTE", "LT", "LTE", "EQ"]), value: decimalText })).min(1) })) });

export type EvaluationPolicy = z.output<typeof scoreConfigSchema> & { readonly classificationRules: readonly ClassificationRule[] };

export function parseEvaluationPolicy(scoreConfig: unknown, signalRules: unknown): EvaluationPolicy {
  const config = scoreConfigSchema.parse(scoreConfig);
  const rules = rulesSchema.parse(signalRules);
  return { ...config, classificationRules: rules.rules };
}

export function isSaleChannel(value: string): value is SaleChannel {
  return channel.safeParse(value).success;
}

export function isCondition(value: string): value is z.infer<typeof condition> {
  return condition.safeParse(value).success;
}
