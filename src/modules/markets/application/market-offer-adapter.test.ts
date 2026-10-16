import Decimal from "decimal.js";

import { describe, expect, it } from "vitest";

import { buildManualOffer, type ManualOfferRegistration } from "../connectors/manual-connector";
import {
  type ConversionBlocker,
  type MarketOfferConversionPolicy,
  type VariantResolver,
  buildCatalogResolver,
  assertValidConversionPolicy,
  mapConditionToEngine,
  summarizeConversions,
  toOpportunityOffer,
  toOpportunityOffers,
} from "./market-offer-adapter";

const CATALOG = [
  {
    variantKey: "ebay:iphone-15-pro-128",
    productVariantId: "variant-iphone-15-pro-128",
    supplierId: "supplier-ebay-pool",
  },
  {
    variantKey: "best_buy:iphone-13-128",
    productVariantId: "variant-iphone-13-128",
    supplierId: "supplier-best-buy",
  },
];

const POLICY: MarketOfferConversionPolicy = {
  requireUnlockedCarrier: true,
  paymentFeeUSD: new Decimal("29.9"),
};

const resolveVariant: VariantResolver = buildCatalogResolver(CATALOG);

/** An override set to `undefined` removes the field, which is how "not reported" is expressed. */
type RegistrationOverrides = {
  readonly [K in keyof ManualOfferRegistration]?: ManualOfferRegistration[K] | undefined;
};

function registration(overrides: RegistrationOverrides = {}): ManualOfferRegistration {
  const base: ManualOfferRegistration = {
    referenceId: "AD-1",
    marketplace: "EBAY",
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
    url: "https://example.com/item/ad-1",
    priceUSD: "410.00",
    shippingUSD: "12.99",
    salesTaxUSD: "0.00",
    warrantyDays: 30,
    observedAt: "2026-01-15T14:30:00.000Z",
    registeredAt: "2026-01-15T15:00:00.000Z",
  };

  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overrides) as (keyof ManualOfferRegistration)[]) {
    const value = overrides[key];
    if (value === undefined) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }
  return result as unknown as ManualOfferRegistration;
}

function blockerCodes(result: ReturnType<typeof toOpportunityOffer>): readonly ConversionBlocker[] {
  expect(result.status).toBe("NOT_EVALUABLE");
  return result.status === "NOT_EVALUABLE" ? result.blockers : [];
}

describe("valid conversions", () => {
  it("maps a comparable unlocked offer into the engine contract", () => {
    const result = toOpportunityOffer(buildManualOffer(registration()), POLICY, resolveVariant);

    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;

    expect(result.sourceOfferId).toBe("ebay:AD-1");
    expect(result.offer.id).toBe("ebay:AD-1");
    expect(result.offer.productVariantId).toBe("variant-iphone-15-pro-128");
    expect(result.offer.supplierId).toBe("supplier-ebay-pool");
    expect(result.offer.condition).toBe("EXCELLENT");
    expect(result.offer.productUrl).toBe("https://example.com/item/ad-1");
    expect(result.offer.observedAt).toBe("2026-01-15T14:30:00.000Z");
    expect(result.offer.expiresAt).toBeUndefined();
  });

  it("keeps every amount as Decimal and unrounded", () => {
    const offer = buildManualOffer(registration({ priceUSD: "410.005", shippingUSD: "12.994" }));
    const result = toOpportunityOffer(offer, POLICY, resolveVariant);
    if (result.status !== "READY") throw new Error("expected READY");

    expect(Decimal.isDecimal(result.offer.purchasePriceUSD)).toBe(true);
    expect(Decimal.isDecimal(result.offer.usShippingUSD)).toBe(true);
    expect(Decimal.isDecimal(result.offer.usSalesTaxUSD)).toBe(true);
    expect(Decimal.isDecimal(result.offer.paymentFeeUSD)).toBe(true);
    expect(result.offer.purchasePriceUSD.toFixed()).toBe("410.005");
    expect(result.offer.usShippingUSD.toFixed()).toBe("12.994");
    expect(result.offer.paymentFeeUSD.toFixed()).toBe("29.9");
  });

  it("maps every condition that has an engine equivalent", () => {
    const cases: readonly [string, string][] = [
      ["New", "NEW"],
      ["Sealed", "SEALED"],
      ["Open Box", "OPEN_BOX"],
      ["Like New", "PREMIUM"],
      ["Excellent", "EXCELLENT"],
      ["Good", "GOOD"],
      ["Fair", "FAIR"],
      ["Used", "USED"],
    ];

    for (const [conditionText, expected] of cases) {
      const result = toOpportunityOffer(
        buildManualOffer(registration({ conditionText })),
        POLICY,
        resolveVariant,
      );
      expect(result.status, conditionText).toBe("READY");
      if (result.status === "READY") {
        expect(result.offer.condition, conditionText).toBe(expected);
      }
    }
  });

  it("reports the approximation of LIKE_NEW instead of hiding it", () => {
    const result = toOpportunityOffer(
      buildManualOffer(registration({ conditionText: "Like New" })),
      POLICY,
      resolveVariant,
    );
    expect(result.notes.map((note) => note.code)).toContain("CONDITION_APPROXIMATED");
  });

  it("passes through configured extra costs and a reported expiry", () => {
    const result = toOpportunityOffer(buildManualOffer(registration()), {
      ...POLICY,
      otherPurchaseCostsUSD: [
        { code: "AUTHENTICATION_FEE", label: "Authentication fee", amountUSD: new Decimal("50"), subjectToFxSpread: true },
      ],
      offerExpiresAt: "2026-01-16T14:30:00.000Z",
    }, resolveVariant);

    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;
    expect(result.offer.otherPurchaseCostsUSD).toHaveLength(1);
    expect(result.offer.otherPurchaseCostsUSD[0]?.code).toBe("AUTHENTICATION_FEE");
    expect(result.offer.expiresAt).toBe("2026-01-16T14:30:00.000Z");
    expect(result.notes.map((note) => note.code)).toContain("OTHER_COSTS_INCLUDED");
  });

  it("is deterministic", () => {
    const offer = buildManualOffer(registration());
    expect(toOpportunityOffer(offer, POLICY, resolveVariant)).toEqual(
      toOpportunityOffer(offer, POLICY, resolveVariant),
    );
  });
});

describe("missing fields are reported, never completed", () => {
  it("still converts when optional quality data is absent, and says so", () => {
    const offer = buildManualOffer(
      registration({
        batteryHealthPercent: undefined,
        sellerRatingPercent: undefined,
        sellerReviewCount: undefined,
        warrantyDays: undefined,
        externalId: undefined,
      }),
    );
    const result = toOpportunityOffer(offer, POLICY, resolveVariant);

    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;

    expect(result.offer.batteryHealthRate).toBeUndefined();
    expect(result.offer.sellerRatingRate).toBeUndefined();
    expect(result.offer.sellerReviewCount).toBeUndefined();
    expect(result.offer.supplierWarrantyDays).toBeUndefined();

    const codes = result.notes.map((note) => note.code);
    expect(codes).toContain("BATTERY_HEALTH_UNKNOWN");
    expect(codes).toContain("SELLER_RATING_UNKNOWN");
    expect(codes).toContain("SELLER_REVIEWS_UNKNOWN");
    expect(codes).toContain("WARRANTY_UNKNOWN");
    expect(codes).toContain("EXPIRY_UNKNOWN");
  });

  it("blocks when the payment fee is not configured instead of assuming zero", () => {
    const result = toOpportunityOffer(buildManualOffer(registration()), {
      requireUnlockedCarrier: true,
    }, resolveVariant);

    expect(blockerCodes(result)).toEqual(["PAYMENT_FEE_UNKNOWN"]);
  });

  it("blocks when the variant has no catalog entry and invents no ids", () => {
    const result = toOpportunityOffer(
      buildManualOffer(registration({ title: "iPhone 12 64GB", model: "iPhone 12", storage: "64GB" })),
      POLICY,
      resolveVariant,
    );

    expect(blockerCodes(result)).toEqual(["CATALOG_VARIANT_NOT_FOUND"]);
  });

  it("blocks an invalid observation instant instead of crashing the engine", () => {
    const offer = buildManualOffer(registration());
    const broken = { ...offer, observedAt: "15/01/2026" };
    expect(blockerCodes(toOpportunityOffer(broken, POLICY, resolveVariant))).toEqual([
      "OBSERVATION_INSTANT_INVALID",
    ]);
  });

  it("rejects a negative configured payment fee loudly", () => {
    expect(() =>
      toOpportunityOffer(buildManualOffer(registration()), {
        requireUnlockedCarrier: true,
        paymentFeeUSD: new Decimal("-1"),
      }, resolveVariant),
    ).toThrow(RangeError);
  });
});

describe("incompatible conditions are not evaluated", () => {
  it("blocks FOR_PARTS explicitly", () => {
    const result = toOpportunityOffer(
      buildManualOffer(registration({ conditionText: "For parts or not working" })),
      POLICY,
      resolveVariant,
    );
    expect(blockerCodes(result)).toEqual(["CONDITION_FOR_PARTS"]);
  });

  it("blocks an unrecognized condition as UNKNOWN", () => {
    const result = toOpportunityOffer(
      buildManualOffer(registration({ conditionText: "estado no informado" })),
      POLICY,
      resolveVariant,
    );
    expect(blockerCodes(result)).toEqual(["CONDITION_UNKNOWN"]);
  });

  it("blocks unknown and non-unlocked devices", () => {
    const unknownLock = toOpportunityOffer(
      buildManualOffer(registration({ carrierName: "sin informar", carrierLockText: "no informado" })),
      POLICY,
      resolveVariant,
    );
    expect(blockerCodes(unknownLock)).toEqual(["CARRIER_LOCK_UNKNOWN"]);

    const locked = toOpportunityOffer(
      buildManualOffer(registration({ carrierLockText: "Carrier locked" })),
      POLICY,
      resolveVariant,
    );
    expect(blockerCodes(locked)).toEqual(["CARRIER_LOCKED"]);

    const financed = toOpportunityOffer(
      buildManualOffer(registration({ carrierLockText: "Financed / locked" })),
      POLICY,
      resolveVariant,
    );
    expect(blockerCodes(financed)).toEqual(["CARRIER_LOCKED"]);
  });

  it("blocks a missing carrier profile", () => {
    const offer = buildManualOffer(
      registration({ carrierName: undefined, carrierLockText: undefined }),
    );
    expect(blockerCodes(toOpportunityOffer(offer, POLICY, resolveVariant))).toEqual([
      "CARRIER_LOCK_UNKNOWN",
    ]);
  });

  it("only checks the lock when the policy explicitly allows locked devices", () => {
    const result = toOpportunityOffer(
      buildManualOffer(registration({ carrierLockText: "Carrier locked" })),
      { requireUnlockedCarrier: false, paymentFeeUSD: new Decimal("0") },
      resolveVariant,
    );
    expect(result.status).toBe("READY");
  });

  it("accumulates every blocker of an unusable offer", () => {
    const result = toOpportunityOffer(
      buildManualOffer(
        registration({
          conditionText: "For parts or not working",
          carrierName: undefined,
          carrierLockText: undefined,
        }),
      ),
      { requireUnlockedCarrier: true },
      () => undefined,
    );
    expect(blockerCodes(result)).toEqual([
      "CONDITION_FOR_PARTS",
      "CARRIER_LOCK_UNKNOWN",
      "CATALOG_VARIANT_NOT_FOUND",
      "PAYMENT_FEE_UNKNOWN",
    ]);
  });
});

describe("catalog resolution", () => {
  it("resolves each marketplace by its own variant key", () => {
    const offer = buildManualOffer(
      registration({
        referenceId: "AD-2",
        marketplace: "BEST_BUY",
        title: "Apple iPhone 13 128GB Open Box Excellent",
        model: "iPhone 13",
        conditionText: "Open Box",
      }),
    );
    const result = toOpportunityOffer(offer, POLICY, resolveVariant);
    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;
    expect(result.offer.productVariantId).toBe("variant-iphone-13-128");
    expect(result.offer.supplierId).toBe("supplier-best-buy");
    expect(result.offer.condition).toBe("OPEN_BOX");
  });

  it("returns undefined for an unknown variant instead of a partial match", () => {
    const resolve = buildCatalogResolver([]);
    expect(resolve(buildManualOffer(registration()).variantKey)).toBeUndefined();
  });

  it("lets the last catalog snapshot win for a duplicated key", () => {
    expect(() =>
      buildCatalogResolver([
        { variantKey: "ebay:iphone-15-pro-128", productVariantId: "v-old", supplierId: "s-old" },
        { variantKey: "ebay:iphone-15-pro-128", productVariantId: "v-new", supplierId: "s-new" },
      ]),
    ).toThrow(RangeError);
  });
});

describe("policy validation", () => {
  it("rejects a negative or non-finite payment fee", () => {
    expect(() =>
      assertValidConversionPolicy({ paymentFeeUSD: new Decimal("-1") }),
    ).toThrow(RangeError);
    expect(() =>
      assertValidConversionPolicy({ paymentFeeUSD: new Decimal(NaN) }),
    ).toThrow(RangeError);
    expect(() =>
      assertValidConversionPolicy({ paymentFeeUSD: new Decimal(Infinity) }),
    ).toThrow(RangeError);
  });

  it("rejects extra costs that are negative or reuse an engine cost code", () => {
    expect(() =>
      assertValidConversionPolicy({
        otherPurchaseCostsUSD: [
          { code: "AUTHENTICATION_FEE", label: "Auth", amountUSD: new Decimal("-5"), subjectToFxSpread: true },
        ],
      }),
    ).toThrow(RangeError);

    expect(() =>
      assertValidConversionPolicy({
        otherPurchaseCostsUSD: [
          { code: "PAYMENT_FEE", label: "Double counted", amountUSD: new Decimal("5"), subjectToFxSpread: true },
        ],
      }),
    ).toThrow(/PAYMENT_FEE/);
  });

  it("rejects a malformed expiry at policy validation instead of crashing the engine later", () => {
    expect(() =>
      assertValidConversionPolicy({ offerExpiresAt: "16/01/2026" }),
    ).toThrow();

    expect(() =>
      toOpportunityOffer(
        buildManualOffer(registration()),
        { ...POLICY, offerExpiresAt: "16/01/2026" },
        resolveVariant,
      ),
    ).toThrow();
  });

  it("is enabled by default when requireUnlockedCarrier is omitted", () => {
    const locked = toOpportunityOffer(
      buildManualOffer(registration({ carrierLockText: "Carrier locked" })),
      { paymentFeeUSD: new Decimal("0") },
      resolveVariant,
    );
    expect(blockerCodes(locked)).toEqual(["CARRIER_LOCKED"]);

    const unknownLock = toOpportunityOffer(
      buildManualOffer(registration({ carrierLockText: "no informado" })),
      { paymentFeeUSD: new Decimal("0"), requireUnlockedCarrier: false },
      resolveVariant,
    );
    expect(unknownLock.status).toBe("READY");
  });

  it("flags absent extra costs as unknown instead of assuming none", () => {
    const withoutCosts = toOpportunityOffer(
      buildManualOffer(registration()),
      POLICY,
      resolveVariant,
    );
    expect(withoutCosts.notes.map((note) => note.code)).toContain("OTHER_COSTS_UNKNOWN");

    const withEmptyCosts = toOpportunityOffer(
      buildManualOffer(registration()),
      { ...POLICY, otherPurchaseCostsUSD: [] },
      resolveVariant,
    );
    expect(withEmptyCosts.notes.map((note) => note.code)).not.toContain("OTHER_COSTS_UNKNOWN");
  });
});

describe("condition map is explicit", () => {
  it("pins every market condition to its engine code or its blocker", () => {
    expect(mapConditionToEngine("NEW")).toEqual({ status: "MAPPED", code: "NEW" });
    expect(mapConditionToEngine("SEALED")).toEqual({ status: "MAPPED", code: "SEALED" });
    expect(mapConditionToEngine("OPEN_BOX")).toEqual({ status: "MAPPED", code: "OPEN_BOX" });
    expect(mapConditionToEngine("LIKE_NEW")).toEqual({ status: "MAPPED", code: "PREMIUM" });
    expect(mapConditionToEngine("EXCELLENT")).toEqual({ status: "MAPPED", code: "EXCELLENT" });
    expect(mapConditionToEngine("GOOD")).toEqual({ status: "MAPPED", code: "GOOD" });
    expect(mapConditionToEngine("FAIR")).toEqual({ status: "MAPPED", code: "FAIR" });
    expect(mapConditionToEngine("USED")).toEqual({ status: "MAPPED", code: "USED" });
    expect(mapConditionToEngine("FOR_PARTS")).toEqual({
      status: "BLOCKED",
      blocker: "CONDITION_FOR_PARTS",
    });
    expect(mapConditionToEngine("UNKNOWN")).toEqual({
      status: "BLOCKED",
      blocker: "CONDITION_UNKNOWN",
    });
  });
});

describe("engine compatibility", () => {
  it("produces an offer the engine matches against comparables of the same condition", () => {
    const result = toOpportunityOffer(buildManualOffer(registration()), POLICY, resolveVariant);
    if (result.status !== "READY") throw new Error("expected READY");

    // The engine filters listings by productVariantId AND condition equality.
    const comparable = {
      productVariantId: result.offer.productVariantId,
      condition: result.offer.condition,
    };
    const matches = [comparable].filter(
      (listing) =>
        listing.productVariantId === result.offer.productVariantId &&
        listing.condition === result.offer.condition,
    );
    expect(matches).toHaveLength(1);
  });

  it("keeps the engine's FX cost lines disjoint from configured extra costs", () => {
    const result = toOpportunityOffer(buildManualOffer(registration()), {
      ...POLICY,
      otherPurchaseCostsUSD: [
        { code: "AUTHENTICATION_FEE", label: "Auth", amountUSD: new Decimal("50"), subjectToFxSpread: true },
      ],
    }, resolveVariant);
    if (result.status !== "READY") throw new Error("expected READY");

    const engineCodes = ["PURCHASE_PRICE", "US_SHIPPING", "US_SALES_TAX", "PAYMENT_FEE"];
    for (const cost of result.offer.otherPurchaseCostsUSD) {
      expect(engineCodes).not.toContain(cost.code);
      expect(Decimal.isDecimal(cost.amountUSD)).toBe(true);
    }
  });

  it("reports dropped source detail so nothing disappears silently", () => {
    const result = toOpportunityOffer(buildManualOffer(registration()), POLICY, resolveVariant);
    const dropped = result.notes.find((note) => note.code === "SOURCE_DETAIL_DROPPED");
    expect(dropped?.message).toContain("seller.name");
    expect(dropped?.message).toContain("imageUrl");
  });

  it("marks a rejected offer with its notes instead of dropping it silently", () => {
    const result = toOpportunityOffer(
      buildManualOffer(registration({ conditionText: "For parts or not working" })),
      POLICY,
      resolveVariant,
    );
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes.map((note) => note.code)).toContain("SOURCE_DETAIL_DROPPED");
  });
});

describe("batch conversion", () => {
  it("converts a page in order and summarizes rejections", () => {
    const offers = [
      buildManualOffer(registration({ referenceId: "B-1" })),
      buildManualOffer(registration({ referenceId: "B-2", conditionText: "For parts or not working" })),
      buildManualOffer(
        registration({
          referenceId: "B-3",
          title: "iPhone 12 64GB",
          model: "iPhone 12",
          storage: "64GB",
        }),
      ),
    ];

    const conversions = toOpportunityOffers(offers, POLICY, resolveVariant);
    expect(conversions.map((conversion) => conversion.sourceOfferId)).toEqual([
      "ebay:B-1",
      "ebay:B-2",
      "ebay:B-3",
    ]);

    const summary = summarizeConversions(conversions);
    expect(summary.ready).toBe(1);
    expect(summary.notEvaluable).toBe(2);
    expect(summary.blockersByCode).toEqual({ CONDITION_FOR_PARTS: 1, CATALOG_VARIANT_NOT_FOUND: 1 });
  });
});