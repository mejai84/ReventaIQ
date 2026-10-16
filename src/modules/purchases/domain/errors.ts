/**
 * Errores de dominio del módulo de compras.
 *
 * Se lanzan cuando el código intenta hacer algo que el negocio no permite.
 * La UI los traduce a mensajes; nunca se muestran al usuario como texto crudo.
 */

/** Una transición de estado no está permitida desde el estado actual. */
export class InvalidPurchaseTransitionError extends Error {
  readonly from: string;
  readonly to: string;
  readonly reason?: string | undefined;

  constructor(from: string, to: string, reason?: string) {
    super(
      reason === undefined
        ? `Purchase cannot move from ${from} to ${to}`
        : `Purchase cannot move from ${from} to ${to}: ${reason}`,
    );
    this.name = "InvalidPurchaseTransitionError";
    this.from = from;
    this.to = to;
    this.reason = reason;
  }
}

/** El estado y sus datos son internamente inconsistentes. */
export class InvalidPurchaseStateError extends Error {
  readonly purchaseId: string;

  constructor(purchaseId: string, message: string) {
    super(`Purchase ${purchaseId} is inconsistent: ${message}`);
    this.name = "InvalidPurchaseStateError";
    this.purchaseId = purchaseId;
  }
}

/** Faltan componentes obligatorios o un importe es inválido. */
export class InvalidPurchaseAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPurchaseAmountError";
  }
}

/** El código de evento no existe en el catálogo del dominio. */
export class UnknownPurchaseEventError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Unknown purchase event code: ${code}`);
    this.name = "UnknownPurchaseEventError";
    this.code = code;
  }
}

/** El payload de un evento no cumple su contrato. */
export class InvalidPurchaseEventPayloadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`Invalid payload for ${code}: ${message}`);
    this.name = "InvalidPurchaseEventPayloadError";
    this.code = code;
  }
}