import { describe, expect, it } from "vitest";

import {
  buildComparableGroupKey,
  buildVariantKey,
  extractModelFromTitle,
  normalizeCarrierLockState,
  normalizeCondition,
  normalizeSeller,
  normalizeSimFormat,
  normalizeStorageGb,
  slugify,
} from "./normalization";

describe("normalizeCondition", () => {
  it("maps exact marketplace tokens to the canonical vocabulary", () => {
    expect(normalizeCondition("New")).toBe("NEW");
    expect(normalizeCondition("SEALED")).toBe("SEALED");
    expect(normalizeCondition("Open Box")).toBe("OPEN_BOX");
    expect(normalizeCondition("Excellent")).toBe("EXCELLENT");
    expect(normalizeCondition("Fair")).toBe("FAIR");
  });

  it("maps composite marketplace phrases", () => {
    expect(normalizeCondition("Used - Excellent")).toBe("EXCELLENT");
    expect(normalizeCondition("Used - Very Good")).toBe("GOOD");
    expect(normalizeCondition("Used - Acceptable")).toBe("FAIR");
    expect(normalizeCondition("For parts or not working")).toBe("FOR_PARTS");
    expect(normalizeCondition("Seller refurbished")).toBe("USED");
    expect(normalizeCondition("Very Good Renewed")).toBe("GOOD");
  });

  it("never guesses: unrecognized or missing text becomes UNKNOWN", () => {
    expect(normalizeCondition("estado no informado")).toBe("UNKNOWN");
    expect(normalizeCondition("")).toBe("UNKNOWN");
    expect(normalizeCondition(undefined)).toBe("UNKNOWN");
    expect(normalizeCondition(null)).toBe("UNKNOWN");
  });
});

describe("normalizeSeller (operator)", () => {
  it("normalizes a percentage rating into a fraction", () => {
    const seller = normalizeSeller({ name: "  ACME  Phones ", ratingPercent: "98.5", reviewCount: 120 });
    expect(seller.name).toBe("ACME PHONES");
    expect(seller.ratingRate?.toFixed()).toBe("0.985");
    expect(seller.reviewCount).toBe(120);
  });

  it("accepts a rate already expressed as a fraction", () => {
    expect(normalizeSeller({ name: "store", ratingRate: "0.75" }).ratingRate?.toFixed()).toBe("0.75");
  });

  it("rejects a rating outside the valid range instead of clamping it", () => {
    expect(() => normalizeSeller({ name: "store", ratingPercent: "140" })).toThrow(RangeError);
    expect(() => normalizeSeller({ name: "store", ratingRate: "1.4" })).toThrow(RangeError);
  });

  it("rejects a missing seller name and a malformed review count", () => {
    expect(() => normalizeSeller({ name: "  " })).toThrow(TypeError);
    expect(() => normalizeSeller({ name: "store", reviewCount: -1 })).toThrow(RangeError);
    expect(() => normalizeSeller({ name: "store", reviewCount: 1.5 })).toThrow(RangeError);
  });

  it("normalizes and validates the country code", () => {
    expect(normalizeSeller({ name: "store", countryCode: "us" }).countryCode).toBe("US");
    expect(() => normalizeSeller({ name: "store", countryCode: "USA" })).toThrow(TypeError);
  });
});

describe("normalizeStorageGb", () => {
  it("accepts the usual spellings", () => {
    expect(normalizeStorageGb("128GB")).toBe(128);
    expect(normalizeStorageGb("128 gb")).toBe(128);
    expect(normalizeStorageGb("128")).toBe(128);
    expect(normalizeStorageGb("1TB")).toBe(1024);
    expect(normalizeStorageGb("1 tb")).toBe(1024);
  });

  it("extracts the capacity out of a title", () => {
    expect(normalizeStorageGb("Apple iPhone 15 Pro 128GB Natural Titanium")).toBe(128);
  });

  it("returns undefined for unknown or missing capacities", () => {
    expect(normalizeStorageGb("192GB")).toBeUndefined();
    expect(normalizeStorageGb("")).toBeUndefined();
    expect(normalizeStorageGb(undefined)).toBeUndefined();
    expect(normalizeStorageGb(null)).toBeUndefined();
  });
});

describe("variant keys", () => {
  it("scopes the variant key to the marketplace", () => {
    expect(buildVariantKey({ marketplace: "EBAY", model: "iPhone 15 Pro", storageGb: 128 })).toBe(
      "iphone-15-pro-128",
    );
    expect(buildVariantKey({ marketplace: "BEST_BUY", model: "iPhone 15 Pro", storageGb: 128 })).toBe(
      "iphone-15-pro-128",
    );
  });

  it("builds the same key for the same model regardless of the source title", () => {
    const fromTitle = buildVariantKey({ marketplace: "EBAY", model: "iPhone 15 Pro", storageGb: 128 });
    const fromSlug = buildVariantKey({ marketplace: "EBAY", model: "iphone  15 pro", storageGb: 128 });
    expect(fromTitle).toBe(fromSlug);
  });

  it("rejects an empty model", () => {
    expect(() => buildVariantKey({ marketplace: "EBAY", model: "  ", storageGb: 128 })).toThrow(TypeError);
  });

  it("groups offers across marketplaces", () => {
    expect(buildComparableGroupKey("iPhone 15 Pro", 128)).toBe("iphone-15-pro-128");
  });

  it("slugifies without losing the storage suffix", () => {
    expect(slugify("iPhone 15 Pro 128GB")).toBe("iphone-15-pro-128gb");
  });
});

describe("carrier and SIM normalization", () => {
  it("normalizes lock states", () => {
    expect(normalizeCarrierLockState("Unlocked")).toBe("UNLOCKED");
    expect(normalizeCarrierLockState("Factory unlocked")).toBe("UNLOCKED");
    expect(normalizeCarrierLockState("Carrier locked")).toBe("CARRIER_LOCKED");
    expect(normalizeCarrierLockState("Financed / locked")).toBe("FINANCE_LOCKED");
    expect(normalizeCarrierLockState("partially locked")).toBe("PARTIALLY_LOCKED");
    expect(normalizeCarrierLockState("")).toBe("UNKNOWN");
  });

  it("normalizes SIM formats", () => {
    expect(normalizeSimFormat("Physical SIM")).toBe("PHYSICAL");
    expect(normalizeSimFormat("Nano SIM")).toBe("PHYSICAL");
    expect(normalizeSimFormat("eSIM")).toBe("ESIM");
    expect(normalizeSimFormat("Dual SIM")).toBe("HYBRID");
    expect(normalizeSimFormat("no informado")).toBe("UNKNOWN");
    // A lock statement is not SIM format information: it stays UNKNOWN.
    expect(normalizeSimFormat("Unlocked")).toBe("UNKNOWN");
  });
});

describe("extractModelFromTitle", () => {
  it("extracts the commercial model", () => {
    expect(extractModelFromTitle("Apple iPhone 15 Pro Max 256GB")).toBe("iPhone 15 Pro Max");
    expect(extractModelFromTitle("iPhone 13 Blue")).toBe("iPhone 13");
    expect(extractModelFromTitle("iPhone 15 Pro 128GB Natural Titanium")).toBe("iPhone 15 Pro");
  });

  it("returns undefined when the title is not an iPhone", () => {
    expect(extractModelFromTitle("Samsung Galaxy S24")).toBeUndefined();
  });
});
