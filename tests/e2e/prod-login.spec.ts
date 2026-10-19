import { expect, test } from "@playwright/test";

/**
 * Smoke test manual contra el despliegue de producción.
 *
 * Se omite por defecto: solo corre cuando existen credenciales de prueba en el
 * entorno. No crea ni modifica datos; únicamente valida que el login llega al
 * dashboard. No uses credenciales reales de administrador en CI.
 */

const email = process.env.PROD_TEST_EMAIL;
const password = process.env.PROD_TEST_PASSWORD;
const baseURL = process.env.PROD_BASE_URL ?? "https://reventaiq.vercel.app";

test.skip(!email || !password, "Requiere PROD_TEST_EMAIL y PROD_TEST_PASSWORD");

test("login contra producción", async ({ page }) => {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email!);
  await page.fill('input[name="password"]', password!);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 20_000 }),
    page.click('button[type="submit"]'),
  ]);
  await expect(page).toHaveURL(/\/dashboard/);
});
