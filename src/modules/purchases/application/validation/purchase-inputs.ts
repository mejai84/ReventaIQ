import Decimal from "decimal.js";
import { z } from "zod";

import { PURCHASE_STATUSES } from "../../domain/contracts";
import { calculatePurchaseTotalUSD, PURCHASE_MONEY_FIELDS } from "../../domain/purchase-money";
import { canEditPurchaseAmounts } from "../../domain/purchase-status";
import {
  currencyCodeSchema,
  entityIdSchema,
  httpsUrlSchema,
  isoInstantSchema,
  optionalText,
  requireKnownFields,
  usdAmountSchema,
} from "./common";

/**
 * Validación de entrada para crear y editar una compra.
 *
 * Contrato cerrado: cualquier clave no declarada se rechaza, de modo que un
 * campo renombrado o inventado falla en el borde en lugar de guardarse en
 * silencio.
 */

/** Los cinco componentes del dinero, como texto → `Decimal`. */
export const purchaseMoneySchema = requireKnownFields({
  purchasePriceUSD: usdAmountSchema("purchasePriceUSD"),
  usShippingUSD: usdAmountSchema("usShippingUSD"),
  usSalesTaxUSD: usdAmountSchema("usSalesTaxUSD"),
  paymentFeeUSD: usdAmountSchema("paymentFeeUSD"),
  otherCostUSD: usdAmountSchema("otherCostUSD"),
});

/**
 * Componentes parciales: válidos en un borrador.
 *
 * Un componente ausente significa "no informado" y nunca se convierte en cero.
 */
export const partialPurchaseMoneySchema = purchaseMoneySchema.partial();

const referenceCodeSchema = z
  .string()
  .trim()
  .min(1, "referenceCode is required")
  .max(64, "referenceCode is too long");

const estimatedDeliveryAtSchema = isoInstantSchema.optional();
const sourceUrlSchema = httpsUrlSchema.optional();
const notesSchema = optionalText("notes").optional();

/**
 * Crear compra.
 *
 * Nace siempre en `DRAFT`: ningún otro estado es alcanzable desde la creación,
 * por eso el estado no se acepta como entrada. Un cliente que quiera confirmar
 * debe crear y luego transicionar.
 */
export const createPurchaseSchema = requireKnownFields({
  referenceCode: referenceCodeSchema,
  supplierOfferId: entityIdSchema,
  productVariantId: entityIdSchema,
  conditionGradeId: entityIdSchema,
  currencyCode: currencyCodeSchema,
  orderedAt: isoInstantSchema,
  opportunityId: entityIdSchema.optional(),
  estimatedDeliveryAt: estimatedDeliveryAtSchema,
  sourceUrl: sourceUrlSchema,
  notes: notesSchema,
  money: partialPurchaseMoneySchema.optional(),
}).refine(
  (input) =>
    input.estimatedDeliveryAt === undefined ||
    Date.parse(input.estimatedDeliveryAt) >= Date.parse(input.orderedAt),
  { message: "estimatedDeliveryAt cannot be before orderedAt", path: ["estimatedDeliveryAt"] },
);

export type CreatePurchaseInput = z.input<typeof createPurchaseSchema>;
export type CreatePurchaseInputParsed = z.output<typeof createPurchaseSchema>;

/** Campos que una edición puede tocar. El estado no se edita: se transiciona. */
const EDITABLE_FIELDS = [
  "referenceCode",
  "conditionGradeId",
  "estimatedDeliveryAt",
  "sourceUrl",
  "notes",
  "money",
] as const;

/**
 * Editar compra (parche parcial).
 *
 * - Exige al menos un campo: un parche vacío es un error de programación.
 * - No acepta `status`: los cambios de estado pasan por la transición.
 * - Si el cliente envía `currentStatus`, los importes se rechazan cuando el
 *   estado no permite editarlos, reutilizando la regla del dominio.
 */
export const editPurchaseSchema = requireKnownFields({
  referenceCode: referenceCodeSchema.optional(),
  conditionGradeId: entityIdSchema.optional(),
  estimatedDeliveryAt: estimatedDeliveryAtSchema,
  sourceUrl: sourceUrlSchema,
  notes: notesSchema,
  money: partialPurchaseMoneySchema.optional(),
  currentStatus: z.enum(PURCHASE_STATUSES).optional(),
  expectedRevision: z.number().int().positive("expectedRevision must be greater than zero").optional(),
})
  .refine(
    (input) => EDITABLE_FIELDS.some((field) => input[field] !== undefined),
    { message: "at least one editable field is required" },
  )
  .refine(
    (input) =>
      input.currentStatus === undefined ||
      canEditPurchaseAmounts(input.currentStatus) ||
      (input.money === undefined && input.estimatedDeliveryAt === undefined),
    {
      message:
        "money and estimatedDeliveryAt cannot be edited once the purchase is paid; record a DATA_CORRECTED event instead",
    },
  );

export type EditPurchaseInput = z.input<typeof editPurchaseSchema>;
export type EditPurchaseInputParsed = z.output<typeof editPurchaseSchema>;

/**
 * Contrasta un total declarado por el cliente con la suma exacta de los
 * componentes.
 *
 * Se usa al confirmar: si no coincide, alguien transcribió mal un importe y el
 * total congelado sería falso. Devuelve un mensaje, no lanza, para que el
 * esquema pueda reportarlo como un problema de campo.
 */
export function declaredTotalMismatch(
  components: z.output<typeof purchaseMoneySchema>,
  declaredTotal: Decimal,
): string | undefined {
  // Un refinamiento se evalúa aunque un campo ya haya fallado, y entonces
  // recibe `z.NEVER` en lugar de `Decimal`. Sin esta guarda, la aritmética
  // lanzaría un TypeError crudo en vez de devolver un error de validación.
  const values = PURCHASE_MONEY_FIELDS.map((field) => components[field]);
  if (!Decimal.isDecimal(declaredTotal) || !values.every((value) => Decimal.isDecimal(value))) {
    return undefined;
  }

  const exact = calculatePurchaseTotalUSD(components);
  return exact.equals(declaredTotal)
    ? undefined
    : `totalUsd must equal the exact sum of the components: ${exact.toFixed()}`;
}