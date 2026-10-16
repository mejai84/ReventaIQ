import { z } from "zod";

import Decimal from "decimal.js";

import { type PurchaseMoneyField, parseUsdAmount } from "../../domain/purchase-money";

/**
 * Primitivas de validación compartidas por las entradas de compras.
 *
 * Todas reutilizan las reglas del dominio en lugar de duplicarlas: si el
 * dominio cambia un criterio, la validación de entrada cambia con él.
 *
 * Regla transversal: los importes entran como **texto** y salen como `Decimal`
 * (ADR-0002). Nunca se acepta un número de JavaScript como importe.
 */

const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const HTTPS_URL = /^https:\/\/\S+$/;
const DECIMAL_ID = /^[1-9]\d*$/;
const US_AMOUNT = /^\d+(\.\d{1,4})?$/;
const WEIGHT_LB = /^\d+(\.\d{1,3})?$/;

/**
 * Identificador de entidad.
 *
 * En Fase 1 las claves son `bigint` y viajan como cadena decimal (ADR-0002).
 * Si en tu frente de aplicación usas otro formato (UUID, ULID), ajusta sólo
 * este esquema: el resto de la validación no depende de él.
 */
export const entityIdSchema = z
  .string()
  .regex(DECIMAL_ID, "must be a positive decimal string, because ids are bigint");

/**
 * Instante ISO 8601 con zona horaria explícita.
 *
 * Se rechaza la hora local sin zona: un instante sin offset es ambiguo y
 * corrompe el orden temporal de la bitácora.
 */
export const isoInstantSchema = z
  .string()
  .regex(ISO_INSTANT, "must be an ISO 8601 instant with a timezone, e.g. 2026-01-15T14:30:00.000Z")
  .refine(isRealInstant, {
    message: "must be a real calendar date and time: Date.parse alone rolls 2026-02-31 over to March",
  });

/**
 * Valida el día y la hora contra el calendario.
 *
 * `Date.parse` es indulgante: interpreta `2026-02-31` como 3 de marzo y no
 * señala error. Comparar el día con su ida y vuelta por `Date.UTC` detecta el
 * desbordamiento, y el rango de la hora funciona igual con desfase horario.
 */
function isRealInstant(value: string): boolean {
  const match = ISO_INSTANT.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() + 1 === month &&
    roundTrip.getUTCDate() === day
  );
}

/** Importe en USD: texto exacto → `Decimal`. */
export function usdAmountSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, "is required")
    .refine((value) => US_AMOUNT.test(value), {
      message:
        "must be a non-negative decimal with up to 4 decimals, without separators or symbols: 410.00",
    })
    .transform((raw, ctx) => {
      try {
        // El dominio usa el nombre del campo sólo para el mensaje de error.
        return parseUsdAmount(raw, label as PurchaseMoneyField);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "invalid amount",
        });
        return z.NEVER;
      }
    });
}

/** Peso en libras: texto exacto → `Decimal`, positivo y con 3 decimales. */
export const weightLbSchema = z
  .string()
  .trim()
  .min(1, "is required")
  .refine((value) => WEIGHT_LB.test(value) && Number(value) > 0, {
    message: "must be a positive decimal with up to 3 decimals",
  })
  .transform((raw) => new Decimal(raw));

/** Código monetario ISO 4217 en mayúsculas. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "must be three uppercase letters, e.g. USD");

/** Enlace externo a la publicación de origen. */
export const httpsUrlSchema = z.string().regex(HTTPS_URL, "must be an https URL");

/** Texto libre no vacío y acotado. */
export function requiredText(label: string, max = 2000) {
  return z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
}

/** Texto opcional: si viene, no puede ser sólo espacios. */
export function optionalText(label: string, max = 2000) {
  return z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .refine((value) => value.length > 0, `${label} cannot be blank`);
}

/** Marca que un objeto rechaza cualquier clave no declarada. */
export function requireKnownFields<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject(shape);
}