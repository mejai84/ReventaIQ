import { describe, expect, it } from "vitest";
import {
  apiRadarConnector,
  csvRadarConnector,
  fakeRadarConnector,
  feedRadarConnector,
  findRadarConnectorByKey,
  findRadarConnectorByMode,
  manualRadarConnector,
  readRadarConnectorEnv,
  webPublicRadarConnector,
} from "./index";

const query = { sourceKey: "manual", requestedAt: "2026-10-19T12:00:00Z", limit: 10 };

describe("radar connectors", () => {
  it("keeps manual and CSV available without credentials", () => {
    expect(manualRadarConnector.describe({}).state).toBe("CONFIGURED");
    expect(csvRadarConnector.describe({}).state).toBe("CONFIGURED");
    expect(findRadarConnectorByMode("MANUAL")).toBe(manualRadarConnector);
    expect(findRadarConnectorByMode("CSV")).toBe(csvRadarConnector);
    expect(findRadarConnectorByKey("csv")).toBe(csvRadarConnector);
  });

  it("disables API and feed until credentials and explicit enablement exist", () => {
    expect(apiRadarConnector.describe({})).toEqual({
      state: "MISSING_CREDENTIALS",
      missingEnvVars: ["RADAR_API_BASE_URL", "RADAR_API_TOKEN"],
      requiresCredentials: true,
    });
    expect(
      apiRadarConnector.describe({
        RADAR_API_BASE_URL: "https://api.example.com",
        RADAR_API_TOKEN: "secret",
      }).state,
    ).toBe("DISABLED");
    expect(
      apiRadarConnector.describe({
        RADAR_API_BASE_URL: "https://api.example.com",
        RADAR_API_TOKEN: "secret",
        RADAR_API_ENABLED: "true",
      }).state,
    ).toBe("CONFIGURED");
    expect(feedRadarConnector.describe({})).toEqual({
      state: "MISSING_CREDENTIALS",
      missingEnvVars: ["RADAR_FEED_URL", "RADAR_FEED_TOKEN"],
      requiresCredentials: true,
    });
  });

  it("never lists a secret value, only variable names", () => {
    const status = apiRadarConnector.describe({
      RADAR_API_BASE_URL: "https://api.example.com",
      RADAR_API_TOKEN: "super-secret-token",
    });
    expect(JSON.stringify(status)).not.toContain("super-secret-token");
    expect(status.missingEnvVars).toEqual([]);
  });

  it("refuses to fetch from unimplemented or unsupported connectors", async () => {
    await expect(apiRadarConnector.fetchCandidates(query, {})).rejects.toMatchObject({
      code: "missing-credentials",
    });
    await expect(
      apiRadarConnector.fetchCandidates(query, {
        RADAR_API_BASE_URL: "https://api.example.com",
        RADAR_API_TOKEN: "secret",
        RADAR_API_ENABLED: "true",
      }),
    ).rejects.toMatchObject({ code: "not-implemented" });
    expect(webPublicRadarConnector.describe({}).state).toBe("UNSUPPORTED");
    await expect(webPublicRadarConnector.fetchCandidates(query, {})).rejects.toMatchObject({
      code: "unsupported",
    });
    expect(findRadarConnectorByMode("WEB_PUBLIC")).toBe(webPublicRadarConnector);
  });

  it("returns deterministic candidates from the test connector", async () => {
    const first = await fakeRadarConnector.fetchCandidates(query, {});
    const second = await fakeRadarConnector.fetchCandidates(query, {});
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      sourceKey: "manual",
      externalListingId: "fake-1",
      title: "Listado de prueba",
      currency: "USD",
      availability: "IN_STOCK",
      observedAt: "2026-10-19T12:00:00Z",
    });
    expect(second[0]?.price?.toString()).toBe(first[0]?.price?.toString());
  });

  it("reports malformed environment values by name without leaking them", () => {
    const report = readRadarConnectorEnv({
      RADAR_API_ENABLED: "yes",
      RADAR_FEED_URL: "file:///etc/passwd",
      RADAR_FEED_TOKEN: "feed-secret",
    });
    expect(report.issues).toEqual([
      { name: "RADAR_API_ENABLED", code: "boolean" },
      { name: "RADAR_FEED_URL", code: "url" },
    ]);
    expect(JSON.stringify(report.issues)).not.toContain("feed-secret");
    expect(JSON.stringify(report.issues)).not.toContain("passwd");
  });
});
