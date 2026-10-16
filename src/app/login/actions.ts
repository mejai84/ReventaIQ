"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (email.length > 254 || password.length < 12 || password.length > 256 || !validEmail.test(email)) redirect("/login?error=1");
  const user = await prisma.user.findFirst({ where: { email, isActive: true } });
  if (user?.passwordHash === null || user?.passwordHash === undefined || !verifyPassword(password, user.passwordHash)) redirect("/login?error=1");
  await createSession(user.id.toString());
  redirect("/dashboard");
}