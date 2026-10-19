import { DECIMAL_HUNDRED, decimal } from "../../finance/decimal";
import {
  buildVariantKey,
  normalizeCarrierLockState,
  normalizeCondition,
  normalizeSeller,
  normalizeSimFormat,
  normalizeStorageGb,
} from "../domain/normalization";
import {
  type ConnectorCapabilities,
  type ConnectorEnv,
  type ConnectorPage,
  type ConnectorQuery,
  type ConnectorSettings,
  type MarketConnector,
  OfferNormalizationError,
  applyQueryFilters,
  buildConnectorPage,
  describeConnectorSettings,
} from "../domain/market-connector";
import type { ProductOffer } from "../domain/product-offer";
import { productOfferSchema, type ProductOfferInput } from "../validation/product-offer-schema";

/**
 * ManualConnector â€” the MVP market source.
 *
 * A human types what they see on a marketplace page and ReventaIQ normalizes
 * it exactly like a future API connector would (overview: "La entrada manual
 * implementa los mismos contratos que usarán los conectores futuros").
 *
 * Everything arrives as text, so the same vocabulary normalizers used by the
 * API connectors apply here. Invalid input is rejected loudly; nothing is
 * silently defaulted.
 */

export interface ManualOfferRegistration {
  /** Local reference chosen by the person registering the offer. Required. */
  readonly referenceId: string;
  /** Marketplace where the offer was seen, e.g. `EBAY`. Defaults to `MANUAL`. */
  readonly marketplace?: ProductOffer["marketplace"];
  /** Marketplace listing id when the operator copies it. */
  readonly externalId?: string;
  readonly title: string;
  readonly model?: string;
  readonly storage?: string;
  readonly conditionText: string;
  readonly simText?: string;
  readonly carrierName?: string;
  readonly carrierLockText?: string;
  readonly batteryHealthPercent?: string;
  readonly sellerName: string;
  readonly sellerRatingPercent?: string;
  readonly sellerReviewCount?: number;
  readonly url: string;
  readonly imageUrl?: string;
  readonly priceUSD: string;
  /**
   * Shipping charged by the marketplace. Required: the operator must type the
   * real figure, including `0`. Leaving it empty would silently treat an
   * unknown cost as a free shipment.
   */
  readonly shippingUSD: string;
  /** Sales tax charged by the marketplace. Required, including `0`. */
  readonly salesTaxUSD: string;
  readonly warrantyDays?: number;
  /** ISO 8601 instant the operator saw the offer. */
  readonly observedAt: string;
  /** ISO 8601 instant the operator typed it into ReventaIQ. */
  readonly registeredAt: string;
  readonly notes?: string;
}

const MANUAL_CAPABILITIES: ConnectorCapabilities = {
  searchByKeyword: true,
  searchByProductId: false,
  openBoxInventory: false,
  pushNotifications: false,
  humanOperated: true,
};

export class ManualConnector implements MarketConnector {
  readonly key = "manual" as const;
  readonly marketplace = "MANUAL" as const;
  readonly displayName = "Manual entry";
  readonly capabilities = MANUAL_CAPABILITIES;

  private offers: ReadonlyMap<string, ProductOffer>;

  constructor(seed: readonly ManualOfferRegistration[] = []) {
    this.offers = new Map(seed.map((registration) => {
      const offer = buildManualOffer(registration);
      return [offer.id, offer] as const;
    }));
  }

  /** The manual source needs no credentials, so it is always configured. */
  describeSettings(_env: ConnectorEnv): ConnectorSettings {
    return describeConnectorSettings("manual", {});
  }

  /**
   * Validates and normalizes a manual registration, then stores it.
   * Throws on invalid input: a wrong price or an unparsable date must never
   * reach the Opportunity Engine.
   */
  register(registration: ManualOfferRegistration): ProductOffer {
    const offer = buildManualOffer(registration);
    const next = new Map(this.offers);
    next.set(offer.id, offer);
    this.offers = next;
    return offer;
  }

  listAll(): readonly ProductOffer[] {
    return [...this.offers.values()];
  }

  async search(query: ConnectorQuery, _env: ConnectorEnv): Promise<ConnectorPage> {
    return buildConnectorPage(applyQueryFilters(this.listAll(), query), query);
  }

  async fetchOffer(externalOfferId: string, _env: ConnectorEnv): Promise<ProductOffer | undefined> {
    return this.offers.get(externalOfferId);
  }
}

/**
 * Normalizes one manual registration into a `ProductOffer`.
 * Exported so tests and the future CSV import reuse the exact same path.
 */
export function buildManualOffer(registration: ManualOfferRegistration): ProductOffer {

  const storageGb = normalizeStorageGb(registration.storage ?? registration.title);


  const marketplace = registration.marketplace ?? "MANUAL";
  const warrantyDays = registration.warrantyDays;
  if (warrantyDays !== undefined && (!Number.isInteger(warrantyDays) || warrantyDays < 0)) {
    throw new RangeError(
      `Manual offer ${registration.referenceId}: warrantyDays must be a non-negative integer`,
    );
  }

  const seller = normalizeSeller({
    name: registration.sellerName,
    ...(registration.sellerRatingPercent === undefined ? {} : { ratingPercent: registration.sellerRatingPercent }),
    ...(registration.sellerReviewCount === undefined ? {} : { reviewCount: registration.sellerReviewCount }),
  });

  const model = registration.model ?? registration.title;
  const priceUSD = decimal(registration.priceUSD);
  const shippingUSD = decimal(registration.shippingUSD);
  const salesTaxUSD = decimal(registration.salesTaxUSD);
  const condition = normalizeCondition(registration.conditionText);
  // A lock statement is not SIM format information; the two are never mixed.
  const simFormat = normalizeSimFormat(registration.simText);
  const batteryHealthRate =
    registration.batteryHealthPercent === undefined
      ? undefined
      : decimal(registration.batteryHealthPercent).dividedBy(DECIMAL_HUNDRED);
  const carrier =
    registration.carrierName === undefined
      ? undefined
      : {
          name: registration.carrierName,
          lockState: normalizeCarrierLockState(registration.carrierLockText),
        };

  const offer: ProductOffer = {
    id: buildOfferId(marketplace, registration.referenceId),
    marketplace,
    ...(registration.externalId === undefined ? {} : { externalId: registration.externalId }),
    seller,
    model,
    variant: registration.title,
    variantKey: buildVariantKey({ marketplace, model, ...(storageGb === undefined ? {} : { storageGb }) }),
    ...(storageGb === undefined ? {} : { storageGb }),
    attributes: {
      ...(storageGb === undefined ? {} : { storage_gb: storageGb }),
      ...(batteryHealthRate === undefined ? {} : { battery_health_percent: batteryHealthRate.times(DECIMAL_HUNDRED).toNumber() }),
    },
    condition,
    ...(batteryHealthRate === undefined ? {} : { batteryHealthRate }),
    ...(carrier === undefined ? {} : { carrier }),
    ...(registration.simText === undefined ? {} : { simFormat }),
    priceUSD,
    shippingUSD,
    salesTaxUSD,
    url: registration.url,
    ...(registration.imageUrl === undefined ? {} : { imageUrl: registration.imageUrl }),
    ...(warrantyDays === undefined ? {} : { warrantyDays }),
    observedAt: registration.observedAt,
    fetchedAt: registration.registeredAt,
    ...(registration.notes === undefined ? {} : { notes: registration.notes }),
  };

  // Boundary validation: nothing downstream sees an offer that failed the schema.
  const validated = productOfferSchema.safeParse(toWireOffer(offer));
  if (!validated.success) {
    throw new OfferNormalizationError(offer.marketplace, validated.error);
  }

  return offer;
}

/** Canonical offer id: `<marketplace>:<reference>`. */
export function buildOfferId(marketplace: ProductOffer["marketplace"], reference: string): string {
  if (reference.trim().length === 0) {
    throw new TypeError("offer reference is required");
  }
  return `${marketplace.toLowerCase()}:${reference.trim()}`;
}

/**
 * Serializes an offer to its validated wire shape.
 * Money and rates become strings (ADR-0002); used for JSONB snapshots and tests.
 */
export function toWireOffer(offer: ProductOffer): ProductOfferInput {
  return {
    id: offer.id,
    marketplace: offer.marketplace,
    ...(offer.externalId === undefined ? {} : { externalId: offer.externalId }),
    seller: {
      name: offer.seller.name,
      ...(offer.seller.externalSellerId === undefined ? {} : { externalSellerId: offer.seller.externalSellerId }),
      ...(offer.seller.ratingRate === undefined ? {} : { ratingRate: offer.seller.ratingRate.toFixed() }),
      ...(offer.seller.reviewCount === undefined ? {} : { reviewCount: offer.seller.reviewCount }),
      ...(offer.seller.isVerified === undefined ? {} : { isVerified: offer.seller.isVerified }),
      ...(offer.seller.countryCode === undefined ? {} : { countryCode: offer.seller.countryCode }),
    },
    model: offer.model,
    variant: offer.variant,
    variantKey: offer.variantKey,
    ...(offer.storageGb === undefined ? {} : { storageGb: offer.storageGb }),
    attributes: offer.attributes,
    condition: offer.condition,
    ...(offer.batteryHealthRate === undefined ? {} : { batteryHealthRate: offer.batteryHealthRate.toFixed() }),
    ...(offer.carrier === undefined
      ? {}
      : { carrier: { name: offer.carrier.name, lockState: offer.carrier.lockState } }),
    ...(offer.simFormat === undefined ? {} : { simFormat: offer.simFormat }),
    priceUSD: offer.priceUSD.toFixed(),
    shippingUSD: offer.shippingUSD.toFixed(),
    salesTaxUSD: offer.salesTaxUSD.toFixed(),
    url: offer.url,
    ...(offer.imageUrl === undefined ? {} : { imageUrl: offer.imageUrl }),
    ...(offer.warrantyDays === undefined ? {} : { warrantyDays: offer.warrantyDays }),
    observedAt: offer.observedAt,
    ...(offer.fetchedAt === undefined ? {} : { fetchedAt: offer.fetchedAt }),
    ...(offer.notes === undefined ? {} : { notes: offer.notes }),
  };
}

export type { ProductOffer };
