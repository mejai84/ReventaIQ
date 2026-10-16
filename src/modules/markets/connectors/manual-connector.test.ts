import { describe, expect, it } from "vitest";

import { ManualConnector, buildManualOffer, buildOfferId, toWireOffer } from "./manual-connector";
import { ManualOfferRegistration } from "./manual-connector";
import {
  REQUESTED_AT,
  baseQuery,
  expectConnectorContract,
  expectConnectorIsDeterministic,
} from "./connector-contract";
import { SAMPLE_MANUAL_OFFERS, SAMPLE_OBSERVED_AT } from "./sample-offers";
import { isOfferIncomplete, offerCashOutflowUsd, offerGaps } from "../domain/product-offer";

/**
 * Removes optional keys entirely.
 * `exactOptionalPropertyTypes` forbids passing an explicit `undefined`, which
 * is how a caller expresses "this field was not reported".
 */
function withoutOptional<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

const VALID: ManualOfferRegistration = {
  referenceId: "TEST-1",
  marketplace: "EBAY",
  externalId: "1234567890",
  title: "Apple iPhone 15 Pro 128GB Natural Titanium Unlocked",
  model: "iPhone 15 Pro",
  storage: "128GB",
  conditionText: "Used - Excellent",
  simText: "Physical SIM",
  carrierName: "Unlocked",
  carrierLockText: "Unlocked",
  batteryHealthPercent: "92",
  sellerName: "test seller",
  sellerRatingPercent: "99.2",
  sellerReviewCount: 1543,
  url: "https://example.com/item/1",
  priceUSD: "410.00",
  shippingUSD: "12.99",
  salesTaxUSD: "0",
  warrantyDays: 30,
  observedAt: "2026-01-15T14:30:00.000Z",
  registeredAt: "2026-01-15T15:00:00.000Z",
};

describe("ManualConnector contract", () => {
  it("satisfies the common connector contract", async () => {
    await expectConnectorContract(new ManualConnector([VALID]), {});
  });

  it("is deterministic for the same query", async () => {
    await expectConnectorIsDeterministic(new ManualConnector([VALID]), {});
  });

  it("never requires credentials", () => {
    expect(new ManualConnector().describeSettings({}).configured).toBe(true);
    expect(new ManualConnector().capabilities.humanOperated).toBe(true);
  });
});

describe("ManualConnector normalization", () => {
  it("produces the canonical offer from a human entry", () => {
    const offer = buildManualOffer(VALID);

    expect(offer.id).toBe("ebay:TEST-1");
    expect(offer.marketplace).toBe("EBAY");
    expect(offer.externalId).toBe("1234567890");
    expect(offer.storageGb).toBe(128);
    expect(offer.condition).toBe("EXCELLENT");
    expect(offer.simFormat).toBe("PHYSICAL");
    expect(offer.carrier?.lockState).toBe("UNLOCKED");
    expect(offer.batteryHealthRate?.toFixed()).toBe("0.92");
    expect(offer.seller.ratingRate?.toFixed()).toBe("0.992");
    expect(offer.variantKey).toBe("ebay:iphone-15-pro-128");
    expect(offer.observedAt).toBe(VALID.observedAt);
    expect(offer.fetchedAt).toBe(VALID.registeredAt);
  });

  it("keeps unknown attributes unknown instead of defaulting them", () => {
    const offer = buildManualOffer({
      ...withoutOptional(VALID, [
        "simText",
        "carrierName",
        "carrierLockText",
        "batteryHealthPercent",
        "sellerRatingPercent",
        "sellerReviewCount",
        "warrantyDays",
      ]),
      conditionText: "estado no informado",
    });

    expect(offer.condition).toBe("UNKNOWN");
    expect(offer.simFormat).toBe("UNKNOWN");
    expect(offer.carrier).toBeUndefined();
    expect(offer.batteryHealthRate).toBeUndefined();
    expect(offer.seller.ratingRate).toBeUndefined();
    expect(offer.warrantyDays).toBeUndefined();
    expect(isOfferIncomplete(offer)).toBe(true);
    expect(offerGaps(offer)).toEqual([
      "CONDITION_UNKNOWN",
      "SIM_FORMAT_UNKNOWN",
      "CARRIER_UNKNOWN",
    ]);
  });

  it("requires shipping and tax to be stated explicitly, including zero", () => {
    const withoutCosts = withoutOptional(VALID, ["shippingUSD", "salesTaxUSD"] as never[]);
    expect(() => buildManualOffer(withoutCosts as unknown as ManualOfferRegistration)).toThrow();

    const freeShipping = buildManualOffer({ ...VALID, shippingUSD: "0", salesTaxUSD: "0" });
    expect(freeShipping.shippingUSD.toFixed()).toBe("0");
    expect(freeShipping.salesTaxUSD.toFixed()).toBe("0");
  });

  it("treats an unrecognized condition as incomplete but storable", () => {
    const offer = buildManualOffer({ ...VALID, conditionText: "estado no informado" });
    expect(offerGaps(offer)).toEqual(["CONDITION_UNKNOWN"]);
  });

  it("computes the exact cash outflow without rounding", () => {
    const offer = buildManualOffer({ ...VALID, priceUSD: "410.005", shippingUSD: "12.99", salesTaxUSD: "0.005" });
    expect(offerCashOutflowUsd(offer).toFixed()).toBe("423");
    expect(offerCashOutflowUsd(buildManualOffer(VALID)).toFixed()).toBe("422.99");
  });
});

describe("ManualConnector validation", () => {
  it("rejects a missing storage capacity", () => {
    expect(() =>
      buildManualOffer({ ...withoutOptional(VALID, ["storage"]), title: "iPhone 15 Pro" }),
    ).toThrow(TypeError);
  });

  it("rejects malformed money and dates", () => {
    expect(() => buildManualOffer({ ...VALID, priceUSD: "410,00" })).toThrow();
    expect(() => buildManualOffer({ ...VALID, priceUSD: "" })).toThrow();
    expect(() => buildManualOffer({ ...VALID, observedAt: "15/01/2026" })).toThrow();
    expect(() => buildManualOffer({ ...VALID, batteryHealthPercent: "120" })).toThrow();
    expect(() => buildManualOffer({ ...VALID, shippingUSD: "-5" })).toThrow();
  });

  it("rejects a non-https product URL and an empty reference", () => {
    expect(() => buildManualOffer({ ...VALID, url: "http://example.com/item/1" })).toThrow();
    expect(() => buildOfferId("EBAY", "  ")).toThrow(TypeError);
  });

  it("rejects an out-of-range seller rating", () => {
    expect(() => buildManualOffer({ ...VALID, sellerRatingPercent: "140" })).toThrow(RangeError);
  });

  it("rejects a negative warranty", () => {
    expect(() => buildManualOffer({ ...VALID, warrantyDays: -1 })).toThrow(RangeError);
  });
});

describe("ManualConnector search", () => {
  const connector = new ManualConnector(SAMPLE_MANUAL_OFFERS);

  it("filters by keyword", async () => {
    const page = await connector.search(baseQuery({ keyword: "iphone 15 pro" }), {});
    expect(page.offers.map((offer) => offer.id)).toEqual(["ebay:sample-001", "best_buy:sample-002"]);
    expect(page.observedAt).toBe(REQUESTED_AT);
  });

  it("filters by storage and by maximum price", async () => {
    const byStorage = await connector.search(baseQuery({ keyword: "iphone", storageGb: 512 }), {});
    expect(byStorage.offers.map((offer) => offer.id)).toEqual(["manual:sample-005"]);

    const byPrice = await connector.search(baseQuery({ keyword: "iphone", maxPriceUSD: "500" }), {});
    expect(byPrice.offers.map((offer) => offer.id)).toEqual([
      "ebay:sample-001",
      "walmart:sample-003",
      "ebay:sample-004",
    ]);
  });

  it("pages with an opaque cursor and never reads the clock", async () => {
    const first = await connector.search(baseQuery({ keyword: "iphone", limit: 2 }), {});
    expect(first.offers).toHaveLength(2);
    expect(first.nextCursor).toBe("2");

    const second = await connector.search(
      baseQuery({ keyword: "iphone", limit: 2, ...(first.nextCursor === undefined ? {} : { cursor: first.nextCursor }) }),
      {},
    );
    expect(second.offers).toHaveLength(2);
    expect(second.observedAt).toBe(REQUESTED_AT);
    expect(second.offers[0]?.id).not.toBe(first.offers[0]?.id);
  });

  it("resolves a known id and returns undefined for a missing one", async () => {
    await expect(connector.fetchOffer("ebay:sample-001", {})).resolves.toMatchObject({
      id: "ebay:sample-001",
      observedAt: SAMPLE_OBSERVED_AT,
    });
    await expect(connector.fetchOffer("ebay:nope", {})).resolves.toBeUndefined();
  });
});

describe("ManualConnector registration", () => {
  it("registers new offers without mutating previous state", async () => {
    const connector = new ManualConnector();
    connector.register(VALID);
    const offers = connector.listAll();
    const second = connector.register({ ...VALID, referenceId: "TEST-2", priceUSD: "399.00" });

    expect(connector.listAll()).toHaveLength(2);
    expect(offers).toHaveLength(1);
    expect(second.priceUSD.toFixed()).toBe("399");
    expect(second.id).toBe("ebay:TEST-2");
  });

  it("replaces an offer registered twice under the same reference", () => {
    const connector = new ManualConnector([VALID]);
    connector.register({ ...VALID, priceUSD: "388.00" });
    expect(connector.listAll()).toHaveLength(1);
    expect(connector.listAll()[0]?.priceUSD.toFixed()).toBe("388");
  });

  it("rejects an invalid registration instead of storing it", () => {
    const connector = new ManualConnector();
    expect(() => connector.register({ ...VALID, priceUSD: "abc" })).toThrow();
    expect(connector.listAll()).toHaveLength(0);
  });
});

describe("sample data", () => {
  it("is normalized end to end and covers every condition path", () => {
    const connector = new ManualConnector(SAMPLE_MANUAL_OFFERS);
    const conditions = connector.listAll().map((offer) => offer.condition);

    expect(conditions).toContain("EXCELLENT");
    expect(conditions).toContain("OPEN_BOX");
    expect(conditions).toContain("GOOD");
    expect(conditions).toContain("FOR_PARTS");
    expect(conditions).toContain("UNKNOWN");
  });

  it("serializes money as strings for the wire", () => {
    const [offer] = new ManualConnector(SAMPLE_MANUAL_OFFERS).listAll();
    expect(typeof toWireOffer(offer!).priceUSD).toBe("string");
    expect(toWireOffer(offer!).priceUSD).toBe("410");
  });
});