import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export type DecimalInput = Decimal | string;

const DECIMAL_STRING_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function decimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }

  if (!DECIMAL_STRING_PATTERN.test(value)) {
    throw new Error(`Invalid decimal string: ${value}`);
  }

  return new Decimal(value);
}

export function decimalToString(value: Decimal): string {
  assertFiniteDecimal(value, "value");
  return value.toFixed();
}

export function assertFiniteDecimal(value: Decimal, name: string): void {
  if (!value.isFinite()) {
    throw new RangeError(`${name} must be finite`);
  }
}

export function assertNonNegative(value: Decimal, name: string): void {
  assertFiniteDecimal(value, name);
  if (value.isNegative()) {
    throw new RangeError(`${name} must be greater than or equal to zero`);
  }
}

export function assertPositive(value: Decimal, name: string): void {
  assertFiniteDecimal(value, name);
  if (!value.isPositive()) {
    throw new RangeError(`${name} must be greater than zero`);
  }
}

export function assertRate(value: Decimal, name: string): void {
  assertNonNegative(value, name);
  if (value.greaterThan(1)) {
    throw new RangeError(`${name} must be between zero and one`);
  }
}

export function sumDecimals(values: readonly Decimal[]): Decimal {
  return values.reduce((total, value) => total.plus(value), new Decimal(0));
}

export function clampDecimal(
  value: Decimal,
  minimum: Decimal,
  maximum: Decimal,
): Decimal {
  return Decimal.max(minimum, Decimal.min(maximum, value));
}

/** Conservative rounding for a non-negative estimated cost in COP. */
export function roundCopCost(value: Decimal): Decimal {
  assertNonNegative(value, "COP cost");
  return value.toDecimalPlaces(0, Decimal.ROUND_CEIL);
}

/** Conservative rounding for a non-negative expected revenue in COP. */
export function roundCopRevenue(value: Decimal): Decimal {
  assertNonNegative(value, "COP revenue");
  return value.toDecimalPlaces(0, Decimal.ROUND_FLOOR);
}

/** Conservative rounding for an estimated USD charge. */
export function roundUsdCost(value: Decimal): Decimal {
  assertNonNegative(value, "USD cost");
  return value.toDecimalPlaces(2, Decimal.ROUND_CEIL);
}

export function roundHalfUp(value: Decimal, decimalPlaces: number): Decimal {
  assertFiniteDecimal(value, "value");
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new RangeError("decimalPlaces must be a non-negative integer");
  }
  return value.toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

export const DECIMAL_ZERO = new Decimal(0);
export const DECIMAL_ONE = new Decimal(1);
export const DECIMAL_HUNDRED = new Decimal(100);
