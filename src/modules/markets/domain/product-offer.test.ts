import { describe, expect, it } from "vitest";

import { isOfferIncomplete, offerCashOutflowUsd, offerGaps } from "./product-offer";
import { buildManualOffer } from "../connectors/manual-connector";
import { productOfferSchema, parseProductOffer } from "../validation/product-offer-schema";
import { toWireOffer } from "../connectors/manual-connector";

const OFFER = buildManualOffer({
  referenceId: "V1",
  title: "iPhone 15 Pro 128GB",
  model: "iPhone 15 Pro",
  storage: "128GB",
  conditionText: "Excellent",
  simText: "Physical SIM",
  carrierName: "Unlocked",
  carrierLockText: "Unlocked",
  sellerName: "seller",
  url: "https://example.com/v1",
  priceUSD: "410.00",
  shippingUSD: "10.00",
  salesTaxUSD: "0.00",
  observedAt: "2026-01-15T14:30:00.000Z",
  registeredAt: "2026-01-15T15:00:00.000Z",
});

describe("ProductOffer", () => {
  it("sums price, shipping and tax exactly, without rounding", () => {
    expect(offerCashOutflowUsd(OFFER).toFixed()).toBe("420");
  });

  it("keeps the exact sum when the amounts have more decimals than cents", () => {
    const offer = buildManualOffer({
      referenceId: "V2",
      title: "iPhone 15 Pro 128GB",
      model: "iPhone 15 Pro",
      storage: "128GB",
      conditionText: "Excellent",
      simText: "Physical SIM",
      carrierName: "Unlocked",
      carrierLockText: "Unlocked",
      sellerName: "seller",
      url: "https://example.com/v2",
      priceUSD: "410.001",
      shippingUSD: "0",
      salesTaxUSD: "0",
      observedAt: "2026-01-15T14:30:00.000Z",
      registeredAt: "2026-01-15T15:00:00.000Z",
    });
    // Rounding is a finance decision and happens outside this module.
    expect(offerCashOutflowUsd(offer).toFixed()).toBe("410.001");
  });

  it("reports gaps explicitly instead of guessing", () => {
    expect(isOfferIncomplete(OFFER)).toBe(false);
    expect(offerGaps(OFFER)).toEqual([]);

    const incomplete = buildManualOffer({
      referenceId: "V3",
      title: "iPhone 15 Pro 128GB",
      model: "iPhone 15 Pro",
      storage: "128GB",
      conditionText: "no informado",
      sellerName: "seller",
      url: "https://example.com/v3",
      priceUSD: "410.00",
      shippingUSD: "0",
      salesTaxUSD: "0",
      observedAt: "2026-01-15T14:30:00.000Z",
      registeredAt: "2026-01-15T15:00:00.000Z",
    });
    expect(isOfferIncomplete(incomplete)).toBe(true);
    expect(offerGaps(incomplete)).toEqual([
      "CONDITION_UNKNOWN",
      "SIM_FORMAT_UNKNOWN",
      "CARRIER_UNKNOWN",
    ]);
  });
});

describe("offer schema", () => {
  it("accepts a normalized offer on the wire and converts money to Decimal", () => {
    const parsed = parseProductOffer(toWireOffer(OFFER));
    expect(parsed.id).toBe("manual:V1");
    expect(parsed.priceUSD.toFixed()).toBe("410");
    expect(parsed.seller.ratingRate).toBeUndefined();
  });

  it("rejects non-https urls, negative amounts and out-of-range rates", () => {
    const base = toWireOffer(OFFER);
    expect(productOfferSchema.safeParse({ ...base, url: "http://example.com/x" }).success).toBe(false);
    expect(productOfferSchema.safeParse({ ...base, priceUSD: "-1" }).success).toBe(false);
    expect(productOfferSchema.safeParse({ ...base, seller: { ...base.seller, ratingRate: "1.5" } }).success).toBe(false);
    expect(productOfferSchema.safeParse({ ...base, storageGb: 192 }).success).toBe(false);
    expect(productOfferSchema.safeParse({ ...base, observedAt: "ayer" }).success).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(productOfferSchema.safeParse({ ...toWireOffer(OFFER), commission: "0.1" }).success).toBe(false);
  });
});