import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { deriveListingEvent, listingIdentity, observationFingerprint } from "./radar";

const iphone = { sourceKey: "manual", externalListingId: "17-pro-max", title: "Apple iPhone 17 Pro Max 256 GB Silver Unlocked", sourceCondition: "Open Box", canonicalConditionId: "OPEN_BOX", price: new Decimal("899"), currency: "USD", availability: "IN_STOCK" as const, observedAt: "2026-10-19T00:00:00Z", attributes: { storage_gb: 256, color: "silver", carrier_lock: "UNLOCKED" } };

describe("Radar listing observations", () => {
  it("keeps listing identity scoped to source, not product identity", () => {
    expect(listingIdentity(iphone)).toBe("manual:external:17-pro-max");
  });
  it("detects changes and suppresses equal effective observations", () => {
    expect(deriveListingEvent(undefined, iphone)).toBe("NEW_LISTING");
    expect(deriveListingEvent({ price: new Decimal("949"), availability: "IN_STOCK" }, iphone)).toBe("PRICE_DROP");
    expect(deriveListingEvent({ price: new Decimal("899"), availability: "IN_STOCK" }, iphone)).toBeUndefined();
    expect(observationFingerprint(iphone)).toBe(observationFingerprint({ ...iphone, attributes: { carrier_lock: "UNLOCKED", color: "silver", storage_gb: 256 } }));
  });
  it("represents a PS5 without phone-only attributes", () => {
    const ps5 = { sourceKey: "csv", externalListingId: "ps5-slim-disc", title: "PlayStation 5 Slim Disc 1 TB Open Box", sourceCondition: "Open Box", canonicalConditionId: "OPEN_BOX", price: new Decimal("420"), currency: "USD", availability: "IN_STOCK" as const, observedAt: "2026-10-19T00:00:00Z", attributes: { edition: "DISC", storage_gb: 1024 } };
    expect(listingIdentity(ps5)).toBe("csv:external:ps5-slim-disc");
    expect(deriveListingEvent(undefined, ps5)).toBe("NEW_LISTING");
  });  it("keeps battery health optional and product-specific", () => {
    const iphone15 = { ...iphone, externalListingId: "15-pro-256", attributes: { storage_gb: 256, battery_health: 91 } };
    const iphone17 = { ...iphone, externalListingId: "17-pro-256", attributes: { storage_gb: 256 } };
    expect(observationFingerprint(iphone15)).not.toBe(observationFingerprint(iphone17));
    expect(() => listingIdentity(iphone17)).not.toThrow();
  });
});