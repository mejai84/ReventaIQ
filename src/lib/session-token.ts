import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "reventaiq_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function sessionSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (value === undefined || value.length < 32) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return value;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + SESSION_MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${sign(payload, sessionSecret())}`;
}

export function readSessionToken(raw: string | undefined, now = Date.now()): string | undefined {
  if (raw === undefined) return undefined;

  const parts = raw.split(".");
  if (parts.length !== 3) return undefined;

  const [userId, expiresAt, signature] = parts;
  if (userId === undefined || expiresAt === undefined || signature === undefined) return undefined;
  if (!/^\d+$/.test(userId)) return undefined;

  const expiresAtMs = Number(expiresAt);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= now) return undefined;

  let secret: string;
  try {
    secret = sessionSecret();
  } catch {
    return undefined;
  }

  const expected = sign(`${userId}.${expiresAt}`, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return undefined;
  }

  return userId;
}
