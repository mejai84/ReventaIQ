import Link from "next/link";

import { describeDatabaseFailure } from "@/lib/database-errors";

type DataLoadErrorProps = {
  readonly error: unknown;
  readonly module: string;
};

/**
 * Renders the actionable cause of a failed server-side data load.
 * It is used instead of a generic error screen while diagnosing Production.
 */
export function DataLoadError({ error, module }: DataLoadErrorProps) {
  const failure = describeDatabaseFailure(error);

  return (
    <main className="data-workspace" role="alert">
      <Link className="back-link" href="/dashboard">← Dashboard</Link>
      <header className="data-header">
        <div>
          <p className="dashboard-kicker">Diagnóstico de datos</p>
          <h1>No se pudo cargar {module}.</h1>
          <p>La interfaz se detuvo antes de mostrar datos para no ocultar la causa del fallo.</p>
        </div>
      </header>
      <section className="data-empty" aria-labelledby="data-error-title">
        <h2 id="data-error-title">{failure.title}</h2>
        <p>{failure.detail}</p>
        {failure.code === undefined ? null : <p><code>Código: {failure.code}</code></p>}
        <p>
          Verifica <code>DATABASE_URL</code> y <code>DATABASE_CA_CERT</code> en Vercel, y ejecuta{" "}
          <code>npx prisma migrate status</code> contra la base de datos de Production.
        </p>
        <Link className="secondary-action purchase-link" href="/dashboard">Volver al dashboard</Link>
      </section>
    </main>
  );
}
