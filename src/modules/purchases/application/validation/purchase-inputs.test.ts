import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  createPurchaseSchema,
  declaredTotalMismatch,
  editPurchaseSchema,
  purchaseMoneySchema,
} from "./purchase-inputs";

const VALID_CREATE = {
  referenceCode: "PC-001",
  supplierOfferId: "41",
  productVariantId: "7",
  conditionGradeId: "3",
  currencyCode: "USD",
  orderedAt: "2026-01-15T14:30:00.000Z",
} as const;

/** Elimina claves para comprobar que son obligatorias. */
function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...(value as Record<string, unknown>) };
  delete copy[key as string];
  return copy as Omit<T, K>;
}

function errorMessages(result: { success: boolean; error?: { issues: readonly { message: string }[] } }): string {
  if (result.success) {
    return "";
  }
  return (result.error?.issues ?? []).map((issue) => issue.message).join(" | ");
}

describe("createPurchaseSchema", () => {
  it("acepta una compra minima valida", () => {
    const parsed = createPurchaseSchema.parse(VALID_CREATE);
    expect(parsed.referenceCode).toBe("PC-001");
    expect(parsed.currencyCode).toBe("USD");
    expect(parsed.money).toBeUndefined();
  });

  it("convierte los importes de texto a Decimal exacto", () => {
    const parsed = createPurchaseSchema.parse({
      ...VALID_CREATE,
      money: {
        purchasePriceUSD: "410.005",
        usShippingUSD: "12.99",
        usSalesTaxUSD: "0",
        paymentFeeUSD: "29.9",
      },
    });

    expect(parsed.money?.purchasePriceUSD?.toFixed()).toBe("410.005");
    expect(parsed.money?.paymentFeeUSD?.toFixed()).toBe("29.9");
  });

  it("acepta importes parciales en un borrador y no rellena con cero", () => {
    const parsed = createPurchaseSchema.parse({
      ...VALID_CREATE,
      money: { purchasePriceUSD: "410" },
    });
    expect(parsed.money?.purchasePriceUSD?.toFixed()).toBe("410");
    expect(parsed.money?.usShippingUSD).toBeUndefined();
  });

  it("rechaza importes ambiguos", () => {
    for (const bad of ["410,00", "1,234.56", "$410", "410 USD", "-1", "", "  "]) {
      const result = createPurchaseSchema.safeParse({
        ...VALID_CREATE,
        money: { purchasePriceUSD: bad },
      });
      expect(result.success, `deberia rechazar ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("rechaza mas de cuatro decimales", () => {
    const result = createPurchaseSchema.safeParse({
      ...VALID_CREATE,
      money: { purchasePriceUSD: "410.12345" },
    });
    expect(result.success).toBe(false);
    expect(errorMessages(result)).toMatch(/up to 4 decimals/);
  });

  it("rechaza fechas invalidas o sin zona horaria", () => {
    for (const bad of ["15/01/2026", "2026-01-15", "2026-01-15T14:30:00", "2026-13-45T10:00:00Z"]) {
      const result = createPurchaseSchema.safeParse({ ...VALID_CREATE, orderedAt: bad });
      expect(result.success, `deberia rechazar ${bad}`).toBe(false);
    }
  });

  it("rechaza una entrega estimada anterior al pedido", () => {
    const result = createPurchaseSchema.safeParse({
      ...VALID_CREATE,
      estimatedDeliveryAt: "2026-01-14T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
    expect(errorMessages(result)).toMatch(/estimatedDeliveryAt cannot be before orderedAt/);
  });

  it("rechaza campos desconocidos", () => {
    for (const extra of [{ status: "PAID" }, { commission: "1" }, { supplierOfferid: "41" }]) {
      const result = createPurchaseSchema.safeParse({ ...VALID_CREATE, ...extra });
      expect(result.success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("rechaza campos obligatorios ausentes", () => {
    expect(createPurchaseSchema.safeParse(omit(VALID_CREATE, "referenceCode")).success).toBe(false);
    expect(createPurchaseSchema.safeParse(omit(VALID_CREATE, "supplierOfferId")).success).toBe(false);
    expect(createPurchaseSchema.safeParse(omit(VALID_CREATE, "orderedAt")).success).toBe(false);
  });

  it("exige ids decimales positivos y moneda en mayusculas", () => {
    expect(createPurchaseSchema.safeParse({ ...VALID_CREATE, supplierOfferId: "abc" }).success).toBe(false);
    expect(createPurchaseSchema.safeParse({ ...VALID_CREATE, supplierOfferId: "0" }).success).toBe(false);
    expect(createPurchaseSchema.safeParse({ ...VALID_CREATE, currencyCode: "usd" }).success).toBe(false);
  });

  it("exige un enlace https para la fuente", () => {
    expect(createPurchaseSchema.safeParse({ ...VALID_CREATE, sourceUrl: "http://example.com/a" }).success).toBe(false);
    expect(createPurchaseSchema.safeParse({ ...VALID_CREATE, sourceUrl: "https://example.com/a" }).success).toBe(true);
  });
});

describe("editPurchaseSchema", () => {
  it("acepta un parche parcial con al menos un campo", () => {
    const parsed = editPurchaseSchema.parse({ referenceCode: "PC-002" });
    expect(parsed.referenceCode).toBe("PC-002");
    expect(parsed.currentStatus).toBeUndefined();
  });

  it("rechaza un parche vacio", () => {
    expect(editPurchaseSchema.safeParse({}).success).toBe(false);
    expect(editPurchaseSchema.safeParse({ currentStatus: "DRAFT" }).success).toBe(false);
  });

  it("rechaza cambiar el estado por la via del parche", () => {
    expect(editPurchaseSchema.safeParse({ status: "DELIVERED" }).success).toBe(false);
  });

  it("permite editar importes antes del pago", () => {
    const result = editPurchaseSchema.safeParse({
      currentStatus: "CONFIRMED",
      money: { purchasePriceUSD: "399.00" },
    });
    expect(result.success).toBe(true);
  });

  it("rechaza editar importes una vez pagada, con la regla del dominio", () => {
    for (const status of ["PAID", "IN_TRANSIT", "DELIVERED", "CANCELLED"]) {
      const result = editPurchaseSchema.safeParse({
        currentStatus: status,
        money: { purchasePriceUSD: "399.00" },
      });
      expect(result.success, status).toBe(false);
      expect(errorMessages(result)).toMatch(/DATA_CORRECTED/);
    }
  });

  it("permite seguir editando metadatos tras el pago", () => {
    expect(editPurchaseSchema.safeParse({ currentStatus: "PAID", notes: "revisar" }).success).toBe(true);
  });

  it("exige una revision positiva para el control de concurrencia", () => {
    expect(editPurchaseSchema.safeParse({ notes: "x", expectedRevision: 0 }).success).toBe(false);
    expect(editPurchaseSchema.safeParse({ notes: "x", expectedRevision: 3 }).success).toBe(true);
  });

  it("rechaza campos desconocidos en el parche", () => {
    expect(editPurchaseSchema.safeParse({ totalPaidUSD: "1" }).success).toBe(false);
  });
});

describe("declaredTotalMismatch", () => {
  const components = purchaseMoneySchema.parse({
    purchasePriceUSD: "410",
    usShippingUSD: "12.99",
    usSalesTaxUSD: "0",
    paymentFeeUSD: "29.9",
    otherCostUSD: "0",
  });

  it("acepta un total que coincide con la suma exacta", () => {
    expect(declaredTotalMismatch(components, new Decimal("452.89"))).toBeUndefined();
  });

  it("senala una transcripcion incorrecta", () => {
    expect(declaredTotalMismatch(components, new Decimal("452.90"))).toMatch(/452\.89/);
  });

  it("distingue una diferencia minima de precision", () => {
    expect(declaredTotalMismatch(components, new Decimal("452.889"))).toMatch(/exact sum/);
  });
});