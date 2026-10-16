"use server";

import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const money = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/);
const optionalMoney = z.union([z.literal(""), money]);

const providerForm = z.object({
  name: z.string().trim().min(2).max(140),
  slug,
  websiteUrl: z.union([z.literal(""), z.url().refine((value) => new URL(value).protocol === "https:")]),
  connectorKey: slug,
  integrationMode: z.enum(["MANUAL", "API", "FEED", "CSV"]),
});

export async function createShippingProvider(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = providerForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/shipping?providerError=validation");
  try {
    await prisma.shippingProvider.create({ data: {
      name: parsed.data.name, slug: parsed.data.slug, connectorKey: parsed.data.connectorKey, integrationMode: parsed.data.integrationMode,
      ...(parsed.data.websiteUrl === "" ? {} : { websiteUrl: parsed.data.websiteUrl }),
    } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/shipping?providerError=duplicate");
    throw error;
  }
  revalidatePath("/shipping");
  redirect("/shipping?providerCreated=1");
}

const quoteForm = z.object({
  supplierOfferId: z.string().regex(/^\d+$/).transform(BigInt),
  shippingProviderId: z.string().regex(/^\d+$/).transform(BigInt),
  quotedAt: z.string().datetime({ offset: true }),
  estimatedDeliveryDays: z.string().regex(/^\d+$/).transform(Number).refine((value) => Number.isSafeInteger(value) && value > 0 && value <= 365),
  expiresAt: z.union([z.literal(""), z.string().datetime({ offset: true })]),
  itemWeightLb: z.union([z.literal(""), z.string().trim().regex(/^\d+(?:\.\d{1,3})?$/)]),
  weightSource: z.union([z.literal(""), z.enum(["MEASURED", "DECLARED"])]),
  internationalShipping: money, insurance: money, customs: money, vat: money, handling: money, nationalization: money, localDelivery: money,
  fuelSurcharge: optionalMoney, logistics: optionalMoney, tariff: optionalMoney, otherCost: optionalMoney,
  notes: z.string().trim().max(1000),
});

export async function createShippingQuote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = quoteForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/shipping?quoteError=validation");
  const input = parsed.data;
  if ((input.itemWeightLb === "") !== (input.weightSource === "")) redirect("/shipping?quoteError=weight");
  const [offer, provider] = await Promise.all([
    prisma.supplierOffer.findFirst({ where: { id: input.supplierOfferId, createdByUserId: user.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.shippingProvider.findFirst({ where: { id: input.shippingProviderId, isActive: true }, select: { id: true } }),
  ]);
  if (offer === null || provider === null) redirect("/shipping?quoteError=relation");
  const amounts = [input.internationalShipping, input.insurance, input.customs, input.vat, input.handling, input.nationalization, input.localDelivery, input.fuelSurcharge, input.logistics, input.tariff, input.otherCost]
    .filter((value): value is string => value !== "")
    .map((value) => new Decimal(value));
  const totalAmount = amounts.reduce((total, amount) => total.plus(amount), new Decimal(0)).toFixed(4);
  await prisma.shippingQuote.create({ data: {
    createdByUserId: user.id, supplierOfferId: offer.id, shippingProviderId: provider.id, currencyCode: "COP", quotedAt: input.quotedAt, estimatedDeliveryDays: input.estimatedDeliveryDays,
    internationalShipping: input.internationalShipping, insurance: input.insurance, customs: input.customs, vat: input.vat, handling: input.handling, nationalization: input.nationalization, localDelivery: input.localDelivery, totalAmount,
    ...(input.expiresAt === "" ? {} : { expiresAt: input.expiresAt }), ...(input.itemWeightLb === "" ? {} : { itemWeightLb: input.itemWeightLb, weightSource: input.weightSource }),
    ...(input.fuelSurcharge === "" ? {} : { fuelSurcharge: input.fuelSurcharge }), ...(input.logistics === "" ? {} : { logistics: input.logistics }), ...(input.tariff === "" ? {} : { tariff: input.tariff }), ...(input.otherCost === "" ? {} : { otherCost: input.otherCost }), ...(input.notes === "" ? {} : { notes: input.notes }),
  } });
  revalidatePath("/shipping");
  redirect("/shipping?quoteCreated=1");
}
