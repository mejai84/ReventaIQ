export type DatabaseFailure = {
  readonly title: string;
  readonly detail: string;
  readonly code?: string;
};

const MAX_DETAIL_LENGTH = 700;

/** Removes credentials that could appear inside a Prisma or pg error message. */
export function redactConnectionSecrets(text: string): string {
  return text
    .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, "$1***@")
    .replace(/([?&](?:password|sslpassword)=)[^&\s]+/gi, "$1***")
    .replace(/(password=)[^&\s]+/gi, "$1***");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function summarize(message: string): string {
  const redacted = redactConnectionSecrets(message).trim();
  return redacted.length > MAX_DETAIL_LENGTH ? `${redacted.slice(0, MAX_DETAIL_LENGTH)}…` : redacted;
}

/**
 * Translates a database/runtime failure into an actionable message for the UI.
 * It intentionally keeps the technical cause (without secrets) so a production
 * incident can be diagnosed from the page instead of a generic error screen.
 */
export function describeDatabaseFailure(error: unknown): DatabaseFailure {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : undefined;
  const code = readString(record?.code);
  const message = error instanceof Error ? error.message : readString(record?.message) ?? String(error);
  const detail = summarize(message);
  const lower = detail.toLowerCase();

  if (code === "ENOENT" || lower.includes("enoent")) {
    return {
      title: "Certificado TLS no disponible",
      detail:
        "La conexión intentó abrir un archivo de certificado que no existe en este servidor. " +
        "No uses rutas locales como `sslrootcert=C:/...` en Production; configura `DATABASE_CA_CERT` " +
        "o deja que la aplicación use el certificado raíz incluido. Causa original: " +
        detail,
      ...(code === undefined ? {} : { code }),
    };
  }

  if (code === "P1001" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return {
      title: "No se pudo alcanzar PostgreSQL",
      detail: `Revisa host, puerto, red y estado del proyecto de Supabase. Causa original: ${detail}`,
      ...(code === undefined ? {} : { code }),
    };
  }

  if (code === "P1000" || code === "28P01" || lower.includes("authentication failed")) {
    return {
      title: "Credenciales de base de datos rechazadas",
      detail: `DATABASE_URL no coincide con un usuario/contraseña válidos. Causa original: ${detail}`,
      ...(code === undefined ? {} : { code }),
    };
  }

  if (code === "42P01" || code === "P2021" || lower.includes("does not exist in the current database")) {
    return {
      title: "Falta una tabla o una migración",
      detail:
        "El esquema de Production no coincide con el cliente Prisma. Ejecuta `npx prisma migrate status` " +
        `y aplica las migraciones pendientes. Causa original: ${detail}`,
      ...(code === undefined ? {} : { code }),
    };
  }

  if (code === "42703" || code === "P2022" || lower.includes("column") && lower.includes("does not exist")) {
    return {
      title: "El esquema no coincide con el cliente Prisma",
      detail:
        "Falta una columna esperada por el código. Aplica la migración correspondiente en Production. " +
        `Causa original: ${detail}`,
      ...(code === undefined ? {} : { code }),
    };
  }

  if (lower.includes("auth_secret")) {
    return {
      title: "AUTH_SECRET no está configurada",
      detail: "Define AUTH_SECRET (mínimo 32 caracteres) en las variables de entorno de Production.",
      ...(code === undefined ? {} : { code }),
    };
  }

  return {
    title: "Error al consultar la base de datos",
    detail: detail.length > 0 ? detail : "La consulta falló sin un mensaje técnico disponible.",
    ...(code === undefined ? {} : { code }),
  };
}
