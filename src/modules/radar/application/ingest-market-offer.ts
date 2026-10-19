import { analyzeOpportunity, type OpportunityAnalysis, type OpportunityEngineInput, type ProductOffer as OpportunityProductOffer } from "../../opportunities/domain";
import { toOpportunityOffer, type MarketOfferConversion, type MarketOfferConversionPolicy, type VariantResolver } from "../../markets/application";
import { buildManualOffer, type ManualOfferRegistration } from "../../markets/connectors";
import type { ProductOffer } from "../../markets/domain";
import { importRadarCandidate, type RadarStore } from "./import-candidate";
import type { ListingCandidate } from "../domain";

const MAX_CSV_ROWS = 1_000;

export interface RadarOpportunityEvaluator {
  buildInput(offer: OpportunityProductOffer): OpportunityEngineInput;
}

export interface RadarIngestionResult {
  readonly importResult: ReturnType<typeof importRadarCandidate>;
  readonly conversion: MarketOfferConversion;
  readonly analysis?: OpportunityAnalysis;
}

function toCandidate(offer: ProductOffer): ListingCandidate {
  return {
    sourceKey: offer.marketplace.toLowerCase(),
    ...(offer.externalId === undefined ? {} : { externalListingId: offer.externalId }),
    canonicalUrl: offer.url,
    ...(offer.seller.externalSellerId === undefined ? {} : { sellerExternalId: offer.seller.externalSellerId }),
    title: offer.variant,
    sourceCondition: offer.condition,
    price: offer.priceUSD,
    currency: "USD",
    availability: "IN_STOCK",
    observedAt: offer.observedAt,
    attributes: offer.attributes,
  };
}

export function ingestManualOffer(
  store: RadarStore,
  registration: ManualOfferRegistration,
  policy: MarketOfferConversionPolicy,
  resolveVariant: VariantResolver,
  evaluator?: RadarOpportunityEvaluator,
): RadarIngestionResult {
  const offer = buildManualOffer(registration);
  const importResult = importRadarCandidate(store, toCandidate(offer));
  const conversion = toOpportunityOffer(offer, policy, resolveVariant);
  if (conversion.status !== "READY" || evaluator === undefined) return { importResult, conversion };
  return { importResult, conversion, analysis: analyzeOpportunity(evaluator.buildInput(conversion.offer)) };
}

/** CSV parsing belongs to the boundary/UI. This validates a bounded typed row set before ingestion. */
export function ingestCsvRows(
  store: RadarStore,
  rows: readonly ManualOfferRegistration[],
  policy: MarketOfferConversionPolicy,
  resolveVariant: VariantResolver,
  evaluator?: RadarOpportunityEvaluator,
): readonly RadarIngestionResult[] {
  if (rows.length > MAX_CSV_ROWS) throw new RangeError(`CSV import exceeds ${MAX_CSV_ROWS} rows`);
  return rows.map((row) => ingestManualOffer(store, row, policy, resolveVariant, evaluator));
}