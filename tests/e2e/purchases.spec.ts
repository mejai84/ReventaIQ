import { expect, test } from "@playwright/test";

import { purchaseDetail, purchases, SAMPLE_PURCHASE_ID } from "./purchases.pom";

/**
 * E2E de la interfaz de Compras.
 *
 * Premisa de estas pruebas: la persistencia de Fase A todavía no existe, así que
 * la aplicación **no tiene datos de compras**. Ninguna prueba puede sembrar
 * datos: afirmarían algo que el sistema todavía no puede mostrar.
 */

test.describe("Compras", () => {
  test("se llega desde el dashboard por el enlace de navegación", async ({ page }) => {
    await page.goto("/");

    const navLink = purchases.navLink(page);
    await expect(navLink).toBeVisible();
    await navLink.click();

    await expect(page).toHaveURL(/\/purchases$/);
    await expect(purchases.heading(page)).toBeVisible();
    await expect(purchases.ledgerHeading(page)).toBeVisible();
  });

  test("el enlace de retroceso del listado devuelve al dashboard", async ({ page }) => {
    await page.goto("/purchases");

    const back = purchases.backToDashboard(page);
    await expect(back).toBeVisible();
    await back.click();

    await expect(page).toHaveURL(/\/$/);
  });

  test("muestra el estado vacío sin inventar datos", async ({ page }) => {
    await page.goto("/purchases");

    await expect(purchases.emptyStateHeading(page)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Empieza con una oportunidad aprobada" }),
    ).toBeVisible();

    // Sin filas de compra, sin totales y sin fechas de entrega inventadas.
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.locator(".purchase-row")).toHaveCount(0);
    await expect(page.getByText("USD")).toHaveCount(0);
    await expect(page.getByText(/\b20\d{2}-\d{2}-\d{2}\b/)).toHaveCount(0);

    // La ausencia se comunica como ausencia, no como un cero.
    await expect(page.getByText("Sin datos operativos")).toBeVisible();
  });

  test("el detalle muestra el identificador solicitado", async ({ page }) => {
    await page.goto(`/purchases/${SAMPLE_PURCHASE_ID}`);

    await expect(purchaseDetail.heading(page)).toBeVisible();
    await expect(purchaseDetail.requestedId(page)).toHaveText(SAMPLE_PURCHASE_ID);
    await expect(page.getByText("Referencia solicitada:")).toBeVisible();
  });

  test("el detalle muestra las secciones de línea de tiempo, envíos y desglose", async ({
    page,
  }) => {
    await page.goto(`/purchases/${SAMPLE_PURCHASE_ID}`);

    await expect(purchaseDetail.sectionHeading(page, "Línea de tiempo")).toBeVisible();
    await expect(purchaseDetail.sectionHeading(page, "Envíos")).toBeVisible();
    await expect(purchaseDetail.sectionHeading(page, "Desglose")).toBeVisible();

    await expect(page.getByText("Sin eventos registrados.")).toBeVisible();
    await expect(page.getByText("Sin envíos registrados.")).toBeVisible();
    await expect(page.getByText("Sin datos de costo disponibles.")).toBeVisible();
  });

  test("el detalle declara que no hay compra disponible, sin inventar una", async ({ page }) => {
    await page.goto(`/purchases/${SAMPLE_PURCHASE_ID}`);

    await expect(
      page.getByRole("heading", { level: 2, name: "No hay una compra disponible para mostrar" }),
    ).toBeVisible();
    await expect(page.getByText("Pendiente de persistencia")).toBeVisible();
  });

  test("el identificador del detalle refleja cualquier id solicitado", async ({ page }) => {
    await page.goto("/purchases/987654321");
    await expect(purchaseDetail.requestedId(page)).toHaveText("987654321");
  });
});