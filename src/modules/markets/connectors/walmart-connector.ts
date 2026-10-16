import {
  type ConnectorCapabilities,
  type ConnectorEnv,
  type ConnectorPage,
  type ConnectorQuery,
  type ConnectorSettings,
  type MarketConnector,
  ConnectorNotImplementedError,
  describeConnectorSettings,
} from "../domain/market-connector";
import type { ProductOffer } from "../domain/product-offer";

/**
 * WalmartConnector — scaffold, no integration yet.
 *
 * Intended source: Walmart Item Search API (search by keyword, UPC, GTIN,
 * EAN, ISBN, ASIN). Its documentation lives inside the Walmart Marketplace
 * ecosystem, so onboarding requirements must be reviewed before ReventaIQ
 * treats it as a public price comparator.
 *
 * No request is performed here and no endpoint is assumed.
 */
export class WalmartConnector implements MarketConnector {
  readonly key = "walmart" as const;
  readonly marketplace = "WALMART" as const;
  readonly displayName = "Walmart";
  readonly capabilities: ConnectorCapabilities = {
    searchByKeyword: true,
    searchByProductId: true,
    openBoxInventory: false,
    pushNotifications: false,
    humanOperated: false,
  };

  describeSettings(env: ConnectorEnv): ConnectorSettings {
    return describeConnectorSettings("walmart", env);
  }

  async search(_query: ConnectorQuery, _env: ConnectorEnv): Promise<ConnectorPage> {
    throw new ConnectorNotImplementedError("walmart", "WALMART");
  }

  async fetchOffer(_externalOfferId: string, _env: ConnectorEnv): Promise<ProductOffer | undefined> {
    throw new ConnectorNotImplementedError("walmart", "WALMART");
  }
}