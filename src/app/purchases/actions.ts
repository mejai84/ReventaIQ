"use server";

import { Decimal } from "decimal.js";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { prismaPurchaseRepository } from "@/modules/purchases/infrastructure/prisma-purchase-repository";
import {
  assertPurchaseConsistency,
  assertPurchaseTransition,
  availablePurchaseActions,
  canCancel,
  canReopen,
  deriveAutomaticEvents,
  nextPurchaseStatus,
  type PurchaseAction,
  type PurchaseMoneyComponents,
  type PurchaseShipmentView,
  type PurchaseStatus,
  type PurchaseView,
  userEventForAction,
} from "@/modules/purchases/domain";
import type { NewPurchaseRecord, PurchaseAggregate, PurchaseShipmentRecord } from "@/modules/purchases/application/purchase-repository";

const isoInstant = z.string().min(1).refine((v) => !Number.isNaN(Date.parse(v)), "Instante invalido");
const moneyText = z
  .string()
  .trim()
  .regex(/^(\d+(?:\.\d{1,4})?)?$/u)
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : new Decimal(v)));

function moneyFromInput(input: Partial<Record<string, string>>) {
  const get = (k: string) => ((input[k] ?? "").trim() === "" ? undefined : new Decimal(input[k]!.trim()));
  return {
    purchasePriceUSD: get("purchasePriceUSD"),
    usShippingUSD: get("usShippingUSD"),
    usSalesTaxUSD: get("usSalesTaxUSD"),
    paymentFeeUSD: get("paymentFeeUSD"),
    otherCostUSD: get("otherCostUSD"),
  } as PurchaseMoneyComponents;
}

async function loadOwnedPurchase(user: { id: bigint }, id: string): Promise<PurchaseAggregate | undefined> {
  const idNum = id.trim();
  if (!/^\d+$/.test(idNum)) return undefined;
  const aggregate = await prismaPurchaseRepository.findById(idNum);
  if (aggregate === undefined || aggregate.createdByUserId !== String(user.id)) return undefined;
  return aggregate;
}

function toView(aggregate: PurchaseAggregate, override: Partial<PurchaseView> = {}): PurchaseView {
  return {
    id: aggregate.id,
    status: override.status ?? aggregate.status,
    orderedAt: aggregate.orderedAt,
    paidAt: override.paidAt ?? aggregate.paidAt,
    estimatedDeliveryAt: aggregate.estimatedDeliveryAt,
    deliveredAt: aggregate.deliveredAt ?? override.deliveredAt,
    cancelledAt: override.cancelledAt ?? aggregate.cancelledAt,
    cancellationReason: override.cancellationReason ?? aggregate.cancellationReason,
    money: override.money ?? aggregate.money,
    shipments: aggregate.shipments,
  };
}

function redirectError(id: string, code: string): never {
  redirect(`/purchases/${id}?error=${code}`);
}

export async function createPurchaseFromOpportunity(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = z.object({ opportunityId: z.string().regex(/^\\d+$/).transform(BigInt) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/purchases?error=validation");

  const opportunity = await prisma.opportunity.findFirst({
    where: { id: parsed.data.opportunityId, status: "ACTIVE", supplierOffer: { createdByUserId: user.id } },
    include: { supplierOffer: { include: { productVariant: true, conditionGrade: true } } },
  });
  if (opportunity === null) redirect("/purchases?error=opportunity");

  const offer = opportunity.supplierOffer as unknown as {
    id: bigint; supplierId: bigint; productVariantId: bigint; conditionGradeId: bigint;
    purchasePrice: unknown; usShipping: (null | unknown); usSalesTax: (null | unknown);
    paymentFee: (null | unknown); otherPurchaseCost: (null | unknown); sourceUrl: string | null;
  };
  const duplicated = await prisma.purchase.findFirst({ where: { supplierOfferId: offer.id, status: { not: "CANCELLED" } }, select: { id: true } });
  if (duplicated !== null) redirect("/purchases?error=duplicate");

  const input: NewPurchaseRecord = {
    createdByUserId: user.id.toString(),
    referenceCode: `P-${Date.now().toString(36).toUpperCase()}`,
    supplierId: String(offer.supplierId),
    supplierOfferId: String(offer.id),
    opportunityId: String(opportunity.id),
    productVariantId: String(offer.productVariantId),
    conditionGradeId: String(offer.conditionGradeId),
    orderedAt: new Date().toISOString(),
    money: {
      purchasePriceUSD: offer.purchasePrice !== null ? new Decimal(String(offer.purchasePrice)) : undefined,
      usShippingUSD: offer.usShipping !== null ? new Decimal(String(offer.usShipping)) : undefined,
      usSalesTaxUSD: offer.usSalesTax !== null ? new Decimal(String(offer.usSalesTax)) : undefined,
      paymentFeeUSD: offer.paymentFee !== null ? new Decimal(String(offer.paymentFee)) : undefined,
      otherCostUSD: offer.otherPurchaseCost !== null ? new Decimal(String(offer.otherPurchaseCost)) : undefined,
    },
    sourceUrl: offer.sourceUrl ?? undefined,
  };
  await prismaPurchaseRepository.transaction(async (tx) => {
    const created = await tx.createPurchase(input);
    await tx.appendEvents(
      [{ purchaseId: created.id, code: "PURCHASE_CREATED", source: "USER", occurredAt: new Date().toISOString(), payload: { opportunityId: String(opportunity.id), supplierOfferId: String(offer.id) } }],
      user.id.toString(),
    );
  });
  revalidatePath("/purchases");
  redirect("/purchases");
}

export async function confirmPurchase(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("purchaseId") ?? "");
  const aggregate = await loadOwnedPurchase(user, id);
  if (aggregate === undefined) redirectError(id, "ownership");

  try {
    assertPurchaseTransition(aggregate.status, nextPurchaseStatus(aggregate.status, "CONFIRM"));
  } catch {
    redirectError(id, "transition");
  }
  const target = nextPurchaseStatus(aggregate.status, "CONFIRM");
  const now = new Date().toISOString();
  const to: PurchaseAggregate = { ...aggregate, status: target, paidAt: (target === "PAID" ? now : aggregate.paidAt) } as PurchaseAggregate;
  assertPurchaseConsistency(to as unknown as PurchaseView);

  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.updatePurchase({ id, expectedRevision: aggregate.revision, status: target });
    const events = deriveAutomaticEvents(toView(aggregate), toView(to as PurchaseAggregate), now);
    const manual = userEventForAction(to, now, { action: "CONFIRM" });
    await tx.appendEvents([...events, manual], user.id.toString());
  });
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?ok=confirmed`);
}

export async function recordPayment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("purchaseId") ?? "");
  const aggregate = await loadOwnedPurchase(user, id);
  if (aggregate === undefined) redirectError(id, "ownership");

  const parsed = z
    .object({
      paidAmountUSD: moneyText,
      paidAt: isoInstant,
      purchasePriceUSD: moneyText,
      usShippingUSD: moneyText,
      usSalesTaxUSD: moneyText,
      paymentFeeUSD: moneyText,
      otherCostUSD: moneyText,
    })
    .safeParse({
      paidAmountUSD: (formData.get("paidAmountUSD") ?? "").toString(),
      paidAt: (formData.get("paidAt") ?? "").toString(),
      purchasePriceUSD: (formData.get("purchasePriceUSD") ?? "").toString(),
      usShippingUSD: (formData.get("usShippingUSD") ?? "").toString(),
      usSalesTaxUSD: (formData.get("usSalesTaxUSD") ?? "").toString(),
      paymentFeeUSD: (formData.get("paymentFeeUSD") ?? "").toString(),
      otherCostUSD: (formData.get("otherCostUSD") ?? "").toString(),
    });
  if (!parsed.success) redirectError(id, "validation");

  const target = nextPurchaseStatus(aggregate.status, "RECORD_PAYMENT");
  try {
    assertPurchaseTransition(aggregate.status, target);
  } catch {
    redirectError(id, "transition");
  }

  const now = parsed.data.paidAt || new Date().toISOString();
  const money = parsed.data.purchasePriceUSD !== undefined || parsed.data.usShippingUSD !== undefined
    ? {
      purchasePriceUSD: parsed.data.purchasePriceUSD ?? aggregate.money.purchasePriceUSD,
      usShippingUSD: parsed.data.usShippingUSD ?? aggregate.money.usShippingUSD,
      usSalesTaxUSD: parsed.data.usSalesTaxUSD ?? aggregate.money.usSalesTaxUSD,
      paymentFeeUSD: parsed.data.paymentFeeUSD ?? aggregate.money.paymentFeeUSD,
      otherCostUSD: parsed.data.otherCostUSD ?? aggregate.money.otherCostUSD,
    }
    : aggregate.money;

  const to: PurchaseView = toView(aggregate,{status:target, paidAt:now, money});
  // Spread leaves money; ensure consistent
  const viewTo: PurchaseView = to;
  assertPurchaseConsistency(viewTo);

  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.updatePurchase({
      id,
      expectedRevision: aggregate.revision,
      status: target,
      money,
      totalPaidUSD: parsed.data.paidAmountUSD ?? undefined,
      paidAt: now,
    });
    const auto = deriveAutomaticEvents(toView(aggregate), viewTo, now);
    const manual = userEventForAction(viewTo, now, { action: "RECORD_PAYMENT", paidAmountUSD: parsed.data.paidAmountUSD?.toString() });
    await tx.appendEvents([...auto, manual], user.id.toString());
  });
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?ok=paid`);
}

export async function cancelPurchase(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("purchaseId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const aggregate = await loadOwnedPurchase(user, id);
  if (aggregate === undefined) redirectError(id, "ownership");
  if (!canCancel(aggregate.status)) redirectError(id, "transition");
  const target: PurchaseStatus = "CANCELLED";
  try {
    assertPurchaseTransition(aggregate.status, target);
  } catch {
    redirectError(id, "transition");
  }
  const now = new Date().toISOString();
  const to: PurchaseView = toView(aggregate,{status:target,cancelledAt:now,cancellationReason:reason || aggregate.cancellationReason});
  assertPurchaseConsistency(to);
  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.updatePurchase({ id, expectedRevision: aggregate.revision, status: target, cancelledAt: now, cancellationReason: reason || aggregate.cancellationReason });
    const auto = deriveAutomaticEvents(toView(aggregate), to, now);
    const manual = userEventForAction(to, now, { action: "CANCEL", reason });
    await tx.appendEvents([...auto, manual], user.id.toString());
  });
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?ok=cancelled`);
}

export async function reopenPurchase(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("purchaseId") ?? "");
  const aggregate = await loadOwnedPurchase(user, id);
  if (aggregate === undefined) redirectError(id, "ownership");
  if (!canReopen(aggregate)) redirectError(id, "transition");
  const target: PurchaseStatus = "DRAFT";
  try {
    assertPurchaseTransition(aggregate.status, target);
  } catch {
    redirectError(id, "transition");
  }
  const now = new Date().toISOString();
  const to: PurchaseView = toView(aggregate,{status:target,paidAt:undefined,cancelledAt:undefined,cancellationReason:undefined});
  assertPurchaseConsistency(to);
  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.updatePurchase({ id, expectedRevision: aggregate.revision, status: target, paidAt: undefined, cancelledAt: undefined, cancellationReason: undefined });
    const manual = userEventForAction(to, now, { action: "REOPEN" });
    await tx.appendEvents([...deriveAutomaticEvents(toView(aggregate), to, now), manual], user.id.toString());
  });
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?ok=reopened`);
}

export async function createShipmentAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("purchaseId") ?? "");
  const aggregate = await loadOwnedPurchase(user, id);
  if (aggregate === undefined) redirectError(id, "ownership");
  const parsed = z.object({
    sequence: z.string().trim().regex(/^\d+$/),
    carrierName: z.string().trim().max(120).optional(),
    trackingNumber: z.string().trim().max(120).optional(),
    trackingUrl: z.union([z.literal(""), z.string().url()]).optional(),
    shippingProviderId: z.string().regex(/^\d+$/).optional().transform((v) => (v === undefined ? undefined : v)),
    shippingQuoteId: z.string().regex(/^\d+$/).optional().transform((v) => (v === undefined ? undefined : v)),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectError(id, "validation");
  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.createShipment({
      purchaseId: id,
      sequence: Number(parsed.data.sequence),
      carrierName: parsed.data.carrierName ?? undefined,
      trackingNumber: parsed.data.trackingNumber === "" ? undefined : parsed.data.trackingNumber,
      trackingUrl: parsed.data.trackingUrl === "" ? undefined : parsed.data.trackingUrl,
      shippingProviderId: parsed.data.shippingProviderId === undefined ? undefined : parsed.data.shippingProviderId,
      shippingQuoteId: parsed.data.shippingQuoteId === undefined ? undefined : parsed.data.shippingQuoteId,
    });
  });
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?ok=shipment`);
}

export async function updateShipmentStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const purchaseId = String(formData.get("purchaseId") ?? "");
  const shipmentId = String(formData.get("shipmentId") ?? "");
  const aggregate = await loadOwnedPurchase(user, purchaseId);
  if (aggregate === undefined) redirectError(purchaseId, "ownership");
  const found = aggregate.shipmentRecords.find((s) => s.id === shipmentId);
  if (found === undefined) redirectError(purchaseId, "shipment");
  const targetStatus = z.enum(["DISPATCHED", "IN_CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "CANCELLED"]).safeParse(formData.get("status"));
  if (!targetStatus.success) redirectError(purchaseId, "validation");
  const now = new Date().toISOString();
  const nextStatus = targetStatus.data as (PurchaseShipmentRecord["status"]);
  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.updateShipment({
      id: found.id,
      status: nextStatus,
      dispatchedAt: nextStatus === "DISPATCHED" ? now : found.dispatchedAt,
      deliveredAt: nextStatus === "DELIVERED" ? now : found.deliveredAt,
    });
  });
  // trigger view update? already done
  revalidatePath(`/purchases/${purchaseId}`);
  redirect(`/purchases/${purchaseId}?ok=shipment-updated`);
}

export async function addNoteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("purchaseId") ?? "");
  const aggregate = await loadOwnedPurchase(user, id);
  if (aggregate === undefined) redirectError(id, "ownership");
  const note = String(formData.get("note") ?? "").trim();
  if (note.length === 0 || note.length > 2000) redirectError(id, "validation");
  const now = new Date().toISOString();
  await prismaPurchaseRepository.transaction(async (tx) => {
    await tx.appendEvents([{ purchaseId: id, code: "NOTE_ADDED", source: "USER", occurredAt: now, payload: { note } }], user.id.toString());
  });
  revalidatePath(`/purchases/${id}`);
  redirect(`/purchases/${id}?ok=note`);
}
