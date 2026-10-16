# ReventaIQ — Sistema de diseño maestro

Versión: fase 1  
Concepto: **mesa de inteligencia financiera**  
Implementación objetivo: aplicación web responsive  
Especificación de experiencia: [UX de fase 1](../../docs/product/ux-phase-1.md)

## 1. Dirección

ReventaIQ se siente como una superficie de trabajo financiero: clara durante
sesiones largas, precisa con los números y prudente al comunicar riesgo. El
lienzo mineral funciona como papel técnico; la sidebar de tinta es la espina de
control; el azul marca acciones; jade, ámbar y coral tienen significado y no se
usan como decoración.

El rasgo memorable es la **franja de decisión**: una banda estructural que reúne
señal, score, completitud, fecha y motivos. Conecta la recomendación con su
evidencia y evita que un badge aislado parezca una promesa.

Principios:

1. **Decisión antes que ornamento.** La recomendación y sus condiciones dominan.
2. **Números rastreables.** Todo total conduce a su desglose, fuente o fórmula.
3. **Densidad con respiración.** Compacto en tablas; generoso alrededor de hitos.
4. **Color semántico.** Ningún color de señal se usa para “dar energía” a la UI.
5. **Incertidumbre visible.** Ausente, cero y no aplicable nunca son equivalentes.

## 2. Revisión contra clichés

La exploración inicial de dashboard fintech devolvió el patrón habitual de fondo
casi negro, verde ácido, brillos y tipografía monoespaciada generalizada. Se
descarta por estas razones:

- se parece a una terminal cripto o de trading de alta frecuencia, mientras que
  ReventaIQ evalúa operaciones físicas y evidencia capturada;
- convierte el verde en decoración y reduce su capacidad de comunicar una
  oportunidad favorable;
- la alta emisión de contraste local y los brillos fatigan en sesiones de carga
  y revisión;
- sugiere datos instantáneos incluso cuando la fase 1 usa captura manual.

También se evita el “kit SaaS” de seis tarjetas iguales, bordes redondeados
idénticos y sombras blandas en todo. Las métricas se agrupan por capital,
resultado y scanner; las superficies se distinguen por estructura, no por una
colección de contenedores flotantes.

Revisión aplicada:

- oscuro total → lienzo mineral luminoso y sidebar tinta;
- verde ácido → jade sobrio reservado a resultados positivos;
- glows y gradientes → reglas, alineación y cambios de superficie;
- mono en etiquetas → sans humana; mono sólo para cifras;
- badges aislados → franja de decisión con explicación y procedencia;
- mayúsculas espaciadas → sentence case y jerarquía por peso/tamaño.

## 3. Tokens de color

### 3.1 Base

| Token | Valor | Uso |
|---|---:|---|
| `color.canvas` | `#F3F6F8` | Lienzo mineral principal. |
| `color.surface` | `#FFFFFF` | Formularios, tablas y superficies elevadas. |
| `color.ink` | `#102236` | Sidebar, texto principal y controles de alto énfasis. |
| `color.text` | `#102236` | Texto principal sobre fondos claros. |
| `color.textMuted` | `#4F6272` | Texto secundario; no usar para contenido deshabilitado sobre fondos oscuros. |
| `color.border` | `#CDD6DD` | Divisores y límites de controles. |
| `color.borderStrong` | `#718394` | Límites de controles y separadores esenciales; supera 3:1 sobre blanco. |
| `color.sidebarText` | `#F3F6F8` | Texto sobre la sidebar de tinta. |
| `color.sidebarMuted` | `#B9C5CF` | Metadatos y navegación secundaria en sidebar. |

### 3.2 Acciones y significado

| Token | Valor | Uso |
|---|---:|---|
| `color.operational` | `#2954D1` | CTA primario, enlace, selección y foco. |
| `color.positive` | `#147D64` | Strong Buy, confirmación y resultado favorable validado. |
| `color.caution` | `#A85B00` | Watch, vigencia y datos incompletos no bloqueantes. |
| `color.critical` | `#B42318` | Reject, error y acción destructiva. |
| `color.infoSurface` | `#E8EEFF` | Fondo informativo suave. |
| `color.positiveSurface` | `#E5F3EE` | Fondo positivo suave. |
| `color.cautionSurface` | `#FFF1D6` | Fondo de advertencia. |
| `color.criticalSurface` | `#FCE8E6` | Fondo de error o rechazo. |

Reglas:

- Texto blanco puede usarse en botones con tinta, azul operativo, jade, ámbar o
  coral sólo después de validar contraste en implementación.
- En superficies tintadas se usa tinta como texto; el color semántico queda para
  icono, borde o énfasis.
- `Buy` usa azul operativo; `Strong Buy`, jade; `Watch`, ámbar; `Reject`, coral;
  `No calculable`, tinta atenuada. Cada estado incluye texto e icono.
- No usar jade en CTAs neutrales ni coral para llamar la atención sin error.
- No crear gradientes de marca en la aplicación de trabajo.

### 3.3 Tokens funcionales sugeridos

```text
--canvas:             #F3F6F8
--surface:            #FFFFFF
--ink:                #102236
--text:               #102236
--text-muted:         #4F6272
--border:             #CDD6DD
--border-strong:      #718394
--operational:        #2954D1
--positive:           #147D64
--caution:            #A85B00
--critical:           #B42318
--focus-ring:         #2954D1
```

Los componentes consumen tokens semánticos; no incluyen hexadecimales propios.

## 4. Tipografía

Familia primaria:

```text
"Instrument Sans", "Geist", system-ui, -apple-system, "Segoe UI", sans-serif
```

Familia numérica:

```text
"Geist Mono", "SFMono-Regular", Consolas, monospace
```

Instrument Sans expresa el carácter humano y editorial de la mesa de trabajo.
Geist es fallback, no una segunda voz decorativa. Mono se limita a cifras:
importes, porcentajes y scores. Navegación, identificadores, fórmulas, etiquetas
y metadatos permanecen en sans.

Escala:

| Token | Tamaño / línea | Peso | Uso |
|---|---|---:|---|
| `type.display` | 32 / 38 px | 650 | Título principal de vista en escritorio. |
| `type.h1` | 28 / 34 px | 650 | Encabezado de oportunidad. |
| `type.h2` | 22 / 28 px | 620 | Sección principal. |
| `type.h3` | 18 / 24 px | 620 | Grupo o panel. |
| `type.body` | 16 / 24 px | 430 | Texto y formularios. |
| `type.bodyCompact` | 14 / 20 px | 450 | Tablas y metadatos. |
| `type.caption` | 12 / 17 px | 500 | Ayuda secundaria; nunca información esencial aislada. |
| `type.metric` | 24 / 30 px | 620 | Importes de resumen con cifras tabulares. |

Reglas:

- Sentence case; no usar etiquetas completas en mayúsculas.
- Alineación izquierda por defecto. Los importes se alinean por el extremo y
  usan `font-variant-numeric: tabular-nums`.
- Longitud recomendada de texto continuo: 60–75 caracteres.
- No mezclar más de tres pesos tipográficos en una vista.

## 5. Espacio, forma y elevación

Escala de espacio basada en 4 px:

```text
space.1  = 4px
space.2  = 8px
space.3  = 12px
space.4  = 16px
space.5  = 20px
space.6  = 24px
space.8  = 32px
space.10 = 40px
space.12 = 48px
space.16 = 64px
```

Radios:

```text
radius.control = 8px
radius.panel   = 12px
radius.badge   = 999px
```

No aplicar el mismo radio a toda la interfaz. Las tablas y la franja de decisión
pueden usar esquinas discretas o compartir borde con la superficie contigua.

Elevación:

```text
shadow.raised = 0 1px 2px rgb(16 34 54 / 0.06),
                0 8px 24px rgb(16 34 54 / 0.05)
shadow.overlay = 0 18px 48px rgb(16 34 54 / 0.18)
```

La mayoría de paneles se separa con borde y color de superficie. `shadow.raised`
se reserva para elementos interactivos elevados; `shadow.overlay`, para modal o
panel móvil. No hay sombras en cada tarjeta.

## 6. Layout

- Sidebar de escritorio: 232–248 px; fondo tinta; navegación y contexto global.
- Área principal: canvas mineral, ancho fluido y gutters de 24–40 px.
- Contenido máximo recomendado: 1600 px para impedir líneas y tablas dispersas.
- Rejilla: doce columnas en escritorio, ocho en tablet y cuatro en móvil.
- Encabezados y contenido se alinean a la misma línea izquierda; evitar bloques
  centrados propios de una landing page.
- La densidad de tabla es media: filas de 52–60 px; controles táctiles conservan
  44 px aunque el contenido visual sea menor.

### Shell

```text
+----------------------+---------------------------------------------------------+
| sidebar tinta        | header de contexto y acciones                           |
|                      +---------------------------------------------------------+
| navegación           |                                                         |
|                      | canvas mineral                                           |
| estado de fuentes    | superficies blancas estructuradas por datos              |
|                      |                                                         |
+----------------------+---------------------------------------------------------+
```

## 7. Patrones característicos

### 7.1 Franja de decisión

Contiene, en este orden:

1. señal textual e icono;
2. score y completitud;
3. razones principales;
4. fecha y origen del cálculo;
5. acción para revisar supuestos.

Usa un borde izquierdo semántico de 4 px y una superficie blanca. El fondo no se
tiñe por completo con el color de la señal. `Strong Buy` no recibe brillo,
confeti ni animación.

### 7.2 Libro de capital

En el dashboard, agrupa pares de métricas en tres superficies conectadas:
capital, resultado y scanner. Las reglas verticales recuerdan un libro contable
sin imitar papel ni usar textura decorativa. La jerarquía proviene de alineación,
tipografía numérica y subtotales.

### 7.3 Desglose monetario

- concepto a la izquierda, importe y moneda a la derecha;
- sangría para componentes, regla superior para subtotal;
- valores desconocidos como `Sin dato`, nunca `0`;
- fórmula disponible mediante divulgación progresiva;
- cifras negativas incluyen signo y descripción, no dependen del coral.

## 8. Componentes

### Botones

- **Primario**: azul operativo, una sola acción dominante por región.
- **Secundario**: superficie blanca, borde fuerte y texto tinta.
- **Terciario**: texto azul, sin fondo permanente.
- **Destructivo**: coral; requiere contexto y confirmación proporcional.
- Estado ocupado mantiene el ancho, cambia a verbo en progreso y desactiva el
  envío duplicado.

### Campos

- Altura mínima de 44 px; etiqueta sobre el control.
- Ayuda debajo sólo cuando evita un error real.
- Prefijo o sufijo de moneda visible, sin sustituir la etiqueta.
- Error con mensaje específico, borde coral e icono; foco azul para no confundir
  selección con error.
- Calculado/de sólo lectura usa superficie mineral, conserva contraste y permite
  seleccionar/copiar el valor.

### Badges de señal

- Icono + etiqueta completa; no abreviar `Strong Buy` a color o iniciales.
- Fondo semántico suave, texto tinta y pequeño acento del estado.
- `No calculable` y `Borrador` son estados neutrales, no rechazos.

### Tablas

- Encabezado persistente sólo si no tapa contenido o foco.
- Orden mediante botón con nombre y dirección anunciados.
- Hover complementa, pero no sustituye, foco y enlace visible.
- Acciones de fila se mantienen separadas del enlace principal.
- En móvil, convertir en tarjetas; no forzar ocho columnas estrechas.

### Iconos

- SVG de una sola familia, trazo de 1.75–2 px.
- 16 px en metadatos, 20 px en controles y 24 px en estados principales.
- No usar emoji como iconografía ni iconos sin etiqueta en acciones ambiguas.

## 9. Visualización de datos

- Primero se elige la pregunta; después, el gráfico.
- Con uno o pocos valores, usar cifra y desglose en lugar de gráfico decorativo.
- No mostrar línea de tendencia con una sola observación ni extrapolar datos.
- Colores accesibles, marcas o patrones adicionales y leyenda cercana.
- Tooltip nunca es la única forma de acceder a un valor.
- Todo gráfico financiero tiene tabla o resumen textual equivalente.
- Escalas y periodos se etiquetan; ejes truncados requieren justificación visible.

## 10. Motion

```text
motion.fast   = 120ms
motion.normal = 180ms
motion.slow   = 240ms
ease.standard = cubic-bezier(.2, .8, .2, 1)
```

Movimiento permitido:

- abrir/cerrar panel;
- revelar error o confirmación cerca de la acción;
- actualizar una fila después de recalcular;
- trasladar foco entre pasos.

No usar entradas escalonadas de tarjetas, parallax, números que cuentan desde
cero ni pulsos continuos. Con `prefers-reduced-motion: reduce`, los cambios son
inmediatos y conservan toda la información.

## 11. Responsive

| Rango | Comportamiento |
|---|---|
| `≥ 1280 px` | Sidebar completa, rejilla de 12 columnas y tabla de oportunidades. |
| `1024–1279 px` | Sidebar compacta, 8 columnas y métricas reagrupadas. |
| `768–1023 px` | Navegación modal, 2 columnas y columnas de tabla priorizadas. |
| `< 768 px` | Una columna, tarjetas de decisión y pasos apilados. |

La adaptación responde a prioridad, no sólo a tamaño: metadatos pasan a una
sección expandible; señal, producto, utilidad ajustada, ROI y completitud se
mantienen visibles. Las acciones críticas permanecen alcanzables sin cubrir
campos ni mensajes de error.

## 12. Accesibilidad

- WCAG AA como mínimo: contraste 4.5:1 para texto normal y 3:1 para texto grande
  y límites visuales esenciales.
- Foco de 2 px en azul operativo con separación suficiente del componente.
- Objetivos táctiles mínimos de 44 × 44 px y separación de 8 px.
- Navegación completa por teclado, incluido ordenamiento, filtros y filas
  repetibles.
- Errores enlazados por `aria-describedby`; resumen enfocable tras enviar.
- Regiones vivas sólo para resultados de acciones, sin narrar cada pulsación.
- El orden DOM coincide con el visual en todos los breakpoints.
- Color acompañado por texto, icono y, cuando proceda, forma o borde.
- Zoom al 200 % sin pérdida de información ni desplazamiento en dos ejes.

## 13. Estados y contenido

Todo componente de datos define:

- cargando;
- vacío;
- completo;
- incompleto;
- desactualizado;
- error;
- sin resultados por filtros.

Las interfaces no inventan contenido para verse llenas. Usar `—` sólo en tablas
compactas donde el encabezado aporta significado; en formularios o decisiones,
preferir `Sin dato`, `No aplica`, `Aún no calculada` o `No calculable`.

## 14. Lista de control

- [ ] La pantalla parece una herramienta de análisis, no una landing ni terminal cripto.
- [ ] El canvas es mineral y la sidebar es tinta; no existe dark mode improvisado.
- [ ] Azul indica acción; jade, ámbar y coral conservan significado.
- [ ] La recomendación incluye evidencia, completitud y fecha.
- [ ] No hay datos, tasas, tendencias ni integraciones ficticias.
- [ ] Mono se limita a cifras.
- [ ] Las métricas no forman una pared de tarjetas idénticas.
- [ ] Hover, color o tooltip nunca son el único canal de información.
- [ ] Foco, contraste, teclado, zoom y movimiento reducido están verificados.
- [ ] Las vistas funcionan a 375, 768, 1024 y 1440 px.
