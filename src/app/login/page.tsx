import Link from "next/link";
import { ArrowRight, LockKeyhole } from "@/components/icons";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error === "1";
  return <main className="auth-page"><Link className="auth-brand" href="/"><span>R</span>ReventaIQ</Link><section className="auth-card" aria-labelledby="login-title"><div className="auth-icon"><LockKeyhole aria-hidden="true" size={20} /></div><p className="dashboard-kicker">Acceso privado</p><h1 id="login-title">Entra a tu operación</h1><p>Usa las credenciales del administrador para acceder al dashboard.</p><form action={login}><label>Correo electrónico<input required type="email" name="email" autoComplete="email" maxLength={254} /></label><label>Contraseña<input required type="password" name="password" autoComplete="current-password" minLength={12} maxLength={256} /></label>{error ? <p className="auth-error" role="alert">No fue posible validar las credenciales.</p> : null}<button type="submit">Entrar al dashboard <ArrowRight aria-hidden="true" size={17} /></button></form></section></main>;
}