import Link from "next/link";

export default function RecoverPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="recover-title">
        <p className="dashboard-kicker">Cuenta</p>
        <h1 id="recover-title">Recuperar contraseña</h1>
        <p>ReventaIQ no envía correos electrónicos todavía. Si olvidaste la contraseña del administrador, restablécela desde Supabase en la tabla <code>users.password_hash</code> usando una nueva contraseña generada por <code>scrypt</code>, o pide al operador superadmin que la reinicie.</p>
        <p>Los usuarios autenticados pueden cambiarla desde su cuenta.</p>
        <p><Link className="app-link" href="/login">Volver al acceso</Link></p>
      </section>
    </main>
  );
}
