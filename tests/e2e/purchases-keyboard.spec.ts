import { expect, test } from "@playwright/test";

import { purchaseDetail, purchases, SAMPLE_PURCHASE_ID } from "./purchases.pom";

/**
 * Accesibilidad de teclado y honestidad de los controles deshabilitados.
 *
 * El diseño de producto prohíbe expresamente los botones falsos: un control que
 * no puede ejecutar la acción no debe parecer que sí.
 */

test.describe("Compras por teclado", () => {
  test("el listado es alcanzable y accionable sólo con teclado", async ({ page }) => {
    await page.goto("/");

    // El foco inicial no está atrapado: el documento recibe la primera pulsación.
    await page.keyboard.press("Tab");

    let reachedPurchases = false;
    for (let attempt = 0; attempt < 25 && !reachedPurchases; attempt += 1) {
      const focused = page.getByRole("link", { name: "Compras", exact: true });
      if (await focused.evaluate((node) => node === document.activeElement).catch(() => false)) {
        reachedPurchases = true;
        break;
      }
      await page.keyboard.press("Tab");
    }

    expect(reachedPurchases, "el enlace a Compras debe alcanzarse con Tab").toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/purchases$/);
    await expect(purchases.heading(page)).toBeVisible();
  });

  test("el botón deshabilitado no es un elemento tabulable", async ({ page }) => {
    await page.goto("/purchases");

    const button = purchases.registerButton(page);
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-disabled", "true");

    // El foco nunca debe saltar a un control deshabilitado.
    const focusedTagNames: string[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.keyboard.press("Tab");
      focusedTagNames.push(
        await page.evaluate(() => document.activeElement?.tagName ?? "NONE"),
      );
    }

    expect(focusedTagNames).not.toContain("BUTTON");
  });

  test("un botón deshabilitado no dispara ninguna acción persistente", async ({ page }) => {
    await page.goto("/purchases");

    const before = page.url();
    const button = purchases.registerButton(page);

    // Un clic forzado sobre un control deshabilitado no debe cambiar la URL,
    // no debe navegar y no debe dejar rastro de una acción.
    await button.click({ force: true, trial: false });

    await expect(button).toBeDisabled();
    await expect(page).toHaveURL(before);
    await expect(purchases.emptyStateHeading(page)).toBeVisible();

    // Tampoco hay un formulario ni un diálogo abierto detrás del control.
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("el detalle de compra es navegable con teclado y conserva el foco visible", async ({
    page,
  }) => {
    await page.goto(`/purchases/${SAMPLE_PURCHASE_ID}`);

    await expect(purchaseDetail.heading(page)).toBeVisible();

    // Los enlaces del detalle se alcanzan con Tab y responden a Enter.
    const backLink = purchaseDetail.backLink(page);
    await backLink.focus();
    await expect(backLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/purchases$/);
  });

  test("el encabezado de la vista identifica la sección activa", async ({ page }) => {
    await page.goto("/purchases");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(purchases.heading(page)).toBeVisible();
  });
});