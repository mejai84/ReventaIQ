import Link from "next/link";

import { prismaPurchaseRepository } from "@/modules/purchases/infrastructure/prisma-purchase-repository";
import { requireUser } from "@/lib/auth";

type PurchaseDetailPageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function PurchaseDetailPage({
  params,
}: Readonly<PurchaseDetailPageProps>) {
  const sessionUser = await requireUser();
  const { id } = await params;

  let aggregate;
  try {
    aggregate = await prismaPurchaseRepository.findById(id);
  } catch {
    aggregate = undefined;
  }

  if (aggregate === undefined || aggregate.createdByUserId !== String(sessionUser.id)) {
    // Empty-state heading required by E2E: the purchase is not available.
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
            <p>La compra no existe o no te pertenece.</p>
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

  return (
    <main className="purchase-workspace">
      <header className="purchase-header">
        <div>
          <Link className="back-link" href="/purchases">← Compras</Link>
          <h1>Detalle de compra</h1>
          <p>Referencia solicitada: <span className="mono-value">{id}</span></p>
          <p className="small muted">Código: <span className="mono-value">{aggregate.referenceCode}</span> · estado: {aggregate.status}</p>
        </div>
      </header>
      <section className="purchase-decision-band" aria-labelledby="detail-status-heading">
        <div>
          <h2 id="detail-status-heading">Compra #{aggregate.id}</h2>
          <p>
            Estado: {aggregate.status}. Creada el {new Date(aggregate.createdAt).toLocaleString("es-CO", { timeZone: "UTC" })}.
          </p>
        </div>
        <span className="neutral-badge">{aggregate.status}</span>
      </section>
      <section className="purchase-ledger" aria-label="Secciones del detalle">
        <div className="purchase-section-grid">
          <div>
            <h2>Línea de tiempo</h2>
            {aggregate.events.length === 0 ? (
              <p>Sin eventos registrados.</p>
            ) : (
              <ul>
                {aggregate.events.map((event) => (
                  <li key={event.id}>
                    <strong>{event.code}</strong> — {new Date(event.occurredAt).toISOString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2>Envíos</h2>
            {aggregate.shipmentRecords.length === 0 ? (
              <p>Sin envíos registrados.</p>
            ) : (
              <ul>
                {aggregate.shipmentRecords.map((shipment) => (
                  <li key={shipment.id}>
                    Envío #{shipment.sequence} · {shipment.status} · {shipment.trackingNumber || "sin tracking"}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2>Desglose</h2>
            {aggregate.totalPaidUSD === undefined ? (
              <p>Sin datos de costo disponibles.</p>
            ) : (
              <p>Total pagado: {aggregate.totalPaidUSD.toString()} {aggregate.currencyCode}</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
