import { type Page } from "@playwright/test";

/**
 * Localizadores de la interfaz de Compras.
 *
 * Se prioriza el rol y el nombre accesible sobre selectores de clase o de
 * `data-testid`: un cambio de estilo no debe romper las pruebas, y el rol
 * comprueba de paso que la vista es comprensible para un lector de pantalla.
 */
export const purchases = {
  /** Enlace de navegación a Compras en la barra lateral. */
  navLink: (page: Page) => page.getByRole("link", { name: "Compras", exact: true }),

  heading: (page: Page) => page.getByRole("heading", { level: 1, name: "Compras" }),

  /** Banda de decisión con el estado actual de la lista. */
  emptyStateHeading: (page: Page) =>
    page.getByRole("heading", { level: 2, name: "Aún no hay compras registradas" }),

  /** Acción principal, deshabilitada mientras no exista persistencia. */
  registerButton: (page: Page) => page.getByRole("button", { name: "Registrar compra" }),

  ledgerHeading: (page: Page) => page.getByRole("heading", { level: 2, name: "Registro de compras" }),

  backToDashboard: (page: Page) => page.getByRole("link", { name: /Dashboard/ }),
};

/** Encabezados de sección del detalle de compra. */
export const purchaseDetail = {
  backLink: (page: Page) => page.getByRole("link", { name: /Compras/ }).first(),
  heading: (page: Page) => page.getByRole("heading", { level: 1, name: "Detalle de compra" }),

  /** El identificador solicitado, en el encabezado. */
  requestedId: (page: Page) => page.locator(".mono-value"),

  sectionHeading: (page: Page, name: RegExp | string) =>
    page.getByRole("heading", { level: 2, name }),
};

/** Identificador de compra de ejemplo para el detalle. */
export const SAMPLE_PURCHASE_ID = "12";