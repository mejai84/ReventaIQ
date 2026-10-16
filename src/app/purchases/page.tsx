import Link from "next/link";

export default function PurchasesPage() {
  return (
    <main className="purchase-workspace">
      <header className="purchase-header">
        <div>
          <Link className="back-link" href="/dashboard">← Dashboard</Link>
          <h1>Compras</h1>
          <p>Seguimiento operativo de equipos adquiridos y su tránsito hacia inventario.</p>
        </div>
        <button className="primary-action" type="button" disabled aria-disabled="true">
          Registrar compra
        </button>
      </header>

      <section className="purchase-decision-band" aria-labelledby="purchase-status-heading">
        <div className="purchase-band-mark" aria-hidden="true">+</div>
        <div>
          <h2 id="purchase-status-heading">Aún no hay compras registradas</h2>
          <p>La creación de compras se habilitará cuando esté lista la persistencia de Fase A.</p>
        </div>
        <span className="neutral-badge">Sin datos operativos</span>
      </section>

      <section className="purchase-ledger" aria-labelledby="purchase-ledger-heading">
        <div className="purchase-ledger-heading">
          <h2 id="purchase-ledger-heading">Registro de compras</h2>
          <p>El historial conservará el estado, origen y evidencia de cada movimiento.</p>
        </div>
        <div className="purchase-empty">
          <div className="purchase-empty-symbol" aria-hidden="true">□</div>
          <h3>Empieza con una oportunidad aprobada</h3>
          <p>Cuando confirmes una compra, su línea de tiempo, envíos y referencias quedarán reunidos aquí.</p>
          <Link className="secondary-action purchase-link" href="/dashboard">
            Revisar oportunidades
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
