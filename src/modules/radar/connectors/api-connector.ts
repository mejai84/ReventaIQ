import { createConnector } from "./port";

/**
 * Authorized marketplace API. Kept as a scaffold until the user provides a
 * provider, contract and credentials. It is disabled unless the environment
 * carries both the credentials and `RADAR_API_ENABLED=true`.
 */
export const apiRadarConnector = createConnector(
  {
    key: "api",
    mode: "API",
    label: "API de marketplace",
    description: "Conector HTTP para un proveedor autorizado. La URL y el token viven solo en el entorno.",
    implemented: false,
    requiresCredentials: true,
    requiredEnvVars: ["RADAR_API_BASE_URL", "RADAR_API_TOKEN"],
    enableEnvVar: "RADAR_API_ENABLED",
  },
  async () => [],
);
