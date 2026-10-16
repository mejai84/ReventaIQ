// Configuracion de Prisma 7.
//
// La URL del datasource no vive en schema.prisma: Prisma 7 la resuelve aqui
// con `env()`, que falla de forma explicita si DATABASE_URL no esta definida.
// Con `exactOptionalPropertyTypes` activa, `process.env["DATABASE_URL"]` es
// `string | undefined` y no es asignable a `url?: string` (TS2375).
//
// No se ejecuta ninguna migracion desde este archivo: el gate de ADR-0004
// exige aprobar el diff antes de aplicar.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
