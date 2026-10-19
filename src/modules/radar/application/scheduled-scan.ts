import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compares the cron secret in constant time. A configured secret shorter than
 * 16 characters is treated as not configured: it never authorizes a request.
 */
export function verifyCronSecret(provided: string | undefined, configured: string | undefined): boolean {
  const expected = configured?.trim();
  if (expected === undefined || expected.length < 16) return false;

  const candidate = provided?.trim();
  if (candidate === undefined || candidate.length === 0) return false;

  const left = Buffer.from(candidate, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export interface DueProfile {
  readonly id: bigint;
  readonly frequencyMinutes: number;
  readonly lastRunAt: Date | null;
}

/**
 * A profile is due when it has never run or its frequency window has elapsed.
 * Pure by design: the caller injects `now` so tests never depend on the clock.
 */
export function selectDueProfiles<T extends DueProfile>(profiles: readonly T[], now: Date): T[] {
  return profiles.filter((profile) => {
    if (profile.lastRunAt === null) return true;
    return now.getTime() - profile.lastRunAt.getTime() >= Math.max(profile.frequencyMinutes, 1) * 60_000;
  });
}

/**
 * Stable key per profile and frequency window. Repeated cron invocations inside
 * the same window resolve to the same `ScanRun` and are rejected by the unique
 * constraint instead of duplicating evidence.
 */
export function cronBucketKey(profileId: bigint, frequencyMinutes: number, now: Date): string {
  const windowMs = Math.max(frequencyMinutes, 1) * 60_000;
  const bucket = Math.floor(now.getTime() / windowMs);
  return createHash("sha256").update(`cron:${profileId.toString()}:${bucket.toString()}`).digest("hex");
}
