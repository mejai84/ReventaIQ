# Auditoría de código multiproducto

**Estado:** propuesto, pendiente de aprobación
**Fecha:** 2026-10-16
**Alcance:** auditoría de supuestos en `src/modules/finance`,
`src/modules/opportunities` y `src/modules/markets`, y propuesta de refactor para
soportar más de una categoría de producto sin duplicar el motor financiero.
**Restricción rectora:** **un solo motor financiero y un solo Opportunity Engine**
para iPhone, PS5, laptops o cualquier otra categoría. Este documento no propone
motores separados ni bifurcaciones por producto.

> No se editó código, `prisma/`, documentación existente, `.env*`, dependencias ni
> configuración. Es una propuesta: nada de lo aquí descrito está implementado.

---

## 0. Método y veredicto

Se revisaron 32 archivos TypeScript de los tres módulos y se clasificó cada
supuesto en tres categorías:

| Marca | Significado |
| --- | --- |
| **G — Genérico** | No supone un tipo de producto; sirve igual para un iPhone o una consola |
| **S — Especialización SMARTPHONE** | Asume un teléfono: atributo, escala de graduación o política de teléfono |
| **D — Deuda técnica** | Acoplamiento evitable, duplicación o API que no crece con más productos |

**Veredicto:** el motor financiero es esencialmente genérico. De 32 archivos, 22
son plenamente genéricos y la especialización está concentrada en **un solo archivo**
(`markets/domain/normalization.ts`), **dos vocabularios de condición** y **una
política por defecto** del adaptador. El riesgo real no es el motor: es que un
producto sin operador móvil queda bloqueado por una política pensada para
teléfonos.

| Severidad | Hallazgos |
| --- | --- |
| Alta | 3 (política de bloqueo sin operador; escalas de condición duplicadas; fingerprint de comparables disperso) |
| Media | 5 (atributos de unidad dentro del contrato de oferta; regex de modelo fija; capacidad de almacenamiento cerrada; métrica de batería en el score; contratos de categoría inexistentes) |
| Baja | 4 (constante de métricas en código, alias duplicados, vocabulario de mercados cerrado, datos de ejemplo) |

---

## 1. Inventario de archivos y símbolos afectados

### 1.1 `finance` — 14 archivos, todos genéricos salvo dos símbolos

| Símbolo | Archivo | Clase | Observación |
| --- | --- | --- | --- |
| `ScoreMetricKey` | `contracts.ts:259-271` | **S** | Incluye `BATTERY_HEALTH`, una métrica de teléfono en una tabla genérica |
| `SCORE_METRICS` | `opportunity-score.ts:19-32` | **G**/**D** | El conjunto de métricas vive en código aunque los pesos viven en configuración versionada; cada métrica nueva exige un cambio de código (**D**) |
| `OpportunityScoringSettings<Condition extends string>` | `contracts.ts:288` | **G** | Ya parametrizado por condición: la abstracción correcta ya existe y hay que reutilizarla |
| `SellerReputationScoreSettings` | `contracts.ts:281` | **G** | Reputación del vendedor sirve para cualquier producto |
| `WarrantySettings` / `calculateWarrantyReserve` | `contracts.ts:201`, `warranty.ts` | **G** | La reserva de garantía aplica igual a consolas y portátiles |
| `ShippingQuote` / `selectBestShippingQuote` | `contracts.ts`, `landed-cost.ts` | **G** | No asume forma ni peso del producto |
| `ExchangeRate`, `FinancingSettings`, `MarketPricingSettings`, `SellingCostSettings` | varios | **G** | Independientes del producto |
| `calculateConservativeMarketPrice` | `market-price.ts` | **G** | Opera sobre comparables ya filtrados; no conoce el producto |
| `classifyOpportunity`, `capSignal` | `classification.ts` | **G** | Señales genéricas de negocio |
| `calculateProfitability`, `calculateReturnVelocity`, `decimal`, `time`, `exchange`, `financing`, `capital-velocity`, `selling-costs`, `index` | varios | **G** | Sin supuestos de producto |

### 1.2 `opportunities` — 2 archivos

| Símbolo | Archivo | Clase | Observación |
| --- | --- | --- | --- |
| `ConditionCode` | `contracts.ts:27-35` | **S** | Escala de graduación de retail refurb de teléfono: `PREMIUM`, `EXCELLENT`, `GOOD`, `FAIR`. Una consola graduada con otra escala no tiene dónde caer |
| `ProductOffer.batteryHealthRate` | `contracts.ts:47` | **S** | Atributo de unidad de teléfono dentro del contrato del motor |
| `ProductOffer.supplierWarrantyDays` | `contracts.ts:50` | **G** | La garantía del vendedor aplica a cualquier producto |
| Comparables por `productVariantId` + `condition` | `opportunity-engine.ts:199-202` | **G** | El motor ya compara por identidad de variante; **esto es el fingerprint actual** |
| Paso de `batteryHealthRate` al score | `opportunity-engine.ts:306` | **S** | Acopla el motor a una métrica de teléfono |
| `analyzeOpportunity` y resto del motor | `opportunity-engine.ts` | **G** | Sin ramas por producto |

### 1.3 `markets` — 16 archivos, concentración alta

| Símbolo | Archivo | Clase | Observación |
| --- | --- | --- | --- |
| `extractModelFromTitle` | `normalization.ts:347-360` | **S**/**D** | Regex fija `iphone` y reconstruye `"iPhone N Pro"`. Bloquea cualquier otra categoría |
| `normalizeStorageGb` / `STORAGE_CAPACITIES_GB` | `normalization.ts`, `product-offer.ts:56` | **S**/**D** | Conjunto cerrado `[32,64,128,256,512,1024]`; no contempla 2 TB ni otras escalas |
| `buildVariantKey` | `normalization.ts` | **S**/**D** | Exige `storageGb` como parte obligatoria de la identidad de variante |
| `buildComparableGroupKey` | `normalization.ts` | **D** | Duplica, en otro formato, la lógica de agrupar comparables que el motor ya hace por `productVariantId` |
| `OFFER_CONDITIONS` | `product-offer.ts:40` | **S** | Escala de condición de teléfono, con `FOR_PARTS` |
| `CARRIER_LOCK_STATES`, `SIM_FORMATS`, `CarrierProfile`, `simFormat` | `product-offer.ts:61-73` | **S** | Conceptos de operador móvil embebidos en la oferta |
| `batteryHealthRate` | `product-offer.ts` | **S** | Atributo de unidad de teléfono en el contrato normalizado |
| `ProductOffer.model`, `variant`, `variantKey` | `product-offer.ts:115-120` | **G**/**D** | Correctos en intención; `variantKey` es una **cadena opaca** que el adaptador luego resuelve (**D**) |
| `normalizeCondition` + `CONDITION_TOKENS` | `normalization.ts` | **S**/**D** | Vocabulario de mercado embebido en código, con patrones ordenados |
| `normalizeSeller` | `normalization.ts` | **G** | Reputación del vendedor es genérica |
| `slugify`, `titleCase` | `normalization.ts` | **G** | Utilidades neutras |
| `requireUnlockedCarrier` (por defecto activo) | `application/market-offer-adapter.ts:137, 258-262` | **S** | **Una consola no tiene operador: quedaría `NOT_EVALUABLE` siempre** |
| `CONDITION_MAP` del adaptador | `market-offer-adapter.ts` | **S** | Segundo vocabulario de condición, hardcoded |
| `SOURCE_DETAIL_DROPPED` y notas de conversión | `market-offer-adapter.ts` | **G** | Buen patrón: reporta lo que el contrato del motor no puede llevar |
| `ManualOfferRegistration` | `connectors/manual-connector.ts` | **S** | Campos `batteryHealthPercent`, `carrierName`, `carrierLockText`, `simText`, `storage` |
| `INITIAL_SHIPMENT_STATUSES`, `createShipmentSchema.actualWeightLb` | `connectors`, `validation` | **G** | Peso del paquete, no del producto (ver decisión **DB**) |
| `product-offer-schema.ts` (`storageGb` unión literal) | `validation/` | **S** | Replica el conjunto cerrado de capacidades |
| `MARKETPLACES` | `market-connector.ts` | **D**/**G** | Unión cerrada en código; añadir un mercado exige cambio de código, pero no afecta al multiproducto |
| Datos de ejemplo | `connectors/sample-offers.ts` | **G** | Todos iPhone: correcto mientras el motor sea el mismo, pero no cubre la segunda categoría |

### 1.4 Resumen cuantificado

| Módulo | Archivos | Genéricos | Con especialización | Deuda |
| --- | --- | --- | --- | --- |
| `finance` | 14 | 12 | 1 | 1 |
| `opportunities` | 2 | 1 | 2 | 0 |
| `markets` | 16 | 6 | 8 | 5 |

---

## 2. Propuesta mínima de contratos genéricos

Objetivo: que la identidad de un producto sea **datos**, no un caso especial en el
código, respetando la regla ya escrita en `data-model-phase-1.md`: los catálogos
 y taxonomías **no son enums ni constantes de código**.

### 2.1 Categoría y marca: identificadores, no enums

```ts
/** Identificador de categoría vindo del catálogo. No es un enum de código. */
type CategoryId = string;      // "SMARTPHONE", "CONSOLE", ...
type BrandId = string;         // "apple", "sony", ...
type VariantId = string;       // id del catálogo, ya normalizado
```

`SMARTPHONE` y `CONSOLE` son **valores de una tabla de catálogo**, no un union
type. Así, una laptop no obliga a tocar el código.

### 2.2 Ejes de variante declarados por datos

```ts
interface VariantAxisDefinition {
  readonly key: string;        // "storage_gb", "edition", "region_code"
  readonly required: boolean;  // si falta, la variante no es comparable
  readonly comparable: boolean;// si entra en el fingerprint de comparables
}

interface CategoryProfile {
  readonly categoryId: CategoryId;
  readonly axes: readonly VariantAxisDefinition[];
  readonly conditionScaleId: string;
  readonly unitAttributeKeys: readonly string[]; // p.ej. "battery_health_rate"
}
```

`storage_gb` es un eje de iPhone **y** de consola; `edition` (disco/digital) sólo
existe en consolas. La categoría declara sus ejes, y el motor no cambia.

### 2.3 `ProductOffer` genérico (propuesta mínima)

```ts
interface UnitAttributes {
  /** Valor observado en esta unidad concreta. Ausente = no informado. */
  readonly values: Readonly<Record<string, Decimal | string | boolean | undefined>>;
  /** Atributos que la categoría declara y la fuente no reportó. */
  readonly missing: readonly string[];
}

interface ProductOfferV2 {
  readonly id: string;
  readonly marketplace: MarketplaceId;
  readonly categoryId: CategoryId;
  readonly variantId: VariantId;
  readonly conditionGradeId: string;
  readonly unitAttributes: UnitAttributes;
  readonly seller: SellerProfile;          // sin cambios
  readonly priceUSD: Decimal;
  readonly shippingUSD: Decimal;
  readonly salesTaxUSD: Decimal;
  readonly url: string;
  readonly observedAt: string;
}
```

Cambios respecto de hoy: `model`, `variant` y `storageGb` desaparecen del
contrato de oferta (pasan al catálogo); `batteryHealthRate`, `carrier` y
`simFormat` se convierten en entradas de `unitAttributes`. **El resto no cambia.**

### 2.4 Compatibilidad: iPhone sigue siendo SMARTPHONE

Durante la transición conviven dos formas:

| Forma | Uso | Vigencia |
| --- | --- | --- |
| `ProductOffer` actual (`model`, `variant`, `variantKey`, `storageGb`, `batteryHealthRate`, `carrier`, `simFormat`) | Todo el código existente y sus 148 pruebas | Hasta la etapa 7 |
| `ProductOfferV2` (`categoryId`, `variantId`, `unitAttributes`) | Toda categoría nueva | Aditiva desde la etapa 1 |

Reglas de la transición:

1. `ProductOfferV2` se introduce **junto a** la actual, no la reemplaza.
2. Un constructor `toV2()` proyecta la oferta actual a la nueva usando un
   `CategoryProfile` de `SMARTPHONE` recibido por parámetro, **no** detectado por
   heurística del título.
3. El adaptador `markets → opportunities` sigue funcionando sin cambios hasta
   que el contrato del motor acepte la nueva forma.
4. Los `variantKey` actuales (`ebay:iphone-15-pro-128`) se conservan como
   **clave de agrupación legible**, aunque el identificador autoritativo pase a
   ser `variantId` del catálogo.

El resultado neto: un iPhone sigue siendo `categoryId = SMARTPHONE` y sus
atributos de batería y operador siguen viajando; lo que cambia es que **nadie
codifica "iphone" en una expresión regular**.

---

## 3. Decisiones explícitas

### 3.1 DA — Atributos de catálogo vs atributos de oferta/unidad

**Regla de clasificación:** un atributo pertenece al **catálogo** si y sólo si (a)
es necesario para decidir si dos publicaciones hablan del mismo SKU y (b) es
estable durante toda la vida de ese SKU. Todo lo que se observa en una unidad
concreta pertenece a la **oferta**.

| Atributo | Destino | Motivo |
| --- | --- | --- |
| Categoría, marca, modelo comercial | Catálogo | Identidad estable del SKU |
| Capacidad de almacenamiento | Catálogo | Define la variante; la observamos igual en cada oferta, pero no cambia por unidad |
| Región / modelo de peça (A…, CH…) | Catálogo | Determina el modelo físico, no la unidad |
| Color | Catálogo | Identidad del SKU. No económico: se excluye del fingerprint |
| Edición (disco / digital) | Catálogo | **Eje propio de consola**, no existe en iPhone |
| Condición / grado | Oferta y unidad | Cambia por unidad; es el eje de comparabilidad |
| Salud de batería | Unidad | Es exactamente lo que se inspecciona en cada equipo |
| Estado de bloqueo de operador | Unidad | Una misma variante se vende bloqueada o libre |
| SIM / eSIM | Unidad cuando se informa | El estándar del SKU es catálogo; el uso concreto es unidad |
| IMEI, autenticidad de pantalla y batería | Unidad | Identidad y estado físicos del equipo |
| Golpes, rayones | Unidad | Observación física |
| Garantía del vendedor | Unidad | Depende del vendedor y del lote |
| Reputación y reseñas del vendedor | Unidad (de la oferta) | Cambia por publicación |
| Precio, envío, impuesto, comisión, stock | Oferta | Cambian por publicación |
| `source_url`, `raw_title`, `observed_at` | Oferta | Procedencia de la observación |

**Corolario para el motor:** el motor nunca debe leer atributos de unidad que la
categoría no declara. Un `batteryHealthRate` ausente en una consola **no** es un
dato faltante: es un atributo no aplicable. Por eso `missing` y "no aplicable" son
listas distintas (decisión **DD**, punto 6).

### 3.2 DB — Peso y dimensiones: producto vs paquete

Son dos medidas distintas y confundirlas cambia el costo de envío.

| Medida | Dónde vive | Cómo se obtiene |
| --- | --- | --- |
| Peso y dimensiones **de producto** | Catálogo (ficha técnica) | Ficha del fabricante; estable |
| Peso y dimensiones **de paquete** | Envío (`shipments`) | Medición real del bulto: caja, protector, accesorios dentro |
| Peso volumétrico | Cotización de envío | `f(dimensiones del paquete, divisor del transportista)` |
| Valor asegurado | Oferta / envío | Valor del equipo de esa unidad |

Reglas:

1. **El peso del paquete nunca se deriva de la ficha técnica.** El divisibility
   fiscal y la protección antic-impacto cambian el peso, y una consola con mando
   dentro no pesa lo que pesa la consola desnuda.
2. **La cotización debe declarar si usó peso real o volumétrico**, porque ambos
   cambian el total y hoy `ShippingQuote` tiene un único total.
3. **Peso volumétrico no se almacena como verdad**: se calcula al cotizar, con el
   divisor configurado, y se guarda el divisor aplicado para poder auditarlo.
4. **Peso desconocido es `NULL`, nunca 0.** Un paquete de 0 kg es un envío gratis
   por error; el diseño de compras ya exige `actual_weight_lb > 0`.
5. **El peso de producto sirve para decidir si cabe un pallet o una caja**, no
   para facturar.

Estado actual: `shipping_quotes.item_weight_lb` (diseño de datos) y
`shipments.actual_weight_lb` (Fase A) ya son medidas por envío, que es lo
correcto. **Falta** el peso de producto en catálogo, y no debe reutilizarse como
peso de paquete.

### 3.3 DC — Qué sale de `product_variants`

`product_variants` (según `data-model-phase-1.md`) tiene `product_id`,
`storage_gb`, `color_key`, `color_label`, `region_code`, `sim_type`,
`manufacturer_sku`, `is_active`.

**Se quedan en la variante (catálogo):**

| Columna | Motivo |
| --- | --- |
| `product_id` | Identidad |
| `storage_gb` | Eje de variante económico |
| `color_key` / `color_label` | Identidad del SKU |
| `region_code` | Determina el modelo físico y el mercado |
| `sim_type` | **Parte de la especificación del SKU**, no del uso concreto |
| `manufacturer_sku` | Identificador externo |

**Deben salir de la variante y nunca añadirse:**

| Atributo | Dónde va realmente |
| --- | --- |
| Salud de batería | Unidad / atributos de oferta |
| Estado de bloqueo de operador | Unidad |
| IMEI | Unidad, con protección reforzada (Fase D del modelo de datos) |
| Grado de condición | Oferta, con su escala por categoría |
| Autenticidad de pantalla y batería, Face ID, True Tone, cámaras | Unidad |
| Golpes, rayones | Unidad |
| `supplier_warranty_days` | Oferta |
| `seller_reputation_rate`, `seller_review_count` | Oferta |
| Precio, envío, impuesto, comisión, disponibilidad | Oferta |
| `source_url`, `raw_title`, `observed_at`, `expires_at` | Oferta |

**Columna a añadir** (no mover): `category_id` en `products` o `product_variants`,
para que el código pueda resolver el `CategoryProfile` sin heurísticas. Y
`attributes jsonb` por variante **sólo** para ejes que el modelo relacional no
cubre (`edition`, `connectivity`, `colorway`), con esquema versionado.

Nota: el propio documento de datos ya dice que "carrier, condición, batería y
bloqueos pertenecen a la oferta observada, no al SKU". Esta decisión lo convierte
en una lista exhaustiva y añade `edition`, que faltaba.

### 3.4 DD — `ComparableFingerprint` determinista, sin ML

**Qué es:** una cadena canónica que dos publicaciones deben compartir para
considerarse comparables. Hoy esa función existe implícitamente en
`opportunity-engine.ts:199-202` (mismo `productVariantId` y misma `condition`) y
en `markets`, duplicada y con otro formato, en `buildComparableGroupKey`.

**Fórmula propuesta:**

```text
ComparableFingerprint =
  join("|", [ categoryId, variantId, conditionGradeId, ...ejesComparablesOrdenados ])
```

Con reglas de determinismo, sin ML ni coincidencia difusa:

| Regla | Detalle |
| --- | --- |
| Orden estable | Los ejes se anexan en el orden **declarado** por el `CategoryProfile`, nunca en orden alfabético en tiempo de ejecución |
| Separador inequívoco | Separador vertical entre valores, y nunca dentro de un valor: los valores se sanean antes |
| Normalización | Códigos en mayúsculas y con guion; texto en slug minúsculas; números como cadena decimal canónica |
| Ausente ≠ vacío | Eje sin dato → token explícito `NA`. Nunca cadena vacía ni `0` |
| Identidad, no texto | Se calcula **desde identificadores**, nunca desde `raw_title`. Cambiar el título de una publicación no cambia su fingerprint |
| Versión delComparabilidad | Se incluye `comparabilityVersion`. Cambiar los ejes crea comparables nuevos sin reescribir los antiguos |
| Índice-amigable | El resultado se indexa; el filtrado es igualdad, no rango ni `LIKE` |

**Ejemplos conceptuales** (no son precios ni datos reales):

```text
iPhone 15 Pro, 128GB, Excellent  ->  SMARTPHONE|<variantId-iphone-15-pro-128>|<grade-excellent>
PS5 Slim, 1TB, disco            ->  CONSOLE|<variantId-ps5-slim-1tb-disc>|<grade-bueno>
```

Dos publicaciones con títulos distintos ("iPhone 15 Pro 128GB Natural Titanium
libre" y "Apple 15 Pro 128GB Natural Titanium - unlocked") producen el **mismo**
fingerprint. Dos publicaciones de la misma variante pero distinto grado de
condición producen fingerprints distintos, que es lo correcto: no son comparables.

**Compatibilidad:** el fingerprint actual es exactamente
(`productVariantId`, `condition`). La primera versión del módulo debe producir
esa misma tupla para no cambiar un solo resultado del motor; la diferencia es que
ahora queda **explícita, versionada y con ejes declarados**.

### 3.5 DE — Cambios que requerirá después el adaptador `markets → opportunities`

Se documentan para que el adaptador no se rediseñe dos veces. **No se implementan
aquí.**

| # | Cambio requerido | Motivo | Impacto |
| --- | --- | --- | --- |
| 1 | `VariantResolver` pasa de `(variantKey) => CatalogMatch` a `(categoryId, variantId) => CatalogMatch` | Hoy la identidad viaja como cadena opaca | Cambio de firma; el resolver actual se adapta con un envoltorio |
| 2 | `requireUnlockedCarrier: boolean` → `CategoryPolicy` | **Una consola no tiene operador: hoy quedaría bloqueada siempre** (líneas 258-262) | Cambio de política con **mismo comportamiento por defecto** para iPhone |
| 3 | `CONDITION_MAP` del adaptador → tabla de datos por `conditionScaleId` | Hoy el mapeo es código y sólo cubre la escala de teléfono | Se elimina un hardcode |
| 4 | `batteryHealthRate`, `carrier`, `simFormat` → `unitAttributes` | Ver DA | El bloque de notas `SOURCE_DETAIL_DROPPED` se reportinga |
| 5 | `CARRIER_LOCK_UNKNOWN` → código neutral `ATTRIBUTE_NOT_APPLICABLE` cuando la categoría no declara el atributo | "No aplica" ≠ "desconocido"; hoy ambos colapsan en `UNKNOWN` y bloquean | Códigos de bloqueo más honestos |
| 6 | `storageGb` deja de ser parte de la identidad de variante obligatoria | Hoy `buildVariantKey` la exige | Permite variantes sin capacidad |
| 7 | `storageGb` del esquema Zod: unión literal → eje validado por `CategoryProfile` | `validation/product-offer-schema.ts` replica el conjunto cerrado | El esquema deja de conocer capacidades concretas |
| 8 | El contrato del motor (`opportunities.ProductOffer`) admite `unitAttributes` o un `attributes` genérico | Hoy no tiene dónde llevar atributos que no sean batería y garantía | **Cambio de contrato del motor**: se planifica, no se hace en estas etapas |
| 9 | `ComparableFingerprint` compartido entre captura, comparables y snapshot | Hoy la lógica está en tres sitios con tres formatos | Una sola implementación |

**Compatibilidad:** los puntos 1 a 7 son locales al adaptador y pueden hacerse sin
tocar el motor. El punto 8 sí cambia el contrato del motor y exige una etapa
propia con su gate.

---

## 4. Caso conceptual: PS5 Slim Disc 1 TB

Camino de la observación hasta el motor, contrastado con iPhone. **Sin precios ni
datos reales.**

| Paso | iPhone 15 Pro 128 GB | PS5 Slim 1 TB con disco |
| --- | --- | --- |
| Título de la publicación | "Apple iPhone 15 Pro 128GB Natural Titanium - Unlocked - Excellent" | "PlayStation 5 Slim 1TB Disc Edition - CIB - Open Box" |
| `categoryId` | `SMARTPHONE` | `CONSOLE` |
| Marca | `apple` | `sony` |
| Ejes de variante | `storage_gb=128`, `region_code` | `storage_gb=1024`, `edition=DISC` |
| Modelo extraído | regex de iPhone funciona | **la regex actual no encuentra nada** |
| Condición | `Excellent` | graduación distinta, sin equivalente directo |
| Bloqueo de operador | `UNLOCKED`, verificable | **no aplicable** |
| Salud de batería | `0.92` | **no aplicable** |
| Peso del paquete | medido | medido, mayor que la ficha |
| Filtro de comparables | variante + condición | variante + condición + `edition` |
| Llega al motor | `analyzeOpportunity` | **`analyzeOpportunity`, sin cambios** |

Conclusiones del caso:

1. **El motor no se toca.** Ni la aritmética, ni el score, ni la clasificación,
   ni la selección de envío. Cambia sólo lo que entra y la escala de condición.
2. **Tres bloqueos reales hoy:** la regex de modelo, la política de bloqueo de
   operador y el vocabulario de condición.
3. **`edition` es el eje que iPhone no tiene**: si no entra en el fingerprint, una
   consola digital y una con disco se compararían entre sí. Error de precio.
4. **"No aplicable" debe ser distinto de "desconocido"**: exigir salud de batería
   a una consola produciría faltantes eternos y una confianza de score falsa.
5. La **edición con disco cambia el perfil logístico** (peso, fragility, valor
   asegurado) y eso es un eje de comparabilidad y de costo, no un detalle de
   catálogo.

---

## 5. Plan de refactor por etapas, sin romper compatibilidad

Cada etapa es un commit reversible. El criterio de no-rotura es el mismo en todas:
**las pruebas existentes siguen en verde sin modificarlas**, salvo cuando la etapa
lo declara explícitamente.

| Etapa | Qué hace | Rompe compatibilidad | Puerta de salida |
| --- | --- | --- | --- |
| **0. Caracterización** | Pruebas doradas del comportamiento actual: fingerprint, condición, mapeo del adaptador, score con batería ausente | No | Comportamiento congelado y verificable |
| **1. `CategoryProfile` como dato** | Nuevo tipo de datos con ejes por categoría; `SMARTPHONE` descrito con los ejes actuales. Sin tocarProductOffer | No | Las 148 pruebas siguen verdes |
| **2. `ComparableFingerprint`** | Módulo puro: fingerprint determinista desde ids. Prueba de equivalencia: para iPhone produce exactamente `("productVariantId","condition")` | No | Fingerprint actual reproducido bit a bit |
| **3. Registro de extractores** | `extractModelFromTitle` pasa a ser el extractor de `SMARTPHONE` dentro de un registro por categoría. La función actual se conserva como envoltorio marcado como obsoleto | No | Mismos modelos extraídos para iPhone |
| **4. Política por categoría en el adaptador** | `requireUnlockedCarrier` se resuelve desde `CategoryProfile`. **Por defecto reproduce exactamente la política actual** | No | iPhone se comporta igual; una consola deja de bloquearse |
| **5. Atributos de unidad en bolsa** | `unitAttributes` aditivo junto a los campos actuales; `batteryHealthRate`, `carrier` y `simFormat` se derivan de la bolsa | No | ProductOffer actual sigue siendo válido |
| **6. Escala de condición por datos** | Mapeo por `conditionScaleId` en datos; se conserva el mapa actual como valor por defecto de `SMARTPHONE` | No | Mismos mapeos para iPhone |
| **7. Activar la segunda categoría** | `CONSOLE` se habilita **sólo por configuración**. Sin cambios de código del motor | No | Pruebas de paridad: iPhone y PS5 por el mismo motor |
| **8. Contrato del motor con atributos** | `opportunities.ProductOffer` acepta atributos genéricos. **Requiere gate propio** | Sí, controlado | Migración + revisión de snapshots |
| **9. Retirada de obsoletos** | Eliminar envoltorios y campos derivados | Sí, pero solo tras una release sin consumidores | Sin referencias en el código |

**Orden innegociable:** la etapa 8 no se aborda hasta que las etapas 0 a 7 estén
probadas. Es la única que toca el motor, y la única que requiere migración.

**Rollback:** cada etapa es un commit aislado. Si una etapa rompe algo, se revierte
esa etapa sin arrastrar las anteriores, porque ninguna depende del contrato del
motor.

---

## 6. Pruebas para demostrar que iPhone y PS5 usan el mismo motor

El objetivo no es "que PS5 funcione", sino **demostrar que no existe un segundo
motor**. Las pruebas se diseñan para que un motor paralelo no pudiera pasarlas.

### 6.1 Paridad de motor

| Prueba | Qué demuestra |
| --- | --- |
| `analyzeOpportunity` devuelve el mismo `engineVersion` para iPhone y PS5 | No hay dos motores |
| El motor produce el mismo número y orden de escenarios para ofertas equivalentes en precio, con atributos distintos | Las diferencias de categoría no alteran la aritmética |
| Una diferencia de atributos de unidad (batería presente o ausente) **no** cambia el resultado aritmético | Los atributos no se filtran dentro de las fórmulas |
| Con `unitAttributes` vacío y `requireUnlockedCarrier` resuelto, ninguna rama del motor cambia | El motor no lee atributos |

### 6.2 Matriz de capacidades por categoría

Prueba de tabla que recorre `SMARTPHONE` y `CONSOLE`:

| Eje | Smartphone | Consola |
| --- | --- | --- |
| Atributos de unidad declarados | batería, bloqueo, SIM | ninguno de esos |
| Ejes de variante comparables | `storage_gb`, `region_code` | `storage_gb`, `edition` |
| Política de bloqueo | exige `UNLOCKED` | no aplica |
| Atributo no aplicable | `NOT_APPLICABLE` | `NOT_APPLICABLE` |
| Atributo declarado y ausente | `UNKNOWN` | `UNKNOWN` |

La aserción clave: **"no aplicable" nunca produce el mismo código que
"desconocente"**, y un atributo no aplicable nunca degrada la confianza del score.

### 6.3 Fingerprint

| Prueba | Qué demuestra |
| --- | --- |
| Mismos ids y ejes → mismo fingerprint | Determinismo |
| Orden de ejes invertido en la declaración produce el mismo resultado | Orden estable, no alfabético |
| Eje ausente → token `NA`, nunca cadena vacía ni `0` | Ausente ≠ vacío |
| Títulos distintos, misma variante y condición → mismo fingerprint | La identidad no sale del texto |
| Variante distinta con título igual → fingerprints distintos | No hay fusión por texto |
| iPhone bajo el fingerprint nuevo reproduce el actual | **No cambia un resultado del motor** |
| `comparabilityVersion` distinta produce fingerprint distinto y no reescribe el anterior | Evidencia histórica estable |

### 6.4 Regresión de iPhone

| Prueba | Qué demuestra |
| --- | --- |
| Las 148 pruebas existentes pasan sin modificarse | Compatibilidad real, no declarada |
| Extracción de modelo para los títulos actuales de iPhone | La etapa 3 no perdió cobertura |
| Mapeo de las diez condiciones de iPhone | La etapa 6 no cambió la escala |
| Bloqueo de operador en iPhone sigue activo por defecto | La etapa 4 conservó el comportamiento |
| Precio conservador, ROI y score idénticos con los mismos datos | Cero deriva numérica |

### 6.5 Garantía de no Machine Learning

| Prueba | Qué demuestra |
| --- | --- |
| El fingerprint se calcula con una función pura y un total de entradas declaradas | No hay modelo, pesos ni similitud |
| Entradas idénticas producen la misma cadena en 100 repeticiones y en distinto orden de proceso | Sin aleatoriedad |
| Cambiar el texto libre de una publicación no cambia su fingerprint | El texto no participa |
| Ninguna función de comparable recibe `raw_title` | Verificable por tipos y por revisión de firmas |

---

## 7. Verificación realizada

- 32 archivos revisados en `finance` (14), `opportunities` (2) y `markets` (16).
- Búsqueda literal de `iphone`, `smartphone` y `apple`: **el único hardcode de
  producto en código de producción** es la expresión regular de
  `extractModelFromTitle`. El resto de menciones están en pruebas y datos de ejemplo.
- Búsqueda de supuestos de unidad: `batteryHealthRate`, `carrier`, `simFormat`,
  `storageGb`, `BATTERY_HEALTH`, con su ubicación exacta.
- Contraste con las reglas ya escritas en `data-model-phase-1.md`: los catálogos
  son datos y no enums de código; esa regla se aplicó a la propuesta.
- Comprobación documental: sin caracteres corruptos, tablas consistentes, enlaces
  resolubles.

No se modificó ningún archivo de código, `prisma/`, documentación existente,
`.env*`, dependencias ni configuración. No se creó `schema.prisma`, SQL ni
migraciones, y no se hizo commit.