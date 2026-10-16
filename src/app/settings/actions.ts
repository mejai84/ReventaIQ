"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const money = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/).max(25);
const rate = z.string().trim().regex(/^\d+(?:\.\d{1,8})?$/).max(25);
const whole = z.string().trim().regex(/^\d+$/).transform(Number).refine(Number.isSafeInteger);
const optionalWhole = z.union([z.literal(""), whole]).optional();
const jsonObject = z.string().trim().min(2).max(20_000).transform((value, ctx) => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
    return parsed as Prisma.InputJsonValue;
  } catch {
    ctx.addIssue({ code: "custom", message: "Debe ser un objeto JSON válido." });
    return z.NEVER;
  }
});

const form = z.object({
  effectiveAt: z.string().datetime({ offset: true }),
  initialCapitalCop: money, availableCapitalCop: money, financedPrincipalCop: money,
  monthlyFinancingRate: rate, financingDaysPerMonth: whole.refine((value) => value > 0 && value <= 31),
  minimumProfitCop: money, minimumRoiRate: rate, targetMonthlySales: optionalWhole,
  cashReserveRate: rate, warrantyReserveRate: rate,
  warrantyReserveBasis: z.enum(["LANDED_COST", "SALE_PRICE"]), fxSpreadRate: rate, safetyMarginRate: rate,
  defaultExpectedDaysToSell: optionalWhole, maxCapitalPerProductRate: rate,
  conservativePriceStrategy: z.enum(["MEDIAN_DISCOUNT", "PERCENTILE", "MINIMUM"]),
  conservativePriceParameter: z.union([z.literal(""), rate]).optional(),
  calculationPolicyVersion: z.string().trim().min(1).max(80), scorePolicyVersion: z.string().trim().min(1).max(80),
  signalRules: jsonObject, scoreConfig: jsonObject,
});

export async function createBusinessSettings(formData: FormData): Promise<void> {
  const user = await requireUser();
  const result = form.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/settings?error=validation");
  const input = result.data;
  await prisma.$transaction(async (tx) => {
    const previous = await tx.businessSettings.findFirst({ where: { userId: user.id, isActive: true }, orderBy: { version: "desc" }, select: { version: true } });
    await tx.businessSettings.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false } });
    await tx.businessSettings.create({ data: {
      userId: user.id, version: (previous?.version ?? 0) + 1, isActive: true, effectiveAt: input.effectiveAt,
      initialCapitalCop: input.initialCapitalCop, availableCapitalCop: input.availableCapitalCop, financedPrincipalCop: input.financedPrincipalCop,
      monthlyFinancingRate: input.monthlyFinancingRate, financingDaysPerMonth: input.financingDaysPerMonth,
      minimumProfitCop: input.minimumProfitCop, minimumRoiRate: input.minimumRoiRate,
      ...(input.targetMonthlySales === undefined || input.targetMonthlySales === "" ? {} : { targetMonthlySales: input.targetMonthlySales }),
      cashReserveRate: input.cashReserveRate, warrantyReserveRate: input.warrantyReserveRate, warrantyReserveBasis: input.warrantyReserveBasis,
      fxSpreadRate: input.fxSpreadRate, safetyMarginRate: input.safetyMarginRate,
      ...(input.defaultExpectedDaysToSell === undefined || input.defaultExpectedDaysToSell === "" ? {} : { defaultExpectedDaysToSell: input.defaultExpectedDaysToSell }),
      maxCapitalPerProductRate: input.maxCapitalPerProductRate, conservativePriceStrategy: input.conservativePriceStrategy,
      ...(input.conservativePriceParameter === undefined || input.conservativePriceParameter === "" ? {} : { conservativePriceParameter: input.conservativePriceParameter }),
      signalRules: input.signalRules, scoreConfig: input.scoreConfig,
      calculationPolicyVersion: input.calculationPolicyVersion, scorePolicyVersion: input.scorePolicyVersion,
    } });
  });
  revalidatePath("/settings");
  redirect("/settings?created=1");
}
