"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const key = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const form = z.object({
  categoryCode: key,
  categoryName: z.string().trim().min(2).max(100),
  brandSlug: key,
  brandName: z.string().trim().min(2).max(100),
  normalizedKey: key,
  displayName: z.string().trim().min(2).max(180),
  releaseYear: z.string().trim().regex(/^\d{4}$/).optional().or(z.literal("")),
  manufacturerSku: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function createCatalogProduct(formData: FormData): Promise<void> {
  await requireUser();
  const result = form.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/catalog?error=validation");
  const input = result.data;
  try {
    await prisma.$transaction(async (tx) => {
      const category = await tx.productCategory.upsert({
        where: { code: input.categoryCode },
        update: { name: input.categoryName, isActive: true },
        create: { code: input.categoryCode, name: input.categoryName, isActive: true },
      });
      const brand = await tx.brand.upsert({
        where: { slug: input.brandSlug },
        update: { name: input.brandName, isActive: true },
        create: { slug: input.brandSlug, name: input.brandName, isActive: true },
      });
      const product = await tx.product.create({
        data: {
          categoryId: category.id,
          brandId: brand.id,
          normalizedKey: input.normalizedKey,
          displayName: input.displayName,
          ...(input.releaseYear === undefined || input.releaseYear === "" ? {} : { releaseYear: Number(input.releaseYear) }),
        },
      });
      await tx.productVariant.create({
        data: {
          productId: product.id,
          ...(input.manufacturerSku === undefined || input.manufacturerSku === "" ? {} : { manufacturerSku: input.manufacturerSku }),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/catalog?error=duplicate");
    throw error;
  }
  revalidatePath("/catalog");
  redirect("/catalog?created=1");
}
