import Link from "next/link";
import { ArrowLeft, ArrowRight, Box, Check, CircleDollarSign, FileSearch, ShoppingBag } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const stages = [
  { key: "catalog", number: "01", title: "Catálogo", detail: "Producto, variante y grado de condición.", href: "/catalog", icon: Box },
  { key: "offer", number: "02", title: "Compra", detail: "Proveedor y oferta observada en USD.", href: "/suppliers#capture-offer", icon: ShoppingBag },
  { key: "market", number: "03", title: "Mercado", detail: "Comparables reales de venta en Colombia.", href: "/opportunities#capture-comparable", icon: FileSearch },
  { key: "decision", number: "04", title: "Decisión", detail: "Logística, tasa, política y recomendación.", href: "/shipping#capture-quote", icon: CircleDollarSign },
] as const;

export default async function NewEvaluationPage() {
  await requireUser();
  const [variants, grades, suppliers, offers, marketplaces, channels, shippingProviders, exchangeRates, settings] = await Promise.all([
    prisma.productVariant.count(), prisma.conditionGrade.count(), prisma.supplier.count(), prisma.supplierOffer.count(),
    prisma.marketplace.count(), prisma.salesChannel.count(), prisma.shippingProvider.count(), prisma.exchangeRate.count(), prisma.businessSettings.count(),
  ]);

  const catalogReady = variants > 0 && grades > 0;
  const offerReady = catalogReady && suppliers > 0 && offers > 0;
  const marketReady = offerReady && marketplaces > 0 && channels > 0;
  const decisionReady = marketReady && shippingProviders > 0 && exchangeRates > 0 && settings > 0;
  const completion = [catalogReady, offerReady, marketReady, decisionReady].filter(Boolean).length;
  const next = !catalogReady
    ? { href: "/catalog", label: variants === 0 ? "Crear catálogo" : "Crear grado de condición", description: "Primero registra una variante y su condición." }
    : !offerReady
      ? { href: suppliers === 0 ? "/suppliers" : "/suppliers#capture-offer", label: suppliers === 0 ? "Crear proveedor" : "Capturar oferta", description: "Registra la evidencia de compra que se evaluará." }
      : !marketReady
        ? { href: marketplaces === 0 ? "/opportunities" : "/settings/sales", label: marketplaces === 0 ? "Crear mercado" : "Crear canal de venta", description: "Prepara dónde y cómo se venderá el producto." }
        : !decisionReady
          ? { href: shippingProviders === 0 ? "/shipping" : exchangeRates === 0 ? "/rates" : "/settings", label: "Completar decisión", description: "Faltan logística, tasa o política de negocio." }
          : { href: "/opportunities", label: "Ver oportunidades", description: "La evidencia ya está lista para ser analizada." };

  return (
    <main className="evaluation-workspace">
      <Link className="back-link" href="/dashboard"><ArrowLeft size={16} /> Dashboard</Link>
      <header className="evaluation-header">
        <div><p className="dashboard-kicker">NUEVA EVALUACIÓN</p><h1>Evalúa una oportunidad</h1><p>Registra evidencia confirmada. El motor calcula la decisión cuando la información está completa.</p></div>
        <span className="evaluation-progress" aria-label={`${completion} de 4 etapas completas`}>{completion}/4 listas</span>
      </header>

      <section className="evaluation-next" aria-labelledby="next-step-title">
        <span className="evaluation-next-icon"><FileSearch size={22} aria-hidden="true" /></span>
        <div><p>PRÓXIMO PASO</p><h2 id="next-step-title">{next.label}</h2><span>{next.description}</span></div>
        <Link className="primary-action evaluation-next-action" href={next.href}>{next.label}<ArrowRight size={16} aria-hidden="true" /></Link>
      </section>

      <ol className="evaluation-flow" aria-label="Progreso de evaluación">
        {stages.map(({ key, number, title, detail, href, icon: Icon }, index) => {
          const ready = [catalogReady, offerReady, marketReady, decisionReady][index]!;
          return <li key={key} className={ready ? "is-ready" : ""}>
            <span className="evaluation-flow-number">{ready ? <Check size={15} aria-label="Completado" /> : number}</span>
            <div><h2>{title}</h2><p>{detail}</p></div>
            <Link href={href} aria-label={`Ir a ${title}`}><Icon size={18} aria-hidden="true" /><span>Ir</span></Link>
          </li>;
        })}
      </ol>

      <section className="evaluation-explainer" aria-labelledby="evaluation-explainer-title">
        <div><h2 id="evaluation-explainer-title">Así funciona</h2><p>La evaluación no inventa precios ni costos. Cada etapa guarda evidencia en su módulo y la siguiente usa sólo los datos confirmados.</p></div>
        <div className="evaluation-explainer-list"><p><b>1.</b> Capturas la oferta y sus costos.</p><p><b>2.</b> Registras comparables y logística.</p><p><b>3.</b> La política calcula costo, utilidad, ROI, score y riesgos.</p></div>
      </section>
    </main>
  );
}
