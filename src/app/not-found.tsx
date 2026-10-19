import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="not-found-title">
        <p className="dashboard-kicker">ReventaIQ</p>
        <h1 id="not-found-title">Página no encontrada.</h1>
        <p>La ruta o compra solicitada no existe en el sistema.</p>
        <Link href="/dashboard" className="landing-primary">
          Ir al dashboard
        </Link>
      </section>
    </main>
  );
}
