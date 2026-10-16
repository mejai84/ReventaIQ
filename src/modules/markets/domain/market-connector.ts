import { decimal } from "../../finance/decimal";

import type { MarketplaceId, ProductOffer, StorageGb } from "./product-offer";

/**
 * The single port every market source implements.
 *
 * The Manual connector and the future API connectors are interchangeable from
 * the point of view of the caller: they all return `ProductOffer[]`. Nothing
 * downstream may branch on which connector produced an offer.
 */

export const CONNECTOR_KEYS = [
  "manual",
  "ebay",
  "best-buy",
  "walmart",
  "back-market",
  "amazon",
] as const;

export type ConnectorKey = (typeof CONNECTOR_KEYS)[number];

/**
 * What a connector can actually do, as data rather than as guessed behaviour.
 *
 * The radar uses this to decide whether a source can answer a query instead of
 * discovering the limitation through a failed request.
 */
export interface ConnectorCapabilities {
  readonly searchByKeyword: boolean;
  readonly searchByProductId: boolean;
  /** Marketplace reports a distinct Open Box / refurbished inventory feed. */
  readonly openBoxInventory: boolean;
  /** Marketplace can push inventory or price change notifications. */
  readonly pushNotifications: boolean;
  /** Source is operated by a human; no rate limit applies. */
  readonly humanOperated: boolean;
}

/** Connector-side requirements, expressed as data and passed in by the caller. */
export interface ConnectorQuery {
  /** Free-text search as the marketplace understands it. */
  readonly keyword?: string;
  /** Marketplace product identifier (GTIN/UPC/ASIN/MPN) when supported. */
  readonly productId?: string;
  /** Canonical storage filter applied after normalization. */
  readonly storageGb?: StorageGb;
  /** Upper bound on the listed price, in USD, before shipping and tax. */
  readonly maxPriceUSD?: string;
  readonly limit: number;
  /** Opaque cursor returned by a previous call, for connector-side paging. */
  readonly cursor?: string;
  /**
   * ISO 8601 instant of this scan, injected by the caller.
   * Connectors never read the clock, so every scan stays reproducible.
   */
  readonly requestedAt: string;
}

/** One page of normalized offers plus the paging token for the next call. */
export interface ConnectorPage {
  readonly offers: readonly ProductOffer[];
  readonly nextCursor?: string;
  /**
   * Instant the caller should consider the observation current.
   * Injected by the caller so connectors never read the clock.
   */
  readonly observedAt: string;
}

/** Configuration surface of a connector. Secrets are values, never messages. */
export interface ConnectorSettings {
  /** Whether the connector has everything it needs to run. */
  readonly configured: boolean;
  /** Names of the environment variables that are missing, never their values. */
  readonly missingEnvVars: readonly string[];
}

export interface MarketConnector {
  /** Stable adapter key, matching the `connector_key` stored in the database. */
  readonly key: ConnectorKey;
  readonly marketplace: MarketplaceId;
  readonly displayName: string;
  readonly capabilities: ConnectorCapabilities;

  /** Reports configuration readiness without performing any network call. */
  describeSettings(env: ConnectorEnv): ConnectorSettings;

  /** Returns normalized offers. Never returns provider-specific models. */
  search(query: ConnectorQuery, env: ConnectorEnv): Promise<ConnectorPage>;

  /** Fetches a single offer by marketplace id, or `undefined` when gone. */
  fetchOffer(externalOfferId: string, env: ConnectorEnv): Promise<ProductOffer | undefined>;
}

/**
 * Environment variables available to a connector, injected by the caller.
 *
 * Connectors never read `process.env` directly: secrets arrive as data, which
 * keeps them out of logs, out of traces and out of tests.
 */
export type ConnectorEnv = Readonly<Record<string, string | undefined>>;

/** Environment variable names each connector expects. Names only, no values. */
export const CONNECTOR_ENV_VARS: Readonly<Record<ConnectorKey, readonly string[]>> = {
  manual: [],
  ebay: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET", "EBAY_ENVIRONMENT"],
  "best-buy": ["BEST_BUY_API_KEY"],
  walmart: ["WALMART_CLIENT_ID", "WALMART_CLIENT_SECRET"],
  "back-market": ["BACK_MARKET_API_KEY", "BACK_MARKET_API_SECRET"],
  amazon: ["AMAZON_SP_API_CLIENT_ID", "AMAZON_SP_API_CLIENT_SECRET"],
};

/** Reads a variable and reports its absence by name, never by value. */
export function readEnvVar(env: ConnectorEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new ConnectorConfigurationError(`Missing required environment variable: ${name}`, [name]);
  }
  return value.trim();
}

export function describeConnectorSettings(
  key: ConnectorKey,
  env: ConnectorEnv,
): ConnectorSettings {
  const missingEnvVars = CONNECTOR_ENV_VARS[key].filter((name) => {
    const value = env[name];
    return value === undefined || value.trim().length === 0;
  });
  return { configured: missingEnvVars.length === 0, missingEnvVars };
}

/**
 * Applies a query to offers that are already normalized.
 *
 * Shared by every connector so that a keyword or price filter behaves the same
 * whichever marketplace answered, and so a new connector does not have to
 * reimplement it.
 */
export function applyQueryFilters(
  offers: readonly ProductOffer[],
  query: ConnectorQuery,
): readonly ProductOffer[] {
  const keyword = query.keyword?.trim().toLowerCase();
  const maxPrice = query.maxPriceUSD === undefined ? undefined : decimal(query.maxPriceUSD);

  return offers.filter((offer) => {
    if (keyword !== undefined && keyword.length > 0) {
      const haystack = `${offer.model} ${offer.variant}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }
    if (query.storageGb !== undefined && offer.storageGb !== query.storageGb) {
      return false;
    }
    if (maxPrice !== undefined && offer.priceUSD.greaterThan(maxPrice)) {
      return false;
    }
    return true;
  });
}

/**
 * Slices an already-filtered result into a page.
 * Invalid paging input is rejected: a silent fallback to "first page" would
 * hide a broken scanner cursor.
 */
export function buildConnectorPage(
  matching: readonly ProductOffer[],
  query: ConnectorQuery,
): ConnectorPage {
  if (!Number.isInteger(query.limit) || query.limit <= 0) {
    throw new RangeError("limit must be a positive integer");
  }

  let offset = 0;
  if (query.cursor !== undefined) {
    const parsed = Number.parseInt(query.cursor, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== query.cursor) {
      throw new TypeError("cursor must be the opaque token returned by a previous call");
    }
    offset = parsed;
  }

  const page = matching.slice(offset, offset + query.limit);
  const nextOffset = offset + page.length;

  return {
    offers: page,
    ...(nextOffset < matching.length ? { nextCursor: String(nextOffset) } : {}),
    observedAt: query.requestedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Domain errors                                                              */
/* -------------------------------------------------------------------------- */

/** The connector exists but was not given the configuration it needs. */
export class ConnectorConfigurationError extends Error {
  readonly missingEnvVars: readonly string[];

  constructor(message: string, missingEnvVars: readonly string[] = []) {
    super(message);
    this.name = "ConnectorConfigurationError";
    this.missingEnvVars = missingEnvVars;
  }
}

/**
 * The connector is a scaffold with no API integration yet.
 *
 * Raised instead of returning empty results, so an unfinished integration can
 * never be mistaken for "this marketplace has no offers".
 */
export class ConnectorNotImplementedError extends Error {
  readonly connectorKey: ConnectorKey;

  constructor(connectorKey: ConnectorKey, marketplace: MarketplaceId) {
    super(
      `Connector "${connectorKey}" (${marketplace}) has no integration yet. ` +
        "Implement search/fetchOffer once the API access is confirmed.",
    );
    this.name = "ConnectorNotImplementedError";
    this.connectorKey = connectorKey;
  }
}

/** The marketplace answered, but the payload could not be normalized. */
export class OfferNormalizationError extends Error {
  readonly marketplace: MarketplaceId;
  override readonly cause: unknown;

  constructor(marketplace: MarketplaceId, cause: unknown) {
    super(`Could not normalize ${marketplace} offer payload`);
    this.name = "OfferNormalizationError";
    this.marketplace = marketplace;
    this.cause = cause;
  }
}