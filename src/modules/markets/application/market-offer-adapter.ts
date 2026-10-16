import type Decimal from "decimal.js";

import type { NamedUsdCost } from "../../finance/contracts";
import { assertNonNegative } from "../../finance/decimal";
import { timestampToMilliseconds } from "../../finance/time";
import type {
  ConditionCode,
  ProductOffer as OpportunityProductOffer,
} from "../../opportunities/domain/contracts";

import type { ProductOffer } from "../domain/product-offer";

/**
 * Adapter between a normalized market offer (`markets.ProductOffer`) and the
 * contract the Opportunity Engine consumes (`opportunities.ProductOffer`).
 *
 * This is the single integration point between both modules, and it is a
 * translation, never an enrichment: every field the engine requires but a
 * marketplace cannot report (catalog variant, supplier, payment fee) arrives
 * from the caller as approved data. When it is missing, the offer is reported
 * as NOT_EVALUABLE instead of being completed with a plausible value.
 *
 * `opportunities` is imported for types only, so the engine keeps no runtime
 * knowledge of market sources. `decimal.js` is the sanctioned money type
 * (ADR-0002); no other external SDK is involved.
 */

/* -------------------------------------------------------------------------- */
/* Condition mapping                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Explicit, conservative market -> engine condition map.
 *
 * The engine matches comparables by exact condition equality and feeds the
 * condition into the score, so an approximate mapping would silently mix
 * grades. `FOR_PARTS` and `UNKNOWN` have no engine equivalent and block the
 * conversion instead of being approximated.
 */
const CONDITION_MAP: Readonly<Record<ProductOffer["condition"], ConditionCode | undefined>> = {
  NEW: "NEW",
  SEALED: "SEALED",
  OPEN_BOX: "OPEN_BOX",
  LIKE_NEW: "PREMIUM",
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  FAIR: "FAIR",
  USED: "USED",
  FOR_PARTS: undefined,
  UNKNOWN: undefined,
};

export type ConditionMapping =
  | { readonly status: "MAPPED"; readonly code: ConditionCode }
  | { readonly status: "BLOCKED"; readonly blocker: "CONDITION_UNKNOWN" | "CONDITION_FOR_PARTS" };

/** Maps a market condition explicitly. Never guesses a grade. */
export function mapConditionToEngine(condition: ProductOffer["condition"]): ConditionMapping {
  const code = CONDITION_MAP[condition];
  if (code !== undefined) {
    return { status: "MAPPED", code };
  }
  return condition === "FOR_PARTS"
    ? { status: "BLOCKED", blocker: "CONDITION_FOR_PARTS" }
    : { status: "BLOCKED", blocker: "CONDITION_UNKNOWN" };
}

/* -------------------------------------------------------------------------- */
/* Catalog and supplier resolution                                            */
/* -------------------------------------------------------------------------- */

/** Catalog identity of a market variant. Supplied by the catalog, never invented. */
export interface CatalogMatch {
  readonly productVariantId: string;
  readonly supplierId: string;
}

/**
 * Resolves the catalog identity of an offer.
 *
 * It receives only the canonical `variantKey`, so an implementation cannot
 * drift into fuzzy matching and silently invent an identity. Returns
 * `undefined` when the variant has no catalog entry.
 */
export type VariantResolver = (variantKey: string) => CatalogMatch | undefined;

export interface CatalogEntry {
  /** `ProductOffer.variantKey`, e.g. `ebay:iphone-15-pro-128`. */
  readonly variantKey: string;
  readonly productVariantId: string;
  readonly supplierId: string;
}

/**
 * Builds a resolver from an approved catalog snapshot.
 * Pure and deterministic: the same snapshot always resolves the same key.
 */
export function buildCatalogResolver(entries: readonly CatalogEntry[]): VariantResolver {
  const index = new Map<string, CatalogMatch>();
  for (const entry of entries) {
    if (index.has(entry.variantKey)) {
      throw new RangeError(`Duplicate catalog entry for variantKey: ${entry.variantKey}`);
    }
    index.set(entry.variantKey, {
      productVariantId: entry.productVariantId,
      supplierId: entry.supplierId,
    });
  }

  return (variantKey) => index.get(variantKey);
}

/* -------------------------------------------------------------------------- */
/* Conversion policy                                                          */
/* -------------------------------------------------------------------------- */

/** Cost codes the engine already adds itself; a configured cost must not reuse them. */
const RESERVED_COST_CODES: readonly string[] = [
  "PURCHASE_PRICE",
  "US_SHIPPING",
  "US_SALES_TAX",
  "PAYMENT_FEE",
];

/**
 * Data the market source cannot know and ReventaIQ must not invent.
 *
 * `paymentFeeUSD` is required by the engine contract and is deliberately not
 * defaulted to zero: a zero fee is a purchase-cost assumption, not an
 * observation. `otherPurchaseCostsUSD` left absent means "unknown", not "none".
 */
export interface MarketOfferConversionPolicy {
  /**
   * Only unlocked devices reach the engine. Enabled unless explicitly disabled,
   * so an omitted field can never quietly allow locked devices through.
   */
  readonly requireUnlockedCarrier?: boolean;
  /** Approved payment fee in USD, from configuration. */
  readonly paymentFeeUSD?: Decimal;
  /** Extra named USD costs approved by configuration. Absent means unknown. */
  readonly otherPurchaseCostsUSD?: readonly NamedUsdCost[];
  /** Expiry reported by a source that has one. Absent means "unknown", not "never". */
  readonly offerExpiresAt?: string;
}

/**
 * Validates the policy once, before converting a batch.
 *
 * An invalid policy is a configuration error, not a per-offer problem, so it
 * fails fast with the offending field instead of producing results.
 */
export function assertValidConversionPolicy(policy: MarketOfferConversionPolicy): void {
  if (policy.paymentFeeUSD !== undefined) {
    assertNonNegative(policy.paymentFeeUSD, "paymentFeeUSD");
  }

  for (const cost of policy.otherPurchaseCostsUSD ?? []) {
    assertNonNegative(cost.amountUSD, `otherPurchaseCost ${cost.code}`);
    if (RESERVED_COST_CODES.includes(cost.code)) {
      throw new RangeError(
        `otherPurchaseCostsUSD must not reuse the engine cost code ${cost.code}`,
      );
    }
  }

  if (policy.offerExpiresAt !== undefined) {
    timestampToMilliseconds(policy.offerExpiresAt, "offerExpiresAt");
  }
}

/* -------------------------------------------------------------------------- */
/* Result                                                                     */
/* -------------------------------------------------------------------------- */

export type ConversionBlocker =
  | "CONDITION_UNKNOWN"
  | "CONDITION_FOR_PARTS"
  | "CARRIER_LOCK_UNKNOWN"
  | "CARRIER_LOCKED"
  | "CATALOG_VARIANT_NOT_FOUND"
  | "PAYMENT_FEE_UNKNOWN"
  | "OBSERVATION_INSTANT_INVALID";

/** Informative trace of a conversion, for audit and UI. */
export type ConversionNoteCode =
  | "CONDITION_APPROXIMATED"
  | "BATTERY_HEALTH_UNKNOWN"
  | "SELLER_RATING_UNKNOWN"
  | "SELLER_REVIEWS_UNKNOWN"
  | "WARRANTY_UNKNOWN"
  | "CARRIER_NOT_REPRESENTED"
  | "SIM_FORMAT_NOT_REPRESENTED"
  | "EXPIRY_UNKNOWN"
  | "OTHER_COSTS_UNKNOWN"
  | "OTHER_COSTS_INCLUDED"
  | "SOURCE_DETAIL_DROPPED";

export interface ConversionNote {
  readonly code: ConversionNoteCode;
  readonly message: string;
}

export type MarketOfferConversion =
  | {
      readonly status: "READY";
      readonly sourceOfferId: string;
      readonly offer: OpportunityProductOffer;
      readonly notes: readonly ConversionNote[];
    }
  | {
      readonly status: "NOT_EVALUABLE";
      readonly sourceOfferId: string;
      readonly blockers: readonly ConversionBlocker[];
      readonly notes: readonly ConversionNote[];
    };

/** Engine fields that carry no market-side attribute; listed in the drop note. */
const DROPPED_SOURCE_DETAILS: readonly string[] = [
  "marketplace",
  "storageGb",
  "variant",
  "variantKey",
  "externalId",
  "imageUrl",
  "seller.name",
  "seller.externalSellerId",
  "seller.countryCode",
  "seller.isVerified",
  "notes",
  "fetchedAt",
];

/**
 * Converts a normalized market offer into the engine contract.
 *
 * Pure: the same offer, policy and catalog snapshot always give the same
 * result. It never reads the clock and never fabricates ids, costs or taxes.
 */
export function toOpportunityOffer(
  offer: ProductOffer,
  policy: MarketOfferConversionPolicy,
  resolveVariant: VariantResolver,
): MarketOfferConversion {
  assertValidConversionPolicy(policy);

  const notes: ConversionNote[] = [];
  const blockers: ConversionBlocker[] = [];

  // 1. Condition: explicit table, no approximation of unusable grades.
  const condition = mapConditionToEngine(offer.condition);
  if (condition.status === "BLOCKED") {
    blockers.push(condition.blocker);
  }

  // 2. Carrier lock: the engine contract has no lock field, so a locked or
  //    unknown device is a different product and must not be evaluated as if
  //    it were unlocked.
  if (policy.requireUnlockedCarrier !== false) {
    const lockState = offer.carrier?.lockState ?? "UNKNOWN";
    if (lockState === "UNKNOWN") {
      blockers.push("CARRIER_LOCK_UNKNOWN");
    } else if (lockState !== "UNLOCKED") {
      blockers.push("CARRIER_LOCKED");
    }
  }

  // 3. Catalog identity: resolved, never invented.
  const catalog = resolveVariant(offer.variantKey);
  if (catalog === undefined) {
    blockers.push("CATALOG_VARIANT_NOT_FOUND");
  }

  // 4. Payment fee: required by the engine, unknown to the marketplace.
  const paymentFeeUSD = policy.paymentFeeUSD;
  if (paymentFeeUSD === undefined) {
    blockers.push("PAYMENT_FEE_UNKNOWN");
  }

  // 5. Instants: an invalid one would crash the engine later.
  if (!isInstant(offer.observedAt)) {
    blockers.push("OBSERVATION_INSTANT_INVALID");
  }
  const expiresAt = policy.offerExpiresAt;

  // Informative notes about data the engine contract cannot carry.
  if (offer.condition === "LIKE_NEW") {
    notes.push({
      code: "CONDITION_APPROXIMATED",
      message: "Market condition LIKE_NEW is offered to the engine as PREMIUM.",
    });
  }
  if (offer.batteryHealthRate === undefined) {
    notes.push({
      code: "BATTERY_HEALTH_UNKNOWN",
      message: "The source did not report battery health; the score will treat it as unknown.",
    });
  }
  if (offer.seller.ratingRate === undefined) {
    notes.push({
      code: "SELLER_RATING_UNKNOWN",
      message: "The source did not report a seller rating; the score will treat it as unknown.",
    });
  }
  if (offer.seller.reviewCount === undefined) {
    notes.push({
      code: "SELLER_REVIEWS_UNKNOWN",
      message: "The source did not report seller review count.",
    });
  }
  if (offer.warrantyDays === undefined) {
    notes.push({
      code: "WARRANTY_UNKNOWN",
      message: "The source did not report a warranty term.",
    });
  }
  if (offer.carrier !== undefined) {
    notes.push({
      code: "CARRIER_NOT_REPRESENTED",
      message: "Carrier identity has no field in the engine offer; only the lock state was checked.",
    });
  }
  if (offer.simFormat !== "UNKNOWN") {
    notes.push({
      code: "SIM_FORMAT_NOT_REPRESENTED",
      message: "SIM format has no field in the engine offer.",
    });
  }
  if (expiresAt === undefined) {
    notes.push({
      code: "EXPIRY_UNKNOWN",
      message: "No expiry reported by the source; the engine will not treat the offer as expiring.",
    });
  }
  const otherCosts = policy.otherPurchaseCostsUSD;
  if (otherCosts === undefined) {
    notes.push({
      code: "OTHER_COSTS_UNKNOWN",
      message: "No configured purchase costs were supplied; unknown costs are treated as none, verify the configuration.",
    });
  } else if (otherCosts.length > 0) {
    notes.push({
      code: "OTHER_COSTS_INCLUDED",
      message: `${otherCosts.length} additional purchase cost(s) were added from configuration.`,
    });
  }
  notes.push({
    code: "SOURCE_DETAIL_DROPPED",
    message: `Not representable in the engine offer: ${DROPPED_SOURCE_DETAILS.join(", ")}.`,
  });

  if (
    blockers.length > 0 ||
    condition.status === "BLOCKED" ||
    catalog === undefined ||
    paymentFeeUSD === undefined
  ) {
    return { status: "NOT_EVALUABLE", sourceOfferId: offer.id, blockers, notes };
  }

  return {
    status: "READY",
    sourceOfferId: offer.id,
    notes,
    offer: {
      id: offer.id,
      productVariantId: catalog.productVariantId,
      supplierId: catalog.supplierId,
      condition: condition.code,
      ...(offer.batteryHealthRate === undefined ? {} : { batteryHealthRate: offer.batteryHealthRate }),
      ...(offer.seller.ratingRate === undefined ? {} : { sellerRatingRate: offer.seller.ratingRate }),
      ...(offer.seller.reviewCount === undefined ? {} : { sellerReviewCount: offer.seller.reviewCount }),
      ...(offer.warrantyDays === undefined ? {} : { supplierWarrantyDays: offer.warrantyDays }),
      purchasePriceUSD: offer.priceUSD,
      usShippingUSD: offer.shippingUSD,
      usSalesTaxUSD: offer.salesTaxUSD,
      paymentFeeUSD,
      otherPurchaseCostsUSD: otherCosts ?? [],
      observedAt: offer.observedAt,
      ...(expiresAt === undefined ? {} : { expiresAt }),
      productUrl: offer.url,
    },
  };
}

function isInstant(value: string): boolean {
  try {
    timestampToMilliseconds(value, "instant");
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Batch conversion                                                           */
/* -------------------------------------------------------------------------- */

/** Summary of a scan, so a caller can report rejections without inspecting offers. */
export interface ConversionSummary {
  readonly ready: number;
  readonly notEvaluable: number;
  readonly blockersByCode: Readonly<Partial<Record<ConversionBlocker, number>>>;
}

export function summarizeConversions(
  conversions: readonly MarketOfferConversion[],
): ConversionSummary {
  const blockersByCode: Partial<Record<ConversionBlocker, number>> = {};
  let ready = 0;
  let notEvaluable = 0;

  for (const conversion of conversions) {
    if (conversion.status === "READY") {
      ready += 1;
      continue;
    }
    notEvaluable += 1;
    for (const blocker of conversion.blockers) {
      blockersByCode[blocker] = (blockersByCode[blocker] ?? 0) + 1;
    }
  }

  return { ready, notEvaluable, blockersByCode };
}

/**
 * Converts a page of offers in one call. Order is preserved.
 * The policy is validated once, before any offer is processed.
 */
export function toOpportunityOffers(
  offers: readonly ProductOffer[],
  policy: MarketOfferConversionPolicy,
  resolveVariant: VariantResolver,
): readonly MarketOfferConversion[] {
  assertValidConversionPolicy(policy);
  return offers.map((offer) => toOpportunityOffer(offer, policy, resolveVariant));
}