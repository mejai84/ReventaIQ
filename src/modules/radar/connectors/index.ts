import type { RadarSourceMode } from "../domain";
import { apiRadarConnector } from "./api-connector";
import { csvRadarConnector } from "./csv-connector";
import { fakeRadarConnector } from "./fake-connector";
import { feedRadarConnector } from "./feed-connector";
import { manualRadarConnector } from "./manual-connector";
import type { RadarConnector } from "./port";
import { webPublicRadarConnector } from "./web-public-connector";

export * from "./api-connector";
export * from "./csv-connector";
export * from "./env";
export * from "./fake-connector";
export * from "./feed-connector";
export * from "./manual-connector";
export * from "./port";
export * from "./web-public-connector";

/** Production connectors. The test-only fake is deliberately excluded. */
export const RADAR_CONNECTORS = [
  manualRadarConnector,
  csvRadarConnector,
  apiRadarConnector,
  feedRadarConnector,
  webPublicRadarConnector,
] as const;

export const RADAR_TEST_CONNECTORS = [fakeRadarConnector] as const;

export function findRadarConnectorByMode(mode: RadarSourceMode): RadarConnector | undefined {
  return RADAR_CONNECTORS.find((connector) => connector.mode === mode);
}

export function findRadarConnectorByKey(key: string): RadarConnector | undefined {
  return RADAR_CONNECTORS.find((connector) => connector.key === key);
}
