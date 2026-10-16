import Link from "next/link";
import { AppleParallaxStage } from "@/components/apple-parallax-stage";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "@/components/icons";

const benefits = ["Decisiones respaldadas por evidencia", "Costos y márgenes trazables", "Una operación conectada"] as const;

export default function HomePage() {
  return (
    <main className="apple-landing">
      <nav className="apple-global-nav" aria-label="Navegación principal">
        <Link className="apple-wordmark" href="/" aria-label="ReventaIQ, inicio"><span aria-hidden="true">R</span>ReventaIQ</Link>
        <Link href="/dashboard">Acceder <ArrowUpRight size={14} /></Link>
      </nav>
      <section className="apple-local-nav"><b>ReventaIQ</b><Link href="/dashboard" className="apple-nav-cta">Abrir dashboard</Link></section>
      <section className="apple-hero" aria-labelledby="hero-title">
        <p className="apple-kicker">OPERACIONES DE REVENTA</p>
        <h1 id="hero-title">Tecnología bien<br />decidida.</h1>
        <p>La mesa de operaciones para convertir una oferta en una decisión rentable, trazable y preparada para crecer.</p>
        <div className="apple-hero-actions"><Link className="apple-blue-pill" href="/dashboard">Entrar al dashboard <ArrowRight size={16} /></Link><a className="apple-text-link" href="#flujo">Descubrir cómo funciona <ArrowRight size={15} /></a></div>
        <AppleParallaxStage />
      </section>
      <section className="apple-highlights" aria-label="Ventajas de ReventaIQ">
        <article><p className="apple-kicker">CLARIDAD</p><h2>Todo lo que importa,<br />antes de pagar.</h2><p>Oferta, comparables, envío y política de negocio reunidos en una sola evaluación.</p></article>
        <article className="apple-highlight-metric"><span>UNA FUENTE<br />DE VERDAD</span><b>De la oportunidad<br />a la compra.</b><i aria-hidden="true">R</i></article>
      </section>
      <section className="apple-flow" id="flujo" aria-labelledby="flow-title">
        <header><p className="apple-kicker">UN FLUJO CONTINUO</p><h2 id="flow-title">Menos suposiciones.<br />Más control.</h2></header>
        <ol>{[["01", "Captura", "Registra la oferta y sus condiciones reales."], ["02", "Evalúa", "Contrasta mercado, costos y riesgo."], ["03", "Ejecuta", "Conserva compra y logística en contexto."]].map(([number, title, copy]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol>
      </section>
      <section className="apple-trust"><div><ShieldCheck size={26} /><h2>Hecha para una operación que cuida sus decisiones.</h2></div><ul>{benefits.map((benefit) => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul></section>
      <footer className="apple-footer"><span>© {new Date().getFullYear()} ReventaIQ</span><span>Colombia · Estados Unidos</span></footer>
    </main>
  );
}
