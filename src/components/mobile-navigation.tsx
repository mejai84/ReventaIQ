"use client";

import Link from "next/link";
import { BarChart3, Box, CircleDollarSign, FileSearch, Menu, ShoppingBag, X } from "@/components/icons";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const links = [
  ["Dashboard", "/dashboard", BarChart3],
  ["Nueva evaluación", "/evaluations/new", FileSearch],
  ["Oportunidades", "/opportunities", CircleDollarSign],
  ["Radar", "/radar", FileSearch],
  ["Compras", "/purchases", ShoppingBag],
  ["Proveedores", "/suppliers", ShoppingBag],
  ["Catálogo", "/catalog", Box],
  ["Cotizaciones", "/shipping", FileSearch],
  ["Tasas", "/rates", CircleDollarSign],
  ["Configuración", "/settings", Box],
] as const;

export function MobileNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/recover")) return <>{children}</>;
  const navigation = (className: string, onNavigate?: () => void) => <nav className={className}>{links.map(([label, href, Icon]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} {...(onNavigate === undefined ? {} : { onClick: onNavigate })}><Icon aria-hidden="true" size={18} /><span>{label}</span></Link>)}</nav>;
  return <div className="app-shell"><aside className="sidebar" aria-label="Navegación principal"><Link href="/dashboard" className="brand"><span className="brand-mark" aria-hidden="true">R</span><span><strong>ReventaIQ</strong><small>Inteligencia de reventa</small></span></Link>{navigation("navigation")}<div className="source-status"><span className="source-symbol" aria-hidden="true">●</span><div><strong>Operación privada</strong><span>Datos verificados primero</span></div></div></aside><div className="app-content">{children}</div><button className="mobile-nav-toggle" type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}><Menu aria-hidden="true" size={19} /> Menú</button>{open ? <button className="mobile-nav-backdrop" aria-label="Cerrar navegación" onClick={() => setOpen(false)} /> : null}<aside id="mobile-navigation" className={`mobile-navigation ${open ? "is-open" : ""}`} aria-label="Navegación principal"><div className="mobile-navigation-head"><strong>ReventaIQ</strong><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar navegación"><X aria-hidden="true" /></button></div>{navigation("mobile-navigation-links", () => setOpen(false))}</aside></div>;
}
