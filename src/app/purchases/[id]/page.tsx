import Link from "next/link";

export default async function PurchaseDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <main className="purchase-workspace">
      <header className="purchase-header">
        <div>
          <Link className="back-link" href="/purchases">← Compras</Link>
          <h1>Detalle de compra</h1>
          <p>Referencia solicitada: <span className="mono-value">{id}</span></p>
        </div>
      </header>

      <section className="purchase-decision-band" aria-labelledby="detail-status-heading">
        <div className="purchase-band-mark" aria-hidden="true">!</div>
        <div>
          <h2 id="detail-status-heading">No hay una compra disponible para mostrar</h2>
          <p>La consulta se conectará al registro persistente al completar la implementación de Fase A.</p>
        </div>
        <span className="neutral-badge">Pendiente de persistencia</span>
      </section>

      <section className="purchase-ledger" aria-label="Próximas secciones del detalle">
        <div className="purchase-section-grid">
          <div><h2>Línea de tiempo</h2><p>Sin eventos registrados.</p></div>
          <div><h2>Envíos</h2><p>Sin envíos registrados.</p></div>
          <div><h2>Desglose</h2><p>Sin datos de costo disponibles.</p></div>
        </div>
      </section>
    </main>
  );
}
