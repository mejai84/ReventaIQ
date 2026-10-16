import Decimal from "decimal.js";

import type { NewPurchaseRecord, NewShipmentRecord, PurchaseAggregate, PurchaseListPage, PurchaseListQuery, PurchaseRepository, PurchaseTransaction, PurchaseUpdate, ShipmentUpdate } from "../application/purchase-repository";

import type { PurchaseEvent as DomainPurchaseEvent } from "../domain";
import type { PurchaseEventCode } from "../domain";
import { prisma } from "@/lib/db";

function d(value: unknown): Decimal | undefined {
  if (value === null || value === undefined) return undefined;
  return new Decimal(String(value));
}

function iso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return new Date(value as string | Date).toISOString();
}

function agg(p: Record<string, unknown>, events: Array<Record<string, unknown>>, shipments: Array<Record<string, unknown>>): PurchaseAggregate {
  if ("referenceCode" in (p as object)) {
    // already aggregate-shaped; not expected
  }
  return {
    id: String(p.id),
    status: p.status as PurchaseAggregate["status"],
    orderedAt: new Date(p.orderedAt as string | Date).toISOString(),
    paidAt: iso(p.paidAt),
    estimatedDeliveryAt: iso(p.estimatedDeliveryAt),
    deliveredAt: iso(p.deliveredAt),
    cancelledAt: iso(p.cancelledAt),
    cancellationReason: (p.cancellationReason as string | null) ?? undefined,
    money: {
      purchasePriceUSD: d(p.purchasePriceUsd),
      usShippingUSD: d(p.usShippingUsd),
      usSalesTaxUSD: d(p.usSalesTaxUsd),
      paymentFeeUSD: d(p.paymentFeeUsd),
      otherCostUSD: d(p.otherCostUsd),
    },
    shipments: shipments
      .slice()
      .sort((a, b) => (a.sequence as number) - (b.sequence as number))
      .map((s) => ({ id: String(s.id), status: s.status as PurchaseAggregate["shipments"][number]["status"], sequence: s.sequence as number, dispatchedAt: iso(s.dispatchedAt), deliveredAt: iso(s.deliveredAt) })),
    referenceCode: p.referenceCode as string,
    createdByUserId: String(p.createdByUserId),
    supplierId: String(p.supplierId),
    supplierOfferId: String(p.supplierOfferId),
    opportunityId: (p.opportunityId === null ? undefined : String(p.opportunityId)),
    productVariantId: String(p.productVariantId),
    conditionGradeId: String(p.conditionGradeId),
    currencyCode: p.currencyCode as "USD",
    totalPaidUSD: d(p.totalPaidUsd),
    revision: p.revision as number,
    sourceUrl: (p.sourceUrl as string | null) ?? undefined,
    notes: (p.notes as string | null) ?? undefined,
    createdAt: new Date(p.createdAt as string | Date).toISOString(),
    updatedAt: new Date(p.updatedAt as string | Date).toISOString(),
    events: events
      .slice()
      .sort((a, b) => new Date(a.occurredAt as string | Date).getTime() - new Date(b.occurredAt as string | Date).getTime())
      .map((e) => ({
        id: String(e.id),
        purchaseId: String(e.purchaseId),
        code: e.eventCode as unknown as PurchaseAggregate["events"][number]["code"],
        source: e.source as unknown as PurchaseAggregate["events"][number]["source"],
        occurredAt: new Date(e.occurredAt as string | Date).toISOString(),
        recordedAt: new Date(e.recordedAt as string | Date).toISOString(),
        createdByUserId: (e.createdByUserId === null ? undefined : String(e.createdByUserId)),
        payload: ((e.payload as Record<string, unknown>) ?? {}) as PurchaseAggregate["events"][number]["payload"],
      })),
    shipmentRecords: shipments
      .slice()
      .sort((a, b) => (a.sequence as number) - (b.sequence as number))
      .map((s) => ({
        id: String(s.id),
        status: s.status as unknown as PurchaseAggregate["shipmentRecords"][number]["status"],
        sequence: s.sequence as number,
        dispatchedAt: iso(s.dispatchedAt),
        deliveredAt: iso(s.deliveredAt),
        estimatedDeliveryAt: iso(s.estimatedDeliveryAt),
        actualCostUSD: d(s.actualCostUsd),
        actualWeightLb: d(s.actualWeightLb),
        trackingNumber: (s.trackingNumber as string | null) ?? undefined,
        trackingUrl: (s.trackingUrl as string | null) ?? undefined,
        carrierName: (s.carrierName as string | null) ?? undefined,
        shippingProviderId: (s.shippingProviderId === null ? undefined : String(s.shippingProviderId)),
        shippingQuoteId: (s.shippingQuoteId === null ? undefined : String(s.shippingQuoteId)),
        notes: (s.notes as string | null) ?? undefined,
        purchaseId: String(s.purchaseId),
        createdAt: new Date(s.createdAt as string | Date).toISOString(),
        updatedAt: new Date(s.updatedAt as string | Date).toISOString(),
      })),
  };
}

function purchaseCreateData(input: NewPurchaseRecord): Record<string, unknown> {
  const data: Record<string, unknown> = {
    createdByUserId: BigInt(input.createdByUserId),
    referenceCode: input.referenceCode,
    supplierId: BigInt(input.supplierId),
    supplierOfferId: BigInt(input.supplierOfferId),
    productVariantId: BigInt(input.productVariantId),
    conditionGradeId: BigInt(input.conditionGradeId),
    currencyCode: "USD",
    status: "DRAFT",
    orderedAt: new Date(input.orderedAt),
  };
  if (input.opportunityId !== undefined) data.opportunityId = BigInt(input.opportunityId);
  if (input.estimatedDeliveryAt !== undefined) data.estimatedDeliveryAt = new Date(input.estimatedDeliveryAt);
  if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
  if (input.notes !== undefined) data.notes = input.notes;
  const m = input.money;
  if (m.purchasePriceUSD !== undefined) data.purchasePriceUsd = m.purchasePriceUSD.toString();
  if (m.usShippingUSD !== undefined) data.usShippingUsd = m.usShippingUSD.toString();
  if (m.usSalesTaxUSD !== undefined) data.usSalesTaxUsd = m.usSalesTaxUSD.toString();
  if (m.paymentFeeUSD !== undefined) data.paymentFeeUsd = m.paymentFeeUSD.toString();
  if (m.otherCostUSD !== undefined) data.otherCostUsd = m.otherCostUSD.toString();
  return data;
}

export const prismaPurchaseRepository: PurchaseRepository = {
  async transaction<T>(operation: (transaction: PurchaseTransaction) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      const t: PurchaseTransaction = {
        async createPurchase(input) {
          const row = await tx.purchase.create({ data: purchaseCreateData(input) as never });
          const p = await tx.purchase.findUnique({ where: { id: row.id } });
          const events = await tx.purchaseEvent.findMany({ where: { purchaseId: row.id } });
          const shipments = await tx.shipment.findMany({ where: { purchaseId: row.id } });
          return agg(p as never, events as never, shipments as never);
        },
        async updatePurchase(input) {
          const cur = await tx.purchase.findUnique({ where: { id: BigInt(input.id) } });
          if (cur === null || cur.revision !== input.expectedRevision) throw new Error("expected revision mismatch");
          const data: Record<string, unknown> = { revision: cur.revision + 1 };
          if (input.status !== undefined) data.status = input.status;
          if (input.money !== undefined) {
            const m = input.money;
            if (m.purchasePriceUSD !== undefined) data.purchasePriceUsd = m.purchasePriceUSD.toString();
            if (m.usShippingUSD !== undefined) data.usShippingUsd = m.usShippingUSD.toString();
            if (m.usSalesTaxUSD !== undefined) data.usSalesTaxUsd = m.usSalesTaxUSD.toString();
            if (m.paymentFeeUSD !== undefined) data.paymentFeeUsd = m.paymentFeeUSD.toString();
            if (m.otherCostUSD !== undefined) data.otherCostUsd = m.otherCostUSD.toString();
          }
          if (input.totalPaidUSD !== undefined) data.totalPaidUsd = input.totalPaidUSD.toString();
          if (input.paidAt !== undefined) data.paidAt = (input.paidAt === null ? null : new Date(input.paidAt));
          if (input.estimatedDeliveryAt !== undefined) data.estimatedDeliveryAt = (input.estimatedDeliveryAt === null ? null : new Date(input.estimatedDeliveryAt));
          if (input.deliveredAt !== undefined) data.deliveredAt = (input.deliveredAt === null ? null : new Date(input.deliveredAt));
          if (input.cancelledAt !== undefined) data.cancelledAt = (input.cancelledAt === null ? null : new Date(input.cancelledAt));
          if (input.cancellationReason !== undefined) data.cancellationReason = input.cancellationReason;
          if (input.notes !== undefined) data.notes = input.notes;
          await tx.purchase.update({ where: { id: BigInt(input.id) }, data: data as never });
          const p = await tx.purchase.findUnique({ where: { id: BigInt(input.id) } });
          const events = await tx.purchaseEvent.findMany({ where: { purchaseId: BigInt(input.id) } });
          const shipments = await tx.shipment.findMany({ where: { purchaseId: BigInt(input.id) } });
          return agg(p as never, events as never, shipments as never);
        },
        async appendEvents(events, createdByUserId) {
          if (events.length === 0) return [];
          await tx.purchaseEvent.createMany({
            data: events.map((e) => ({
              purchaseId: BigInt(e.purchaseId),
              eventCode: e.code,
              source: e.source,
              occurredAt: new Date(e.occurredAt),
              createdByUserId: createdByUserId !== undefined ? BigInt(createdByUserId) : null,
              payload: e.payload as unknown as never,
            })) as never,
          });
          const ids = await tx.purchaseEvent.findMany({
            where: { purchaseId: BigInt(events[0]?.purchaseId ?? "0") },
            orderBy: { id: "desc" },
            take: events.length,
          });
          return ids.map((e: Record<string, unknown>) => ({
            id: String(e.id),
            purchaseId: String(e.purchaseId),
            code: e.eventCode as unknown as PurchaseEventCode,
            source: e.source as unknown as "USER" | "SYSTEM" | "IMPORT",
            occurredAt: new Date(e.occurredAt as string | Date).toISOString(),
            recordedAt: new Date(e.recordedAt as string | Date).toISOString(),
            createdByUserId: e.createdByUserId === null ? undefined : String(e.createdByUserId),
            payload: ((e.payload as Record<string, unknown>) ?? {}) as DomainPurchaseEvent["payload"],
          }));
        },
        async createShipment(input) {
          const row = await tx.shipment.create({
            data: {
              purchaseId: BigInt(input.purchaseId),
              sequence: input.sequence,
              status: "PENDING",
              shippingProviderId: input.shippingProviderId !== undefined ? BigInt(input.shippingProviderId) : undefined,
              shippingQuoteId: input.shippingQuoteId !== undefined ? BigInt(input.shippingQuoteId) : undefined,
              carrierName: input.carrierName,
              trackingNumber: input.trackingNumber,
              trackingUrl: input.trackingUrl,
              estimatedDeliveryAt: input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt) : undefined,
              actualCostUsd: (input.actualCostUSD !== undefined ? input.actualCostUSD.toString() : undefined),
              actualWeightLb: (input.actualWeightLb !== undefined ? input.actualWeightLb.toString() : undefined),
              notes: input.notes,
            } as never,
          });
          return {
            id: String(row.id),
            status: row.status as unknown as PurchaseAggregate["shipmentRecords"][number]["status"],
            sequence: row.sequence as unknown as number,
            dispatchedAt: undefined,
            deliveredAt: undefined,
            estimatedDeliveryAt: iso(row.estimatedDeliveryAt),
            actualCostUSD: d(row.actualCostUsd),
            actualWeightLb: d(row.actualWeightLb),
            trackingNumber: row.trackingNumber ?? undefined,
            trackingUrl: row.trackingUrl ?? undefined,
            carrierName: row.carrierName ?? undefined,
            shippingProviderId: row.shippingProviderId === null ? undefined : String(row.shippingProviderId),
            shippingQuoteId: row.shippingQuoteId === null ? undefined : String(row.shippingQuoteId),
            notes: row.notes ?? undefined,
            purchaseId: String(row.purchaseId),
            createdAt: new Date(row.createdAt).toISOString(),
            updatedAt: new Date(row.updatedAt).toISOString(),
          };
        },
        async updateShipment(input) {
          const data: Record<string, unknown> = {};
          if (input.status !== undefined) data.status = input.status;
          if (input.dispatchedAt !== undefined) data.dispatchedAt = new Date(input.dispatchedAt);
          if (input.deliveredAt !== undefined) data.deliveredAt = new Date(input.deliveredAt);
          if (input.estimatedDeliveryAt !== undefined) data.estimatedDeliveryAt = input.estimatedDeliveryAt === null ? null : new Date(input.estimatedDeliveryAt as string);
          if (input.actualCostUSD !== undefined) data.actualCostUsd = (input.actualCostUSD === null ? null : input.actualCostUSD.toString());
          if (input.actualWeightLb !== undefined) data.actualWeightLb = (input.actualWeightLb === null ? null : input.actualWeightLb.toString());
          if (input.trackingNumber !== undefined) data.trackingNumber = input.trackingNumber;
          if (input.trackingUrl !== undefined) data.trackingUrl = input.trackingUrl;
          if (input.notes !== undefined) data.notes = input.notes;
          const row = await tx.shipment.update({ where: { id: BigInt(input.id) }, data: data as never });
          return {
            id: String(row.id),
            status: row.status as unknown as PurchaseAggregate["shipmentRecords"][number]["status"],
            sequence: row.sequence as unknown as number,
            dispatchedAt: iso(row.dispatchedAt),
            deliveredAt: iso(row.deliveredAt),
            estimatedDeliveryAt: iso(row.estimatedDeliveryAt),
            actualCostUSD: d(row.actualCostUsd),
            actualWeightLb: d(row.actualWeightLb),
            trackingNumber: row.trackingNumber ?? undefined,
            trackingUrl: row.trackingUrl ?? undefined,
            carrierName: row.carrierName ?? undefined,
            shippingProviderId: row.shippingProviderId === null ? undefined : String(row.shippingProviderId),
            shippingQuoteId: row.shippingQuoteId === null ? undefined : String(row.shippingQuoteId),
            notes: row.notes ?? undefined,
            purchaseId: String(row.purchaseId),
            createdAt: new Date(row.createdAt).toISOString(),
            updatedAt: new Date(row.updatedAt).toISOString(),
          };
        },
      };
      return operation(t);
    });
  },
  async findById(id) {
    const idB = BigInt(id);
    const p = await prisma.purchase.findUnique({ where: { id: idB } });
    if (p === null) return undefined;
    const [events, shipments] = await Promise.all([
      prisma.purchaseEvent.findMany({ where: { purchaseId: idB } }),
      prisma.shipment.findMany({ where: { purchaseId: idB } }),
    ]);
    return agg(p, events, shipments);
  },
  async list(query) {
    const where: Record<string, unknown> = { createdByUserId: BigInt(query.createdByUserId) };
    if (query.status !== undefined) where.status = query.status;
    if (query.supplierId !== undefined) where.supplierId = BigInt(query.supplierId);
    if (query.productVariantId !== undefined) where.productVariantId = BigInt(query.productVariantId);
    const take = query.limit + 1;
    const orderBy = [{ createdAt: "desc" }, { id: "desc" }] as never;
    const cursor = query.cursor !== undefined ? BigInt(query.cursor.id) : undefined;
    const rows = cursor !== undefined
      ? await prisma.purchase.findMany({ where: where as never, orderBy, take, cursor: { id: cursor }, skip: 1 })
      : await prisma.purchase.findMany({ where: where as never, orderBy, take });
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map((row) => {
      const p = row as Record<string, unknown>;
      return ({
        id: String(p.id),
        referenceCode: p.referenceCode as string,
        status: p.status as PurchaseAggregate["status"],
        supplierId: String(p.supplierId),
        productVariantId: String(p.productVariantId),
        totalPaidUSD: d(p.totalPaidUsd),
        currencyCode: "USD" as const,
        orderedAt: new Date(p.orderedAt as string | Date).toISOString(),
        estimatedDeliveryAt: iso(p.estimatedDeliveryAt),
        createdAt: new Date(p.createdAt as string | Date).toISOString(),
      });
    });
    let nextCursor: PurchaseListPage["nextCursor"];
    if (hasMore) {
      const last = rows.at(query.limit - 1);
      if (last !== undefined) nextCursor = { createdAt: new Date(last.createdAt).toISOString(), id: String(last.id) };
    }
    return { items, nextCursor };
  },
};
