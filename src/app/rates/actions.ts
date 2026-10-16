"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const rateForm = z.object({
  rate: z.string().trim().regex(/^\d+(?:\.\d{1,8})?$/).refine((value) => Number(value) > 0),
  observedAt: z.string().datetime({ offset: true }),
  providerName: z.string().trim().max(140),
  notes: z.string().trim().max(1000),
});

export async function createExchangeRate(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = rateForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/rates?error=validation");

  await prisma.exchangeRate.create({
    data: {
      createdByUserId: user.id,
      baseCurrencyCode: "USD",
      quoteCurrencyCode: "COP",
      rate: parsed.data.rate,
      source: "MANUAL",
      observedAt: parsed.data.observedAt,
      ...(parsed.data.providerName === "" ? {} : { providerName: parsed.data.providerName }),
      ...(parsed.data.notes === "" ? {} : { notes: parsed.data.notes }),
    },
  });
  revalidatePath("/rates");
  redirect("/rates?created=1");
}
