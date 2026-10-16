import type { PurchaseAction, PurchaseView } from "./contracts";
import { availablePurchaseActions } from "./purchase-status";
import { type MoneyGapCode, moneyGaps } from "./purchase-money";

/**
 * Completitud y vigencia de una compra.
 *
 * Aquí vive la regla de "ausente, cero y no aplicable nunca son equivalentes":
 * un faltante se nombra, no se rellena.
 */

/**
 * Códigos de faltante. Los de dinero se reutilizan de `purchase-money` para que
 * un mismo componente ausente no reciba dos nombres distintos según quién
 * consulte.
 */
export type CompletionGapCode =
  | MoneyGapCode
  | "PAYMENT_INSTANT_UNKNOWN"
  | "SHIPPING_QUOTE_UNKNOWN"
  | "EXPECTED_DELIVERY_UNKNOWN"
  | "SHIPMENT_UNKNOWN";

export interface CompletionGap {
  readonly code: CompletionGapCode;
  readonly detail: string;
}

/**
 * Faltantes de una compra en su estado actual.
 *
 * Cada estado exige lo que le corresponde: un borrador puede estar vacío; una
 * compra confirmada necesita los cinco importes; una pagada necesita además el
 * instante del pago y un envío registrado.
 */
export function purchaseCompletionGaps(view: PurchaseView): readonly CompletionGap[] {
  const gaps: CompletionGap[] = [];

  const isPaidStage = view.status === "PAID" || view.status === "IN_TRANSIT" || view.status === "DELIVERED";
  const needsMoney =
    view.status === "CONFIRMED" || view.status === "PAID" || view.status === "IN_TRANSIT" || view.status === "DELIVERED";

  if (needsMoney) {
    for (const gap of moneyGaps(view.money)) {
      gaps.push({ code: gap.code, detail: `${gap.field} is not reported` });
    }
  }

  if (isPaidStage && view.paidAt === undefined) {
    gaps.push({
      code: "PAYMENT_INSTANT_UNKNOWN",
      detail: "paidAt is missing for a purchase that already reached the paid stage",
    });
  }

  if (isPaidStage) {
    if (view.shipments.length === 0) {
      gaps.push({ code: "SHIPMENT_UNKNOWN", detail: "no shipment registered" });
    }
    if (view.estimatedDeliveryAt === undefined) {
      gaps.push({
        code: "EXPECTED_DELIVERY_UNKNOWN",
        detail: "the supplier did not report an estimated delivery",
      });
    }
  }

  return gaps;
}

/**
 * ¿Venció la entrega estimada?
 *
 * `evaluatedAt` se inyecta: el dominio nunca lee el reloj, y una compra sin
 * fecha estimada **no** está vencida, simplemente no se puede evaluar.
 */
export function isPurchaseOverdue(
  view: Pick<PurchaseView, "status" | "estimatedDeliveryAt">,
  evaluatedAt: string,
): boolean {
  if (view.estimatedDeliveryAt === undefined) {
    return false;
  }
  if (view.status === "DELIVERED" || view.status === "CANCELLED") {
    return false;
  }
  return Date.parse(view.estimatedDeliveryAt) < Date.parse(evaluatedAt);
}

/** Dias de retraso respecto a la fecha estimada. Cero si no hay retraso. */
export function purchaseOverdueDays(
  view: Pick<PurchaseView, "status" | "estimatedDeliveryAt">,
  evaluatedAt: string,
): number {
  if (!isPurchaseOverdue(view, evaluatedAt) || view.estimatedDeliveryAt === undefined) {
    return 0;
  }
  const diff = Date.parse(evaluatedAt) - Date.parse(view.estimatedDeliveryAt);
  return Math.floor(diff / 86_400_000);
}

/**
 * Próxima acción sugerida, para el estado vacío y la franja de decisión.
 * Es una sugerencia de interfaz, no una autorización: el dominio sigue
 * validando la transición.
 */
export function nextPurchaseAction(view: PurchaseView): PurchaseAction | undefined {
  const actions = availablePurchaseActions(view.status);
  const priority: readonly PurchaseAction[] = [
    "CONFIRM",
    "RECORD_PAYMENT",
    "CANCEL",
    "REOPEN",
  ];
  return priority.find((action) => actions.includes(action));
}