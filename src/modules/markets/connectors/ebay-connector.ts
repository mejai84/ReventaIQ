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
 * EbayConnector — scaffold, no integration yet.
 *
 * Intended source: eBay Browse API (search by keyword, category, GTIN).
 * Nothing here performs a request: per `docs/architecture/overview.md`
 * ("No se implementará un conector sin confirmar una API, feed, archivo
 * autorizado o permiso de uso"), the adapter stays empty until API access is
 * confirmed and credentials exist in the environment.
 *
 * `search` throws `ConnectorNotImplementedError` on purpose: an unfinished
 * connector must never look like "this marketplace has no offers".
 */
export class EbayConnector implements MarketConnector {
  readonly key = "ebay" as const;
  readonly marketplace = "EBAY" as const;
  readonly displayName = "eBay";
  readonly capabilities: ConnectorCapabilities = {
    searchByKeyword: true,
    searchByProductId: true,
    openBoxInventory: false,
    pushNotifications: true,
    humanOperated: false,
  };

  describeSettings(env: ConnectorEnv): ConnectorSettings {
    return describeConnectorSettings("ebay", env);
  }

  async search(_query: ConnectorQuery, _env: ConnectorEnv): Promise<ConnectorPage> {
    throw new ConnectorNotImplementedError("ebay", "EBAY");
  }

  async fetchOffer(_externalOfferId: string, _env: ConnectorEnv): Promise<ProductOffer | undefined> {
    throw new ConnectorNotImplementedError("ebay", "EBAY");
  }
}