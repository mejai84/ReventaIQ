import { describe, expect, it } from "vitest";

import { PURCHASE_EVENT_CODES } from "../../domain/contracts";
import { MANUAL_EVENT_CODES, isSystemOnlyEventCode, registerManualEventSchema } from "./purchase-event-input";

function messages(result: { success: boolean; error?: { issues: readonly { message: string }[] } }): string {
  if (result.success) return "";
  return (result.error?.issues ?? []).map((issue) => issue.message).join(" | ");
}

describe("eventos manuales admitidos", () => {
  it("registra la creacion", () => {
    const parsed = registerManualEventSchema.parse({
      purchaseId: "12",
      code: "PURCHASE_CREATED",
      occurredAt: "2026-01-15T15:00:00.000Z",
      payload: { status: "DRAFT" },
    });
    expect(parsed.code).toBe("PURCHASE_CREATED");
  });

  it("registra una nota", () => {
    expect(
      registerManualEventSchema.safeParse({
        purchaseId: "12",
        code: "NOTE_ADDED",
        occurredAt: "2026-01-16T09:00:00.000Z",
        payload: { note: "el proveedor pidio esperar 48 horas" },
      }).success,
    ).toBe(true);
  });

  it("registra una correccion de datos con valor anterior y nuevo", () => {
    expect(
      registerManualEventSchema.safeParse({
        purchaseId: "12",
        code: "DATA_CORRECTED",
        occurredAt: "2026-01-16T09:00:00.000Z",
        payload: { field: "purchasePriceUSD", previousValue: "410,00", newValue: "419.99" },
      }).success,
    ).toBe(true);
  });

  it("acepta componentes parciales en el evento de creacion", () => {
    expect(
      registerManualEventSchema.safeParse({
        purchaseId: "12",
        code: "PURCHASE_CREATED",
        occurredAt: "2026-01-15T15:00:00.000Z",
        payload: { status: "DRAFT", components: { purchasePriceUSD: "410" } },
      }).success,
    ).toBe(true);
  });
});

describe("eventos no permitidos como carga manual", () => {
  it("rechaza los eventos que produce una transicion", () => {
    const forbidden = [
      "PURCHASE_CONFIRMED",
      "PAYMENT_RECORDED",
      "SHIPMENT_DISPATCHED",
      "SHIPMENT_STATUS_CHANGED",
      "SHIPMENT_EXCEEDED_ESTIMATE",
      "PURCHASE_DELIVERED",
      "PURCHASE_CANCELLED",
      "PURCHASE_REOPENED",
    ] as const;

    for (const code of forbidden) {
      const result = registerManualEventSchema.safeParse({
        purchaseId: "12",
        code,
        occurredAt: "2026-01-16T09:00:00.000Z",
        payload: {},
      });
      expect(result.success, code).toBe(false);
      expect(isSystemOnlyEventCode(code), code).toBe(true);
    }
  });

  it("rechaza un codigo inexistente", () => {
    const result = registerManualEventSchema.safeParse({
      purchaseId: "12",
      code: "PURCHASE_SHIPPED",
      occurredAt: "2026-01-16T09:00:00.000Z",
      payload: { note: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("deja fuera del conjunto manual exactamente los eventos no manuales", () => {
    const manual = new Set<string>(MANUAL_EVENT_CODES);
    const derived = PURCHASE_EVENT_CODES.filter((code) => !manual.has(code));
    expect(derived).toHaveLength(8);
    for (const code of derived) {
      expect(isSystemOnlyEventCode(code), code).toBe(true);
    }
  });
});

describe("payloads de eventos manuales", () => {
  it("exige los campos del contrato del evento", () => {
    const result = registerManualEventSchema.safeParse({
      purchaseId: "12",
      code: "DATA_CORRECTED",
      occurredAt: "2026-01-16T09:00:00.000Z",
      payload: { field: "purchasePriceUSD" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una nota vacia", () => {
    const result = registerManualEventSchema.safeParse({
      purchaseId: "12",
      code: "NOTE_ADDED",
      occurredAt: "2026-01-16T09:00:00.000Z",
      payload: { note: "   " },
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/note is required/);
  });

  it("rechaza campos desconocidos que el contrato no declara", () => {
    const result = registerManualEventSchema.safeParse({
      purchaseId: "12",
      code: "NOTE_ADDED",
      occurredAt: "2026-01-16T09:00:00.000Z",
      payload: { note: "revisar", creditCard: "4111" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un instante invalido o sin zona horaria", () => {
    for (const bad of ["ayer", "2026-01-16", "2026-02-31T10:00:00Z"]) {
      const result = registerManualEventSchema.safeParse({
        purchaseId: "12",
        code: "NOTE_ADDED",
        occurredAt: bad,
        payload: { note: "x" },
      });
      expect(result.success, bad).toBe(false);
    }
  });

  it("rechaza un purchaseId no numerico", () => {
    expect(
      registerManualEventSchema.safeParse({
        purchaseId: "abc",
        code: "NOTE_ADDED",
        occurredAt: "2026-01-16T09:00:00.000Z",
        payload: { note: "x" },
      }).success,
    ).toBe(false);
  });

  it("rechaza campos de control que no pertenecen a la entrada", () => {
    expect(
      registerManualEventSchema.safeParse({
        purchaseId: "12",
        code: "NOTE_ADDED",
        occurredAt: "2026-01-16T09:00:00.000Z",
        payload: { note: "x" },
        source: "SYSTEM",
      }).success,
    ).toBe(false);
  });
});