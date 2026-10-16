import {
  type PurchaseAction,
  type PurchaseStatus,
  type PurchaseView,
} from "./contracts";
import { InvalidPurchaseStateError, InvalidPurchaseTransitionError } from "./errors";

/**
 * Máquina de estados de la compra.
 *
 * Es la única fuente de verdad sobre qué transiciones existen. La UI usa
 * `availablePurchaseActions` para no ofrecer botones que el dominio vaya a
 * rechazar, y `assertPurchaseTransition` para que el rechazo ocurra en el
 * dominio y no en un formulario.
 *
 * Tabla de transiciones (documento de diseño §8.2):
 *
 *   DRAFT      → CONFIRMED   (confirmar el pedido con el proveedor)
 *   DRAFT      → CANCELLED   (descartar el borrador)
 *   CONFIRMED  → PAID        (registrar el pago)
 *   CONFIRMED  → CANCELLED
 *   PAID       → IN_TRANSIT  (el sistema, al despacharse un envío)
 *   PAID       → CANCELLED   (con motivo obligatorio)
 *   IN_TRANSIT → DELIVERED   (el sistema, al entregarse todos los envíos)
 *   CANCELLED  → DRAFT       (reabrir, sólo si nunca se pagó)
 *   DELIVERED  → terminal
 */

/** Transiciones válidas por estado de origen. */
const TRANSITIONS: Readonly<Record<PurchaseStatus, readonly PurchaseStatus[]>> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PAID", "CANCELLED"],
  PAID: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: ["DRAFT"],
};

/** Acción de negocio que produce cada transición. */
const ACTION_TARGET: Readonly<Record<PurchaseAction, PurchaseStatus>> = {
  CONFIRM: "CONFIRMED",
  RECORD_PAYMENT: "PAID",
  MARK_IN_TRANSIT: "IN_TRANSIT",
  MARK_DELIVERED: "DELIVERED",
  CANCEL: "CANCELLED",
  REOPEN: "DRAFT",
};

export function canTransition(from: PurchaseStatus, to: PurchaseStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionsFrom(from: PurchaseStatus): readonly PurchaseStatus[] {
  return TRANSITIONS[from];
}

/** Lanza `InvalidPurchaseTransitionError` si la transición no está permitida. */
export function assertPurchaseTransition(from: PurchaseStatus, to: PurchaseStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidPurchaseTransitionError(from, to);
  }
}

/** Estados en los que no se admite ninguna transición posterior. */
export function isPurchaseTerminal(status: PurchaseStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Acciones ofrecidas al operador.
 *
 * El sistema nunca ofrece `MARK_IN_TRANSIT` ni `MARK_DELIVERED`: esos estados
 * los deriva el sistema a partir de los envíos.
 */
export function availablePurchaseActions(status: PurchaseStatus): readonly PurchaseAction[] {
  const userActions: readonly PurchaseAction[] = ["CONFIRM", "RECORD_PAYMENT", "CANCEL", "REOPEN"];
  return userActions.filter((action) => canTransition(status, ACTION_TARGET[action]));
}

/**
 * Estado resultante de aplicar una acción. Es una función pura: misma entrada,
 * mismo resultado.
 */
export function nextPurchaseStatus(current: PurchaseStatus, action: PurchaseAction): PurchaseStatus {
  const target = ACTION_TARGET[action];
  if (!canTransition(current, target)) {
    throw new InvalidPurchaseTransitionError(current, target);
  }
  return target;
}

/**
 * Los importes sólo se editan antes del pago. Después, corregirlos es un evento
 * `DATA_CORRECTED` que conserva el valor anterior, no una sobrescritura.
 */
export function canEditPurchaseAmounts(status: PurchaseStatus): boolean {
  return status === "DRAFT" || status === "CONFIRMED";
}

/** Cancelar una compra pagada se permite, pero exige motivo. */
export function canCancel(status: PurchaseStatus): boolean {
  return canTransition(status, "CANCELLED");
}

/**
 * Reabrir una compra cancelada sólo es posible si nunca se pagó: si hubo pago,
 * la operación es una devolución y pertenece a otra fase.
 */
export function canReopen(view: Pick<PurchaseView, "status" | "paidAt">): boolean {
  return canTransition(view.status, "DRAFT") && view.paidAt === undefined;
}

/* -------------------------------------------------------------------------- */
/* Coherencia entre estado y datos                                             */
/* -------------------------------------------------------------------------- */

/**
 * Invariantes que deben cumplirse en todo momento para que el estado
 * significa lo que dice.
 *
 * Se ejecuta antes de aceptar una transición, de modo que un estado imposible
 * nunca llega a persistirse.
 */
export function assertPurchaseConsistency(view: PurchaseView): void {
  const dispatched = view.shipments.filter(
    (shipment) => shipment.status !== "PENDING" && shipment.status !== "CANCELLED",
  );
  const delivered = view.shipments.filter((shipment) => shipment.status === "DELIVERED");

  switch (view.status) {
    case "DRAFT":
    case "CONFIRMED":
      break;

    case "PAID":
      if (view.paidAt === undefined) {
        throw new InvalidPurchaseStateError(view.id, "status PAID without paidAt");
      }
      break;

    case "IN_TRANSIT":
      if (dispatched.length === 0) {
        throw new InvalidPurchaseStateError(
          view.id,
          "status IN_TRANSIT without any dispatched shipment",
        );
      }
      break;

    case "DELIVERED":
      if (view.deliveredAt === undefined) {
        throw new InvalidPurchaseStateError(view.id, "status DELIVERED without deliveredAt");
      }
      if (view.shipments.length === 0 || delivered.length !== view.shipments.length) {
        throw new InvalidPurchaseStateError(
          view.id,
          "status DELIVERED while some shipment is not DELIVERED",
        );
      }
      break;

    case "CANCELLED":
      if (view.cancelledAt === undefined || view.cancellationReason === undefined) {
        throw new InvalidPurchaseStateError(
          view.id,
          "status CANCELLED requires cancelledAt and cancellationReason",
        );
      }
      break;
  }

  assertInstantsOrdered(view);
}

/** Orden temporal obligatorio entre los hitos de la compra. */
function assertInstantsOrdered(view: PurchaseView): void {
  const ordered = timestamp(view.orderedAt);
  const pairs: readonly (readonly [string, string | undefined])[] = [
    ["paidAt", view.paidAt],
    ["estimatedDeliveryAt", view.estimatedDeliveryAt],
    ["deliveredAt", view.deliveredAt],
    ["cancelledAt", view.cancelledAt],
  ];

  for (const [field, value] of pairs) {
    if (value !== undefined && timestamp(value) < ordered) {
      throw new InvalidPurchaseStateError(view.id, `${field} is before orderedAt`);
    }
  }
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new RangeError(`Invalid ISO 8601 instant: ${value}`);
  }
  return parsed;
}