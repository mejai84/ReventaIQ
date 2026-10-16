import { describe, expect, it } from "vitest";

import { BestBuyConnector } from "./best-buy-connector";
import { EbayConnector } from "./ebay-connector";
import { WalmartConnector } from "./walmart-connector";
import {
  CONNECTOR_ENV_VARS,
  ConnectorNotImplementedError,
  describeConnectorSettings,
  readEnvVar,
  ConnectorConfigurationError,
} from "../domain/market-connector";
import { baseQuery } from "./connector-contract";

/**
 * The scaffolds must stay honest:
 * they report missing configuration by variable name and fail loudly instead of
 * returning an empty result set that would look like "no offers found".
 */

const CONFIGURED_ENV: Readonly<Record<string, string>> = {
  EBAY_CLIENT_ID: "placeholder-client-id",
  EBAY_CLIENT_SECRET: "placeholder-client-secret",
  EBAY_ENVIRONMENT: "sandbox",
  BEST_BUY_API_KEY: "placeholder-api-key",
  WALMART_CLIENT_ID: "placeholder-client-id",
  WALMART_CLIENT_SECRET: "placeholder-client-secret",
};

describe("API connector scaffolds", () => {
  const connectors = [new EbayConnector(), new BestBuyConnector(), new WalmartConnector()];

  it("declare their stable keys and marketplaces", () => {
    expect(connectors.map((connector) => connector.key)).toEqual(["ebay", "best-buy", "walmart"]);
    expect(connectors.map((connector) => connector.marketplace)).toEqual([
      "EBAY",
      "BEST_BUY",
      "WALMART",
    ]);
  });

  it("report missing configuration by variable name, never by value", () => {
    expect(new EbayConnector().describeSettings({})).toEqual({
      configured: false,
      missingEnvVars: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_ENVIRONMENT"],
    });
    expect(new BestBuyConnector().describeSettings({ BEST_BUY_API_KEY: "  " })).toEqual({
      configured: false,
      missingEnvVars: ["BEST_BUY_API_KEY"],
    });
    expect(new WalmartConnector().describeSettings(CONFIGURED_ENV)).toEqual({
      configured: true,
      missingEnvVars: [],
    });
  });

  it("advertise capabilities as data", () => {
    expect(new BestBuyConnector().capabilities.openBoxInventory).toBe(true);
    expect(new EbayConnector().capabilities.pushNotifications).toBe(true);
    expect(new WalmartConnector().capabilities.humanOperated).toBe(false);
  });

  it("throw instead of pretending the marketplace has no offers", async () => {
    for (const connector of connectors) {
      await expect(connector.search(baseQuery(), CONFIGURED_ENV)).rejects.toBeInstanceOf(
        ConnectorNotImplementedError,
      );
      await expect(connector.fetchOffer("any-id", CONFIGURED_ENV)).rejects.toBeInstanceOf(
        ConnectorNotImplementedError,
      );
    }
  });

  it("never read process.env or perform network calls", () => {
    // describeSettings must be answerable from injected data alone.
    expect(CONNECTOR_ENV_VARS.manual).toEqual([]);
    expect(describeConnectorSettings("ebay", CONFIGURED_ENV).configured).toBe(true);
  });
});

describe("environment access", () => {
  it("reads a configured value", () => {
    expect(readEnvVar(CONFIGURED_ENV, "BEST_BUY_API_KEY")).toBe("placeholder-api-key");
  });

  it("throws a configuration error naming only the variable", () => {
    expect(() => readEnvVar({}, "BEST_BUY_API_KEY")).toThrow(ConnectorConfigurationError);
    expect(() => readEnvVar({}, "BEST_BUY_API_KEY")).toThrow("BEST_BUY_API_KEY");
  });
});