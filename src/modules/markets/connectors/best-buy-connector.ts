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
 * BestBuyConnector — scaffold, no integration yet.
 *
 * Intended source: Best Buy Products API (catalog, price, availability) plus
 * the Open Box inventory feed, which is the highest-value signal for ReventaIQ
 * because it reports condition and reduced pricing for refurbished units.
 *
 * No request is performed here. Implement only after developer-portal access is
 * granted and `BEST_BUY_API_KEY` exists in the environment.
 */
export class BestBuyConnector implements MarketConnector {
  readonly key = "best-buy" as const;
  readonly marketplace = "BEST_BUY" as const;
  readonly displayName = "Best Buy";
  readonly capabilities: ConnectorCapabilities = {
    searchByKeyword: true,
    searchByProductId: true,
    openBoxInventory: true,
    pushNotifications: false,
    humanOperated: false,
  };

  describeSettings(env: ConnectorEnv): ConnectorSettings {
    return describeConnectorSettings("best-buy", env);
  }

  async search(_query: ConnectorQuery, _env: ConnectorEnv): Promise<ConnectorPage> {
    throw new ConnectorNotImplementedError("best-buy", "BEST_BUY");
  }

  async fetchOffer(_externalOfferId: string, _env: ConnectorEnv): Promise<ProductOffer | undefined> {
    throw new ConnectorNotImplementedError("best-buy", "BEST_BUY");
  }
}