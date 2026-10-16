import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import type { PurchaseMoneyComponents, PurchaseView } from "./contracts";
import {
  isPurchaseOverdue,
  nextPurchaseAction,
  purchaseCompletionGaps,
  purchaseOverdueDays,
} from "./purchase-readiness";

const EVALUATED_AT = "2026-01-20T12:00:00.000Z";

function money(overrides: Partial<PurchaseMoneyComponents> = {}): PurchaseMoneyComponents {
  return {
    purchasePriceUSD: new Decimal("410"),
    usShippingUSD: new Decimal("12.99"),
    usSalesTaxUSD: new Decimal("0"),
    paymentFeeUSD: new Decimal("29.9"),
    otherCostUSD: new Decimal("0"),
    ...overrides,
  };
}

function view(overrides: Partial<PurchaseView> = {}): PurchaseView {
  return {
    id: "P-1",
    status: "DRAFT",
    orderedAt: "2026-01-15T14:30:00.000Z",
    money: money(),
    shipments: [],
    ...overrides,
  };
}

const DISPATCHED = {
  id: "S-1",
  sequence: 1,
  status: "DISPATCHED" as const,
  dispatchedAt: "2026-01-16T12:00:00.000Z",
};

describe("purchaseCompletionGaps", () => {
  it("un borrador completo no reporta faltantes", () => {
    expect(purchaseCompletionGaps(view())).toEqual([]);
  });

  it("no exige importes a un borrador", () => {
    expect(purchaseCompletionGaps(view({ money: {} }))).toEqual([]);
  });

  it("exige los cinco importes al confirmar", () => {
    const gaps = purchaseCompletionGaps(view({ status: "CONFIRMED", money: {} }));
    expect(gaps.map((gap) => gap.code)).toEqual([
      "PURCHASE_PRICE_UNKNOWN",
      "US_SHIPPING_UNKNOWN",
      "US_SALES_TAX_UNKNOWN",
      "PAYMENT_FEE_UNKNOWN",
      "OTHER_COST_UNKNOWN",
    ]);
  });

  it("distingue un cero explícito de un dato ausente", () => {
    const complete = purchaseCompletionGaps(
      view({ status: "CONFIRMED", money: money({ usShippingUSD: new Decimal("0") }) }),
    );
    expect(complete).toEqual([]);

    const missing = purchaseCompletionGaps(
      view({ status: "CONFIRMED", money: money({ usShippingUSD: undefined }) }),
    );
    expect(missing.map((gap) => gap.code)).toEqual(["US_SHIPPING_UNKNOWN"]);
  });

  it("exige instante de pago y envío en la etapa pagada", () => {
    const gaps = purchaseCompletionGaps(view({ status: "PAID", shipments: [] }));
    const codes = gaps.map((gap) => gap.code);
    expect(codes).toContain("PAYMENT_INSTANT_UNKNOWN");
    expect(codes).toContain("SHIPMENT_UNKNOWN");
    expect(codes).toContain("EXPECTED_DELIVERY_UNKNOWN");
  });

  it("no reporta faltantes en una compra pagada y enviada completa", () => {
    const gaps = purchaseCompletionGaps(
      view({
        status: "PAID",
        paidAt: "2026-01-16T10:00:00.000Z",
        estimatedDeliveryAt: "2026-01-22T10:00:00.000Z",
        shipments: [DISPATCHED],
      }),
    );
    expect(gaps).toEqual([]);
  });

  it("no exime a la entrega de los requisitos de la etapa pagada", () => {
    const gaps = purchaseCompletionGaps(
      view({
        status: "DELIVERED",
        paidAt: "2026-01-16T10:00:00.000Z",
        deliveredAt: "2026-01-20T10:00:00.000Z",
        estimatedDeliveryAt: "2026-01-22T10:00:00.000Z",
        shipments: [
          { id: "S-1", sequence: 1, status: "DELIVERED", deliveredAt: "2026-01-20T10:00:00.000Z" },
        ],
      }),
    );
    expect(gaps).toEqual([]);
  });

  it("no reporta faltantes de una compra cancelada", () => {
    expect(
      purchaseCompletionGaps(
        view({ status: "CANCELLED", cancelledAt: "2026-01-16T10:00:00.000Z", cancellationReason: "proveedor" }),
      ),
    ).toEqual([]);
  });
});

describe("isPurchaseOverdue", () => {
  it("detecta el vencimiento con el instante inyectado", () => {
    expect(
      isPurchaseOverdue({ status: "IN_TRANSIT", estimatedDeliveryAt: "2026-01-19T12:00:00.000Z" }, EVALUATED_AT),
    ).toBe(true);
  });

  it("no vence si la fecha estimada sigue en el futuro", () => {
    expect(
      isPurchaseOverdue({ status: "IN_TRANSIT", estimatedDeliveryAt: "2026-01-21T12:00:00.000Z" }, EVALUATED_AT),
    ).toBe(false);
  });

  it("no vence una compra sin fecha estimada: no se puede evaluar", () => {
    expect(isPurchaseOverdue({ status: "IN_TRANSIT" }, EVALUATED_AT)).toBe(false);
  });

  it("no vence lo ya entregado ni lo cancelado", () => {
    expect(
      isPurchaseOverdue({ status: "DELIVERED", estimatedDeliveryAt: "2026-01-10T12:00:00.000Z" }, EVALUATED_AT),
    ).toBe(false);
    expect(
      isPurchaseOverdue({ status: "CANCELLED", estimatedDeliveryAt: "2026-01-10T12:00:00.000Z" }, EVALUATED_AT),
    ).toBe(false);
  });

  it("calcula los días de retraso con el instante inyectado", () => {
    expect(
      purchaseOverdueDays(
        { status: "IN_TRANSIT", estimatedDeliveryAt: "2026-01-17T12:00:00.000Z" },
        EVALUATED_AT,
      ),
    ).toBe(3);
    expect(purchaseOverdueDays({ status: "IN_TRANSIT" }, EVALUATED_AT)).toBe(0);
    expect(
      purchaseOverdueDays(
        { status: "IN_TRANSIT", estimatedDeliveryAt: "2026-01-25T12:00:00.000Z" },
        EVALUATED_AT,
      ),
    ).toBe(0);
  });

  it("no lee el reloj: el resultado depende sólo del instante inyectado", () => {
    const target = { status: "IN_TRANSIT" as const, estimatedDeliveryAt: "2026-01-19T12:00:00.000Z" };
    expect(isPurchaseOverdue(target, "2026-01-20T12:00:00.000Z")).toBe(true);
    expect(isPurchaseOverdue(target, "2026-01-19T12:00:00.000Z")).toBe(false);
  });
});

describe("nextPurchaseAction", () => {
  it("sugiere la accion segun el estado", () => {
    expect(nextPurchaseAction(view({ status: "DRAFT" }))).toBe("CONFIRM");
    expect(nextPurchaseAction(view({ status: "CONFIRMED" }))).toBe("RECORD_PAYMENT");
    expect(nextPurchaseAction(view({ status: "PAID" }))).toBe("CANCEL");
    expect(nextPurchaseAction(view({ status: "CANCELLED" }))).toBe("REOPEN");
  });

  it("no sugiere acciones en estados sin salida", () => {
    expect(nextPurchaseAction(view({ status: "IN_TRANSIT" }))).toBeUndefined();
    expect(nextPurchaseAction(view({ status: "DELIVERED" }))).toBeUndefined();
  });
});