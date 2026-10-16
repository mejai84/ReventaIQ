import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { InvalidPurchaseAmountError } from "./errors";
import type { PurchaseMoneyComponents } from "./contracts";
import {
  PURCHASE_MONEY_FIELDS,
  assertPurchaseComponents,
  calculatePurchaseTotalUSD,
  moneyGaps,
  parseUsdAmount,
  summarizePurchaseMoney,
} from "./purchase-money";

function fullMoney(overrides: Partial<PurchaseMoneyComponents> = {}): PurchaseMoneyComponents {
  return {
    purchasePriceUSD: new Decimal("410"),
    usShippingUSD: new Decimal("12.99"),
    usSalesTaxUSD: new Decimal("0"),
    paymentFeeUSD: new Decimal("29.9"),
    otherCostUSD: new Decimal("0"),
    ...overrides,
  };
}

describe("calculatePurchaseTotalUSD", () => {
  it("suma los cinco componentes como Decimal", () => {
    const total = calculatePurchaseTotalUSD(fullMoney());
    expect(Decimal.isDecimal(total)).toBe(true);
    expect(total.toFixed()).toBe("452.89");
  });

  it("no redondea: conserva los decimales exactos", () => {
    const total = calculatePurchaseTotalUSD(
      fullMoney({ purchasePriceUSD: new Decimal("410.005"), usShippingUSD: new Decimal("0.004") }),
    );
    expect(total.toFixed()).toBe("439.909");
  });

  it("falla si falta un componente en vez de asumir cero", () => {
    const partial = fullMoney();
    expect(() => calculatePurchaseTotalUSD({ ...partial, otherCostUSD: undefined })).toThrow(
      InvalidPurchaseAmountError,
    );
    expect(() => calculatePurchaseTotalUSD({ ...partial, usShippingUSD: undefined })).toThrow(
      /usShippingUSD/,
    );
  });

  it("rechaza importes negativos y no finitos", () => {
    expect(() => calculatePurchaseTotalUSD(fullMoney({ purchasePriceUSD: new Decimal("-1") }))).toThrow(
      RangeError,
    );
    expect(() => calculatePurchaseTotalUSD(fullMoney({ paymentFeeUSD: new Decimal(NaN) }))).toThrow(RangeError);
    expect(() => calculatePurchaseTotalUSD(fullMoney({ paymentFeeUSD: new Decimal(Infinity) }))).toThrow(RangeError);
  });

  it("acepta un cero explícito", () => {
    const total = calculatePurchaseTotalUSD(fullMoney({ usSalesTaxUSD: new Decimal("0"), otherCostUSD: new Decimal("0") }));
    expect(total.toFixed()).toBe("452.89");
  });

  it("es determinista", () => {
    expect(calculatePurchaseTotalUSD(fullMoney()).toFixed()).toBe(calculatePurchaseTotalUSD(fullMoney()).toFixed());
  });
});

describe("moneyGaps", () => {
  it("lista los faltantes en orden estable", () => {
    expect(moneyGaps({}).map((gap) => gap.code)).toEqual([
      "PURCHASE_PRICE_UNKNOWN",
      "US_SHIPPING_UNKNOWN",
      "US_SALES_TAX_UNKNOWN",
      "PAYMENT_FEE_UNKNOWN",
      "OTHER_COST_UNKNOWN",
    ]);
  });

  it("no reporta faltantes cuando todo está informado", () => {
    expect(moneyGaps(fullMoney())).toEqual([]);
  });

  it("distingue ausente de cero explícito", () => {
    expect(moneyGaps(fullMoney({ otherCostUSD: new Decimal("0") }))).toEqual([]);
    expect(moneyGaps({ ...fullMoney(), otherCostUSD: undefined })).toHaveLength(1);
  });
});

describe("summarizePurchaseMoney", () => {
  it("devuelve el total sólo cuando está completo", () => {
    const complete = summarizePurchaseMoney(fullMoney());
    expect(complete.complete).toBe(true);
    expect(complete.totalUSD?.toFixed()).toBe("452.89");
    expect(complete.gaps).toEqual([]);
  });

  it("omite el total y expone los faltantes cuando está incompleto", () => {
    const partial = summarizePurchaseMoney({ ...fullMoney(), usShippingUSD: undefined });
    expect(partial.complete).toBe(false);
    expect(partial.totalUSD).toBeUndefined();
    expect(partial.gaps.map((gap) => gap.field)).toEqual(["usShippingUSD"]);
    expect(partial.components.usShippingUSD).toBeUndefined();
  });
});

describe("assertPurchaseComponents", () => {
  it("acepta componentes ausentes y valida los presentes", () => {
    expect(() => assertPurchaseComponents({})).not.toThrow();
    expect(() => assertPurchaseComponents(fullMoney())).not.toThrow();
    expect(() => assertPurchaseComponents({ purchasePriceUSD: new Decimal("-0.01") })).toThrow(RangeError);
  });
});

describe("parseUsdAmount", () => {
  it("acepta formatos válidos como texto", () => {
    expect(parseUsdAmount("410", "purchasePriceUSD").toFixed()).toBe("410");
    expect(parseUsdAmount(" 12.99 ", "usShippingUSD").toFixed()).toBe("12.99");
    expect(parseUsdAmount("0", "otherCostUSD").toFixed()).toBe("0");
  });

  it("rechaza separadores de millar y formatos ambiguos", () => {
    expect(() => parseUsdAmount("410,00", "purchasePriceUSD")).toThrow(InvalidPurchaseAmountError);
    expect(() => parseUsdAmount("1,234.56", "purchasePriceUSD")).toThrow(InvalidPurchaseAmountError);
    expect(() => parseUsdAmount("$410", "purchasePriceUSD")).toThrow(InvalidPurchaseAmountError);
    expect(() => parseUsdAmount("-1", "purchasePriceUSD")).toThrow(InvalidPurchaseAmountError);
    expect(() => parseUsdAmount("", "purchasePriceUSD")).toThrow(InvalidPurchaseAmountError);
    expect(() => parseUsdAmount("410.12345", "purchasePriceUSD")).toThrow(/up to 4 decimals/);
  });
});

describe("contrato de campos monetarios", () => {
  it("expone los cinco componentes en orden estable", () => {
    expect(PURCHASE_MONEY_FIELDS).toEqual([
      "purchasePriceUSD",
      "usShippingUSD",
      "usSalesTaxUSD",
      "paymentFeeUSD",
      "otherCostUSD",
    ]);
  });
});