"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const form = z.object({
  name: z.string().trim().min(2).max(140),
  slug,
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  websiteUrl: z.union([z.literal(""), z.url().refine((value) => new URL(value).protocol === "https:")]),
  connectorKey: slug,
  integrationMode: z.enum(["MANUAL", "API", "FEED", "CSV"]),
});

export async function createSupplier(formData: FormData): Promise<void> {
  await requireUser();
  const result = form.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/suppliers?error=validation");
  try {
    await prisma.supplier.create({ data: {
      name: result.data.name, slug: result.data.slug, countryCode: result.data.countryCode,
      ...(result.data.websiteUrl === "" ? {} : { websiteUrl: result.data.websiteUrl }),
      connectorKey: result.data.connectorKey, integrationMode: result.data.integrationMode,
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/suppliers?error=duplicate");
    throw error;
  }
  revalidatePath("/suppliers");
  redirect("/suppliers?created=1");
}

const positiveMoney = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/);
const optionalMoney = z.union([z.literal(""), positiveMoney]).optional();
const optionalCount = z.union([z.literal(""), z.string().regex(/^\d+$/).transform(Number).refine(Number.isSafeInteger)]).optional();
const offerForm = z.object({
  supplierId: z.string().regex(/^\d+$/).transform(BigInt), productVariantId: z.string().regex(/^\d+$/).transform(BigInt), conditionGradeId: z.string().regex(/^\d+$/).transform(BigInt),
  rawTitle: z.string().trim().min(2).max(500), externalId: z.string().trim().max(200).optional().or(z.literal("")),
  sourceUrl: z.union([z.literal(""), z.url().refine((value) => new URL(value).protocol === "https:")]), currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  purchasePrice: positiveMoney, usShipping: optionalMoney, usSalesTax: optionalMoney, paymentFee: optionalMoney, otherPurchaseCost: optionalMoney,
  availableQuantity: optionalCount, observedAt: z.string().datetime({ offset: true }), expiresAt: z.union([z.literal(""), z.string().datetime({ offset: true })]),
  carrierLockStatus: z.enum(["UNLOCKED", "LOCKED", "UNKNOWN"]), icloudStatus: z.enum(["CLEAR", "LOCKED", "UNKNOWN"]),
});

export async function createSupplierOffer(formData: FormData): Promise<void> {
  const user = await requireUser();
  const result = offerForm.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/suppliers?offerError=validation");
  const input = result.data;
  const [supplier, variant, grade] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: input.supplierId, isActive: true }, select: { id: true } }),
    prisma.productVariant.findFirst({ where: { id: input.productVariantId, isActive: true }, include: { product: { select: { categoryId: true } } } }),
    prisma.conditionGrade.findFirst({ where: { id: input.conditionGradeId, userId: user.id, isActive: true }, select: { id: true, categoryId: true } }),
  ]);
  if (supplier === null || variant === null || grade === null || variant.product.categoryId !== grade.categoryId) redirect("/suppliers?offerError=relation");
  await prisma.supplierOffer.create({ data: {
    createdByUserId: user.id, supplierId: supplier.id, productVariantId: variant.id, conditionGradeId: grade.id,
    rawTitle: input.rawTitle, currencyCode: input.currencyCode, purchasePrice: input.purchasePrice, observedAt: input.observedAt,
    carrierLockStatus: input.carrierLockStatus, icloudStatus: input.icloudStatus,
    ...(input.externalId === "" || input.externalId === undefined ? {} : { externalId: input.externalId }), ...(input.sourceUrl === "" ? {} : { sourceUrl: input.sourceUrl }),
    ...(input.usShipping === "" || input.usShipping === undefined ? {} : { usShipping: input.usShipping }), ...(input.usSalesTax === "" || input.usSalesTax === undefined ? {} : { usSalesTax: input.usSalesTax }), ...(input.paymentFee === "" || input.paymentFee === undefined ? {} : { paymentFee: input.paymentFee }), ...(input.otherPurchaseCost === "" || input.otherPurchaseCost === undefined ? {} : { otherPurchaseCost: input.otherPurchaseCost }),
    ...(input.availableQuantity === "" || input.availableQuantity === undefined ? {} : { availableQuantity: input.availableQuantity }), ...(input.expiresAt === "" ? {} : { expiresAt: input.expiresAt }),
  } });
  revalidatePath("/suppliers");
  redirect("/suppliers?offerCreated=1");
}