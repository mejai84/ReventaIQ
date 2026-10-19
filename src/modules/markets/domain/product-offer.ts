import type Decimal from "decimal.js";

/**
 * Canonical offer model produced by every market connector.
 *
 * Rule of the module: the Opportunity Engine never learns where a price came
 * from. It receives a `ProductOffer` already normalized, regardless of whether
 * it was typed by a human (manual) or read from a marketplace API.
 *
 * Money is always `Decimal` (ADR-0002). Amounts cross JSON boundaries as
 * strings, never as JavaScript numbers.
 *
 * NOTE: this type is intentionally independent from
 * `opportunities/domain/contracts.ProductOffer`. The two modules evolve
 * separately and neither imports the other; the mapping between them belongs
 * to the adapter that feeds the Opportunity Engine.
 */

/** Every marketplace ReventaIQ can read, including non-API sources. */
export const MARKETPLACES = [
  "EBAY",
  "BEST_BUY",
  "WALMART",
  "BACK_MARKET",
  "AMAZON",
  "MANUAL",
] as const;

export type MarketplaceId = (typeof MARKETPLACES)[number];

/** Runtime list, for validation boundaries that cannot take a literal union. */
export const MARKETPLACE_IDS: readonly MarketplaceId[] = MARKETPLACES;

/**
 * Normalized condition vocabulary.
 *
 * `UNKNOWN` is a first-class value: an unrecognized condition is never guessed
 * and never silently mapped to `GOOD` (unknown is not zero).
 */
export const OFFER_CONDITIONS = [
  "NEW",
  "SEALED",
  "OPEN_BOX",
  "LIKE_NEW",
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "USED",
  "FOR_PARTS",
  "UNKNOWN",
] as const;

export type OfferCondition = (typeof OFFER_CONDITIONS)[number];

/** Storage capacities in GB that ReventaIQ models as canonical variants. */
export const STORAGE_CAPACITIES_GB = [32, 64, 128, 256, 512, 1024] as const;

export type StorageGb = (typeof STORAGE_CAPACITIES_GB)[number];

/** Lock status of the handset. Resale value depends on it, so it is explicit. */
export const CARRIER_LOCK_STATES = [
  "UNLOCKED",
  "CARRIER_LOCKED",
  "FINANCE_LOCKED",
  "PARTIALLY_LOCKED",
  "UNKNOWN",
] as const;

export type CarrierLockState = (typeof CARRIER_LOCK_STATES)[number];

export const SIM_FORMATS = ["PHYSICAL", "ESIM", "HYBRID", "UNKNOWN"] as const;

export type SimFormat = (typeof SIM_FORMATS)[number];

/** Coarse carrier attribution. Free text is preserved for traceability. */
export interface CarrierProfile {
  readonly name: string;
  readonly lockState: CarrierLockState;
}

/**
 * Normalized seller/operator identity.
 *
 * Every marketplace calls this something else ("seller", "merchant", "vendor",
 * "store"). Connectors map their own vocabulary into this shape.
 */
export interface SellerProfile {
  /** Display name exactly as reported by the marketplace. */
  readonly name: string;
  /** Marketplace-scoped stable identifier, when the source exposes one. */
  readonly externalSellerId?: string;
  /** Fraction in [0, 1] of positive ratings. Never a percentage. */
  readonly ratingRate?: Decimal;
  readonly reviewCount?: number;
  /** Whether the marketplace marks the seller as a verified business. */
  readonly isVerified?: boolean;
  /** ISO 3166-1 alpha-2 country of the seller, when disclosed. */
  readonly countryCode?: string;
}

/**
 * A single normalized purchase candidate observed in a US marketplace.
 *
 * Optional means "the source did not report it". Absent data must stay absent;
 * it must not be defaulted to zero or to an optimistic value.
 */
export interface ProductOffer {
  /** Stable identity of this observation: `${marketplace}:${externalId}`. */
  readonly id: string;
  readonly marketplace: MarketplaceId;
  /** Identifier assigned by the marketplace. Absent only for manual entries. */
  readonly externalId?: string;
  readonly seller: SellerProfile;
  /** Commercial model, e.g. `iPhone 15 Pro`. */
  readonly model: string;
  /** Marketplace-specific variant label, preserved verbatim for traceability. */
  readonly variant: string;
  /** Canonical variant key used to group comparable offers. */
  readonly variantKey: string;
  /** Optional category attribute; e.g. 1 TB for a PS5, absent when irrelevant. */
  readonly storageGb?: StorageGb;
  /** Category-specific observed attributes. No phone attribute is universal. */
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  readonly condition: OfferCondition;
  /** Fraction in [0, 1] of remaining battery capacity, when reported. */
  readonly batteryHealthRate?: Decimal;
  readonly carrier?: CarrierProfile;
  /** Present only when SIM technology applies to this category. */
  readonly simFormat?: SimFormat;
  /** Listed item price in USD, excluding shipping and tax. */
  readonly priceUSD: Decimal;
  /** Shipping charged by the marketplace, in USD. */
  readonly shippingUSD: Decimal;
  /** Sales tax charged by the marketplace, in USD. */
  readonly salesTaxUSD: Decimal;
  readonly url: string;
  readonly imageUrl?: string;
  readonly warrantyDays?: number;
  /** When the marketplace published or last confirmed the offer (ISO 8601). */
  readonly observedAt: string;
  /** When ReventaIQ retrieved the offer (ISO 8601). Never a clock read here. */
  readonly fetchedAt?: string;
  /** Free-text note kept for manual entries and marketplace annotations. */
  readonly notes?: string;
}

/**
 * Total cash outflow implied by the offer, in USD, as an exact sum.
 *
 * No rounding happens here: rounding is a finance concern and belongs to the
 * module that applies the policy (`finance`), not to the market source.
 */
export function offerCashOutflowUsd(offer: ProductOffer): Decimal {
  return offer.priceUSD.plus(offer.shippingUSD).plus(offer.salesTaxUSD);
}

/**
 * True when the offer carries an attribute ReventaIQ must not guess.
 * These offers can be stored and displayed, but never auto-bought.
 */
export function isOfferIncomplete(offer: ProductOffer): boolean {
  return offerGaps(offer).length > 0;
}

/** Reason codes for an incomplete offer, useful for audit trails and UI. */
export type OfferGapCode = "CONDITION_UNKNOWN";

export function offerGaps(offer: ProductOffer): readonly OfferGapCode[] {
  return offer.condition === "UNKNOWN" ? ["CONDITION_UNKNOWN"] : [];
}
