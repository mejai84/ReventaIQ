import { createConnector } from "./port";

/**
 * Authorized inventory/price feed. Same gate as the API connector: explicit
 * enablement plus credentials in the environment, never in code or forms.
 */
export const feedRadarConnector = createConnector(
  {
    key: "feed",
    mode: "FEED",
    label: "Feed autorizado",
    description: "Feed de inventario o precios publicado por el proveedor. Requiere habilitación explícita.",
    implemented: false,
    requiresCredentials: true,
    requiredEnvVars: ["RADAR_FEED_URL", "RADAR_FEED_TOKEN"],
    enableEnvVar: "RADAR_FEED_ENABLED",
  },
  async () => [],
);
