import type { Listing, ListingCandidate, ListingObservation } from "../domain";
import { deriveListingEvent, listingIdentity, observationFingerprint } from "../domain";

export interface RadarStore {
  findListing(identity: string): Listing | undefined;
  latestObservation(listingId: string): ListingObservation | undefined;
  saveListing(listing: Listing): void;
  saveObservation(observation: ListingObservation): void;
}

/** Idempotent in-memory/application flow. A Prisma adapter belongs after an approved migration. */
export function importRadarCandidate(store: RadarStore, candidate: ListingCandidate): { readonly listing: Listing; readonly observation?: ListingObservation } {
  const identity = listingIdentity(candidate);
  const existing = store.findListing(identity);
  const listing: Listing = existing ?? { id: identity, sourceKey: candidate.sourceKey, ...(candidate.externalListingId === undefined ? {} : { externalListingId: candidate.externalListingId }), ...(candidate.canonicalUrl === undefined ? {} : { canonicalUrl: candidate.canonicalUrl }), ...(candidate.sellerExternalId === undefined ? {} : { sellerExternalId: candidate.sellerExternalId }), ...(candidate.productVariantId === undefined ? {} : { productVariantId: candidate.productVariantId }), status: candidate.availability, createdAt: candidate.observedAt, lastSeenAt: candidate.observedAt };
  const latest = store.latestObservation(listing.id);
  const fingerprint = observationFingerprint(candidate);
  if (latest?.contentFingerprint === fingerprint) return { listing };
  const event = deriveListingEvent(latest, candidate);
  const observation: ListingObservation = { ...candidate, listingId: listing.id, contentFingerprint: fingerprint, ...(event === undefined ? {} : { event }) };
  const updated = { ...listing, status: candidate.availability, lastSeenAt: candidate.observedAt };
  store.saveListing(updated); store.saveObservation(observation);
  return { listing: updated, observation };
}
