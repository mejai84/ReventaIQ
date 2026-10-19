import { SUPABASE_PROD_CA_CERT } from "./supabase-ca";

export type DatabaseConnectionConfig = {
  readonly connectionString: string;
  readonly ssl?: {
    readonly ca: string;
    readonly rejectUnauthorized: true;
  };
};

export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;

const FILE_BASED_SSL_PARAMS = ["sslrootcert", "sslcert", "sslkey"] as const;
const VERIFIED_SSL_MODES = new Set(["require", "verify-ca", "verify-full"]);

function isSupabaseHost(hostname: string): boolean {
  return hostname.endsWith(".supabase.com") || hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.net");
}

/**
 * Builds a portable pg configuration from DATABASE_URL.
 *
 * Local environments often point `sslrootcert` to a machine-specific file
 * (for example `C:/ReventaIQ/.supabase/prod-ca-2021.crt`). That path does not
 * exist on Vercel, so pg fails with ENOENT before opening a connection.
 *
 * We remove filesystem-only TLS parameters and, when the URL requires a
 * verified connection, provide the public Supabase root CA bundled with the
 * application (or DATABASE_CA_CERT when the project uses another CA).
 */
export function resolveDatabaseConnectionConfig(
  rawConnectionString: string | undefined,
  environment: DatabaseEnvironment = process.env,
): DatabaseConnectionConfig {
  if (rawConnectionString === undefined || rawConnectionString.trim().length === 0) {
    throw new Error(
      "DATABASE_URL no está configurada. Define la variable de entorno en Production (Vercel) y vuelve a desplegar.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawConnectionString);
  } catch {
    throw new Error("DATABASE_URL no es una URL de conexión válida.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`DATABASE_URL debe usar el protocolo postgresql:// (recibido: ${url.protocol}).`);
  }

  const sslMode = url.searchParams.get("sslmode");
  const hadFileBasedCertificate = FILE_BASED_SSL_PARAMS.some((parameter) => url.searchParams.has(parameter));
  for (const parameter of FILE_BASED_SSL_PARAMS) {
    url.searchParams.delete(parameter);
  }

  const configuredCa = environment.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ca = configuredCa !== undefined && configuredCa.length > 0
    ? configuredCa
    : isSupabaseHost(url.hostname)
      ? SUPABASE_PROD_CA_CERT
      : undefined;

  if (sslMode !== null && VERIFIED_SSL_MODES.has(sslMode) && ca !== undefined) {
    url.searchParams.delete("sslmode");
    return {
      connectionString: url.toString(),
      ssl: { ca, rejectUnauthorized: true },
    };
  }

  if (hadFileBasedCertificate && sslMode !== null && VERIFIED_SSL_MODES.has(sslMode)) {
    throw new Error(
      "DATABASE_URL exige TLS verificado (sslmode=verify-full) pero no se encontró un certificado CA. " +
        "Define DATABASE_CA_CERT con el PEM de la autoridad certificadora.",
    );
  }

  return { connectionString: url.toString() };
}
