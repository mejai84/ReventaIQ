import { createConnector } from "./port";

/** Explicitly unsupported: Radar never scrapes public web pages. */
export const webPublicRadarConnector = createConnector(
  {
    key: "web-public",
    mode: "WEB_PUBLIC",
    label: "Web pública",
    description: "No soportada. Radar no hace scraping ni automatiza navegación de marketplaces.",
    implemented: false,
    requiresCredentials: false,
    requiredEnvVars: [],
    unsupported: true,
  },
  async () => [],
);
