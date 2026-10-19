import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionToken, readSessionToken, SESSION_MAX_AGE_SECONDS } from "./session-token";

const testSecret = "test-secret-value-with-at-least-32-characters";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session token", () => {
  it("acepta un token firmado y vigente", () => {
    vi.stubEnv("AUTH_SECRET", testSecret);
    const now = 1_700_000_000_000;

    const token = createSessionToken("1", now);

    expect(readSessionToken(token, now)).toBe("1");
  });

  it("rechaza un token vencido", () => {
    vi.stubEnv("AUTH_SECRET", testSecret);
    const now = 1_700_000_000_000;
    const token = createSessionToken("1", now);

    expect(readSessionToken(token, now + SESSION_MAX_AGE_SECONDS * 1000)).toBeUndefined();
  });

  it("rechaza un token manipulado", () => {
    vi.stubEnv("AUTH_SECRET", testSecret);
    const token = createSessionToken("1");
    const [userId, expiresAt, signature] = token.split(".");

    expect(readSessionToken(`${userId}.${expiresAt}.${signature}x`)).toBeUndefined();
    expect(readSessionToken(`2.${expiresAt}.${signature}`)).toBeUndefined();
  });

  it("rechaza tokens mal formados y usuarios no numéricos", () => {
    vi.stubEnv("AUTH_SECRET", testSecret);

    expect(readSessionToken(undefined)).toBeUndefined();
    expect(readSessionToken("")).toBeUndefined();
    expect(readSessionToken("1")).toBeUndefined();
    expect(readSessionToken("abc.9999999999999.firma")).toBeUndefined();
  });

  it("rechaza cualquier token si AUTH_SECRET no está configurado", () => {
    vi.stubEnv("AUTH_SECRET", "");

    expect(readSessionToken("1.9999999999999.firma")).toBeUndefined();
    expect(() => createSessionToken("1")).toThrow("AUTH_SECRET is not configured");
  });
});
