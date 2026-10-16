import { z } from "zod";

import { PURCHASE_STATUSES, type PurchaseStatus } from "../../domain/contracts";
import { availablePurchaseActions, nextPurchaseStatus } from "../../domain/purchase-status";
import {
  entityIdSchema,
  isoInstantSchema,
  requireKnownFields,
  requiredText,
  usdAmountSchema,
} from "./common";
import { declaredTotalMismatch, purchaseMoneySchema } from "./purchase-inputs";

/**
 * Validación de la transición de estado de una compra.
 *
 * La lista de transiciones permitidas vive en el dominio
 * (`purchase-status.ts`); este esquema la reutiliza, de modo que un esquema y
 * el dominio no pueden divergir. La UI y la acción de servidor reciben aquí el
 * mismo veredicto que aplicará el motor.
 */

const purchaseStatusSchema = z.enum(PURCHASE_STATUSES);

/** Componentes + total declarado, exigidos al confirmar. */
const confirmPayloadSchema = requireKnownFields({
  components: purchaseMoneySchema,
  totalUsd: usdAmountSchema("totalUsd"),
}).refine((input) => declaredTotalMismatch(input.components, input.totalUsd) === undefined, {
  message: "totalUsd must equal the exact sum of the components",
  path: ["totalUsd"],
});

const paymentPayloadSchema = requireKnownFields({
  paidAt: isoInstantSchema,
  paidAmountUsd: usdAmountSchema("paidAmountUsd"),
});

const cancelPayloadSchema = requireKnownFields({
  cancelledAt: isoInstantSchema,
  reason: requiredText("reason", 500),
});

const reopenPayloadSchema = requireKnownFields({
  reason: requiredText("reason", 500),
});

/** Campos comunes a cualquier transición. */
const transitionBase = {
  purchaseId: entityIdSchema,
  /** Estado en el que el cliente cree que está la compra. */
  from: purchaseStatusSchema,
  /**
   * Estado destino esperado, opcional.
   *
   * Si viene, se contrasta con el que deriva la acción: evita que una acción y
   * un destino discrepen.
   */
  to: purchaseStatusSchema.optional(),
  /** Inyección del instante actual: la validación no lee el reloj. */
  evaluatedAt: isoInstantSchema,
} as const;

/**
 * Unión discriminada por acción. Cada rama declara el payload que exige el
 * contrato del evento correspondiente en el dominio.
 *
 * El refinamiento final aplica la tabla de transiciones del dominio: la
 * validación y el motor dan el mismo veredicto.
 */
const transitionUnion = z.discriminatedUnion("action", [
  requireKnownFields({ ...transitionBase, action: z.literal("CONFIRM"), payload: confirmPayloadSchema }),
  requireKnownFields({ ...transitionBase, action: z.literal("RECORD_PAYMENT"), payload: paymentPayloadSchema }),
  requireKnownFields({ ...transitionBase, action: z.literal("CANCEL"), payload: cancelPayloadSchema }),
  requireKnownFields({ ...transitionBase, action: z.literal("REOPEN"), payload: reopenPayloadSchema }),
]);

export const purchaseTransitionSchema = transitionUnion.superRefine((input, ctx) => {
  const notAllowed = transitionNotAllowedMessage(input.from, input.action);
  if (notAllowed !== undefined) {
    ctx.addIssue({ code: "custom", message: notAllowed, path: ["action"] });
  }

  if (input.to !== undefined) {
    const mismatch = declaredTargetMismatchMessage(input.from, input.action, input.to);
    if (mismatch !== undefined) {
      ctx.addIssue({ code: "custom", message: mismatch, path: ["to"] });
    }
  }
});

export type PurchaseTransitionInput = z.input<typeof purchaseTransitionSchema>;
export type PurchaseTransitionInputParsed = z.output<typeof purchaseTransitionSchema>;

/**
 * Verifica que la acción sea válida desde `from`, reutilizando la tabla del
 * dominio. Devuelve un mensaje o `undefined`, para reportarlo como problema de
 * campo en lugar de lanzar.
 */
export function transitionNotAllowedMessage(
  from: PurchaseStatus,
  action: "CONFIRM" | "RECORD_PAYMENT" | "CANCEL" | "REOPEN",
): string | undefined {
  return availablePurchaseActions(from).includes(action)
    ? undefined
    : `action ${action} is not allowed from status ${from}`;
}

/**
 * Compara el destino declarado con el que deriva la acción.
 */
export function declaredTargetMismatchMessage(
  from: PurchaseStatus,
  action: "CONFIRM" | "RECORD_PAYMENT" | "CANCEL" | "REOPEN",
  declaredTo: PurchaseStatus,
): string | undefined {
  let derived: PurchaseStatus;
  try {
    derived = nextPurchaseStatus(from, action);
  } catch {
    // La acción no es válida: lo reporta transitionNotAllowedMessage.
    return undefined;
  }
  return derived === declaredTo
    ? undefined
    : `action ${action} from ${from} leads to ${derived}, not ${declaredTo}`;
}