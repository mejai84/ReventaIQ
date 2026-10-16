"use client";

import { Menu, X } from "@/components/icons";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["Dashboard", "/dashboard"], ["Nueva evaluación", "/evaluations/new"], ["Oportunidades", "/opportunities"], ["Compras", "/purchases"], ["Proveedores", "/suppliers"], ["Catálogo", "/catalog"], ["Cotizaciones", "/shipping"], ["Tasas", "/rates"], ["Configuración", "/settings"],
] as const;

export function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/" || pathname === "/login") return null;
  return <><button className="mobile-nav-toggle" type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}><Menu aria-hidden="true" size={19} /> Menú</button>{open ? <button className="mobile-nav-backdrop" aria-label="Cerrar navegación" onClick={() => setOpen(false)} /> : null}<aside id="mobile-navigation" className={`mobile-navigation ${open ? "is-open" : ""}`} aria-label="Navegación principal"><div className="mobile-navigation-head"><strong>ReventaIQ</strong><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar navegación"><X aria-hidden="true" /></button></div><nav>{links.map(([label, href]) => <a key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{label}</a>)}</nav></aside></>;
}