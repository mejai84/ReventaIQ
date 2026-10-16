import Link from "next/link";
import { ArrowRight, BarChart3, Check, ChevronRight, ShieldCheck, Sparkles, TrendingUp } from "@/components/icons";

const capabilities = [
  "Decisiones respaldadas por evidencia",
  "Costos y márgenes trazables",
  "Compras y logística en un solo lugar",
] as const;

export default function HomePage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Navegación principal">
        <Link className="landing-brand" href="/" aria-label="ReventaIQ, inicio"><span aria-hidden="true">R</span><strong>ReventaIQ</strong></Link>
        <Link className="landing-login" href="/login">Acceder <ChevronRight aria-hidden="true" size={17} /></Link>
      </nav>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-eyebrow"><Sparkles aria-hidden="true" size={15} /> Inteligencia para reventa</p>
          <h1 id="landing-title">Compra tecnología con <em>criterio.</em></h1>
          <p className="landing-lede">ReventaIQ reúne costo, mercado y logística para que cada equipo entre a tu operación con una decisión clara.</p>
          <div className="landing-actions"><Link className="landing-primary" href="/login">Entrar al dashboard <ArrowRight aria-hidden="true" size={18} /></Link><a className="landing-secondary" href="#como-funciona">Conocer la plataforma</a></div>
          <ul className="landing-proof" aria-label="Características">{capabilities.map((item) => <li key={item}><Check aria-hidden="true" size={15} />{item}</li>)}</ul>
        </div>
        <div className="landing-device" aria-label="Vista previa del dashboard">
          <div className="device-top"><span /><span /><span /><small>REVENTAIQ / INTELLIGENCE DESK</small></div>
          <div className="device-content"><div className="device-sidebar"><b>R</b><i /><i /><i /><i /></div><div className="device-main"><div className="device-header"><div><small>OPERACIÓN</small><strong>Buenos días, Jaime</strong></div><span>+ Evaluar</span></div><div className="device-metrics"><div><small>Capital disponible</small><b>Sin datos</b></div><div><small>Oportunidades</small><b>Sin datos</b></div></div><div className="device-card"><div><span>SEÑAL DE MERCADO</span><b>Tu próxima decisión empieza con evidencia.</b></div><BarChart3 aria-hidden="true" /></div></div></div>
        </div>
      </section>
      <section className="landing-flow" id="como-funciona" aria-labelledby="flow-title"><div><p className="landing-eyebrow">Un flujo, una fuente de verdad</p><h2 id="flow-title">Del hallazgo a la compra, sin hojas dispersas.</h2></div><ol><li><span>01</span><h3>Captura</h3><p>Registra la oferta y sus condiciones reales.</p></li><li><span>02</span><h3>Evalúa</h3><p>Contrasta comparables, costos y riesgo.</p></li><li><span>03</span><h3>Ejecuta</h3><p>Conserva la trazabilidad de compra y envío.</p></li></ol></section>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} ReventaIQ</span><span><ShieldCheck aria-hidden="true" size={15} /> Operación privada y trazable</span><span><TrendingUp aria-hidden="true" size={15} /> Colombia · Estados Unidos</span></footer>
    </main>
  );
}