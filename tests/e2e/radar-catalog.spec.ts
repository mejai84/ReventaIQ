import { expect, test } from "@playwright/test";

const email = process.env.PROD_TEST_EMAIL;
const password = process.env.PROD_TEST_PASSWORD;
const allowWrites = process.env.E2E_ALLOW_WRITES === "1";

test.describe("acceso no autenticado", () => {
  test("catalog y radar redirigen al login", async ({ page }) => {
    for (const path of ["/catalog", "/radar"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});

test.describe("catálogo y radar autenticados", () => {
  test.skip(!email || !password, "Requiere PROD_TEST_EMAIL y PROD_TEST_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("catalog lista productos y categorías sin desbordar", async ({ page }) => {
    await page.goto("/catalog", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Productos y variantes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Catálogo registrado" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Categorías registradas" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });

  test("radar muestra perfiles, importación y evidencia sin desbordar", async ({ page }) => {
    await page.goto("/radar", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Fuentes y evidencia de mercado" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Importar CSV" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Listados importados" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
});

test.describe("flujo completo de catálogo y radar", () => {
  test.skip(!email || !password, "Requiere PROD_TEST_EMAIL y PROD_TEST_PASSWORD");
  test.skip(!allowWrites, "Escribe datos: exporta E2E_ALLOW_WRITES=1 solo contra una base de pruebas");

  const suffix = Date.now().toString(36);
  const categoryCode = `e2e-consolas-${suffix}`;
  const categoryName = `Consolas E2E ${suffix}`;
  const profileName = `Perfil E2E ${suffix}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', email!);
    await page.fill('input[name="password"]', password!);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("crea categoría, perfil e importa CSV con evidencia", async ({ page }) => {
    await page.goto("/catalog", { waitUntil: "networkidle" });
    const categoryForm = page.locator("#nueva-categoria");
    await categoryForm.locator('input[name="categoryCode"]').fill(categoryCode);
    await categoryForm.locator('input[name="categoryName"]').fill(categoryName);
    await categoryForm.getByRole("button", { name: "Guardar categoría" }).click();
    await expect(page.getByText("Categoría registrada.")).toBeVisible();

    await page.goto("/radar", { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', profileName);
    await page.selectOption('select[name="categoryId"]', { label: categoryName });
    await page.fill('input[name="minNetProfitCop"]', "50000");
    await page.fill('input[name="minRoiRate"]', "0.15");
    await page.fill('input[name="maxPurchasePriceUsd"]', "150");
    await page.fill('input[name="minimumConfidence"]', "50");
    await page.fill('input[name="frequencyMinutes"]', "1440");
    await page.fill('input[name="sourceKey"]', "manual");
    await page.selectOption('select[name="sourceMode"]', "MANUAL");
    await page.getByRole("button", { name: "Guardar perfil" }).click();
    await expect(page.getByText("Perfil Radar creado.")).toBeVisible();

    const csv = [
      "source_key,external_listing_id,canonical_url,title,price,currency,availability,observed_at,confidence",
      `manual,${suffix}-1,https://example.invalid/${suffix}-1,Consola E2E,120.00,USD,IN_STOCK,2026-10-19T12:00:00Z,80`,
    ].join("\n");
    await page.selectOption('select[name="profileId"]', { label: profileName });
    await page.fill('textarea[name="csvText"]', csv);
    await page.getByRole("button", { name: "Importar evidencia" }).click();
    await expect(page.getByText("Consola E2E")).toBeVisible();
    await expect(page.getByText("Cumple reglas disponibles")).toBeVisible();
  });

  test("rechaza un CSV inválido y muestra el error por fila", async ({ page }) => {
    await page.goto("/radar", { waitUntil: "networkidle" });
    await page.selectOption('select[name="profileId"]', { index: 0 });
    await page.fill('textarea[name="csvText"]', "columna_equivocada\nsolo_una_columna");
    await page.getByRole("button", { name: "Importar evidencia" }).click();
    await expect(page).toHaveURL(/error=csv-format/);
  });
});
