import { z } from "zod";

import { PURCHASE_STATUSES } from "../../domain/contracts";
import { assertPurchaseEventPayload } from "../../domain/purchase-events";
import {
  entityIdSchema,
  isoInstantSchema,
  requiredText,
  requireKnownFields,
} from "./common";
import { partialPurchaseMoneySchema } from "./purchase-inputs";

/**
 * Validación del registro manual de un evento de compra.
 *
 * Un evento manual no es cualquier evento: sólo los que una persona puede
 * escribir por su cuenta. Los que nacen de una transición (`PURCHASE_CONFIRMED`,
 * `PAYMENT_RECORDED`, `SHIPMENT_DISPATCHED`, `PURCHASE_DELIVERED`,
 * `PURCHASE_CANCELLED`, `PURCHASE_REOPENED`) los genera el caso de uso cuando
 * cambia el estado; aceptarlos como carga libre permitiría saltarse la máquina
 * de estados y escribir una bitácora que no ocurrió.
 */
export const MANUAL_EVENT_CODES = [
  "PURCHASE_CREATED",
  "DATA_CORRECTED",
  "NOTE_ADDED",
] as const;

export type ManualEventCode = (typeof MANUAL_EVENT_CODES)[number];

const createdPayloadSchema = requireKnownFields({
  status: z.enum(PURCHASE_STATUSES),
  components: partialPurchaseMoneySchema.optional(),
});

const correctedPayloadSchema = requireKnownFields({
  /** Campo corregido, por nombre de columna o de DTO. */
  field: requiredText("field", 120),
  /** Valores previos y nuevos como texto, porque la bitácora es JSONB. */
  previousValue: requiredText("previousValue", 500),
  newValue: requiredText("newValue", 500),
  note: requiredText("note", 500).optional(),
});

const notePayloadSchema = requireKnownFields({
  note: requiredText("note", 2000),
});

/**
 * Unión discriminada por código. Cada payload es estricto y coincide con el
 * contrato del evento declarado en `purchase-events.ts`, que además se
 * comprueba en el refinamiento final.
 */
const manualEventUnion = z.discriminatedUnion("code", [
  requireKnownFields({
    purchaseId: entityIdSchema,
    code: z.literal("PURCHASE_CREATED"),
    occurredAt: isoInstantSchema,
    payload: createdPayloadSchema,
  }),
  requireKnownFields({
    purchaseId: entityIdSchema,
    code: z.literal("DATA_CORRECTED"),
    occurredAt: isoInstantSchema,
    payload: correctedPayloadSchema,
  }),
  requireKnownFields({
    purchaseId: entityIdSchema,
    code: z.literal("NOTE_ADDED"),
    occurredAt: isoInstantSchema,
    payload: notePayloadSchema,
  }),
]);

export const registerManualEventSchema = manualEventUnion.superRefine((input, ctx) => {
  // Última línea de defensa: el payload también cumple el contrato del dominio.
  try {
    assertPurchaseEventPayload(input.code, input.payload as Record<string, unknown>);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "payload does not match the event contract",
      path: ["payload"],
    });
  }
});

export type RegisterManualEventInput = z.input<typeof registerManualEventSchema>;
export type RegisterManualEventInputParsed = z.output<typeof registerManualEventSchema>;

/** ¿Es un evento que sólo puede producir el sistema? */
export function isSystemOnlyEventCode(code: string): boolean {
  return (
    code === "SHIPMENT_DISPATCHED" ||
    code === "SHIPMENT_EXCEEDED_ESTIMATE" ||
    code === "PURCHASE_DELIVERED" ||
    code === "PURCHASE_CONFIRMED" ||
    code === "PAYMENT_RECORDED" ||
    code === "SHIPMENT_STATUS_CHANGED" ||
    code === "PURCHASE_CANCELLED" ||
    code === "PURCHASE_REOPENED"
  );
}