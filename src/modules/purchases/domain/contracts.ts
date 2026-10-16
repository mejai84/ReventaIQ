import type Decimal from "decimal.js";

/**
 * Contratos de dominio del módulo de compras (Fase A).
 *
 * Son **vistas estrechas**, no entidades persistentes. El módulo de aplicación
 * (tu frente) decide cómo materializarlas desde Prisma; el dominio razona
 * sobre estas estructuras sin saber nada de tablas, ORM ni framework.
 *
 * Ver `docs/architecture/purchases-fiscal-phase-a-design.md`.
 */

/* -------------------------------------------------------------------------- */
/* Estados                                                                     */
/* -------------------------------------------------------------------------- */

/** Ciclo de vida de la compra. Estados estables: candidatos a enum. */
export const PURCHASE_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PAID",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  "PENDING",
  "DISPATCHED",
  "IN_CUSTOMS",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "CANCELLED",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** Quién origina el hecho. Un evento automático no tiene usuario. */
export const EVENT_SOURCES = ["USER", "SYSTEM", "IMPORT"] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

/* -------------------------------------------------------------------------- */
/* Componentes monetarios                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Componentes del dinero pagado. Todos en USD.
 *
 * Un componente ausente es "no informado", nunca cero: por eso son
 * `| undefined` y no opcionales. La suma exige los cinco.
 */
export interface PurchaseMoneyComponents {
  readonly purchasePriceUSD?: Decimal | undefined;
  readonly usShippingUSD?: Decimal | undefined;
  readonly usSalesTaxUSD?: Decimal | undefined;
  readonly paymentFeeUSD?: Decimal | undefined;
  readonly otherCostUSD?: Decimal | undefined;
}

/* -------------------------------------------------------------------------- */
/* Vistas                                                                     */
/* -------------------------------------------------------------------------- */

export interface PurchaseShipmentView {
  readonly id: string;
  readonly sequence: number;
  readonly status: ShipmentStatus;
  readonly dispatchedAt?: string | undefined;
  readonly deliveredAt?: string | undefined;
}

/** Vista mínima de una compra para razonar sobre su ciclo de vida. */
export interface PurchaseView {
  readonly id: string;
  readonly status: PurchaseStatus;
  readonly orderedAt: string;
  readonly paidAt?: string | undefined;
  readonly estimatedDeliveryAt?: string | undefined;
  readonly deliveredAt?: string | undefined;
  readonly cancelledAt?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly money: PurchaseMoneyComponents;
  readonly shipments: readonly PurchaseShipmentView[];
}

/* -------------------------------------------------------------------------- */
/* Eventos                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Catálogo de eventos. Es texto validado, no enum de base de datos: crece por
 * fases sin requerir una migración.
 */
export const PURCHASE_EVENT_CODES = [
  "PURCHASE_CREATED",
  "PURCHASE_CONFIRMED",
  "PAYMENT_RECORDED",
  "SHIPMENT_DISPATCHED",
  "SHIPMENT_STATUS_CHANGED",
  "SHIPMENT_EXCEEDED_ESTIMATE",
  "PURCHASE_DELIVERED",
  "PURCHASE_CANCELLED",
  "PURCHASE_REOPENED",
  "DATA_CORRECTED",
  "NOTE_ADDED",
] as const;

export type PurchaseEventCode = (typeof PURCHASE_EVENT_CODES)[number];

/** Campos obligatorios y prohibidos de cada payload. */
export interface EventPayloadContract {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

export interface PurchaseEvent {
  readonly id: string;
  readonly purchaseId: string;
  readonly code: PurchaseEventCode;
  readonly source: EventSource;
  /** Hecho: cuándo ocurrió. */
  readonly occurredAt: string;
  /** Registro: cuándo se escribió. */
  readonly recordedAt: string;
  readonly createdByUserId?: string | undefined;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Evento a escribir, sin identificador ni marca de registro. */
export interface NewPurchaseEvent {
  readonly purchaseId: string;
  readonly code: PurchaseEventCode;
  readonly source: EventSource;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Acciones                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Acción de negocio aplicada por una persona. Cada acción tiene una
 * transición y un evento asociados, de modo que la UI nunca ofrezca una acción
 * que el dominio vaya a rechazar.
 */
export const PURCHASE_ACTIONS = [
  "CONFIRM",
  "RECORD_PAYMENT",
  "MARK_IN_TRANSIT",
  "MARK_DELIVERED",
  "CANCEL",
  "REOPEN",
] as const;

export type PurchaseAction = (typeof PURCHASE_ACTIONS)[number];

