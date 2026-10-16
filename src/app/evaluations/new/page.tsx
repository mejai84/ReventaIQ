import Link from "next/link";

const steps = [
  ["01", "Producto", "Categoría, marca, variante y condición."],
  ["02", "Oferta", "Precio, envío USA y costos observados."],
  ["03", "Mercado", "Comparables de venta en Colombia."],
  ["04", "Logística", "Cotización, peso, paquete y tasa de cambio."],
  ["05", "Decisión", "Costo, utilidad, ROI, score y riesgos."],
] as const;

export default function NewEvaluationPage() {
  return <main className="purchase-workspace"><Link className="back-link" href="/dashboard">← Dashboard</Link><header className="purchase-header"><div><p>Nueva evaluación</p><h1>Construye una decisión verificable</h1><p>Reúne evidencia de compra, mercado y logística antes de pedir una recomendación.</p></div></header><ol className="purchase-steps">{steps.map(([n, title, detail]) => <li key={n}><strong>{n} · {title}</strong><p>{detail}</p></li>)}</ol><section className="purchase-ledger"><div className="purchase-empty"><h2>La captura persistente estará disponible tras aprobar la migración.</h2><p>El flujo ya define los insumos que necesita el motor. No muestra estimaciones ni recomienda comprar hasta contar con datos confirmados.</p><button className="secondary-action" type="button" disabled aria-disabled="true">Iniciar captura</button></div></section></main>;
}
