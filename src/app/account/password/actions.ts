"use server";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

const MIN_NEW_PASSWORD = 12;
const MAX_PASSWORD = 256;

export async function changePassword(formData: FormData): Promise<void> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (current.length === 0 || next.length < MIN_NEW_PASSWORD || confirm !== next || next.length > MAX_PASSWORD) {
    redirect("/account/password?error=1");
  }

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (row === null || row.passwordHash === null || !verifyPassword(current, row.passwordHash)) {
    redirect("/account/password?error=1");
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  revalidatePath("/account/password");
  redirect("/account/password?ok=1");
}
