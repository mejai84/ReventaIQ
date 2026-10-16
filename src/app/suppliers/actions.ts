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
