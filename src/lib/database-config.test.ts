import { describe, expect, it } from "vitest";

import { resolveDatabaseConnectionConfig } from "./database-config";
import { SUPABASE_PROD_CA_CERT } from "./supabase-ca";

describe("resolveDatabaseConnectionConfig", () => {
  it("elimina rutas locales de certificados y usa el CA incluido para Supabase", () => {
    const config = resolveDatabaseConnectionConfig(
      "postgresql://user:secret@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=verify-full&sslrootcert=C%3A%2FReventaIQ%2F.supabase%2Fprod-ca-2021.crt",
      {},
    );

    const url = new URL(config.connectionString);
    expect(url.searchParams.has("sslrootcert")).toBe(false);
    expect(url.searchParams.has("sslmode")).toBe(false);
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(config.ssl).toEqual({ ca: SUPABASE_PROD_CA_CERT, rejectUnauthorized: true });
  });

  it("prefiere DATABASE_CA_CERT cuando está definido", () => {
    const config = resolveDatabaseConnectionConfig(
      "postgresql://user:secret@db.example.com:5432/postgres?sslmode=verify-full",
      { DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----custom-----END CERTIFICATE-----" },
    );

    expect(config.ssl?.ca).toContain("custom");
  });

  it("convierte los saltos de línea escapados de DATABASE_CA_CERT", () => {
    const config = resolveDatabaseConnectionConfig(
      "postgresql://user:secret@db.example.com:5432/postgres?sslmode=verify-full",
      { DATABASE_CA_CERT: "linea1\\nlinea2" },
    );

    expect(config.ssl?.ca).toBe("linea1\nlinea2");
  });

  it("rechaza verify-full sin CA cuando la URL apuntaba a un archivo local", () => {
    expect(() =>
      resolveDatabaseConnectionConfig(
        "postgresql://user:secret@db.example.com:5432/postgres?sslmode=verify-full&sslrootcert=/tmp/ca.crt",
        {},
      ),
    ).toThrow(/DATABASE_CA_CERT/);
  });

  it("mantiene sslmode cuando no se configura TLS verificado", () => {
    const config = resolveDatabaseConnectionConfig(
      "postgresql://user:secret@localhost:5432/mydb?schema=public",
      {},
    );

    expect(config.ssl).toBeUndefined();
    expect(new URL(config.connectionString).searchParams.get("schema")).toBe("public");
  });

  it("falla con un mensaje claro si DATABASE_URL no existe", () => {
    expect(() => resolveDatabaseConnectionConfig(undefined, {})).toThrow(/DATABASE_URL no está configurada/);
    expect(() => resolveDatabaseConnectionConfig("   ", {})).toThrow(/DATABASE_URL no está configurada/);
  });

  it("rechaza protocolos que no son PostgreSQL", () => {
    expect(() => resolveDatabaseConnectionConfig("mysql://localhost/db", {})).toThrow(/postgresql:\/\//);
  });
});
