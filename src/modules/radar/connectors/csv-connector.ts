import { createConnector } from "./port";

/** CSV rows arrive from the authenticated import form, not from the network. */
export const csvRadarConnector = createConnector(
  {
    key: "csv",
    mode: "CSV",
    label: "Importación CSV",
    description: "Plantilla estricta de hasta 1.000 filas. El archivo lo aporta el usuario autenticado.",
    implemented: true,
    requiresCredentials: false,
    requiredEnvVars: [],
  },
  async () => [],
);
