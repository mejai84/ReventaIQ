import { describe, expect, it } from "vitest";
import { cronBucketKey, selectDueProfiles, verifyCronSecret } from "./scheduled-scan";

describe("verifyCronSecret", () => {
  const secret = "radar-cron-secret-32-bytes-long";

  it("accepts only an exact match", () => {
    expect(verifyCronSecret(secret, secret)).toBe(true);
    expect(verifyCronSecret("wrong-secret-value", secret)).toBe(false);
    expect(verifyCronSecret(undefined, secret)).toBe(false);
    expect(verifyCronSecret("", secret)).toBe(false);
  });

  it("refuses a short configured secret instead of authorizing it", () => {
    expect(verifyCronSecret("short", "short")).toBe(false);
    expect(verifyCronSecret("short", undefined)).toBe(false);
  });

  it("does not throw on different lengths", () => {
    expect(verifyCronSecret("a", secret)).toBe(false);
    expect(verifyCronSecret(secret, "a")).toBe(false);
  });
});

describe("selectDueProfiles", () => {
  const now = new Date("2026-10-19T12:00:00Z");

  it("selects profiles that never ran or whose window elapsed", () => {
    const profiles = [
      { id: 1n, frequencyMinutes: 60, lastRunAt: null },
      { id: 2n, frequencyMinutes: 60, lastRunAt: new Date("2026-10-19T11:00:00Z") },
      { id: 3n, frequencyMinutes: 60, lastRunAt: new Date("2026-10-19T10:59:59Z") },
    ];
    expect(selectDueProfiles(profiles, now).map((profile) => profile.id.toString())).toEqual(["1", "2", "3"]);
  });

  it("skips profiles still inside their window", () => {
    const profiles = [
      { id: 1n, frequencyMinutes: 60, lastRunAt: new Date("2026-10-19T11:30:00Z") },
      { id: 2n, frequencyMinutes: 1440, lastRunAt: new Date("2026-10-19T01:00:00Z") },
    ];
    expect(selectDueProfiles(profiles, now)).toEqual([]);
  });
});

describe("cronBucketKey", () => {
  it("is stable inside a window and changes across windows", () => {
    const first = cronBucketKey(7n, 60, new Date("2026-10-19T12:00:00Z"));
    const same = cronBucketKey(7n, 60, new Date("2026-10-19T12:59:59Z"));
    const next = cronBucketKey(7n, 60, new Date("2026-10-19T13:00:00Z"));
    const otherProfile = cronBucketKey(8n, 60, new Date("2026-10-19T12:00:00Z"));
    expect(same).toBe(first);
    expect(next).not.toBe(first);
    expect(otherProfile).not.toBe(first);
  });
});
