import { cookies } from "next/headers";

import {
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "./session-token";

export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function readSessionUserId(): Promise<string | undefined> {
  const raw = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return readSessionToken(raw);
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
