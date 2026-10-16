"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const channelCode = z.enum(["FACEBOOK_MARKETPLACE", "MERCADO_LIBRE", "DIRECT_SALE"]);
const money = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/);
const rate = z.string().trim().regex(/^\d+(?:\.\d{1,8})?$/).refine((value) => Number(value) <= 1);

const channelForm = z.object({ code: channelCode, name: z.string().trim().min(2).max(120) });

export async function createSalesChannel(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = channelForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings/sales?channelError=validation");
  try {
    await prisma.salesChannel.create({ data: parsed.data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/settings/sales?channelError=duplicate");
    throw error;
  }
  revalidatePath("/settings/sales");
  redirect("/settings/sales?channelCreated=1");
}

const profileForm = z.object({
  salesChannelId: z.string().regex(/^\d+$/).transform(BigInt), validFrom: z.string().datetime({ offset: true }), validTo: z.union([z.literal(""), z.string().datetime({ offset: true })]),
  sellingFeeRate: rate, withholdingRate: rate, fixedFeeCop: money, shippingCostCop: money, advertisingCostCop: money, otherCostCop: money,
});

export async function createSalesCostProfile(formData: FormData): Promise<void> {
  await requireUser();
  const parsed = profileForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings/sales?profileError=validation");
  const input = parsed.data;
  const channel = await prisma.salesChannel.findFirst({ where: { id: input.salesChannelId, isActive: true }, select: { id: true } });
  if (channel === null) redirect("/settings/sales?profileError=relation");
  await prisma.$transaction(async (tx) => {
    const latest = await tx.salesCostProfile.findFirst({ where: { salesChannelId: channel.id }, orderBy: { version: "desc" }, select: { version: true } });
    await tx.salesCostProfile.create({ data: {
      salesChannelId: channel.id, version: (latest?.version ?? 0) + 1, validFrom: input.validFrom,
      ...(input.validTo === "" ? {} : { validTo: input.validTo }), sellingFeeRate: input.sellingFeeRate, withholdingRate: input.withholdingRate, fixedFeeCop: input.fixedFeeCop, shippingCostCop: input.shippingCostCop, advertisingCostCop: input.advertisingCostCop, otherCostCop: input.otherCostCop,
    } });
  });
  revalidatePath("/settings/sales");
  redirect("/settings/sales?profileCreated=1");
}
