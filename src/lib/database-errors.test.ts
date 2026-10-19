import { describe, expect, it } from "vitest";

import { describeDatabaseFailure, redactConnectionSecrets } from "./database-errors";

describe("redactConnectionSecrets", () => {
  it("oculta la contraseña de una URL de PostgreSQL", () => {
    expect(redactConnectionSecrets("postgresql://user:super-secret@host:5432/db")).toBe(
      "postgresql://user:***@host:5432/db",
    );
  });

  it("oculta parámetros password", () => {
    expect(redactConnectionSecrets("postgresql://host/db?password=abc&sslmode=require")).toBe(
      "postgresql://host/db?password=***&sslmode=require",
    );
  });
});

describe("describeDatabaseFailure", () => {
  it("explica el ENOENT de un certificado con ruta local", () => {
    const failure = describeDatabaseFailure(
      Object.assign(new Error("ENOENT: no such file or directory, open 'C:/ReventaIQ/.supabase/prod-ca-2021.crt'"), {
        code: "ENOENT",
      }),
    );

    expect(failure.title).toBe("Certificado TLS no disponible");
    expect(failure.code).toBe("ENOENT");
    expect(failure.detail).toContain("DATABASE_CA_CERT");
  });

  it("identifica migraciones o tablas faltantes", () => {
    const failure = describeDatabaseFailure(
      Object.assign(new Error('relation "Product" does not exist in the current database'), { code: "42P01" }),
    );

    expect(failure.title).toBe("Falta una tabla o una migración");
    expect(failure.detail).toContain("prisma migrate status");
  });

  it("identifica credenciales rechazadas", () => {
    const failure = describeDatabaseFailure(
      Object.assign(new Error("password authentication failed for user"), { code: "28P01" }),
    );

    expect(failure.title).toBe("Credenciales de base de datos rechazadas");
  });

  it("nunca devuelve la contraseña en el detalle", () => {
    const failure = describeDatabaseFailure(
      new Error("connect failed for postgresql://user:secret@host:5432/db"),
    );

    expect(failure.detail).not.toContain("secret");
  });
});
