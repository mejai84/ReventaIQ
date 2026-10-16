import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "reventaiq_session";
const maxAge = 60 * 60 * 12;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value === undefined || value.length < 32) throw new Error("AUTH_SECRET is not configured");
  return value;
}

function sign(value: string): string { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export async function createSession(userId: string): Promise<void> {
  const payload = `${userId}.${Date.now() + maxAge * 1000}`;
  const jar = await cookies();
  jar.set(cookieName, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
}

export async function readSessionUserId(): Promise<string | undefined> {
  const raw = (await cookies()).get(cookieName)?.value;
  if (raw === undefined) return undefined;
  const [userId, expiresAt, signature] = raw.split(".");
  if (userId === undefined || expiresAt === undefined || signature === undefined || Number(expiresAt) < Date.now()) return undefined;
  const expected = sign(`${userId}.${expiresAt}`);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? userId : undefined;
}

export async function clearSession(): Promise<void> { (await cookies()).delete(cookieName); }
