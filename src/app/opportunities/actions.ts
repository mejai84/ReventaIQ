"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const url = z.union([z.literal(""), z.url().refine((value) => new URL(value).protocol === "https:")]);
const marketplaceForm = z.object({ name: z.string().trim().min(2).max(140), slug, countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/), websiteUrl: url, connectorKey: slug, integrationMode: z.enum(["MANUAL", "API", "FEED", "CSV"]) });

export async function createMarketplace(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = marketplaceForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/opportunities?marketError=validation");
  try {
    await prisma.marketplace.create({ data: { name: parsed.data.name, slug: parsed.data.slug, countryCode: parsed.data.countryCode, connectorKey: parsed.data.connectorKey, integrationMode: parsed.data.integrationMode, ...(parsed.data.websiteUrl === "" ? {} : { websiteUrl: parsed.data.websiteUrl }) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/opportunities?marketError=duplicate");
    throw error;
  }
  revalidatePath("/opportunities");
  redirect("/opportunities?marketCreated=1");
}

const listingForm = z.object({
  marketplaceId: z.string().regex(/^\d+$/).transform(BigInt), productVariantId: z.string().regex(/^\d+$/).transform(BigInt), conditionGradeId: z.string().regex(/^\d+$/).transform(BigInt),
  rawTitle: z.string().trim().min(2).max(500), price: z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/), observedAt: z.string().datetime({ offset: true }), expiresAt: z.union([z.literal(""), z.string().datetime({ offset: true })]), sourceUrl: url, externalId: z.string().trim().max(200), sellerName: z.string().trim().max(160), location: z.string().trim().max(160), isComparable: z.enum(["yes", "no"]), exclusionReason: z.string().trim().max(500),
});

export async function createMarketListing(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = listingForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/opportunities?listingError=validation");
  const input = parsed.data;
  if (input.isComparable === "no" && input.exclusionReason === "") redirect("/opportunities?listingError=reason");
  const [marketplace, variant, grade] = await Promise.all([
    prisma.marketplace.findFirst({ where: { id: input.marketplaceId, isActive: true }, select: { id: true } }),
    prisma.productVariant.findFirst({ where: { id: input.productVariantId, isActive: true }, include: { product: { select: { categoryId: true } } } }),
    prisma.conditionGrade.findFirst({ where: { id: input.conditionGradeId, userId: user.id, isActive: true }, select: { id: true, categoryId: true } }),
  ]);
  if (marketplace === null || variant === null || grade === null || variant.product.categoryId !== grade.categoryId) redirect("/opportunities?listingError=relation");
  await prisma.marketListing.create({ data: {
    createdByUserId: user.id, marketplaceId: marketplace.id, productVariantId: variant.id, conditionGradeId: grade.id, rawTitle: input.rawTitle, currencyCode: "COP", price: input.price, observedAt: input.observedAt, isComparable: input.isComparable === "yes",
    ...(input.expiresAt === "" ? {} : { expiresAt: input.expiresAt }), ...(input.sourceUrl === "" ? {} : { sourceUrl: input.sourceUrl }), ...(input.externalId === "" ? {} : { externalId: input.externalId }), ...(input.sellerName === "" ? {} : { sellerName: input.sellerName }), ...(input.location === "" ? {} : { location: input.location }), ...(input.exclusionReason === "" ? {} : { exclusionReason: input.exclusionReason }),
  } });
  revalidatePath("/opportunities");
  redirect("/opportunities?listingCreated=1");
}
