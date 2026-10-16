interface NavigationItem {
  readonly label: string;
  readonly symbol: string;
  readonly href: string;
  readonly active?: boolean;
}

const navigation: readonly NavigationItem[] = [
  { label: "Dashboard", symbol: "◫", href: "/", active: true },
  { label: "Oportunidades", symbol: "↗", href: "/opportunities" },
  { label: "Compras", symbol: "□", href: "/purchases" },
  { label: "Capturar datos", symbol: "+", href: "/suppliers" },
  { label: "Catálogo", symbol: "◇", href: "/catalog" },
  { label: "Configuración", symbol: "·", href: "/settings" },
];

function EmptyValue() {
  return <span className="metric-empty">Sin datos</span>;
}

export default function DashboardPage() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <div>
            <strong>ReventaIQ</strong>
            <span>Mesa financiera</span>
          </div>
        </div>

        <nav className="navigation">
          {navigation.map(({ label, symbol, href, active }) => (
            <a key={label} href={href} aria-current={active ? "page" : undefined}>
              <span className="nav-symbol" aria-hidden="true">{symbol}</span>
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="source-status">
          <span className="source-symbol" aria-hidden="true">●</span>
          <div>
            <strong>Fuentes manuales</strong>
            <span>Sin datos capturados</span>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="Abrir navegación">
            <span aria-hidden="true">☰</span>
          </button>
          <div className="heading">
            <h1>Dashboard</h1>
            <p>Resumen de capital y oportunidades evaluadas</p>
          </div>
          <a className="primary-action" href="/evaluations/new">`r`n            <span aria-hidden="true">+</span>`r`n            Nueva evaluación`r`n          </a>
        </header>

        <div className="workspace">
          <section className="notice" aria-labelledby="source-heading">
            <span className="notice-symbol" aria-hidden="true">i</span>
            <div>
              <h2 id="source-heading">Los datos se capturan manualmente</h2>
              <p>La primera oportunidad aparecerá cuando registres la oferta, el mercado en Colombia y los costos conocidos.</p>
            </div>
          </section>

          <section className="ledger" aria-label="Resumen financiero">
            <div className="ledger-group">
              <h2>Capital</h2>
              <dl>
                <div><dt>Disponible</dt><dd><EmptyValue /></dd></div>
                <div><dt>Invertido</dt><dd><EmptyValue /></dd></div>
              </dl>
            </div>
            <div className="ledger-group">
              <h2>Resultado</h2>
              <dl>
                <div><dt>Utilidad acumulada</dt><dd><EmptyValue /></dd></div>
                <div><dt>Intereses pagados</dt><dd><EmptyValue /></dd></div>
              </dl>
            </div>
            <div className="ledger-group">
              <h2>Scanner</h2>
              <dl>
                <div><dt>Oportunidades activas</dt><dd><EmptyValue /></dd></div>
                <div><dt>ROI promedio</dt><dd><EmptyValue /></dd></div>
              </dl>
            </div>
          </section>

          <section className="opportunity-panel" aria-labelledby="opportunities-heading">
            <div className="section-heading">
              <div>
                <h2 id="opportunities-heading">Oportunidades</h2>
                <p>Ordenadas por señal, rentabilidad y evidencia disponible.</p>
              </div>
            </div>
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">↗</div>
              <h3>Aún no hay oportunidades calculadas</h3>
              <p>Registra una evaluación completa para comparar el costo en Colombia con un precio de venta conservador.</p>
              <button className="secondary-action" type="button">
                Crear primera evaluación
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
