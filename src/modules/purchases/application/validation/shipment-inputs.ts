import { z } from "zod";

import { SHIPMENT_STATUSES } from "../../domain/contracts";
import {
  entityIdSchema,
  isoInstantSchema,
  optionalText,
  requireKnownFields,
  usdAmountSchema,
  weightLbSchema,
} from "./common";

/**
 * Validación de entrada para crear y actualizar envíos.
 *
 * Un envío identifica una unidad en tránsito de una compra. La compra no se
 * puede cambiar desde aquí: la identidad del envío es estable y su relación
 * con la compra tampoco se edita.
 */

/**
 * Estado inicial permitido.
 *
 * `CANCELLED` se excluye porque un envío no nace cancelado: se cancela, y esa
 * decisión deja evento. `DELIVERED` sí se admite para registrar una entrega
 * retrospective, siempre con su instante.
 */
export const INITIAL_SHIPMENT_STATUSES = [
  "PENDING",
  "DISPATCHED",
  "IN_CUSTOMS",
  "OUT_FOR_DELIVERY",
  "EXCEPTION",
  "DELIVERED",
] as const;

const carrierNameSchema = optionalText("carrierName", 200).optional();
const trackingNumberSchema = optionalText("trackingNumber", 200).optional();
const trackingUrlSchema = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/, "trackingUrl must be an https URL")
  .optional();
const dispatchedAtSchema = isoInstantSchema.optional();
const estimatedDeliveryAtSchema = isoInstantSchema.optional();
const deliveredAtSchema = isoInstantSchema.optional();
const actualCostUsdSchema = usdAmountSchema("actualCostUsd").optional();

export const createShipmentSchema = requireKnownFields({
  purchaseId: entityIdSchema,
  sequence: z.number().int().positive("sequence must be greater than zero"),
  status: z.enum(INITIAL_SHIPMENT_STATUSES).optional(),
  shippingProviderId: entityIdSchema.optional(),
  shippingQuoteId: entityIdSchema.optional(),
  carrierName: carrierNameSchema,
  trackingNumber: trackingNumberSchema,
  trackingUrl: trackingUrlSchema,
  dispatchedAt: dispatchedAtSchema,
  estimatedDeliveryAt: estimatedDeliveryAtSchema,
  deliveredAt: deliveredAtSchema,
  actualCostUsd: actualCostUsdSchema,
  actualWeightLb: weightLbSchema.optional(),
  notes: optionalText("notes").optional(),
})
  .refine((input) => input.status !== "DELIVERED" || input.deliveredAt !== undefined, {
    message: "deliveredAt is required when the shipment is created as DELIVERED",
    path: ["deliveredAt"],
  })
  .refine(
    (input) =>
      input.dispatchedAt === undefined ||
      input.deliveredAt === undefined ||
      Date.parse(input.deliveredAt) >= Date.parse(input.dispatchedAt),
    { message: "deliveredAt cannot be before dispatchedAt", path: ["deliveredAt"] },
  )
  .refine(
    (input) =>
      input.dispatchedAt === undefined ||
      input.estimatedDeliveryAt === undefined ||
      Date.parse(input.estimatedDeliveryAt) >= Date.parse(input.dispatchedAt),
    { message: "estimatedDeliveryAt cannot be before dispatchedAt", path: ["estimatedDeliveryAt"] },
  )
  .refine(
    (input) => input.trackingNumber === undefined || input.carrierName !== undefined,
    {
      message: "carrierName is required when a tracking number is provided",
      path: ["carrierName"],
    },
  );

export type CreateShipmentInput = z.input<typeof createShipmentSchema>;
export type CreateShipmentInputParsed = z.output<typeof createShipmentSchema>;

/**
 * Actualizar envío (parche parcial).
 *
 * `purchaseId`, `sequence` y `status` no son editables aquí:
 * - `purchaseId` y `sequence` fijan la identidad y su unicidad;
 * - `status` cambia por la máquina de estados del envío, no por un parche libre.
 */
export const updateShipmentSchema = requireKnownFields({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  shippingProviderId: entityIdSchema.optional(),
  shippingQuoteId: entityIdSchema.optional(),
  carrierName: carrierNameSchema,
  trackingNumber: trackingNumberSchema,
  trackingUrl: trackingUrlSchema,
  dispatchedAt: dispatchedAtSchema,
  estimatedDeliveryAt: estimatedDeliveryAtSchema,
  deliveredAt: deliveredAtSchema,
  actualCostUsd: actualCostUsdSchema,
  actualWeightLb: weightLbSchema.optional(),
  notes: optionalText("notes").optional(),
})
  .refine((input) => Object.keys(input).length > 0, {
    message: "at least one field is required",
  })
  .refine((input) => input.status !== "DELIVERED" || input.deliveredAt !== undefined, {
    message: "deliveredAt is required when the status becomes DELIVERED",
    path: ["deliveredAt"],
  })
  .refine((input) => input.status !== "CANCELLED" || input.notes !== undefined, {
    message: "notes with a reason are required when a shipment is cancelled",
    path: ["notes"],
  })
  .refine(
    (input) =>
      input.dispatchedAt === undefined ||
      input.deliveredAt === undefined ||
      Date.parse(input.deliveredAt) >= Date.parse(input.dispatchedAt),
    { message: "deliveredAt cannot be before dispatchedAt", path: ["deliveredAt"] },
  )
  .refine(
    (input) => input.trackingNumber === undefined || input.carrierName !== undefined,
    {
      message: "carrierName is required when a tracking number is provided",
      path: ["carrierName"],
    },
  );

export type UpdateShipmentInput = z.input<typeof updateShipmentSchema>;
export type UpdateShipmentInputParsed = z.output<typeof updateShipmentSchema>;