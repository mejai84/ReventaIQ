import { describe, expect, it } from "vitest";

import { createShipmentSchema, updateShipmentSchema } from "./shipment-inputs";

const MINIMAL = { purchaseId: "12", sequence: 1 } as const;

function messages(result: { success: boolean; error?: { issues: readonly { message: string }[] } }): string {
  if (result.success) return "";
  return (result.error?.issues ?? []).map((issue) => issue.message).join(" | ");
}

describe("createShipmentSchema", () => {
  it("acepta un envio minimo", () => {
    const parsed = createShipmentSchema.parse(MINIMAL);
    expect(parsed.sequence).toBe(1);
    expect(parsed.status).toBeUndefined();
  });

  it("convierte costo y peso a Decimal exacto", () => {
    const parsed = createShipmentSchema.parse({
      ...MINIMAL,
      actualCostUsd: "45.905",
      actualWeightLb: "1.250",
    });
    expect(parsed.actualCostUsd?.toFixed()).toBe("45.905");
    expect(parsed.actualWeightLb?.toFixed()).toBe("1.25");
  });

  it("rechaza importes y pesos ambiguos o fuera de rango", () => {
    expect(createShipmentSchema.safeParse({ ...MINIMAL, actualCostUsd: "45,90" }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ ...MINIMAL, actualCostUsd: "-1" }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ ...MINIMAL, actualWeightLb: "0" }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ ...MINIMAL, actualWeightLb: "1.2345" }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ ...MINIMAL, actualWeightLb: "abc" }).success).toBe(false);
  });

  it("exige una secuencia entera positiva", () => {
    expect(createShipmentSchema.safeParse({ purchaseId: "12", sequence: 0 }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ purchaseId: "12", sequence: 1.5 }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ purchaseId: "12" }).success).toBe(false);
  });

  it("rechaza fechas invalidas y ordenes imposibles", () => {
    expect(createShipmentSchema.safeParse({ ...MINIMAL, dispatchedAt: "ayer" }).success).toBe(false);
    expect(
      createShipmentSchema.safeParse({
        ...MINIMAL,
        dispatchedAt: "2026-01-17T10:00:00.000Z",
        deliveredAt: "2026-01-16T10:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      createShipmentSchema.safeParse({
        ...MINIMAL,
        dispatchedAt: "2026-01-17T10:00:00.000Z",
        estimatedDeliveryAt: "2026-01-16T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("exige el instante de entrega si el envio nace entregado", () => {
    const result = createShipmentSchema.safeParse({ ...MINIMAL, status: "DELIVERED" });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/deliveredAt is required/);

    expect(
      createShipmentSchema.safeParse({
        ...MINIMAL,
        status: "DELIVERED",
        deliveredAt: "2026-01-20T10:00:00.000Z",
        dispatchedAt: "2026-01-16T10:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("no admite un envio recien nacido como cancelado", () => {
    expect(createShipmentSchema.safeParse({ ...MINIMAL, status: "CANCELLED" }).success).toBe(false);
  });

  it("exige transportista si se informa un numero de seguimiento", () => {
    const result = createShipmentSchema.safeParse({ ...MINIMAL, trackingNumber: "1Z999" });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/carrierName is required/);

    expect(
      createShipmentSchema.safeParse({ ...MINIMAL, trackingNumber: "1Z999", carrierName: "UPS" }).success,
    ).toBe(true);
  });

  it("exige un enlace https para el seguimiento", () => {
    expect(
      createShipmentSchema.safeParse({ ...MINIMAL, trackingUrl: "http://ups.com/1Z999" }).success,
    ).toBe(false);
  });

  it("rechaza campos desconocidos", () => {
    expect(createShipmentSchema.safeParse({ ...MINIMAL, deliveredBy: "el transportista" }).success).toBe(false);
    expect(createShipmentSchema.safeParse({ ...MINIMAL, purchaseid: "12" }).success).toBe(false);
  });
});

describe("updateShipmentSchema", () => {
  it("acepta un parche parcial", () => {
    expect(updateShipmentSchema.safeParse({ notes: "revisar con el transportista" }).success).toBe(true);
    expect(updateShipmentSchema.safeParse({ actualCostUsd: "48.10" }).success).toBe(true);
  });

  it("rechaza un parche vacio", () => {
    expect(updateShipmentSchema.safeParse({}).success).toBe(false);
  });

  it("no permite cambiar la identidad del envio", () => {
    expect(updateShipmentSchema.safeParse({ purchaseId: "13" }).success).toBe(false);
    expect(updateShipmentSchema.safeParse({ sequence: 2 }).success).toBe(false);
  });

  it("exige instante de entrega al marcar entregado", () => {
    const result = updateShipmentSchema.safeParse({ status: "DELIVERED" });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/deliveredAt is required/);

    expect(
      updateShipmentSchema.safeParse({ status: "DELIVERED", deliveredAt: "2026-01-20T10:00:00.000Z" }).success,
    ).toBe(true);
  });

  it("exige motivo al cancelar un envio", () => {
    const result = updateShipmentSchema.safeParse({ status: "CANCELLED" });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/notes with a reason are required/);

    expect(updateShipmentSchema.safeParse({ status: "CANCELLED", notes: "paquete perdido" }).success).toBe(true);
  });

  it("rechaza un estado de envio inexistente", () => {
    expect(updateShipmentSchema.safeParse({ status: "EN_TRANSIT" }).success).toBe(false);
    expect(updateShipmentSchema.safeParse({ status: "SHIPPED" }).success).toBe(false);
  });

  it("rechaza campos desconocidos y formatos invalidos", () => {
    expect(updateShipmentSchema.safeParse({ deliveredBy: "el transportista" }).success).toBe(false);
    expect(updateShipmentSchema.safeParse({ actualCostUsd: "48,10" }).success).toBe(false);
    expect(updateShipmentSchema.safeParse({ dispatchedAt: "2026-01-16" }).success).toBe(false);
    expect(updateShipmentSchema.safeParse({ trackingNumber: "1Z999" }).success).toBe(false);
  });
});