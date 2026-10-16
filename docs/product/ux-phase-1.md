# UX de producto — Fase 1

Estado: propuesta de experiencia para el MVP  
Alcance: dashboard, captura manual y detalle de oportunidad  
Fuente visual: [sistema maestro de ReventaIQ](../../design-system/reventaiq/MASTER.md)

## 1. Propósito

ReventaIQ es una mesa de inteligencia financiera para evaluar compras y reventa de
iPhone entre Estados Unidos y Colombia. La experiencia no debe comportarse como
una calculadora aislada ni como una terminal de trading. Su trabajo principal es
permitir que una persona responda, con evidencia:

1. ¿Conviene comprar esta unidad?
2. ¿Qué supuestos sostienen el resultado?
3. ¿Cuánto capital compromete y durante cuánto tiempo?
4. ¿Qué datos faltan o podrían cambiar la decisión?

La recomendación nunca se presenta como una promesa. Siempre se acompaña de la
fecha de cálculo, las fuentes capturadas, las reglas aplicadas y el nivel de
completitud.

## 2. Alcance y límites de la fase

Incluido:

- configuración de negocio y reglas;
- catálogo normalizado de iPhone;
- captura manual de oferta en Estados Unidos;
- captura manual de comparables en Colombia;
- captura manual de cotizaciones de envío;
- cálculo financiero y clasificación determinista;
- dashboard y detalle de oportunidad.

Fuera de alcance en esta fase:

- conectores automáticos y scraping;
- compra desde ReventaIQ;
- inventario, ventas y optimizador de capital completos;
- tendencias sin histórico suficiente;
- tasas, impuestos, comisiones o costos inferidos por la interfaz.

Los módulos futuros no aparecen como destinos vacíos en la navegación. Se añaden
cuando exista una tarea real que completar.

## 3. Modelo mental y arquitectura de información

El producto sigue un ciclo corto y estable:

```text
Revisar cartera
     |
     v
Capturar evidencia -> Revisar supuestos -> Calcular
                                           |
                                           v
                              Entender la recomendación
                                           |
                         +-----------------+-----------------+
                         |                                   |
                    Editar datos                    Abrir fuente original
                         |                                   |
                         +----------> Recalcular <-----------+
```

Navegación del MVP:

- **Dashboard**: posición de capital y oportunidades priorizadas.
- **Oportunidades**: listado completo, búsqueda y filtros.
- **Capturar datos**: entrada principal para una nueva evaluación.
- **Catálogo**: variantes normalizadas que pueden seleccionarse al capturar.
- **Configuración**:
  - negocio y capital;
  - moneda y conversión;
  - reglas de recomendación;
  - reserva y costos;
  - canales de venta.

En escritorio, esta navegación vive en una barra lateral de tinta. En pantallas
pequeñas se abre como panel modal desde el encabezado. El CTA persistente es
`Nueva evaluación`; “Opportunity Engine”, “connector” y otros nombres internos
no se exponen al usuario.

## 4. Dashboard

### 4.1 Jerarquía

La página abre con contexto y decisión, no con decoración:

1. título, periodo y CTA `Nueva evaluación`;
2. estado de las fuentes y fecha de actualización;
3. resumen financiero agrupado por significado;
4. tabla de oportunidades;
5. instrucciones o estados vacíos cuando aún no hay evidencia.

Las seis métricas requeridas no se convierten en seis tarjetas idénticas. Se
agrupan como un libro operativo:

- **Capital**: disponible e invertido;
- **Resultado**: utilidad acumulada e intereses pagados;
- **Scanner**: oportunidades activas y ROI promedio.

Cada valor indica moneda, periodo o universo de cálculo. Si no existe un dato,
se muestra `Sin datos`; no se sustituye por cero. Una tendencia sólo aparece
cuando hay dos periodos comparables y una definición implementada.

### 4.2 Wireframe de escritorio

```text
+----------------------+---------------------------------------------------------+
| ReventaIQ            | Dashboard                          [Nueva evaluación]   |
|                      | Datos capturados manualmente · Actualización [fecha]    |
| Dashboard            +------------------+------------------+-------------------+
| Oportunidades        | CAPITAL          | RESULTADO        | SCANNER           |
| Capturar datos       | Disponible  [—]  | Utilidad    [—]  | Activas      [—]  |
| Catálogo             | Invertido   [—]  | Intereses   [—]  | ROI promedio [—]  |
|                      +------------------+------------------+-------------------+
| Configuración        | Oportunidades                         [Filtros] [Buscar] |
|                      +------+----------------+---------+--------+------+--------+
|                      |Score | Modelo         | Costo   | Venta  | ROI  | Señal  |
|                      +------+----------------+---------+--------+------+--------+
|                      |  —   | [producto]     |   —     |   —    |  —   | [—]    |
|                      +------+----------------+---------+--------+------+--------+
|                      | Origen, fecha y completitud de cada análisis            |
+----------------------+---------------------------------------------------------+
```

### 4.3 Tabla de oportunidades

Columnas de escritorio:

- score;
- producto, almacenamiento y condición;
- proveedor;
- precio USA;
- costo puesto en Colombia;
- venta conservadora;
- utilidad ajustada;
- ROI;
- mejor cotización de envío;
- señal;
- fecha de cálculo.

La fila completa abre el detalle y contiene un enlace accesible, sin convertir
celdas con acciones propias en áreas anidadas. Encabezados ordenables anuncian
campo y dirección. Los filtros activos se pueden retirar individualmente y
restablecer en conjunto.

En móvil, cada fila pasa a tarjeta de decisión. Se priorizan producto, señal,
utilidad ajustada, ROI, capital requerido y completitud; el resto queda bajo
`Ver desglose`. No se encoge la tabla hasta volverla ilegible.

## 5. Captura manual

La captura es un flujo guiado único. Evita obligar al usuario a crear registros
aislados y luego descubrir cómo relacionarlos.

### 5.1 Pasos

1. **Producto y oferta USA**
   - variante normalizada, capacidad y condición;
   - atributos que cambian la equivalencia: batería, bloqueo, SIM, piezas y
     estado funcional;
   - proveedor, precio, envío local, cargos conocidos, URL y fecha de captura.
2. **Mercado Colombia**
   - lista repetible de comparables;
   - fuente, precio, condición, fecha y URL opcional;
   - mínimo, mediana, promedio, máximo y cantidad calculados, sin inventar
     observaciones faltantes;
   - método configurado para el precio conservador, descrito en lenguaje claro.
3. **Envío e importación**
   - una o más cotizaciones;
   - conceptos desglosados y moneda indicada por campo;
   - comparación de totales sólo entre cotizaciones suficientemente completas.
4. **Supuestos comerciales**
   - canal, costos de venta, reserva de garantía, financiación y días esperados;
   - tasa y margen de conversión utilizados;
   - valores heredados de configuración identificados como tales y posibilidad
     de sobrescribirlos sólo para este análisis.
5. **Revisar y calcular**
   - resumen de entradas, faltantes y advertencias;
   - desglose preliminar;
   - acción `Calcular oportunidad`.

### 5.2 Wireframe de escritorio

```text
+----------------------+---------------------------------------------------------+
| navegación           | Nueva evaluación                        Borrador guardado|
|                      +------------+----------------------------+---------------+
|                      | 1 Producto | 2 Mercado | 3 Envío | 4 Supuestos | 5 Revisar|
|                      +------------+----------------------------+---------------+
|                      | Producto y oferta USA        | Resumen del análisis     |
|                      |                              |                          |
|                      | Modelo        [seleccionar]  | Producto       [—]       |
|                      | Condición     [seleccionar]  | Datos completos [—]      |
|                      | Proveedor     [texto]        | Costos conocidos [—]     |
|                      | Precio USD    [importe]      |                          |
|                      | Fecha         [fecha]        | Los resultados aparecen |
|                      | URL           [opcional]     | después de calcular.     |
|                      |                              |                          |
|                      | [Guardar y salir] [Continuar]                           |
+----------------------+---------------------------------------------------------+
```

### 5.3 Reglas de formulario

- Una etiqueta visible acompaña cada control; el placeholder sólo aporta un
  ejemplo de formato.
- `0`, `No aplica` y `Desconocido` son estados diferentes. Un campo vacío nunca
  se transforma silenciosamente en costo cero.
- Las monedas se identifican en la etiqueta y en el valor formateado.
- La validación ocurre al salir del campo; tras un envío fallido aparece un
  resumen enfocable con enlaces a los campos y persisten los errores inline.
- Los valores calculados son de sólo lectura y se distinguen de las entradas.
- Añadir o eliminar una fila repetible confirma la acción cuando contiene datos.
- El flujo conserva borrador y paso actual. La confirmación usa el mismo verbo
  de la acción: `Oportunidad calculada`, no `Operación exitosa`.
- El resumen lateral no intenta anticipar una señal mientras falten entradas
  requeridas; usa `Aún no calculada`.

## 6. Detalle de oportunidad

### 6.1 Primera vista

El encabezado reúne identidad, procedencia y acciones. Debajo, una franja de
decisión muestra la señal, el score, la completitud y una explicación breve de
las reglas cumplidas. La señal no ocupa toda la pantalla ni usa lenguaje de
certeza absoluta.

Métricas principales:

- precio de compra USD;
- costo puesto en Colombia;
- venta conservadora;
- utilidad bruta y ajustada;
- ROI y margen;
- capital requerido;
- días esperados de rotación.

### 6.2 Wireframe de escritorio

```text
+----------------------+---------------------------------------------------------+
| navegación           | < Oportunidades               [Editar] [Ver publicación]|
|                      | [Producto normalizado] · [condición] · Cálculo [fecha]   |
|                      +---------------------------------------------------------+
|                      | DECISIÓN | [Señal] [Score —] [Completitud —]             |
|                      | Motivos verificables y datos que pueden cambiarla       |
|                      +-----------+-----------+-----------+---------------------+
|                      | Compra [—]| Puesto [—]| Venta [—] | Utilidad ajustada [—]|
|                      +-----------+-----------+-----------+---------------------+
|                      | Desglose de costos       | Reglas y score               |
|                      | Compra                 — | ROI                   —      |
|                      | Conversión            — | Utilidad              —      |
|                      | Envío/importación      — | Liquidez/comparables  —      |
|                      | Venta y reservas       — | Riesgo                —      |
|                      +--------------------------+------------------------------+
|                      | Comparables Colombia | Cotizaciones | Riesgos y faltantes|
+----------------------+---------------------------------------------------------+
```

### 6.3 Secciones de evidencia

- **Desglose de costos**: recorrido desde compra hasta costo real, con subtotales
  y fórmula consultable.
- **Mercado Colombia**: estadísticos, estrategia conservadora y cada comparable
  con condición, fecha y fuente.
- **Cotizaciones**: conceptos, total y faltantes. “Mejor opción” significa el
  menor total entre cotizaciones comparables, no una recomendación contractual.
- **Score**: factores, pesos y contribución al resultado; nunca sólo un círculo
  con un número.
- **Riesgos**: datos ausentes, comparables débiles, condición incierta y otros
  hechos derivados de la evidencia disponible.
- **Historial**: se muestra únicamente cuando existen snapshots. El estado vacío
  explica que aún no hay observaciones suficientes.
- **Auditoría**: configuración, tasa, reglas, fuentes y fecha usadas en el cálculo.

`Ver publicación original` sólo aparece si se guardó una URL. Es un enlace
externo, no implica que ReventaIQ venda, reserve o garantice el producto.

## 7. Estados transversales

| Estado | Comportamiento |
|---|---|
| Cargando | Skeleton con el tamaño final reservado; controles principales desactivados. |
| Vacío inicial | Explica qué falta y ofrece una sola acción siguiente. |
| Sin resultados | Conserva filtros y permite limpiarlos. |
| Incompleto | Indica campos o fuentes faltantes; la señal pasa a `No calculable` cuando corresponda. |
| Desactualizado | Conserva el último cálculo, muestra su fecha y ofrece recalcular. El umbral proviene de configuración. |
| Guardando | El control mantiene etiqueta y añade progreso; evita envíos duplicados. |
| Guardado | Confirmación breve y persistente en el contexto relevante. |
| Error de validación | Resumen enfocable más mensaje específico junto al campo. |
| Error de cálculo | Conserva todas las entradas y permite corregir o reintentar. |
| Sin permiso futuro | No se diseña en fase 1; no mostrar acciones falsas. |

## 8. Responsive

- **≥ 1280 px**: sidebar fija, contenido de hasta doce columnas y tabla completa.
- **1024–1279 px**: sidebar compacta, ocho columnas y ocultación de columnas
  secundarias mediante un control explícito.
- **768–1023 px**: navegación en panel, dos columnas para resúmenes y tablas con
  sólo las columnas críticas.
- **< 768 px**: una columna, oportunidades como tarjetas, pasos con título corto
  y barra de acciones al final de la vista.
- Probar como mínimo anchos de 375, 768, 1024 y 1440 px.
- Ningún flujo depende de desplazamiento horizontal. Un desglose excepcionalmente
  ancho puede usar contenedor desplazable con indicación visual y alternativa
  legible por filas.
- Los objetivos táctiles miden al menos 44 × 44 px y mantienen 8 px de separación.

## 9. Accesibilidad y formato de datos

- Contraste mínimo 4.5:1 para texto normal y foco visible sobre lienzo y sidebar.
- Orden de tabulación igual al orden visual; el foco no queda oculto bajo barras
  fijas.
- Iconos funcionales con nombre accesible; los decorativos quedan ocultos para
  tecnología asistiva.
- Señales expresadas con texto, icono y color. La forma del badge también ayuda a
  diferenciar recomendación, advertencia y error.
- Actualizaciones de cálculo anunciadas de forma breve mediante una región viva;
  no se anuncia cada cambio mientras se escribe.
- Movimiento reducido respetado; no hay animación automática indispensable.
- Gráficos futuros incluyen resumen textual, leyenda y tabla equivalente.
- Cifras tabulares y nombres de moneda explícitos: `COP` y `USD`. Los importes
  abreviados sólo se usan en resúmenes y ofrecen el valor completo en texto
  accesible, sin depender de hover.
- Fechas incluyen zona o contexto cuando afecte la vigencia de una fuente.

## 10. Contenido y confianza

Voz: directa, sobria y operacional. Verbos de acción en sentence case:
`Guardar borrador`, `Continuar`, `Calcular oportunidad`, `Editar datos`.

Copias recomendadas:

- `Aún no hay oportunidades calculadas.`
- `Añade comparables de Colombia para estimar un precio conservador.`
- `Faltan datos para calcular una recomendación.`
- `Resultado basado en datos capturados manualmente el [fecha].`
- `Esta recomendación depende de los supuestos mostrados.`

Evitar:

- `Ganancia garantizada`;
- `Oportunidad imperdible`;
- afirmaciones de datos “en vivo” sin un conector implementado;
- porcentajes, tendencias o precisión que no provengan del cálculo guardado;
- mensajes genéricos como `Algo salió mal` sin una acción correctiva.

## 11. Riesgos de usabilidad y mitigaciones

| Riesgo | Mitigación |
|---|---|
| La señal se interpreta como garantía | Mostrar reglas, supuestos, completitud y riesgos junto a la señal. |
| USD y COP se confunden | Moneda explícita en campo, celda, subtotal y valor accesible. |
| Un dato ausente se trata como cero | Estados separados y bloqueo del cálculo cuando el faltante sea esencial. |
| Comparables no equivalentes | Exponer variante, capacidad, condición y atributos relevantes. |
| Cambios globales alteran análisis históricos | Guardar snapshot de configuración y ofrecer recálculo explícito. |
| Captura manual demasiado larga | Pasos breves, filas repetibles, borrador y resumen contextual. |
| Score opaco | Desglosar pesos, contribuciones y reglas. |
| Densidad excesiva en móvil | Tarjetas de decisión y divulgación progresiva. |
| Datos antiguos parecen actuales | Fecha y procedencia visibles; nunca sólo en tooltip. |

## 12. Criterios de aceptación UX

- Es posible completar una evaluación sólo con teclado.
- Un lector de pantalla identifica etiquetas, errores, moneda, estado y resultado.
- Ninguna recomendación aparece si faltan datos definidos como obligatorios.
- Toda cifra del detalle puede rastrearse a una entrada, configuración o fórmula.
- El dashboard no muestra tendencias ni datos sintéticos cuando no existe
  histórico.
- Las tres vistas mantienen la acción principal y la jerarquía en 375, 768, 1024
  y 1440 px.
- El estado de una oportunidad se entiende en escala de grises.
- La interfaz diferencia claramente captura manual, cálculo y fuente externa.

