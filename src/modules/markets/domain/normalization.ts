import Decimal from "decimal.js";

import { DECIMAL_HUNDRED, assertRate, decimal } from "../../finance/decimal";

import {
  type CarrierLockState,
  type MarketplaceId,
  type OfferCondition,
  type SellerProfile,
  type SimFormat,
  type StorageGb,
  STORAGE_CAPACITIES_GB,
} from "./product-offer";

/**
 * Normalization of connector-specific vocabularies.
 *
 * Every function here is pure, total and deterministic: an unrecognized input
 * yields `UNKNOWN`/`undefined` instead of a guess. Connectors call these
 * functions so that the same word means the same thing regardless of the
 * marketplace it came from.
 */

/* -------------------------------------------------------------------------- */
/* Condition                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Exact tokens per marketplace vocabulary, already uppercased.
 * Keys are matched after trimming, collapsing whitespace and uppercasing.
 */
const CONDITION_TOKENS: Readonly<Record<string, OfferCondition>> = {
  // Shared retail vocabulary.
  NEW: "NEW",
  SEALED: "SEALED",
  BRAND_NEW: "NEW",
  "BRAND NEW": "NEW",
  OPEN_BOX: "OPEN_BOX",
  "OPEN BOX": "OPEN_BOX",
  OPENBOX: "OPEN_BOX",
  LIKE_NEW: "LIKE_NEW",
  "LIKE NEW": "LIKE_NEW",
  EXCELLENT: "EXCELLENT",
  GOOD: "GOOD",
  FAIR: "FAIR",
  USED: "USED",
  PRE_OWNED: "USED",
  "PRE OWNED": "USED",
  "PRE-OWNED": "USED",
  FOR_PARTS: "FOR_PARTS",
  "FOR PARTS": "FOR_PARTS",
  "PARTS ONLY": "FOR_PARTS",
  "NOT WORKING": "FOR_PARTS",
  REFURBISHED: "USED",
  "SELLER REFURBISHED": "USED",
  "EXCELLENT REFURBISHED": "EXCELLENT",
  "VERY GOOD REFURBISHED": "GOOD",
  "GOOD REFURBISHED": "GOOD",

  // eBay style: "New", "Used - Excellent", "New other".
  "USED - EXCELLENT": "EXCELLENT",
  "USED - VERY GOOD": "GOOD",
  "USED - GOOD": "GOOD",
  "USED - ACCEPTABLE": "FAIR",
  "FOR PARTS OR NOT WORKING": "FOR_PARTS",
  "NEW OTHER": "LIKE_NEW",
  "NEW - OPEN BOX": "OPEN_BOX",
};

/** Ordered rules applied when no exact token matches. */
const CONDITION_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly condition: OfferCondition;
}[] = [
  { pattern: /\bfor parts\b|\bnot working\b|\bas is\b/i, condition: "FOR_PARTS" },
  { pattern: /\bopen box\b|\bopen-box\b|\bopenbox\b/i, condition: "OPEN_BOX" },
  { pattern: /\bsealed\b/i, condition: "SEALED" },
  { pattern: /\blike new\b|\bnear mint\b|\bmint\b|\bnew other\b/i, condition: "LIKE_NEW" },
  { pattern: /\bexcellent\b/i, condition: "EXCELLENT" },
  { pattern: /\bvery good\b/i, condition: "GOOD" },
  { pattern: /\bgood\b/i, condition: "GOOD" },
  { pattern: /\bacceptable\b|\bfair\b/i, condition: "FAIR" },
  { pattern: /\brefurb|\brenewed\b|\bpre[- ]?owned\b|\bused\b/i, condition: "USED" },
  { pattern: /\bbrand new\b|^new$|\bnew\b/i, condition: "NEW" },
];

/**
 * Maps a free-text marketplace condition to the canonical vocabulary.
 * Anything not recognized becomes `UNKNOWN`, never a default.
 */
export function normalizeCondition(raw: string | null | undefined): OfferCondition {
  const token = normalizeToken(raw);
  if (token.length === 0) {
    return "UNKNOWN";
  }

  const exact = Object.prototype.hasOwnProperty.call(CONDITION_TOKENS, token)
    ? CONDITION_TOKENS[token]
    : undefined;
  if (exact !== undefined) {
    return exact;
  }

  for (const rule of CONDITION_PATTERNS) {
    if (rule.pattern.test(token)) {
      return rule.condition;
    }
  }

  return "UNKNOWN";
}

/* -------------------------------------------------------------------------- */
/* Operator (seller / merchant)                                                */
/* -------------------------------------------------------------------------- */

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export interface SellerNormalizationInput {
  readonly name: string | null | undefined;
  readonly externalSellerId?: string;
  /** Percentage in [0, 100] as commonly reported by marketplaces. */
  readonly ratingPercent?: number | string;
  /** Fraction in [0, 1], used as-is when the source already reports a rate. */
  readonly ratingRate?: string;
  readonly reviewCount?: number;
  readonly isVerified?: boolean;
  readonly countryCode?: string;
}

/**
 * Converts a marketplace seller record into a `SellerProfile`.
 *
 * Ratings are normalized to a fraction in [0, 1]. An out-of-range rating is
 * rejected instead of clamped, because a clamped rating would silently
 * overstate seller quality.
 */
export function normalizeSeller(input: SellerNormalizationInput): SellerProfile {
  const name = normalizeToken(input.name);
  if (name.length === 0) {
    throw new TypeError("seller name is required");
  }

  const ratingRate = normalizeRatingRate(input);

  return {
    name,
    ...(input.externalSellerId === undefined ? {} : { externalSellerId: input.externalSellerId }),
    ...(ratingRate === undefined ? {} : { ratingRate }),
    ...(input.reviewCount === undefined ? {} : { reviewCount: assertNonNegativeInteger(input.reviewCount, "seller reviewCount") }),
    ...(input.isVerified === undefined ? {} : { isVerified: input.isVerified }),
    ...(input.countryCode === undefined ? {} : { countryCode: normalizeCountryCode(input.countryCode) }),
  };
}

function normalizeRatingRate(input: SellerNormalizationInput): Decimal | undefined {
  if (input.ratingRate !== undefined) {
    const rate = decimal(input.ratingRate);
    assertRate(rate, "seller rating rate");
    return rate;
  }

  if (input.ratingPercent === undefined) {
    return undefined;
  }

  const percent =
    typeof input.ratingPercent === "number"
      ? new Decimal(input.ratingPercent)
      : decimal(input.ratingPercent);
  if (percent.isNegative() || percent.greaterThan(100)) {
    throw new RangeError("seller rating percent must be between 0 and 100");
  }

  return percent.dividedBy(DECIMAL_HUNDRED);
}

function normalizeCountryCode(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(normalized)) {
    throw new TypeError(`countryCode must be two uppercase letters: ${countryCode}`);
  }
  return normalized;
}

function assertNonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

/** Matches a capacity with its unit: `128GB`, `256 gb`, `1TB`, `1 terabyte`, `512G`. */
const STORAGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*(terabytes?|tb|gigabytes?|gb|g)\b/gi;

export function normalizeStorageGb(raw: string | number | null | undefined): StorageGb | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }

  const token = normalizeToken(typeof raw === "number" ? String(raw) : raw);
  if (token.length === 0) {
    return undefined;
  }

  // A title contains several numbers ("iPhone 15 Pro 128GB"): the first one that
  // maps to a real capacity wins, so the model generation is never mistaken
  // for a storage size.
  for (const match of token.matchAll(STORAGE_PATTERN)) {
    const amount = decimal((match[1] ?? "").replace(",", "."));
    const unit = (match[2] ?? "").toLowerCase();
    const gb = unit.startsWith("t") ? amount.times(1024) : amount;

    const capacity = STORAGE_CAPACITIES_GB.find((candidate) => new Decimal(candidate).equals(gb));
    if (capacity !== undefined) {
      return capacity;
    }
  }

  // Bare number, e.g. "128" typed in the storage field.
  const bare = /^\d+$/.test(token) ? STORAGE_CAPACITIES_GB.find((c) => new Decimal(c).equals(token)) : undefined;
  return bare;
}

/* -------------------------------------------------------------------------- */
/* Variant                                                                    */
/* -------------------------------------------------------------------------- */

/** Collapses spacing and case without losing alphanumerics or separators. */
function normalizeToken(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    return "";
  }
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Lowercase slug safe for grouping keys: `iPhone 15 Pro 128GB` -> `iphone-15-pro-128`. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Canonical key identifying a purchasable variant.
 *
 * Condition is intentionally excluded: two offers of the same variant in
 * different conditions are the same variant with different quality, and the
 * Opportunity Engine compares them through `condition`.
 */
export function buildVariantKey(input: {
  /** Deprecated compatibility input. Source identity never enters the result. */
  readonly marketplace?: MarketplaceId;
  readonly model: string;
  readonly storageGb?: StorageGb;
}): string {
  const model = slugify(input.model);
  if (model.length === 0) {
    throw new TypeError("model is required to build a variant key");
  }
  return input.storageGb === undefined ? model : `${model}-${input.storageGb}`;
}

/** Grouping key across marketplaces: `iphone-15-pro-128`. */
export function buildComparableGroupKey(model: string, storageGb: StorageGb): string {
  return `${slugify(model)}-${storageGb}`;
}

/* -------------------------------------------------------------------------- */
/* Carrier and SIM                                                            */
/* -------------------------------------------------------------------------- */

const LOCK_TOKENS: Readonly<Record<string, CarrierLockState>> = {
  UNLOCKED: "UNLOCKED",
  "UNLOCKED (FACTORY)": "UNLOCKED",
  FACTORY_UNLOCKED: "UNLOCKED",
  FREE: "UNLOCKED",
  "CARRIER LOCKED": "CARRIER_LOCKED",
  LOCKED: "CARRIER_LOCKED",
  "FINANCE LOCKED": "FINANCE_LOCKED",
  FINANCED: "FINANCE_LOCKED",
  "PARTIALLY LOCKED": "PARTIALLY_LOCKED",
};

export function normalizeCarrierLockState(raw: string | null | undefined): CarrierLockState {
  const token = normalizeToken(raw);
  if (token.length === 0) {
    return "UNKNOWN";
  }

  if (Object.prototype.hasOwnProperty.call(LOCK_TOKENS, token)) {
    return LOCK_TOKENS[token] as CarrierLockState;
  }
  if (token.includes("UNLOCK") || token === "FREE" || token.includes("NO LOCK")) {
    return "UNLOCKED";
  }
  if (token.includes("FINANCE")) {
    return "FINANCE_LOCKED";
  }
  if (token.includes("PARTIAL")) {
    return "PARTIALLY_LOCKED";
  }
  if (token.includes("LOCK")) {
    return "CARRIER_LOCKED";
  }
  return "UNKNOWN";
}

const SIM_TOKENS: Readonly<Record<string, SimFormat>> = {
  PHYSICAL: "PHYSICAL",
  "PHYSICAL SIM": "PHYSICAL",
  SIM: "PHYSICAL",
  ESIM: "ESIM",
  "E-SIM": "ESIM",
  "E SIM": "ESIM",
  HYBRID: "HYBRID",
  "DUAL SIM": "HYBRID",
  "DUAL-SIM": "HYBRID",
};

export function normalizeSimFormat(raw: string | null | undefined): SimFormat {
  const token = normalizeToken(raw);
  if (token.length === 0) {
    return "UNKNOWN";
  }
  if (Object.prototype.hasOwnProperty.call(SIM_TOKENS, token)) {
    return SIM_TOKENS[token] as SimFormat;
  }
  if (token.includes("E-SIM") || token.includes("ESIM")) {
    return "ESIM";
  }
  if (token.includes("HYBRID") || token.includes("DUAL")) {
    return "HYBRID";
  }
  if (token.includes("SIM")) {
    return "PHYSICAL";
  }
  return "UNKNOWN";
}

/** Best-effort extraction of "iPhone 15 Pro Max" from a marketplace title. */
export function extractModelFromTitle(title: string): string | undefined {
  const match = /\biphone\s+([0-9]{1,2})(?!\d)\s*(pro\s*max|pro|max|plus|mini)?/i.exec(title);
  if (match === null) {
    return undefined;
  }

  const generation = match[1];
  if (generation === undefined) {
    return undefined;
  }

  const suffix = match[2] === undefined ? "" : ` ${titleCase(match[2])}`;
  return `iPhone ${generation}${suffix}`;
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}
