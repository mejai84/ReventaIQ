import { assertNonNegative, decimal, sumDecimals } from "../../finance/decimal";
import type Decimal from "decimal.js";

import type { PurchaseMoneyComponents, PurchaseView } from "./contracts";
import { InvalidPurchaseAmountError } from "./errors";
import { canEditPurchaseAmounts } from "./purchase-status";

/**
 * Dinero de la compra.
 *
 * Regla central: **un componente ausente es "no informado", nunca cero**. Por
 * eso la suma falla si falta cualquiera, en lugar de asumir que no costó nada.
 * Una compra pagada sin costo de envío conocido no se puede evaluar.
 */

/** Nombres de los cinco componentes, en orden estable. */
export const PURCHASE_MONEY_FIELDS = [
  "purchasePriceUSD",
  "usShippingUSD",
  "usSalesTaxUSD",
  "paymentFeeUSD",
  "otherCostUSD",
] as const;

export type PurchaseMoneyField = (typeof PURCHASE_MONEY_FIELDS)[number];

export type MoneyGapCode =
  | "PURCHASE_PRICE_UNKNOWN"
  | "US_SHIPPING_UNKNOWN"
  | "US_SALES_TAX_UNKNOWN"
  | "PAYMENT_FEE_UNKNOWN"
  | "OTHER_COST_UNKNOWN";

/** Componentes ausentes, con su código de faltante. */
export interface MoneyGap {
  readonly code: MoneyGapCode;
  readonly field: PurchaseMoneyField;
}

/** Resumen para la UI: total, componentes y faltantes. Nunca inventa ceros. */
export interface PurchaseMoneySummary {
  /** Suma exacta de los cinco componentes, o `undefined` si falta alguno. */
  readonly totalUSD?: Decimal | undefined;
  readonly components: Readonly<Partial<Record<PurchaseMoneyField, Decimal>>>;
  readonly gaps: readonly MoneyGap[];
  readonly complete: boolean;
}

const FIELD_TO_GAP: Readonly<Record<PurchaseMoneyField, MoneyGapCode>> = {
  purchasePriceUSD: "PURCHASE_PRICE_UNKNOWN",
  usShippingUSD: "US_SHIPPING_UNKNOWN",
  usSalesTaxUSD: "US_SALES_TAX_UNKNOWN",
  paymentFeeUSD: "PAYMENT_FEE_UNKNOWN",
  otherCostUSD: "OTHER_COST_UNKNOWN",
};

/** Valida que ningún componente sea negativo o no finito. */
export function assertPurchaseComponents(money: PurchaseMoneyComponents): void {
  for (const field of PURCHASE_MONEY_FIELDS) {
    const value = money[field];
    if (value !== undefined) {
      assertNonNegative(value, field);
    }
  }
}

/** Componentes ausentes, en orden estable. */
export function moneyGaps(money: PurchaseMoneyComponents): readonly MoneyGap[] {
  const gaps: MoneyGap[] = [];
  for (const field of PURCHASE_MONEY_FIELDS) {
    if (money[field] === undefined) {
      gaps.push({ code: FIELD_TO_GAP[field], field });
    }
  }
  return gaps;
}

/**
 * Suma exacta de los cinco componentes, como `Decimal` y sin redondear.
 *
 * Falla si falta un componente: calcular un total con datos incompletos
 * produciría una utilidad falsamente favorable.
 */
export function calculatePurchaseTotalUSD(money: PurchaseMoneyComponents): Decimal {
  assertPurchaseComponents(money);

  const missing = moneyGaps(money);
  if (missing.length > 0) {
    throw new InvalidPurchaseAmountError(
      `Cannot total a purchase with unknown amounts: ${missing.map((gap) => gap.field).join(", ")}`,
    );
  }

  return sumDecimals(PURCHASE_MONEY_FIELDS.map((field) => money[field] as Decimal));
}

/**
 * Resumen tolerante: devuelve el total sólo si todos los componentes están
 * conocidos, y siempre expone los faltantes para que la UI muestre `Sin dato`.
 */
export function summarizePurchaseMoney(money: PurchaseMoneyComponents): PurchaseMoneySummary {
  assertPurchaseComponents(money);

  const components: Partial<Record<PurchaseMoneyField, Decimal>> = {};
  for (const field of PURCHASE_MONEY_FIELDS) {
    const value = money[field];
    if (value !== undefined) {
      components[field] = value;
    }
  }

  const gaps = moneyGaps(money);
  return {
    totalUSD: gaps.length === 0 ? calculatePurchaseTotalUSD(money) : undefined,
    components,
    gaps,
    complete: gaps.length === 0,
  };
}

/**
 * Convierte texto a `Decimal` para captura manual.
 *
 * Rechaza separadores de millar y formatos ambiguos: `"410,00"` no es un
 * importe válido, y adivinar sería peor que fallar.
 */
export function parseUsdAmount(raw: string, field: PurchaseMoneyField): Decimal {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
    throw new InvalidPurchaseAmountError(
      `${field} must be a non-negative decimal with up to 4 decimals, received "${raw}"`,
    );
  }
  return decimal(trimmed);
}

/** ¿Los importes son editables en este estado? */
export function areAmountsEditable(view: Pick<PurchaseView, "status">): boolean {
  return canEditPurchaseAmounts(view.status);
}