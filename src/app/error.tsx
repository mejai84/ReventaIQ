"use client";

import { useEffect } from "react";

import Link from "next/link";

type ErrorProps = {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="auth-page" role="alert" aria-live="assertive">
      <section className="auth-card" aria-labelledby="error-title">
        <p className="dashboard-kicker">ReventaIQ</p>
        <h1 id="error-title">Ocurrió un problema inesperado.</h1>
        <p>No pudimos completar esta acción en este momento. Puedes volver a intentarlo con seguridad.</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem" }}>
          <button type="button" onClick={() => reset()} className="landing-primary">Reintentar</button>
          <Link href="/dashboard" className="landing-secondary">Ir al dashboard</Link>
        </div>
      </section>
    </main>
  );
}
