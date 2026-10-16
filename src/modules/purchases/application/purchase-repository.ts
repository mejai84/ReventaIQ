import type Decimal from "decimal.js";

import type {
  NewPurchaseEvent,
  PurchaseEvent,
  PurchaseShipmentView,
  PurchaseStatus,
  PurchaseView,
  ShipmentStatus,
} from "../domain";

/** Puerto de persistencia de Fase A, independiente de Prisma y Next.js. */
export interface PurchaseRepository {
  transaction<T>(operation: (transaction: PurchaseTransaction) => Promise<T>): Promise<T>;
  findById(id: string): Promise<PurchaseAggregate | undefined>;
  list(query: PurchaseListQuery): Promise<PurchaseListPage>;
}

/** Las transiciones y sus eventos se escriben en la misma transacción. */
export interface PurchaseTransaction {
  createPurchase(input: NewPurchaseRecord): Promise<PurchaseAggregate>;
  updatePurchase(input: PurchaseUpdate): Promise<PurchaseAggregate>;
  appendEvents(events: readonly NewPurchaseEvent[], createdByUserId?: string): Promise<readonly PurchaseEvent[]>;
  createShipment(input: NewShipmentRecord): Promise<PurchaseShipmentRecord>;
  updateShipment(input: ShipmentUpdate): Promise<PurchaseShipmentRecord>;
}

export interface PurchaseAggregate extends PurchaseView {
  readonly referenceCode: string;
  readonly createdByUserId: string;
  readonly supplierId: string;
  readonly supplierOfferId: string;
  readonly opportunityId?: string | undefined;
  readonly productVariantId: string;
  readonly conditionGradeId: string;
  readonly currencyCode: "USD";
  readonly totalPaidUSD?: Decimal | undefined;
  readonly revision: number;
  readonly sourceUrl?: string | undefined;
  readonly notes?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly events: readonly PurchaseEvent[];
  readonly shipmentRecords: readonly PurchaseShipmentRecord[];
}

export interface PurchaseShipmentRecord extends PurchaseShipmentView {
  readonly purchaseId: string;
  readonly shippingProviderId?: string | undefined;
  readonly shippingQuoteId?: string | undefined;
  readonly carrierName?: string | undefined;
  readonly trackingNumber?: string | undefined;
  readonly trackingUrl?: string | undefined;
  readonly estimatedDeliveryAt?: string | undefined;
  readonly actualCostUSD?: Decimal | undefined;
  readonly actualWeightLb?: Decimal | undefined;
  readonly notes?: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewPurchaseRecord {
  readonly createdByUserId: string;
  readonly referenceCode: string;
  readonly supplierId: string;
  readonly supplierOfferId: string;
  readonly opportunityId?: string | undefined;
  readonly productVariantId: string;
  readonly conditionGradeId: string;
  readonly orderedAt: string;
  readonly money: PurchaseView["money"];
  readonly estimatedDeliveryAt?: string | undefined;
  readonly sourceUrl?: string | undefined;
  readonly notes?: string | undefined;
}

/** expectedRevision implementa concurrencia optimista; evita editar silenciosamente. */
export interface PurchaseUpdate {
  readonly id: string;
  readonly expectedRevision: number;
  readonly status?: PurchaseStatus | undefined;
  readonly money?: PurchaseView["money"] | undefined;
  readonly totalPaidUSD?: Decimal | undefined;
  readonly paidAt?: string | undefined;
  readonly estimatedDeliveryAt?: string | undefined;
  readonly deliveredAt?: string | undefined;
  readonly cancelledAt?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly notes?: string | undefined;
}

export interface NewShipmentRecord {
  readonly purchaseId: string;
  readonly sequence: number;
  readonly shippingProviderId?: string | undefined;
  readonly shippingQuoteId?: string | undefined;
  readonly carrierName?: string | undefined;
  readonly trackingNumber?: string | undefined;
  readonly trackingUrl?: string | undefined;
  readonly estimatedDeliveryAt?: string | undefined;
  readonly actualCostUSD?: Decimal | undefined;
  readonly actualWeightLb?: Decimal | undefined;
  readonly notes?: string | undefined;
}

export interface ShipmentUpdate {
  readonly id: string;
  readonly status?: ShipmentStatus | undefined;
  readonly dispatchedAt?: string | undefined;
  readonly deliveredAt?: string | undefined;
  readonly estimatedDeliveryAt?: string | undefined;
  readonly actualCostUSD?: Decimal | undefined;
  readonly actualWeightLb?: Decimal | undefined;
  readonly trackingNumber?: string | undefined;
  readonly trackingUrl?: string | undefined;
  readonly notes?: string | undefined;
}

export interface PurchaseListQuery {
  readonly createdByUserId: string;
  readonly status?: PurchaseStatus | undefined;
  readonly supplierId?: string | undefined;
  readonly productVariantId?: string | undefined;
  readonly cursor?: PurchaseListCursor | undefined;
  readonly limit: number;
}

/** Cursor estable para `created_at DESC, id DESC`; no usa OFFSET. */
export interface PurchaseListCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface PurchaseListPage {
  readonly items: readonly PurchaseListItem[];
  readonly nextCursor?: PurchaseListCursor | undefined;
}

export interface PurchaseListItem {
  readonly id: string;
  readonly referenceCode: string;
  readonly status: PurchaseStatus;
  readonly supplierId: string;
  readonly productVariantId: string;
  readonly totalPaidUSD?: Decimal | undefined;
  readonly currencyCode: "USD";
  readonly orderedAt: string;
  readonly estimatedDeliveryAt?: string | undefined;
  readonly createdAt: string;
}
