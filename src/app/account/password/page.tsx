import Link from "next/link";

import { changePassword } from "./actions";
import { requireUser } from "@/lib/auth";

export default async function ChangePasswordPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ error?: string; ok?: string }> }>) {
  await requireUser();
  const { error, ok } = await searchParams;
  return (
    <main className="auth-page">
      <header className="auth-page-header">
        <Link href="/dashboard" className="back-link">← Dashboard</Link>
      </header>
      <section className="auth-card" aria-labelledby="change-password-title">
        <p className="dashboard-kicker">Cuenta</p>
        <h1 id="change-password-title">Cambiar contraseña</h1>
        <p>Introduce la contraseña actual para confirmar y la nueva dos veces.</p>
        <form action={changePassword}>
          <label>Contraseña actual<input required type="password" name="current" autoComplete="current-password" minLength={12} maxLength={256} /></label>
          <label>Nueva contraseña<input required type="password" name="next" autoComplete="new-password" minLength={12} maxLength={256} /></label>
          <label>Repetir nueva contraseña<input required type="password" name="confirm" autoComplete="new-password" minLength={12} maxLength={256} /></label>
          {error === "1" ? <p className="auth-error" role="alert">No fue posible cambiar la contraseña. Revisa los datos.</p> : null}
          {ok === "1" ? <p role="status" className="auth-notice" style={{ color: "var(--color-success, #1f8f55)" }}>Contraseña actualizada.</p> : null}
          <button type="submit">Actualizar contraseña</button>
        </form>
      </section>
    </main>
  );
}
