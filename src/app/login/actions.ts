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

  let user: { id: bigint; passwordHash: string | null } | null;
  try {
    user = await prisma.user.findFirst({ where: { email, isActive: true }, select: { id: true, passwordHash: true } });
  } catch (error) {
    console.error("Login database lookup failed", error);
    redirect("/login?error=1");
  }
  if (user === null || user.passwordHash === null || !verifyPassword(password, user.passwordHash)) redirect("/login?error=1");

  try {
    await createSession(user.id.toString());
  } catch (error) {
    console.error("Login session creation failed", error);
    redirect("/login?error=1");
  }
  redirect("/dashboard");
}
