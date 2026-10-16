import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para ReventaIQ.
 *
 * Alcance actual: E2E de la interfaz de Compras. No hay base de datos detrás
 * todavía, así que las pruebas no dependen de PostgreSQL, Supabase ni de datos
 * sembrados: affirmation de lo que la UI muestra hoy, incluido el estado vacío.
 *
 * El servidor de desarrollo se levanta una sola vez por ejecución y se reutiliza
 * si ya está en marcha.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // El proyecto sólo define pruebas E2E; las unitarias las ejecuta Vitest.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // Webpack explicito: en esta maquina los bindings nativos de Turbopack no
    // estan disponibles, y Next 16 lo indica en consola. El script `dev` del
    // proyecto no incluye el flag, asi que se pasa aqui a proposito.
    command: `npx next dev --webpack --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});