import { z } from "zod";

import { decimal } from "../../finance/decimal";

import {
  CARRIER_LOCK_STATES,
  MARKETPLACES,
  OFFER_CONDITIONS,
  SIM_FORMATS,
  STORAGE_CAPACITIES_GB,
  type StorageGb,
} from "../domain/product-offer";

/**
 * Zod schemas for data entering the domain from outside.
 *
 * Money and rates arrive as strings (ADR-0002) and are validated as Decimal, so
 * an invalid payload fails at the boundary instead of corrupting an analysis.
 */

const DECIMAL_STRING = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const HTTP_URL = /^https:\/\/\S+$/;
const CURRENCY_AMOUNT = /^\d+(?:\.\d{1,4})?$/;

export const isoDateStringSchema = z.string().regex(ISO_DATE, "must be an ISO 8601 instant");

export const httpsUrlSchema = z.string().regex(HTTP_URL, "must be an https URL");

const rateSchema = z
  .string()
  .regex(DECIMAL_STRING, "must be a decimal fraction")
  .transform((value) => decimal(value))
  .refine((value) => value.isFinite() && !value.isNegative() && value.lessThanOrEqualTo(1), {
    message: "must be between 0 and 1",
  });

const moneyUsdSchema = z
  .string()
  .regex(CURRENCY_AMOUNT, "must be a non-negative amount with up to 4 decimals")
  .transform((value) => decimal(value))
  .refine((value) => value.isFinite() && !value.isNegative(), { message: "must not be negative" });

/** Wire shape of a normalized offer, as stored or transported. */
export const productOfferSchema = z
  .object({
    id: z.string().min(1),
    marketplace: z.enum(MARKETPLACES),
    externalId: z.string().min(1).optional(),
    seller: z.object({
      name: z.string().min(1),
      externalSellerId: z.string().min(1).optional(),
      ratingRate: rateSchema.optional(),
      reviewCount: z.number().int().nonnegative().optional(),
      isVerified: z.boolean().optional(),
      countryCode: z
        .string()
        .regex(/^[A-Z]{2}$/, "must be a two-letter uppercase country code")
        .optional(),
    }),
    model: z.string().min(1),
    variant: z.string().min(1),
    variantKey: z.string().min(1),
    storageGb: z.union(
      STORAGE_CAPACITIES_GB.map((capacity) => z.literal(capacity)) as unknown as [
        z.ZodLiteral<StorageGb>,
        ...z.ZodLiteral<StorageGb>[],
      ],
    ),
    condition: z.enum(OFFER_CONDITIONS),
    batteryHealthRate: rateSchema.optional(),
    carrier: z
      .object({
        name: z.string().min(1),
        lockState: z.enum(CARRIER_LOCK_STATES),
      })
      .optional(),
    simFormat: z.enum(SIM_FORMATS),
    priceUSD: moneyUsdSchema,
    shippingUSD: moneyUsdSchema,
    salesTaxUSD: moneyUsdSchema,
    url: httpsUrlSchema,
    imageUrl: httpsUrlSchema.optional(),
    warrantyDays: z.number().int().nonnegative().optional(),
    observedAt: isoDateStringSchema,
    fetchedAt: isoDateStringSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type ProductOfferInput = z.input<typeof productOfferSchema>;
export type ProductOfferOutput = z.output<typeof productOfferSchema>;

/**
 * Validates and converts a wire payload into a `ProductOffer`.
 * Throws a `ZodError` on invalid input; callers decide how to surface it.
 */
export function parseProductOffer(input: unknown) {
  return productOfferSchema.parse(input);
}