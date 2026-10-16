import { describe, expect, it } from "vitest";

import { InvalidPurchaseStateError, InvalidPurchaseTransitionError } from "./errors";
import {
  type PurchaseStatus,
  type PurchaseView,
  PURCHASE_STATUSES,
} from "./contracts";
import {
  assertPurchaseConsistency,
  assertPurchaseTransition,
  availablePurchaseActions,
  canCancel,
  canEditPurchaseAmounts,
  canReopen,
  canTransition,
  isPurchaseTerminal,
  nextPurchaseStatus,
  transitionsFrom,
} from "./purchase-status";

function view(overrides: Partial<PurchaseView> = {}): PurchaseView {
  return {
    id: "P-1",
    status: "DRAFT",
    orderedAt: "2026-01-15T14:30:00.000Z",
    money: {},
    shipments: [],
    ...overrides,
  };
}

describe("tabla de transiciones", () => {
  it("permite exactamente las transiciones documentadas", () => {
    expect(transitionsFrom("DRAFT")).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(transitionsFrom("CONFIRMED")).toEqual(["PAID", "CANCELLED"]);
    expect(transitionsFrom("PAID")).toEqual(["IN_TRANSIT", "CANCELLED"]);
    expect(transitionsFrom("IN_TRANSIT")).toEqual(["DELIVERED"]);
    expect(transitionsFrom("CANCELLED")).toEqual(["DRAFT"]);
    expect(transitionsFrom("DELIVERED")).toEqual([]);
  });

  it("rechaza cualquier transición no documentada", () => {
    const allowed = new Set<string>(["DRAFT|CONFIRMED", "DRAFT|CANCELLED", "CONFIRMED|PAID", "CONFIRMED|CANCELLED", "PAID|IN_TRANSIT", "PAID|CANCELLED", "IN_TRANSIT|DELIVERED", "CANCELLED|DRAFT"]);

    const rejected: string[] = [];
    for (const from of PURCHASE_STATUSES) {
      for (const to of PURCHASE_STATUSES) {
        if (!allowed.has(`${from}|${to}`)) {
          expect(canTransition(from, to), `${from} -> ${to}`).toBe(false);
          rejected.push(`${from}->${to}`);
        }
      }
    }
    // 6 estados: 36 combinaciones, 8 válidas.
    expect(rejected).toHaveLength(28);
  });

  it("lanza un error de dominio con origen y destino", () => {
    expect(() => assertPurchaseTransition("DRAFT", "DELIVERED")).toThrow(InvalidPurchaseTransitionError);
    try {
      assertPurchaseTransition("DRAFT", "PAID");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseTransitionError);
      const typed = error as InvalidPurchaseTransitionError;
      expect(typed.from).toBe("DRAFT");
      expect(typed.to).toBe("PAID");
    }
  });

  it("no permite saltarse el pago", () => {
    expect(canTransition("DRAFT", "PAID")).toBe(false);
    expect(canTransition("CONFIRMED", "IN_TRANSIT")).toBe(false);
    expect(canTransition("DRAFT", "IN_TRANSIT")).toBe(false);
  });

  it("no permite delivered hacia atrás", () => {
    expect(canTransition("DELIVERED", "IN_TRANSIT")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
  });
});

describe("acciones disponibles", () => {
  it("nunca ofrece las transiciones que deriva el sistema", () => {
    for (const status of PURCHASE_STATUSES) {
      const actions = availablePurchaseActions(status);
      expect(actions).not.toContain("MARK_IN_TRANSIT");
      expect(actions).not.toContain("MARK_DELIVERED");
    }
  });

  it("ofrece sólo acciones que el estado admite", () => {
    expect(availablePurchaseActions("DRAFT")).toEqual(["CONFIRM", "CANCEL"]);
    expect(availablePurchaseActions("CONFIRMED")).toEqual(["RECORD_PAYMENT", "CANCEL"]);
    expect(availablePurchaseActions("PAID")).toEqual(["CANCEL"]);
    expect(availablePurchaseActions("IN_TRANSIT")).toEqual([]);
    expect(availablePurchaseActions("DELIVERED")).toEqual([]);
    expect(availablePurchaseActions("CANCELLED")).toEqual(["REOPEN"]);
  });

  it("resuelve el estado siguiente de forma pura", () => {
    expect(nextPurchaseStatus("DRAFT", "CONFIRM")).toBe("CONFIRMED");
    expect(nextPurchaseStatus("CONFIRMED", "RECORD_PAYMENT")).toBe("PAID");
    expect(nextPurchaseStatus("CANCELLED", "REOPEN")).toBe("DRAFT");
    expect(() => nextPurchaseStatus("DRAFT", "RECORD_PAYMENT")).toThrow(InvalidPurchaseTransitionError);
  });
});

describe("estados terminales y edición de importes", () => {
  it("sólo DELIVERED es terminal sin salida", () => {
    expect(isPurchaseTerminal("DELIVERED")).toBe(true);
    expect(isPurchaseTerminal("IN_TRANSIT")).toBe(false);
    expect(isPurchaseTerminal("CANCELLED")).toBe(false);
  });

  it("permite editar importes sólo antes del pago", () => {
    expect(canEditPurchaseAmounts("DRAFT")).toBe(true);
    expect(canEditPurchaseAmounts("CONFIRMED")).toBe(true);
    expect(canEditPurchaseAmounts("PAID")).toBe(false);
    expect(canEditPurchaseAmounts("IN_TRANSIT")).toBe(false);
    expect(canEditPurchaseAmounts("DELIVERED")).toBe(false);
  });

  it("permite cancelar mientras haya salida y reabrir sólo sin pago", () => {
    expect(canCancel("DRAFT")).toBe(true);
    expect(canCancel("IN_TRANSIT")).toBe(false);

    expect(canReopen({ status: "CANCELLED", paidAt: undefined })).toBe(true);
    expect(canReopen({ status: "CANCELLED", paidAt: "2026-01-16T10:00:00.000Z" })).toBe(false);
    expect(canReopen({ status: "DRAFT", paidAt: undefined })).toBe(false);
  });
});

describe("coherencia entre estado y datos", () => {
  it("acepta un borrador sin importes ni envíos", () => {
    expect(() => assertPurchaseConsistency(view())).not.toThrow();
  });

  it("rechaza PAID sin paidAt", () => {
    expect(() => assertPurchaseConsistency(view({ status: "PAID" }))).toThrow(InvalidPurchaseStateError);
  });

  it("rechaza IN_TRANSIT sin ningún envío despachado", () => {
    const v = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [{ id: "S-1", sequence: 1, status: "PENDING" }],
    });
    expect(() => assertPurchaseConsistency(v)).toThrow(/dispatched shipment/);
  });

  it("acepta IN_TRANSIT con un envío despachado", () => {
    const v = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [
        { id: "S-1", sequence: 1, status: "DISPATCHED", dispatchedAt: "2026-01-16T12:00:00.000Z" },
      ],
    });
    expect(() => assertPurchaseConsistency(v)).not.toThrow();
  });

  it("rechaza DELIVERED con envíos sin entregar", () => {
    const v = view({
      status: "DELIVERED",
      paidAt: "2026-01-16T10:00:00.000Z",
      deliveredAt: "2026-01-20T10:00:00.000Z",
      shipments: [
        { id: "S-1", sequence: 1, status: "DELIVERED", deliveredAt: "2026-01-20T10:00:00.000Z" },
        { id: "S-2", sequence: 2, status: "IN_CUSTOMS" },
      ],
    });
    expect(() => assertPurchaseConsistency(v)).toThrow(/not DELIVERED/);
  });

  it("rechaza DELIVERED sin deliveredAt", () => {
    const v = view({
      status: "DELIVERED",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [{ id: "S-1", sequence: 1, status: "DELIVERED" }],
    });
    expect(() => assertPurchaseConsistency(v)).toThrow(/deliveredAt/);
  });

  it("rechaza CANCELLED sin motivo", () => {
    expect(() => assertPurchaseConsistency(view({ status: "CANCELLED", cancelledAt: "2026-01-16T10:00:00.000Z" }))).toThrow(
      InvalidPurchaseStateError,
    );
    expect(() =>
      assertPurchaseConsistency(
        view({ status: "CANCELLED", cancelledAt: "2026-01-16T10:00:00.000Z", cancellationReason: "proveedor" }),
      ),
    ).not.toThrow();
  });

  it("rechaza hitos anteriores al pedido", () => {
    const v = view({ status: "PAID", paidAt: "2026-01-14T10:00:00.000Z" });
    expect(() => assertPurchaseConsistency(v)).toThrow(/before orderedAt/);
  });

  it("rechaza un instante inválido", () => {
    const v = view({ orderedAt: "15/01/2026" });
    expect(() => assertPurchaseConsistency(v)).toThrow(RangeError);
  });

  it("es determinista: mismos datos, mismo resultado", () => {
    const v = view({ status: "CONFIRMED" });
    expect(() => assertPurchaseConsistency(v)).not.toThrow();
    expect(() => assertPurchaseConsistency(v)).not.toThrow();
  });

  it("acepta cada estado con sus invariantes satisfechas", () => {
    const paid = view({ status: "PAID", paidAt: "2026-01-16T10:00:00.000Z" });
    const transit = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [{ id: "S-1", sequence: 1, status: "IN_CUSTOMS", dispatchedAt: "2026-01-16T12:00:00.000Z" }],
    });
    const delivered = view({
      status: "DELIVERED",
      paidAt: "2026-01-16T10:00:00.000Z",
      deliveredAt: "2026-01-20T10:00:00.000Z",
      shipments: [{ id: "S-1", sequence: 1, status: "DELIVERED", dispatchedAt: "2026-01-16T12:00:00.000Z", deliveredAt: "2026-01-20T10:00:00.000Z" }],
    });

    for (const v of [paid, transit, delivered]) {
      expect(() => assertPurchaseConsistency(v), v.status).not.toThrow();
    }
  });
});

describe("tipos de estado", () => {
  it("cubre los seis estados documentados", () => {
    const all: readonly PurchaseStatus[] = PURCHASE_STATUSES;
    expect(all).toHaveLength(6);
    expect(new Set(all).size).toBe(6);
  });
});