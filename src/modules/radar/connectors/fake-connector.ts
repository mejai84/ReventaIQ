import Decimal from "decimal.js";
import { createConnector } from "./port";

/**
 * Deterministic connector used by tests and local development. It never opens
 * a socket and is excluded from the production status screen.
 */
export const fakeRadarConnector = createConnector(
  {
    key: "fake",
    mode: "API",
    label: "Conector de prueba",
    description: "Devuelve un listado determinista. Solo pruebas; no realiza solicitudes.",
    implemented: true,
    requiresCredentials: false,
    requiredEnvVars: [],
    testOnly: true,
  },
  async (query) => [
    {
      sourceKey: query.sourceKey,
      externalListingId: "fake-1",
      canonicalUrl: "https://example.invalid/fake-1",
      title: "Listado de prueba",
      price: new Decimal("100.00"),
      currency: "USD",
      availability: "IN_STOCK",
      observedAt: query.requestedAt,
      attributes: { confidence: 80 },
    },
  ],
);
