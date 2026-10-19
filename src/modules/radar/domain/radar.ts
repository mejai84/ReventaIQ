import { createHash } from "node:crypto";
import Decimal from "decimal.js";

export const RADAR_SOURCE_MODES = ["API", "WEB_PUBLIC", "FEED", "MANUAL", "CSV"] as const;
export type RadarSourceMode = (typeof RADAR_SOURCE_MODES)[number];
export const LISTING_EVENTS = ["NEW_LISTING", "PRICE_DROP", "PRICE_INCREASE", "OUT_OF_STOCK", "BACK_IN_STOCK", "LISTING_REMOVED"] as const;
export type ListingEvent = (typeof LISTING_EVENTS)[number];
export type Availability = "IN_STOCK" | "OUT_OF_STOCK" | "REMOVED" | "UNKNOWN";

export interface ScanProfile {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly categoryId: string;
  readonly brandId?: string;
  readonly frequencyMinutes: number;
  readonly minNetProfitCOP: Decimal;
  readonly minRoiRate: Decimal;
  readonly maxPurchasePriceUSD?: Decimal;
  readonly minimumConfidence: Decimal;
  readonly sourceKeys: readonly string[];
}

export interface ScanProfileTarget {
  readonly scanProfileId: string;
  readonly categoryId: string;
  readonly productId?: string;
  readonly productVariantId?: string;
}

export const SCAN_RUN_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "FAILED"] as const;
export type ScanRunStatus = (typeof SCAN_RUN_STATUSES)[number];

export interface ScanRun {
  readonly id: string;
  readonly scanProfileId: string;
  readonly mode: "MANUAL" | "CSV";
  readonly idempotencyKey: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: ScanRunStatus;
}

export interface ScanSourceRun {
  readonly id: string;
  readonly scanRunId: string;
  readonly sourceKey: string;
  readonly status: ScanRunStatus;
  readonly candidateCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
}

export function scanRunIdentity(input: Pick<ScanRun, "scanProfileId" | "mode" | "idempotencyKey">): string {
  if (input.idempotencyKey.trim().length === 0) throw new TypeError("idempotencyKey is required");
  return `${input.scanProfileId}:${input.mode}:${input.idempotencyKey.trim()}`;
}
export interface ListingCandidate {
  readonly sourceKey: string;
  readonly externalListingId?: string;
  readonly canonicalUrl?: string;
  readonly sellerExternalId?: string;
  readonly productVariantId?: string;
  readonly title: string;
  readonly sourceCondition?: string;
  readonly canonicalConditionId?: string;
  readonly price?: Decimal;
  readonly currency?: string;
  readonly availability: Availability;
  readonly observedAt: string;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  readonly rawPayload?: Readonly<Record<string, unknown>>;
}

export interface Listing {
  readonly id: string;
  readonly sourceKey: string;
  readonly externalListingId?: string;
  readonly canonicalUrl?: string;
  readonly sellerExternalId?: string;
  readonly productVariantId?: string;
  readonly status: Availability;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

export interface ListingObservation extends ListingCandidate {
  readonly listingId: string;
  readonly contentFingerprint: string;
  readonly event?: ListingEvent;
}

export function listingIdentity(input: Pick<ListingCandidate, "sourceKey" | "externalListingId" | "canonicalUrl">): string {
  if (input.externalListingId?.trim()) return `${input.sourceKey}:external:${input.externalListingId.trim()}`;
  if (input.canonicalUrl?.trim()) return `${input.sourceKey}:url:${input.canonicalUrl.trim()}`;
  throw new TypeError("A listing needs an externalListingId or canonicalUrl");
}

export function observationFingerprint(input: ListingCandidate): string {
  const value = JSON.stringify({ price: input.price?.toFixed(), currency: input.currency, availability: input.availability, sourceCondition: input.sourceCondition, canonicalConditionId: input.canonicalConditionId, title: input.title, attributes: Object.entries(input.attributes).sort(([a], [b]) => a.localeCompare(b)) });
  return createHash("sha256").update(value).digest("hex");
}

export function deriveListingEvent(previous: Pick<ListingObservation, "price" | "availability"> | undefined, next: Pick<ListingCandidate, "price" | "availability">): ListingEvent | undefined {
  if (previous === undefined) return "NEW_LISTING";
  if (previous.availability !== "OUT_OF_STOCK" && next.availability === "OUT_OF_STOCK") return "OUT_OF_STOCK";
  if (previous.availability === "OUT_OF_STOCK" && next.availability === "IN_STOCK") return "BACK_IN_STOCK";
  if (next.availability === "REMOVED" && previous.availability !== "REMOVED") return "LISTING_REMOVED";
  if (previous.price !== undefined && next.price !== undefined) {
    if (next.price.lessThan(previous.price)) return "PRICE_DROP";
    if (next.price.greaterThan(previous.price)) return "PRICE_INCREASE";
  }
  return undefined;
}
