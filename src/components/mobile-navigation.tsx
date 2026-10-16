"use client";

import { useState } from "react";

const links = [
  ["Dashboard", "/"], ["Nueva evaluación", "/evaluations/new"], ["Oportunidades", "/opportunities"], ["Compras", "/purchases"], ["Proveedores", "/suppliers"], ["Catálogo", "/catalog"], ["Cotizaciones", "/shipping"], ["Tasas", "/rates"], ["Configuración", "/settings"],
] as const;

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return <><button className="mobile-nav-toggle" type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>Menú</button>{open && <button className="mobile-nav-backdrop" aria-label="Cerrar navegación" onClick={() => setOpen(false)} />}{<aside id="mobile-navigation" className={`mobile-navigation ${open ? "is-open" : ""}`} aria-label="Navegación principal"><div className="mobile-navigation-head"><strong>ReventaIQ</strong><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar navegación">×</button></div><nav>{links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav></aside>}</>;
}
