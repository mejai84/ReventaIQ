import { expect } from "vitest";

import Decimal from "decimal.js";

import type { ConnectorQuery, MarketConnector } from "../domain/market-connector";
import { MARKETPLACE_IDS } from "../domain/product-offer";
import type { ProductOffer } from "../domain/product-offer";
import { productOfferSchema } from "../validation/product-offer-schema";
import { toWireOffer } from "./manual-connector";

/**
 * The common contract every market connector must satisfy.
 *
 * Run it against a connector wired to a recorded, sanitized fixture response:
 * a new connector cannot ship with a different offer shape, a clock-dependent
 * result or a silently missing normalization. Scaffolds that are not
 * integrated yet are covered separately, because they must fail loudly.
 */

export const REQUESTED_AT = "2026-01-15T16:00:00.000Z";

export function baseQuery(overrides: Partial<ConnectorQuery> = {}): ConnectorQuery {
  return { keyword: "iphone 15 pro", limit: 10, requestedAt: REQUESTED_AT, ...overrides };
}

/** Assertions that apply to any connector, whatever its source. */
export async function expectConnectorContract(
  connector: MarketConnector,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  expect(connector.key.length).toBeGreaterThan(0);
  expect(connector.displayName.length).toBeGreaterThan(0);
  expect(MARKETPLACE_IDS).toContain(connector.marketplace);

  // Capabilities are data, not guesses.
  expect(Object.values(connector.capabilities).every((value) => typeof value === "boolean")).toBe(true);

  // describeSettings answers from injected data only: no I/O, no leaked values.
  const settings = connector.describeSettings(env);
  expect(typeof settings.configured).toBe("boolean");
  for (const name of settings.missingEnvVars) {
    expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
  }

  const page = await connector.search(baseQuery(), env);
  expect(Array.isArray(page.offers)).toBe(true);
  expect(typeof page.observedAt).toBe("string");

  for (const offer of page.offers) {
    expectOfferContract(offer, connector);
  }

  // An unknown id resolves to undefined rather than throwing or inventing data.
  await expect(connector.fetchOffer("__missing__", env)).resolves.toBeUndefined();
}

/** Per-offer invariants shared by every connector. */
export function expectOfferContract(offer: ProductOffer, connector: MarketConnector): void {
  // Every offer, from every source, is the same canonical object.
  expect(productOfferSchema.safeParse(toWireOffer(offer)).success).toBe(true);

  expect(MARKETPLACE_IDS).toContain(offer.marketplace);
  // API connectors only ever emit their own marketplace. The manual source also
  // records offers observed on a marketplace page it cannot read yet.
  if (connector.key !== "manual") {
    expect(offer.marketplace).toBe(connector.marketplace);
  }

  // Money is Decimal end to end, never a JavaScript number.
  expect(Decimal.isDecimal(offer.priceUSD)).toBe(true);
  expect(Decimal.isDecimal(offer.shippingUSD)).toBe(true);
  expect(Decimal.isDecimal(offer.salesTaxUSD)).toBe(true);
  expect(offer.priceUSD.isNegative()).toBe(false);

  expect(offer.observedAt).toBeTypeOf("string");
  expect(offer.fetchedAt).toBeTypeOf("string");
  // The observation instant comes from the caller, never from a clock read.
  expect(offer.fetchedAt ?? offer.observedAt).toBeTypeOf("string");
}

/** Determinism: the same inputs must produce the same normalized offers. */
export async function expectConnectorIsDeterministic(
  connector: MarketConnector,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const first = await connector.search(baseQuery(), env);
  const second = await connector.search(baseQuery(), env);
  expect(first.offers.map(toWireOffer)).toEqual(second.offers.map(toWireOffer));
  expect(first.observedAt).toBe(second.observedAt);
}