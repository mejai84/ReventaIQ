"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const input = z.object({ opportunityId: z.string().regex(/^\d+$/).transform(BigInt) });

/** Creates the operational record and its immutable first audit event together. */
export async function createPurchaseFromOpportunity(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/purchases?error=validation");
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: parsed.data.opportunityId, supplierOffer: { createdByUserId: user.id }, status: "ACTIVE" },
    include: { supplierOffer: true },
  });
  if (opportunity === null) redirect("/purchases?error=opportunity");
  const offer = opportunity.supplierOffer;
  const orderedAt = new Date();
  const referenceCode = `P-${orderedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${opportunity.id.toString()}`;
  try {
    const purchase = await prisma.$transaction(async (tx) => tx.purchase.create({ data: {
      createdByUserId: user.id, referenceCode, status: "DRAFT", supplierId: offer.supplierId,
      supplierOfferId: offer.id, opportunityId: opportunity.id, productVariantId: offer.productVariantId,
      conditionGradeId: offer.conditionGradeId, currencyCode: "USD", orderedAt,
      ...(offer.sourceUrl === null ? {} : { sourceUrl: offer.sourceUrl }),
      events: { create: { eventCode: "PURCHASE_CREATED", source: "USER", occurredAt: orderedAt, createdByUserId: user.id, payload: { status: "DRAFT" } } },
    } }));
    revalidatePath("/purchases");
    redirect(`/purchases/${purchase.id.toString()}?created=1`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/purchases?error=duplicate");
    throw error;
  }
}
