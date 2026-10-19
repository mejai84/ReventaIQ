import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildCatalogResolver } from "../../markets/application";
import type { Listing, ListingObservation } from "../domain";
import { ingestCsvRows, ingestManualOffer } from "./ingest-market-offer";
import type { RadarStore } from "./import-candidate";

function store(): RadarStore & { observations: ListingObservation[] } {
  const listings = new Map<string, Listing>();
  const observations: ListingObservation[] = [];
  return { observations, findListing: (id) => listings.get(id), latestObservation: (id) => observations.filter((item) => item.listingId === id).at(-1), saveListing: (item) => listings.set(item.id, item), saveObservation: (item) => observations.push(item) };
}

const ps5 = { referenceId: "ps5-1", title: "PlayStation 5 Slim Disc", model: "PlayStation 5 Slim", conditionText: "Open Box", sellerName: "Tienda", url: "https://example.com/ps5-1", priceUSD: "420", shippingUSD: "0", salesTaxUSD: "0", observedAt: "2026-10-19T00:00:00Z", registeredAt: "2026-10-19T00:00:00Z" };
const policy = { paymentFeeUSD: new Decimal("0") };
const resolver = buildCatalogResolver([{ variantKey: "playstation-5-slim", productVariantId: "ps5-variant", supplierId: "manual-supplier" }]);

describe("Radar manual and CSV ingestion", () => {
  it("imports a PS5 without phone-only fields and remains idempotent", () => {
    const memory = store();
    const first = ingestManualOffer(memory, ps5, policy, resolver);
    const second = ingestManualOffer(memory, ps5, policy, resolver);
    expect(first.conversion.status).toBe("READY");
    expect(second.importResult.observation).toBeUndefined();
    expect(memory.observations).toHaveLength(1);
  });

  it("bounds CSV rows before importing them", () => {
    const memory = store();
    expect(ingestCsvRows(memory, [ps5], policy, resolver)).toHaveLength(1);
    expect(() => ingestCsvRows(memory, Array.from({ length: 1001 }, () => ps5), policy, resolver)).toThrow(RangeError);
  });
});