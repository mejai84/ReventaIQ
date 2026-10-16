import { describe, expect, it } from "vitest";

import {
  declaredTargetMismatchMessage,
  purchaseTransitionSchema,
  transitionNotAllowedMessage,
} from "./purchase-transition";

const EVALUATED_AT = "2026-01-16T10:00:00.000Z";

const COMPONENTS = {
  purchasePriceUSD: "410",
  usShippingUSD: "12.99",
  usSalesTaxUSD: "0",
  paymentFeeUSD: "29.9",
  otherCostUSD: "0",
} as const;

const CONFIRM = {
  purchaseId: "12",
  from: "DRAFT",
  action: "CONFIRM",
  evaluatedAt: EVALUATED_AT,
  payload: { components: COMPONENTS, totalUsd: "452.89" },
} as const;

/** Elimina claves para comprobar que son obligatorias. */
function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...(value as Record<string, unknown>) };
  delete copy[key as string];
  return copy as Omit<T, K>;
}

function messages(result: { success: boolean; error?: { issues: readonly { message: string; path: readonly PropertyKey[] }[] } }): string {
  if (result.success) return "";
  return (result.error?.issues ?? [])
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(" | ");
}

describe("transiciones permitidas", () => {
  it("acepta confirmar un borrador con total coherente", () => {
    const parsed = purchaseTransitionSchema.parse(CONFIRM);
    expect(parsed.action).toBe("CONFIRM");
    if (parsed.action !== "CONFIRM") throw new Error("se esperaba CONFIRM");
    expect(parsed.payload.totalUsd.toFixed()).toBe("452.89");
  });

  it("acepta registrar el pago desde CONFIRMED", () => {
    const parsed = purchaseTransitionSchema.parse({
      purchaseId: "12",
      from: "CONFIRMED",
      action: "RECORD_PAYMENT",
      evaluatedAt: EVALUATED_AT,
      payload: { paidAt: "2026-01-16T09:00:00.000Z", paidAmountUsd: "452.89" },
    });
    expect(parsed.action).toBe("RECORD_PAYMENT");
    if (parsed.action !== "RECORD_PAYMENT") throw new Error("se esperaba RECORD_PAYMENT");
    expect(parsed.payload.paidAmountUsd.toFixed()).toBe("452.89");
  });

  it("acepta cancelar desde CONFIRMED con motivo", () => {
    const parsed = purchaseTransitionSchema.parse({
      purchaseId: "12",
      from: "CONFIRMED",
      action: "CANCEL",
      evaluatedAt: EVALUATED_AT,
      payload: { cancelledAt: "2026-01-16T09:00:00.000Z", reason: "el proveedor no envio" },
    });
    expect(parsed.action).toBe("CANCEL");
    if (parsed.action !== "CANCEL") throw new Error("se esperaba CANCEL");
    expect(parsed.payload.reason).toBe("el proveedor no envio");
  });

  it("acepta reabrir una compra cancelada sin pago", () => {
    const parsed = purchaseTransitionSchema.parse({
      purchaseId: "12",
      from: "CANCELLED",
      action: "REOPEN",
      evaluatedAt: EVALUATED_AT,
      payload: { reason: "el proveedor confirmo el envio" },
    });
    expect(parsed.action).toBe("REOPEN");
  });

  it("acepta el destino declarado cuando coincide con la accion", () => {
    expect(purchaseTransitionSchema.safeParse({ ...CONFIRM, to: "CONFIRMED" }).success).toBe(true);
  });
});

describe("transiciones no permitidas", () => {
  it("rechaza confirmar una compra ya confirmada", () => {
    const result = purchaseTransitionSchema.safeParse({ ...CONFIRM, from: "CONFIRMED" });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/action CONFIRM is not allowed from status CONFIRMED/);
  });

  it("rechaza registrar el pago de un borrador sin confirmar", () => {
    const result = purchaseTransitionSchema.safeParse({
      purchaseId: "12",
      from: "DRAFT",
      action: "RECORD_PAYMENT",
      evaluatedAt: EVALUATED_AT,
      payload: { paidAt: EVALUATED_AT, paidAmountUsd: "452.89" },
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/not allowed from status DRAFT/);
  });

  it("rechaza reabrir una compra pagada", () => {
    const result = purchaseTransitionSchema.safeParse({
      purchaseId: "12",
      from: "PAID",
      action: "REOPEN",
      evaluatedAt: EVALUATED_AT,
      payload: { reason: "me equivoque" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una accion inexistente", () => {
    const result = purchaseTransitionSchema.safeParse({ ...CONFIRM, action: "MARK_DELIVERED" });
    expect(result.success).toBe(false);
  });

  it("exige el estado de origen", () => {
    expect(purchaseTransitionSchema.safeParse(omit(CONFIRM, "from")).success).toBe(false);
    expect(purchaseTransitionSchema.safeParse(omit(CONFIRM, "evaluatedAt")).success).toBe(false);
  });

  it("rechaza un destino declarado que no corresponde a la accion", () => {
    const result = purchaseTransitionSchema.safeParse({ ...CONFIRM, to: "DELIVERED" });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/leads to CONFIRMED, not DELIVERED/);
  });

  it("expone el veredicto como funcion pura para reutilizarlo", () => {
    expect(transitionNotAllowedMessage("DRAFT", "CONFIRM")).toBeUndefined();
    expect(transitionNotAllowedMessage("DRAFT", "RECORD_PAYMENT")).toMatch(/not allowed/);
    expect(declaredTargetMismatchMessage("DRAFT", "CONFIRM", "CONFIRMED")).toBeUndefined();
    expect(declaredTargetMismatchMessage("DRAFT", "CONFIRM", "CANCELLED")).toMatch(/leads to CONFIRMED/);
  });
});

describe("payloads de transicion", () => {
  it("rechaza un total que no coincide con la suma de componentes", () => {
    const result = purchaseTransitionSchema.safeParse({
      ...CONFIRM,
      payload: { components: COMPONENTS, totalUsd: "450.00" },
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/totalUsd must equal the exact sum/);
  });

  it("rechaza componentes incompletos al confirmar", () => {
    const result = purchaseTransitionSchema.safeParse({
      ...CONFIRM,
      payload: {
        components: { purchasePriceUSD: "410", usShippingUSD: "12.99" },
        totalUsd: "422.99",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza importes ambiguos en el payload", () => {
    const result = purchaseTransitionSchema.safeParse({
      ...CONFIRM,
      payload: {
        components: { ...COMPONENTS, paymentFeeUSD: "29,90" },
        totalUsd: "452.89",
      },
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/without separators/);
  });

  it("no revienta cuando un componente ya fallo y el total tampoco cuadra", () => {
    const result = purchaseTransitionSchema.safeParse({
      ...CONFIRM,
      payload: {
        components: { ...COMPONENTS, usShippingUSD: "12,99" },
        totalUsd: "450.00",
      },
    });
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/without separators/);
  });

  it("exige motivo al cancelar", () => {
    const result = purchaseTransitionSchema.safeParse({
      purchaseId: "12",
      from: "CONFIRMED",
      action: "CANCEL",
      evaluatedAt: EVALUATED_AT,
      payload: { cancelledAt: EVALUATED_AT, reason: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza campos desconocidos en el payload", () => {
    const result = purchaseTransitionSchema.safeParse({
      ...CONFIRM,
      payload: { components: COMPONENTS, totalUsd: "452.89", cardNumber: "4111" },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una fecha de pago invalida", () => {
    const result = purchaseTransitionSchema.safeParse({
      purchaseId: "12",
      from: "CONFIRMED",
      action: "RECORD_PAYMENT",
      evaluatedAt: EVALUATED_AT,
      payload: { paidAt: "ayer", paidAmountUsd: "452.89" },
    });
    expect(result.success).toBe(false);
  });
});