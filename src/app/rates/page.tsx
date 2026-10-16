import Link from "next/link";
import { ArrowLeft, Check, CircleDollarSign } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createExchangeRate } from "./actions";

export default async function RatesPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  const user = await requireUser();
  const [params, rates] = await Promise.all([
    searchParams,
    prisma.exchangeRate.findMany({ where: { createdByUserId: user.id, baseCurrencyCode: "USD", quoteCurrencyCode: "COP" }, orderBy: [{ observedAt: "desc" }, { id: "desc" }], take: 30 }),
  ]);
  const feedback = params.created === "1" ? "Tasa registrada." : params.error === "validation" ? "Revisa la tasa y usa una fecha ISO con zona horaria." : undefined;

  return <main className="data-workspace"><Link className="back-link" href="/dashboard"><ArrowLeft size={16} /> Dashboard</Link><header className="data-header"><div><p className="dashboard-kicker">Conversión</p><h1>Tasas de cambio</h1><p>Observaciones USD/COP separadas del spread de tu política de negocio.</p></div></header>{feedback ? <p className={`form-feedback ${params.created === "1" ? "is-success" : ""}`} role="status">{params.created === "1" ? <Check size={16} /> : null}{feedback}</p> : null}<section className="catalog-layout"><form action={createExchangeRate} className="data-form" aria-labelledby="rate-form-title"><div className="form-heading"><CircleDollarSign aria-hidden="true" size={22} /><div><h2 id="rate-form-title">Registrar tasa USD → COP</h2><p>Conserva cuándo y de dónde viene cada observación.</p></div></div><fieldset><legend>Observación</legend><label>Tasa COP por USD<input name="rate" required inputMode="decimal" placeholder="4200.0000" /></label><label>Observada en UTC<input name="observedAt" required placeholder="2026-10-16T12:00:00Z" /></label><label className="form-wide">Proveedor o fuente<input name="providerName" maxLength={140} placeholder="Banco de la República (opcional)" /></label><label className="form-wide">Notas<textarea name="notes" maxLength={1000} placeholder="Opcional" /></label></fieldset><button className="form-submit" type="submit">Guardar tasa</button></form><section className="data-list" aria-labelledby="rate-list-title"><div className="list-heading"><div><p className="dashboard-kicker">Persistencia activa</p><h2 id="rate-list-title">Tasas registradas</h2></div><span>{rates.length}</span></div>{rates.length === 0 ? <div className="data-empty"><h3>No hay tasas registradas.</h3><p>Captura una tasa observada antes de calcular costos en Colombia.</p></div> : <ul className="catalog-list">{rates.map((rate) => <li key={rate.id.toString()}><div><strong>USD → COP</strong><span>{rate.observedAt.toISOString()}</span><code>{rate.providerName ?? "Fuente manual"}</code></div><div><b>{rate.rate.toString()}</b><span>COP por USD</span></div></li>)}</ul>}</section></section></main>;
}
