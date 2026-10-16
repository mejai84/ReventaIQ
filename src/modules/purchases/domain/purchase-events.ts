import {
  type EventPayloadContract,
  type EventSource,
  PURCHASE_EVENT_CODES,
  type PurchaseEvent,
  type PurchaseEventCode,
  type PurchaseStatus,
  type PurchaseView,
  type NewPurchaseEvent,
} from "./contracts";
import {
  InvalidPurchaseEventPayloadError,
  InvalidPurchaseTransitionError,
  UnknownPurchaseEventError,
} from "./errors";
import { assertPurchaseConsistency, assertPurchaseTransition } from "./purchase-status";

/**
 * Eventos de la compra: catálogo, derivación automática, línea de tiempo y
 * validación de payload.
 *
 * Principio: el evento es la fuente de verdad de "qué pasó". La capa de
 * aplicación escribe estado y evento en la misma transacción; este módulo sólo
 * calcula qué eventos corresponden a una transición.
 */

/* -------------------------------------------------------------------------- */
/* Catálogo                                                                    */
/* -------------------------------------------------------------------------- */

const EVENT_CODES: ReadonlySet<string> = new Set<string>(PURCHASE_EVENT_CODES);

export function isPurchaseEventCode(value: string): value is PurchaseEventCode {
  return EVENT_CODES.has(value);
}

export function assertPurchaseEventCode(value: string): PurchaseEventCode {
  if (!isPurchaseEventCode(value)) {
    throw new UnknownPurchaseEventError(value);
  }
  return value;
}

/**
 * Forma de cada payload: qué campos son obligatorios y cuáles admitidos.
 *
 * Es un contrato cerrado y explícito, no un `Record<string, unknown>` libre:
 * impide que se cuele un dato sensible o una forma inventada en la bitácora.
 */
const PAYLOAD_CONTRACTS: Readonly<Record<PurchaseEventCode, EventPayloadContract>> = {
  PURCHASE_CREATED: { required: ["status"], optional: ["components"] },
  PURCHASE_CONFIRMED: { required: ["components", "totalUsd"], optional: [] },
  PAYMENT_RECORDED: { required: ["paidAt", "paidAmountUsd"], optional: [] },
  SHIPMENT_DISPATCHED: {
    required: ["shipmentId", "sequence", "status"],
    optional: ["carrierName", "trackingNumber", "dispatchedAt"],
  },
  SHIPMENT_STATUS_CHANGED: {
    required: ["shipmentId", "previousStatus", "status"],
    optional: [],
  },
  SHIPMENT_EXCEEDED_ESTIMATE: {
    required: ["shipmentId", "estimatedAt", "actualAt"],
    optional: ["actualCostUsd"],
  },
  PURCHASE_DELIVERED: { required: ["deliveredAt", "shipmentCount"], optional: [] },
  PURCHASE_CANCELLED: { required: ["cancelledAt", "reason"], optional: [] },
  PURCHASE_REOPENED: { required: ["reason"], optional: [] },
  DATA_CORRECTED: { required: ["field", "previousValue", "newValue"], optional: ["note"] },
  NOTE_ADDED: { required: ["note"], optional: [] },
};

export function purchaseEventPayloadContract(
  code: PurchaseEventCode,
): EventPayloadContract {
  return PAYLOAD_CONTRACTS[code];
}

/**
 * Valida el payload contra el contrato del evento.
 * Falla si falta un campo obligatorio, sobra uno no admitido o el valor es vacío.
 */
export function assertPurchaseEventPayload(
  code: string,
  payload: Readonly<Record<string, unknown>>,
): PurchaseEventCode {
  const eventCode = assertPurchaseEventCode(code);
  const contract = PAYLOAD_CONTRACTS[eventCode];

  for (const field of contract.required) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      throw new InvalidPurchaseEventPayloadError(eventCode, `missing required field "${field}"`);
    }
  }

  const allowed = new Set([...contract.required, ...contract.optional]);
  for (const field of Object.keys(payload)) {
    if (!allowed.has(field)) {
      throw new InvalidPurchaseEventPayloadError(eventCode, `unexpected field "${field}"`);
    }
  }

  return eventCode;
}

/* -------------------------------------------------------------------------- */
/* Eventos automáticos                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Calcula los eventos que corresponden a pasar de `from` a `to`.
 *
 * Es puro y no lee el reloj: `occurredAt` lo inyecta quien llama. Falla si la
 * transición no es válida o si el estado resultante es incoherente, de modo que
 * un estado imposible nunca llegue a persistirse junto a un evento válido.
 */
export function deriveAutomaticEvents(
  from: PurchaseView,
  to: PurchaseView,
  occurredAt: string,
): readonly NewPurchaseEvent[] {
  assertPurchaseTransition(from.status, to.status);
  assertPurchaseConsistency(to);

  const events: NewPurchaseEvent[] = [];
  const push = (code: PurchaseEventCode, payload: Readonly<Record<string, unknown>>) => {
    assertPurchaseEventPayload(code, payload);
    events.push({ purchaseId: to.id, code, source: "SYSTEM", occurredAt, payload });
  };

  switch (to.status) {
    case "IN_TRANSIT": {
      const newlyDispatched = to.shipments.filter(
        (shipment) => shipment.status === "DISPATCHED" && shipment.dispatchedAt !== undefined,
      );
      for (const shipment of newlyDispatched) {
        push("SHIPMENT_DISPATCHED", {
          shipmentId: shipment.id,
          sequence: shipment.sequence,
          status: shipment.status,
          dispatchedAt: shipment.dispatchedAt,
        });
      }
      break;
    }

    case "DELIVERED": {
      push("PURCHASE_DELIVERED", {
        deliveredAt: to.deliveredAt,
        shipmentCount: to.shipments.length,
      });
      break;
    }

    case "DRAFT":
    case "CONFIRMED":
    case "PAID":
    case "CANCELLED":
      break;
  }

  return events;
}

/**
 * Eventos que registra una persona al aplicar una acción.
 *
 * El instante del hecho es un parámetro aparte, igual que en
 * `deriveAutomaticEvents`: es metadato del evento y no forma parte de su
 * payload, que es un contrato cerrado de datos del hecho.
 */
export function userEventForAction(
  to: PurchaseView,
  occurredAt: string,
  payload: Readonly<Record<string, unknown>>,
): NewPurchaseEvent {
  const code = EVENT_FOR_TARGET[to.status];
  if (code === undefined) {
    throw new InvalidPurchaseTransitionError("(user action)", to.status, "no user event for this state");
  }

  assertInstant(occurredAt);
  assertPurchaseEventPayload(code, payload);

  return {
    purchaseId: to.id,
    code,
    source: "USER",
    occurredAt,
    payload,
  };
}

const EVENT_FOR_TARGET: Readonly<Partial<Record<PurchaseStatus, PurchaseEventCode>>> = {
  CONFIRMED: "PURCHASE_CONFIRMED",
  PAID: "PAYMENT_RECORDED",
  CANCELLED: "PURCHASE_CANCELLED",
  DRAFT: "PURCHASE_REOPENED",
};

function assertInstant(value: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new InvalidPurchaseEventPayloadError("occurredAt", "occurredAt must be an ISO 8601 instant");
  }
}

/* -------------------------------------------------------------------------- */
/* Línea de tiempo                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Ordena los eventos de forma determinista: por `occurredAt` y, ante empate,
 * por identificador. Dos llamadas con la misma entrada dan el mismo resultado.
 */
export function buildPurchaseTimeline(events: readonly PurchaseEvent[]): readonly PurchaseEvent[] {
  return [...events].sort((left, right) => {
    const byTime = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    if (byTime !== 0) {
      return byTime;
    }
    return left.id.localeCompare(right.id);
  });
}

/** Resumen de la bitácora para la franja de decisión y la UI. */
export interface PurchaseTimelineSummary {
  readonly events: readonly PurchaseEvent[];
  readonly firstOccurredAt?: string | undefined;
  readonly lastOccurredAt?: string | undefined;
  readonly automaticEventCount: number;
  readonly byCode: Readonly<Partial<Record<PurchaseEventCode, number>>>;
}

export function summarizePurchaseTimeline(
  events: readonly PurchaseEvent[],
): PurchaseTimelineSummary {
  const timeline = buildPurchaseTimeline(events);
  const byCode: Partial<Record<PurchaseEventCode, number>> = {};
  let automaticEventCount = 0;

  for (const event of timeline) {
    byCode[event.code] = (byCode[event.code] ?? 0) + 1;
    if (event.source === "SYSTEM") {
      automaticEventCount += 1;
    }
  }

  const first = timeline[0];
  const last = timeline[timeline.length - 1];

  return {
    events: timeline,
    firstOccurredAt: first?.occurredAt,
    lastOccurredAt: last?.occurredAt,
    automaticEventCount,
    byCode,
  };
}

/** ¿El origen del evento es coherente con quién puede firmarlo? */
export function isUserAttributedEvent(event: NewPurchaseEvent): boolean {
  const source: EventSource = event.source;
  return source !== "SYSTEM";
}