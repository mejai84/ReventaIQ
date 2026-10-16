import { describe, expect, it } from "vitest";

import type { PurchaseEvent, PurchaseView } from "./contracts";
import { PURCHASE_EVENT_CODES } from "./contracts";
import {
  InvalidPurchaseEventPayloadError,
  InvalidPurchaseTransitionError,
  UnknownPurchaseEventError,
} from "./errors";
import {
  assertPurchaseEventPayload,
  buildPurchaseTimeline,
  deriveAutomaticEvents,
  isPurchaseEventCode,
  isUserAttributedEvent,
  summarizePurchaseTimeline,
  userEventForAction,
} from "./purchase-events";

const OCCURRED_AT = "2026-01-20T12:00:00.000Z";

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

function dispatchedShipment(sequence = 1) {
  return {
    id: `S-${sequence}`,
    sequence,
    status: "DISPATCHED" as const,
    dispatchedAt: "2026-01-16T12:00:00.000Z",
  };
}

describe("catalogo de eventos", () => {
  it("reconoce los once codigos documentados", () => {
    expect(PURCHASE_EVENT_CODES).toHaveLength(11);
    for (const code of PURCHASE_EVENT_CODES) {
      expect(isPurchaseEventCode(code), code).toBe(true);
    }
  });

  it("rechaza un codigo desconocido", () => {
    expect(isPurchaseEventCode("PURCHASE_SHIPPED")).toBe(false);
    expect(() => assertPurchaseEventPayload("PURCHASE_SHIPPED", {})).toThrow(UnknownPurchaseEventError);
  });
});

describe("assertPurchaseEventPayload", () => {
  it("acepta un payload conforme", () => {
    expect(
      assertPurchaseEventPayload("PURCHASE_CANCELLED", {
        cancelledAt: "2026-01-20T12:00:00.000Z",
        reason: "proveedor no envio",
      }),
    ).toBe("PURCHASE_CANCELLED");
  });

  it("exige los campos obligatorios", () => {
    expect(() => assertPurchaseEventPayload("PURCHASE_CANCELLED", { cancelledAt: "2026-01-20T12:00:00.000Z" })).toThrow(
      /missing required field "reason"/,
    );
    expect(() => assertPurchaseEventPayload("PAYMENT_RECORDED", { paidAt: "", paidAmountUsd: 10 })).toThrow(
      InvalidPurchaseEventPayloadError,
    );
  });

  it("rechaza campos no admitidos para impedir datos esperables", () => {
    expect(() =>
      assertPurchaseEventPayload("PURCHASE_DELIVERED", {
        deliveredAt: "2026-01-20T12:00:00.000Z",
        shipmentCount: 1,
        cardNumber: "4111111111111111",
      }),
    ).toThrow(/unexpected field "cardNumber"/);
  });

  it("admite los campos opcionales declarados", () => {
    expect(() =>
      assertPurchaseEventPayload("SHIPMENT_DISPATCHED", {
        shipmentId: "S-1",
        sequence: 1,
        status: "DISPATCHED",
        carrierName: "UPS",
        trackingNumber: "1Z",
      }),
    ).not.toThrow();
  });
});

describe("deriveAutomaticEvents", () => {
  it("rechaza una transicion invalida antes de calcular eventos", () => {
    expect(() => deriveAutomaticEvents(view(), view({ status: "DELIVERED" }), OCCURRED_AT)).toThrow(
      InvalidPurchaseTransitionError,
    );
  });

  it("rechaza un estado resultante incoherente", () => {
    const paid = view({ status: "PAID", paidAt: "2026-01-16T10:00:00.000Z" });
    const incoherent = view({ status: "IN_TRANSIT", paidAt: "2026-01-16T10:00:00.000Z", shipments: [] });
    expect(() => deriveAutomaticEvents(paid, incoherent, OCCURRED_AT)).toThrow(/dispatched shipment/);
  });

  it("emite SHIPMENT_DISPATCHED al pasar a IN_TRANSIT", () => {
    const paid = view({ status: "PAID", paidAt: "2026-01-16T10:00:00.000Z" });
    const transit = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [dispatchedShipment()],
    });

    const events = deriveAutomaticEvents(paid, transit, OCCURRED_AT);
    expect(events).toHaveLength(1);
    expect(events[0]?.code).toBe("SHIPMENT_DISPATCHED");
    expect(events[0]?.source).toBe("SYSTEM");
    expect(events[0]?.occurredAt).toBe(OCCURRED_AT);
    expect(events[0]?.payload).toMatchObject({ shipmentId: "S-1", sequence: 1 });
  });

  it("emite un evento por cada envio recien despachado", () => {
    const paid = view({ status: "PAID", paidAt: "2026-01-16T10:00:00.000Z" });
    const transit = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [dispatchedShipment(1), dispatchedShipment(2)],
    });

    const events = deriveAutomaticEvents(paid, transit, OCCURRED_AT);
    expect(events.map((event) => (event.payload as { shipmentId: string }).shipmentId)).toEqual(["S-1", "S-2"]);
  });

  it("emite PURCHASE_DELIVERED con el conteo de envios", () => {
    const transit = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [dispatchedShipment()],
    });
    const delivered = view({
      status: "DELIVERED",
      paidAt: "2026-01-16T10:00:00.000Z",
      deliveredAt: "2026-01-20T10:00:00.000Z",
      shipments: [
        {
          id: "S-1",
          sequence: 1,
          status: "DELIVERED",
          dispatchedAt: "2026-01-16T12:00:00.000Z",
          deliveredAt: "2026-01-20T10:00:00.000Z",
        },
      ],
    });

    const events = deriveAutomaticEvents(transit, delivered, OCCURRED_AT);
    expect(events).toHaveLength(1);
    expect(events[0]?.code).toBe("PURCHASE_DELIVERED");
    expect(events[0]?.payload).toMatchObject({ shipmentCount: 1, deliveredAt: "2026-01-20T10:00:00.000Z" });
  });

  it("no emite eventos para transiciones que no los requieren", () => {
    const draft = view();
    const confirmed = view({ status: "CONFIRMED" });
    expect(deriveAutomaticEvents(draft, confirmed, OCCURRED_AT)).toEqual([]);
  });

  it("usa el instante inyectado y no lee el reloj", () => {
    const paid = view({ status: "PAID", paidAt: "2026-01-16T10:00:00.000Z" });
    const transit = view({
      status: "IN_TRANSIT",
      paidAt: "2026-01-16T10:00:00.000Z",
      shipments: [dispatchedShipment()],
    });

    const first = deriveAutomaticEvents(paid, transit, "2020-01-01T00:00:00.000Z");
    const second = deriveAutomaticEvents(paid, transit, "2020-01-01T00:00:00.000Z");
    expect(first).toEqual(second);
    expect(first[0]?.occurredAt).toBe("2020-01-01T00:00:00.000Z");
  });
});

describe("userEventForAction", () => {
  it("devuelve el evento del usuario segun el estado alcanzado", () => {
    const cancelled = userEventForAction(
      view({ status: "CANCELLED" }),
      OCCURRED_AT,
      { cancelledAt: OCCURRED_AT, reason: "proveedor" },
    );
    expect(cancelled.code).toBe("PURCHASE_CANCELLED");
    expect(cancelled.source).toBe("USER");
    expect(cancelled.occurredAt).toBe(OCCURRED_AT);
  });

  it("rechaza un instante del hecho invalido", () => {
    expect(() =>
      userEventForAction(view({ status: "CANCELLED" }), "ayer", {
        cancelledAt: OCCURRED_AT,
        reason: "x",
      }),
    ).toThrow(/ISO 8601/);
  });

  it("no acepta el instante dentro del payload", () => {
    expect(() =>
      userEventForAction(view({ status: "CANCELLED" }), OCCURRED_AT, {
        occurredAt: OCCURRED_AT,
        cancelledAt: OCCURRED_AT,
        reason: "x",
      }),
    ).toThrow(/unexpected field "occurredAt"/);
  });

  it("no inventa evento para estados que deriva el sistema", () => {
    expect(() => userEventForAction(view({ status: "IN_TRANSIT" }), OCCURRED_AT, {})).toThrow(
      InvalidPurchaseTransitionError,
    );
  });
});

describe("linea de tiempo", () => {
  const events: readonly PurchaseEvent[] = [
    {
      id: "3",
      purchaseId: "P-1",
      code: "PURCHASE_DELIVERED",
      source: "SYSTEM",
      occurredAt: "2026-01-20T12:00:00.000Z",
      recordedAt: "2026-01-20T12:00:01.000Z",
      payload: {},
    },
    {
      id: "1",
      purchaseId: "P-1",
      code: "PURCHASE_CREATED",
      source: "USER",
      occurredAt: "2026-01-15T14:30:00.000Z",
      recordedAt: "2026-01-15T14:30:01.000Z",
      payload: {},
    },
    {
      id: "2",
      purchaseId: "P-1",
      code: "PAYMENT_RECORDED",
      source: "USER",
      occurredAt: "2026-01-16T10:00:00.000Z",
      recordedAt: "2026-01-16T10:00:01.000Z",
      payload: {},
    },
  ];

  it("ordena por instante del hecho, no por registro", () => {
    expect(buildPurchaseTimeline(events).map((event) => event.id)).toEqual(["1", "2", "3"]);
  });

  it("desempata por identificador de forma determinista", () => {
    const sameTime: readonly PurchaseEvent[] = [
      { ...events[0]!, id: "b", occurredAt: "2026-01-15T00:00:00.000Z" },
      { ...events[0]!, id: "a", occurredAt: "2026-01-15T00:00:00.000Z" },
    ];
    expect(buildPurchaseTimeline(sameTime).map((event) => event.id)).toEqual(["a", "b"]);
    expect(buildPurchaseTimeline(sameTime)).toEqual(buildPurchaseTimeline([...sameTime].reverse()));
  });

  it("no muta la entrada", () => {
    const input = [...events];
    buildPurchaseTimeline(input);
    expect(input.map((event) => event.id)).toEqual(["3", "1", "2"]);
  });

  it("resume la bitacora distinguiendo eventos automaticos", () => {
    const summary = summarizePurchaseTimeline(events);
    expect(summary.firstOccurredAt).toBe("2026-01-15T14:30:00.000Z");
    expect(summary.lastOccurredAt).toBe("2026-01-20T12:00:00.000Z");
    expect(summary.automaticEventCount).toBe(1);
    expect(summary.byCode.PURCHASE_DELIVERED).toBe(1);
  });

  it("resume una bitacora vacia sin inventar instantes", () => {
    const summary = summarizePurchaseTimeline([]);
    expect(summary.events).toEqual([]);
    expect(summary.firstOccurredAt).toBeUndefined();
    expect(summary.automaticEventCount).toBe(0);
  });
});

describe("atribucion de eventos", () => {
  it("un evento automatico no se atribuye a una persona", () => {
    expect(isUserAttributedEvent({ purchaseId: "P-1", code: "PURCHASE_DELIVERED", source: "SYSTEM", occurredAt: OCCURRED_AT, payload: {} })).toBe(false);
    expect(isUserAttributedEvent({ purchaseId: "P-1", code: "NOTE_ADDED", source: "USER", occurredAt: OCCURRED_AT, payload: {} })).toBe(true);
  });
});