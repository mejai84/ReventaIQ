import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { RADAR_CONNECTORS, readRadarConnectorEnv } from "@/modules/radar/connectors";

const stateLabels: Record<string, string> = {
  CONFIGURED: "Configurado",
  DISABLED: "Deshabilitado",
  MISSING_CREDENTIALS: "Faltan credenciales",
  UNSUPPORTED: "No soportado",
};

export default async function RadarSourcesPage() {
  await requireUser();
  const report = readRadarConnectorEnv(process.env);

  return <main className="data-workspace">
    <Link className="back-link" href="/radar"><ArrowLeft size={16} /> Radar</Link>
    <header className="data-header"><div><p className="dashboard-kicker">Conectores</p><h1>Estado de fuentes</h1><p>Solo se muestran nombres de variables. Los valores y credenciales nunca salen del entorno.</p></div></header>
    {report.issues.length > 0 ? <p className="form-feedback" role="status">Variables con formato inválido: {report.issues.map((issue) => `${issue.name} (${issue.code})`).join(", ")}.</p> : null}
    <section className="data-list" aria-labelledby="radar-sources-title">
      <div className="list-heading"><div><p className="dashboard-kicker">Fuentes</p><h2 id="radar-sources-title">Conectores disponibles</h2></div><span>{RADAR_CONNECTORS.length}</span></div>
      <ul className="catalog-list">{RADAR_CONNECTORS.map((connector) => {
        const status = connector.describe(report.env);
        return <li key={connector.key}>
          <div>
            <strong>{connector.label}</strong>
            <span>{connector.mode} · {stateLabels[status.state] ?? status.state}</span>
            <code>{connector.description}</code>
            {status.missingEnvVars.length === 0 ? null : <small>Variables faltantes: {status.missingEnvVars.join(", ")}</small>}
            {connector.implemented ? null : <small>Conector pendiente de proveedor: no realiza solicitudes.</small>}
          </div>
          <div>
            <b>{status.state === "CONFIGURED" ? "Listo" : "Sin uso"}</b>
            <span>{connector.requiresCredentials ? "Requiere credenciales" : "Sin credenciales"}</span>
          </div>
        </li>;
      })}</ul>
    </section>
  </main>;
}
