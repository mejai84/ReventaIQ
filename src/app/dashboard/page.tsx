import Link from "next/link";
import { ArrowUpRight, Box, CircleDollarSign, FileSearch, Plus, ShoppingBag } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/logout";

const areas = [
  { label: "01", title: "Evaluar oportunidad", description: "Reúne oferta, mercado y logística antes de decidir.", href: "/evaluations/new", icon: FileSearch },
  { label: "02", title: "Registrar compra", description: "Da seguimiento a un equipo que ya fue aprobado.", href: "/purchases", icon: ShoppingBag },
  { label: "03", title: "Gestionar catálogo", description: "Organiza productos, variantes y atributos verificables.", href: "/catalog", icon: Box },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.displayName.split(" ")[0] ?? user.displayName;

  return (
    <main className="apple-dashboard">
      <header className="apple-dashboard-nav">
        <Link href="/dashboard" className="apple-wordmark"><span aria-hidden="true">R</span>ReventaIQ</Link>
        <div className="apple-dashboard-actions"><form action={logout}><button type="submit">Cerrar sesión</button></form><Link className="apple-nav-cta" href="/evaluations/new"><Plus size={14} />Nueva evaluación</Link></div>
      </header>
      <section className="apple-dashboard-intro"><p className="apple-kicker">MESA DE OPERACIONES</p><h1>Hola, {firstName}.</h1><p>Tu operación empieza con evidencia. Registra datos confirmados y permite que cada decisión conserve su contexto.</p></section>
      <section className="apple-dashboard-strip" aria-label="Resumen operativo">
        <div><span>Capital disponible</span><strong>Sin datos</strong><small>Configura tu política de capital</small></div>
        <div><span>Oportunidades activas</span><strong>Sin datos</strong><small>Captura una oferta para comenzar</small></div>
        <div><span>Compras en curso</span><strong>Sin datos</strong><small>Sin movimientos registrados</small></div>
      </section>
      <section className="apple-dashboard-hero"><div><p className="apple-kicker">SIGUIENTE MOVIMIENTO</p><h2>Convierte un hallazgo<br />en una decisión clara.</h2><p>Reúne oferta, comparables, envío y política de negocio en una evaluación verificable.</p><Link className="apple-blue-pill" href="/evaluations/new">Crear evaluación <ArrowUpRight size={16} /></Link></div><div className="apple-dashboard-orbit" aria-hidden="true"><CircleDollarSign size={128} /><span>REVENTAIQ<br />DECISION ENGINE</span></div></section>
      <section className="apple-dashboard-workflow"><header><p className="apple-kicker">FLUJO DE TRABAJO</p><h2>Empieza donde esté la operación.</h2></header><div>{areas.map(({ label, title, description, href, icon: Icon }) => <Link href={href} key={href}><span>{label}</span><Icon size={22} /><h3>{title}</h3><p>{description}</p><b>Ir al módulo <ArrowUpRight size={15} /></b></Link>)}</div></section>
      <footer className="apple-dashboard-footer"><span>ReventaIQ · operación privada</span><Link href="/settings">Configuración</Link></footer>
    </main>
  );
}
