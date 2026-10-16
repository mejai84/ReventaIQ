# Plan de implementación — Fase 1

**Estado:** propuesto  
**Regla de inicio:** documentación y esquema aprobados antes de cualquier migración

> Situación actual: se documentó una propuesta. No se ha creado `schema.prisma`, no se ha generado SQL y no se ha aplicado ninguna migración.

## Etapa 0 — Cierre de diseño

Entregables:

- revisión de [overview.md](./overview.md);
- revisión del [modelo de datos](./data-model-phase-1.md);
- aprobación de las fórmulas canónicas y su orden de operaciones;
- resolución de las preguntas abiertas del modelo;
- aceptación de los ADRs.

Gate de salida:

- aprobación explícita del usuario del modelo de Fase 1;
- ninguna ambigüedad sobre ROI, garantía, spread, financiación o precio conservador;
- ninguna tasa o costo de ejemplo tratado como valor real.

## Etapa 1 — Fundación del proyecto

Entregables:

- aplicación Next.js con App Router y TypeScript estricto;
- Tailwind CSS, lint, formato y pruebas unitarias;
- validación tipada de variables de entorno y `.env.example` sin secretos;
- estructura modular descrita en la arquitectura;
- PostgreSQL de desarrollo reproducible;
- configuración de Prisma ORM 7 sin modelos todavía, si el gate anterior ya fue aprobado.

Verificación:

- build, typecheck, lint y prueba mínima ejecutan localmente;
- no se exponen secretos al cliente;
- la conexión a PostgreSQL no usa credenciales incluidas en Git.

## Etapa 2 — Persistencia aprobada

Esta etapa sólo empieza después del gate de Etapa 0.

Secuencia obligatoria:

1. Traducir el documento aprobado a `prisma/schema.prisma`.
2. Ejecutar formato y validación de Prisma.
3. Crear la migración en modo `create-only`.
4. Revisar el SQL generado: identity, `numeric`, `timestamptz`, nombres físicos, FK, acciones de borrado, checks e índices.
5. Añadir al SQL únicamente constraints e índices parciales documentados que Prisma no pueda expresar.
6. Revisar el diff completo y obtener aprobación del SQL.
7. Aplicar la migración en desarrollo.
8. Ejecutar pruebas de constraints y un detector de FK sin índice.

Entregables:

- esquema Prisma alineado con el documento;
- una migración inicial revisada;
- repositorios con transacciones explícitas;
- seed idempotente de catálogos aprobados.

El seed puede registrar nombres de proveedores, canales y taxonomías confirmadas. No asignará tasas tributarias, comisiones, spreads, costos, umbrales ni puntuaciones inventadas.

## Etapa 3 — Motor financiero mediante TDD

Implementar funciones puras y pequeñas:

- costo de conversión y tipo de cambio efectivo;
- costo puesto en Colombia;
- costos del canal de venta;
- reserva de garantía;
- costo financiero diario y por período;
- utilidad bruta y ajustada;
- margen y ROI;
- ROI equivalente por tiempo;
- velocidad de capital;
- estadísticas de mercado y precio conservador;
- score y clasificación configurables.

Pruebas requeridas:

- casos de referencia aprobados por el usuario;
- redondeo únicamente en fronteras definidas;
- invariantes: costos no negativos, suma de componentes, monotonicidad básica;
- ausencia de `number` en operaciones monetarias;
- rechazo explícito de inputs incompletos o inválidos;
- prueba que el spread no se cuenta dos veces;
- prueba que cambiar settings no altera una oportunidad histórica.

Gate de salida:

- las fórmulas están documentadas en lenguaje de negocio y código;
- cada resultado puede explicarse componente por componente.

## Etapa 4 — Casos de uso e ingreso manual

Entregables:

- administración versionada de settings;
- catálogo de productos, variantes y grados de condición;
- formularios para ofertas USA, listings Colombia, tasas, perfiles de venta y cotizaciones;
- validación Zod en servidor;
- búsqueda y paginación por cursor;
- autorización de administrador en cada mutación;
- transacciones para cambios de versión activa.

Verificación:

- pruebas de integración contra PostgreSQL real de pruebas;
- entradas desconocidas permanecen `UNKNOWN`/`NULL` y no se convierten en cero;
- enlaces, fuentes y tiempos de observación quedan persistidos.

## Etapa 5 — Opportunity Engine

Secuencia:

1. Seleccionar comparables compatibles y registrar exclusiones.
2. Calcular mínimo, promedio, mediana, máximo y tamaño de muestra.
3. Aplicar la estrategia conservadora configurada.
4. evaluar todas las cotizaciones vigentes y elegir la de menor costo total válido;
5. ejecutar el motor financiero;
6. calcular score, riesgos y señal;
7. persistir resumen, comparables y snapshot en una sola transacción;
8. crear una versión nueva en lugar de sobrescribir un análisis previo.

Gate de salida:

- el mismo conjunto de entradas y versiones produce el mismo resultado;
- el detalle permite reconstruir cada operación;
- una muestra insuficiente o dato vencido se muestra como riesgo.

## Etapa 6 — Dashboard y detalle

Dashboard:

- capital disponible e invertido sólo cuando exista una fuente válida para cada métrica;
- oportunidades activas, ROI y utilidad agregados sin mezclar monedas;
- tabla ordenable con score, producto, proveedor, costos, venta, utilidad, ROI, casillero y señal;
- filtros por producto, proveedor, condición y señal;
- estados vacíos, carga y error.

Detalle:

- identidad normalizada y enlace a fuente;
- comparables incluidos/excluidos;
- estadísticas y precio conservador;
- comparación de cotizaciones;
- desglose financiero completo;
- score por factor, riesgos, versión de settings y algoritmo.

Verificación:

- responsive en móvil, tableta y escritorio;
- navegación por teclado y estados no dependientes sólo del color;
- Decimals formateados en la UI sin recalcularlos;
- pruebas E2E del flujo manual hasta oportunidad.

## Etapa 7 — Endurecimiento y entrega

- autenticación de administrador y protección de todas las rutas privadas;
- límites de entrada, manejo de errores y logs sin secretos;
- pool de conexiones acorde al entorno de despliegue;
- backup y restauración probados antes de datos reales;
- revisión de accesibilidad y rendimiento;
- README operativo y guía de recuperación;
- CI con typecheck, lint, unitarias, integración y E2E crítica.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación en Fase 1 |
| --- | --- | --- |
| Reglas tributarias o de importación cambiantes | Costos incorrectos | Capturar componentes reales/configurables; validarlos externamente; no codificar tasas |
| Comparables no equivalentes | Venta estimada inflada | Catálogo normalizado, calidad tipada, exclusiones visibles y advertencia por muestra |
| Doble conteo de conversión o costos | Utilidad falsa | Fórmula canónica, snapshot y pruebas específicas |
| Cambio retroactivo de settings | Pérdida de auditabilidad | Versiones inmutables y referencia desde Opportunity |
| Precisión binaria | Centavos acumulados y señales erróneas | PostgreSQL `numeric` y Decimal en TypeScript |
| Datos vencidos | Compra basada en una oferta inexistente | `observed_at`, `expires_at`, estados y riesgos visibles |
| Score con falsa certeza | Decisión engañosa | Factores, pesos, versión y desglose auditables |
| Conectores que violen términos | Riesgo legal y bloqueo | Manual primero; sólo API/feed/import permitido |
| Agotamiento de conexiones | Caídas en producción | Cliente reutilizable y pool del proveedor |
| Limitaciones de Prisma para SQL avanzado | Integridad o rendimiento incompletos | Migración `create-only`, revisión SQL y pruebas de constraints |
| Sobreingeniería temprana | Demora del aprendizaje de negocio | Monolito modular y alcance estricto del MVP |
| Datos sensibles futuros | Exposición de IMEI/clientes | No incluirlos en Fase 1; diseñar protección antes de inventario |

## Orden posterior

Una vez validado el MVP:

1. Fase 2: fuentes autorizadas y scanner programado.
2. Fase 3: alertas, historial, capital, optimizador, inventario y ventas.
3. Fase 4: analytics avanzados, multiusuario y posible SaaS.

Cada fase requiere su propio ajuste de modelo documentado y aprobado antes de migrar.
