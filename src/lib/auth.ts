import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

export async function requireUser() {
  const userId = await readSessionUserId();
  if (userId === undefined || !/^\d+$/.test(userId)) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: BigInt(userId) }, select: { id: true, displayName: true, email: true, role: true, isActive: true } });
  if (user === null || !user.isActive) redirect("/login");

  return user;
}
