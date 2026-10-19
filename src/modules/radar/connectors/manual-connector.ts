import { createConnector } from "./port";

/** A person captures the observation in the app; nothing is fetched. */
export const manualRadarConnector = createConnector(
  {
    key: "manual",
    mode: "MANUAL",
    label: "Carga manual",
    description: "Una persona registra la observación desde la interfaz. No se realizan solicitudes externas.",
    implemented: true,
    requiresCredentials: false,
    requiredEnvVars: [],
  },
  async () => [],
);
