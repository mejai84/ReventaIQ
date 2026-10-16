# Revisión de esquema — Compras Fase A

**Estado:** propuesto, pendiente de aprobación
**Fecha:** 2026-10-16
**Alcance:** contraste entre la documentación de Fase A y el código ya implementado
**Documentos revisados:** [data-model-phase-1.md](./data-model-phase-1.md),
[purchases-fiscal-phase-a-design.md](./purchases-fiscal-phase-a-design.md)
**Código revisado:** `src/modules/purchases/domain/` y
`src/modules/purchases/application/validation/`

> Este documento **no** crea `schema.prisma`, **no** genera SQL y **no** aplica
> migraciones. Traduce el código existente a columnas y enums, propone los eventos
> logísticos que faltan y enumera lo que Prisma no puede expresar. La decisión de
> implementarlo sigue el gate de [ADR-0004](../adr/0004-gated-database-migrations.md).

---

## 0. Veredicto en una línea

El código y el diseño coinciden en lo esencial —los tres estados de la compra, los
cinco componentes de dinero y los once códigos de evento mapean 1:1 con columnas
previstas—, pero hay **cinco campos que el código exige y el diseño no tiene
columna**, **un catálogo logístico ausente** y **una contradicción de moneda**
entre `shipments` y `shipping_quotes`. Ninguna es un bloqueo; todas son
decisiones que conviene cerrar antes de escribir el esquema.

| Severidad | Hallazgos |
| --- | --- |
| Alta | 2 (dinero de pago sin columna; moneda de `shipments` vs `shipping_quotes`) |
| Media | 6 (eventos logísticos ausentes; `revision` sin dueño; `updated_at` en eventos; idempotencia de eventos; `shipments` sin autor; estado de envío que mezcla dos dimensiones) |
| Baja | 5 (unicidad de referencia, `notes` duplicado, typo, `currency_code` redundante, enum vs `CHECK`) |

---

## 1. Mapeo dominio y validaciones → columnas y enums

### 1.1 `purchases`

| Origen en el código | Tipo | Columna esperada | Nota |
| --- | --- | --- | --- |
| `createPurchaseSchema.referenceCode` | `string(1..64)` | `reference_code text` | Trim en el borde; el `CHECK` de no vacío es manual |
| `.supplierOfferId` | id `bigint` | `supplier_offer_id bigint` → `supplier_offers(id)` | Obligatorio en el diseño y en el código |
| `.productVariantId` | id | `product_variant_id bigint` → `product_variants(id)` | |
| `.conditionGradeId` | id | `condition_grade_id bigint` → `condition_grades(id)` | Congelado: el diseño lo trata como hecho histórico |
| `.currencyCode` | `[A-Z]{3}` | `currency_code char(3)` | El esquema exige el patrón; en Fase A sólo `USD` |
| `.orderedAt` | ISO con zona | `ordered_at timestamptz` | |
| `.opportunityId?` | id | `opportunity_id bigint` → `opportunities(id)` | Nulo: la compra puede no tener análisis previo |
| `.estimatedDeliveryAt?` | ISO con zona | `estimated_delivery_at timestamptz` | Nulo si el proveedor no informa |
| `.sourceUrl?` | https | `source_url text` | |
| `.notes?` | texto ≤2000 | `notes text` | |
| `.money.purchasePriceUSD?` | `Decimal` | `purchase_price_usd numeric(20,4)` | Nulo sólo en `DRAFT` |
| `.money.usShippingUSD?` | `Decimal` | `us_shipping_usd numeric(20,4)` | |
| `.money.usSalesTaxUSD?` | `Decimal` | `us_sales_tax_usd numeric(20,4)` | Impuesto del mercado en EE. UU., **no** registro fiscal |
| `.money.paymentFeeUSD?` | `Decimal` | `payment_fee_usd numeric(20,4)` | |
| `.money.otherCostUSD?` | `Decimal` | `other_cost_usd numeric(20,4)` | Ausente ≠ 0 |
| `calculatePurchaseTotalUSD(money)` | `Decimal` | `total_paid_usd numeric(20,4)` | Suma exacta de los cinco; el `CHECK` de igualdad es manual |
| `PurchaseView.status` | `PurchaseStatus` | `status purchase_status` | `NOT NULL`, por defecto `DRAFT` |
| `PurchaseView.paidAt?` | ISO | `paid_at timestamptz` | |
| `PurchaseView.deliveredAt?` | ISO | `delivered_at timestamptz` | |
| `PurchaseView.cancelledAt?` | ISO | `cancelled_at timestamptz` | |
| `PurchaseView.cancellationReason?` | texto | `cancellation_reason text` | |
| `editPurchaseSchema.expectedRevision?` | entero > 0 | `revision int` | Control de concurrencia optimista (§4, decisión D2) |
| — | — | `created_by_user_id bigint` → `users(id)` | Sin equivalente en el dominio: lo asigna la capa de aplicación |
| — | — | `created_at`, `updated_at timestamptz` | |

**Entrada de validación sin columna (alta).** `purchaseTransitionSchema` exige
`payload.paidAmountUsd` en la acción `RECORD_PAYMENT`, y el dominio exige `paidAt`
para el estado `PAID`. El diseño no tiene columna para el importe pagado. Ver D1.

### 1.2 `purchase_events`

| Origen en el código | Columna esperada |
| --- | --- |
| `NewPurchaseEvent.purchaseId` | `purchase_id bigint` → `purchases(id)`, `NOT NULL` |
| `PurchaseEvent.code` | `event_code text` — **no** enum: crece por fases sin migración |
| `PurchaseEvent.source` (`USER`/`SYSTEM`/`IMPORT`) | `source event_source` |
| `PurchaseEvent.occurredAt` | `occurred_at timestamptz`, `NOT NULL` |
| `PurchaseEvent.recordedAt` | `recorded_at timestamptz`, `NOT NULL` |
| `PurchaseEvent.createdByUserId?` | `created_by_user_id bigint` → `users(id)`, nulo en eventos del sistema |
| `PurchaseEvent.payload` | `payload jsonb`, `NOT NULL` |
| — | `notes text` en el diseño, sin origen en el código (D4) |

Los once códigos que la columna debe admitir hoy, con su disparador y su payload
cerrado según `PAYLOAD_CONTRACTS` en `domain/purchase-events.ts`:

| `event_code` | Disparador | `payload` obligatorio |
| --- | --- | --- |
| `PURCHASE_CREATED` | Usuario | `status` |
| `PURCHASE_CONFIRMED` | Usuario (transición) | `components`, `totalUsd` |
| `PAYMENT_RECORDED` | Usuario (transición) | `paidAt`, `paidAmountUsd` |
| `SHIPMENT_DISPATCHED` | Sistema | `shipmentId`, `sequence`, `status` |
| `SHIPMENT_STATUS_CHANGED` | Usuario o sistema | `shipmentId`, `previousStatus`, `status` |
| `SHIPMENT_EXCEEDED_ESTIMATE` | Sistema | `shipmentId`, `estimatedAt`, `actualAt` |
| `PURCHASE_DELIVERED` | Sistema | `deliveredAt`, `shipmentCount` |
| `PURCHASE_CANCELLED` | Usuario (transición) | `cancelledAt`, `reason` |
| `PURCHASE_REOPENED` | Usuario (transición) | `reason` |
| `DATA_CORRECTED` | Usuario | `field`, `previousValue`, `newValue` |
| `NOTE_ADDED` | Usuario | `note` |

De ellos, sólo tres son registrables a mano: `PURCHASE_CREATED`, `DATA_CORRECTED`
y `NOTE_ADDED`. Los otros ocho los emite el caso de uso al cambiar el estado; por
eso la tabla de `event_code` debe ser `text` y no un enum cerrado.

El contrato de `payload` por código (`purchase-events.ts`, `PAYLOAD_CONTRACTS`)
queda en el dominio y se valida con Zod antes de escribir. En base de datos sólo
se comprueba que sea un objeto: **el contrato no es un `CHECK` de PostgreSQL**, y
debe quedar validado en dos puntos, escritura y lectura.

### 1.3 `shipments`

| Origen en el código | Columna esperada |
| --- | --- |
| `createShipmentSchema.purchaseId` | `purchase_id bigint` → `purchases(id)`, `NOT NULL` |
| `.sequence` (entero > 0) | `sequence int`, `NOT NULL` |
| `.status?` (`INITIAL_SHIPMENT_STATUSES`, sin `CANCELLED`) | `status shipment_status`, por defecto `PENDING` |
| `.shippingProviderId?` | `shipping_provider_id bigint` → `shipping_providers(id)` |
| `.shippingQuoteId?` | `shipping_quote_id bigint` → `shipping_quotes(id)` |
| `.carrierName?` | `carrier_name text` |
| `.trackingNumber?` | `tracking_number text` |
| `.trackingUrl?` | `tracking_url text` |
| `.dispatchedAt?` | `dispatched_at timestamptz` |
| `.estimatedDeliveryAt?` | `estimated_delivery_at timestamptz` |
| `.deliveredAt?` | `delivered_at timestamptz` |
| `.actualCostUsd?` | `actual_cost_usd numeric(20,4)` — moneda en discusión (D3) |
| `.actualWeightLb?` | `actual_weight_lb numeric(10,3)`, `> 0` |
| `.notes?` | `notes text` |
| — | `created_at`, `updated_at timestamptz` |

No hay `created_by_user_id` en el diseño de `shipments`, aunque `supplier_offers`,
`market_listings`, `shipping_quotes` y `opportunities` sí lo llevan en
`data-model-phase-1.md`. Ver D5.

### 1.4 Enums esperados

| Enum | Valores | Origen |
| --- | --- | --- |
| `purchase_status` | `DRAFT`, `CONFIRMED`, `PAID`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED` | `PURCHASE_STATUSES` |
| `shipment_status` | `PENDING`, `DISPATCHED`, `IN_CUSTOMS`, `OUT_FOR_DELIVERY`, `DELIVERED`, `EXCEPTION`, `CANCELLED` | `SHIPMENT_STATUSES` |
| `event_source` | `USER`, `SYSTEM`, `IMPORT` | `EVENT_SOURCES` |
| `event_code` | **texto**, no enum | Crece por fases; la validación es de aplicación |

`INITIAL_SHIPMENT_STATUSES` (esquema de creación) es un subconjunto de
`shipment_status` sin `CANCELLED`: un envío no nace cancelado. No necesita tipo
propio en la base de datos.

Los cuatro enums coinciden con el criterio de `data-model-phase-1.md` ("sólo los
estados de ciclo de vida estables se consideran enums"). Falta decidir si se
materializan como enum de PostgreSQL o como `text` con `CHECK` (D6).

### 1.5 Divergencia intencionada que conviene documentar

`supplier_offers` ya tiene `purchase_price`, `us_shipping`, `us_sales_tax`,
`payment_fee` y `other_purchase_cost`. `purchases` repite los cinco. Es
**correcto**: la compra congela lo que se pagó, que puede diferir de lo que la
oferta anunciaba. Conviene dejarlo escrito en el diccionario de datos para que
nadie lo lea como duplicación por error y lo "normalice" con un trigger de
sincronización.

---

## 2. Eventos logísticos necesarios

### 2.1 El hueco

Los once códigos actuales cubren el ciclo **comercial** de la compra, pero el
tránsito real de un iPhone comprado en EE. UU. tiene ocho tramos que hoy no
tienen representación:

| Tramo | ¿Representado hoy? |
| --- | --- |
| Vendedor / contraparte | No: sólo hay `SHIPMENT_DISPATCHED` con transportista opcional |
| Envío en EE. UU. | Parcial: `SHIPMENT_DISPATCHED` |
| Bodega en EE. UU. | No |
| Cotización de envío | No: `shipments.shipping_quote_id` referencia la cotización, pero no registra cuándo se eligió |
| Envío internacional | No |
| Aduana | Parcial: sólo el estado `IN_CUSTOMS` del envío |
| Entrega local (casillero) | Parcial: sólo `OUT_FOR_DELIVERY` |
| Recepción | Sí: `PURCHASE_DELIVERED`, sin datos de custodia ni de quién recibió |

### 2.2 Catálogo propuesto

Son **eventos**, no estados: `purchase_status` y `shipment_status` no cambian.
El patrón de cada fila es "un tramo calculado por el sistema o registrado por una
persona, con un payload cerrado".

| `event_code` propuesto | Disparador | `payload` obligatorio | `payload` opcional |
| --- | --- | --- | --- |
| `SELLER_CONTACTED` | Usuario | `sellerName`, `occurredAt` | `channel`, `note` |
| `SELLER_CONFIRMED` | Usuario | `confirmedAt` | `sellerReference`, `note` |
| `SHIPPING_QUOTE_SELECTED` | Usuario | `quoteId`, `selectedAt` | `providerName`, `totalAmountUsd`, `currencyCode` |
| `US_SHIPMENT_DISPATCHED` | Sistema | `shipmentId`, `carrierName`, `dispatchedAt` | `trackingNumber`, `usCostUsd` |
| `US_WAREHOUSE_RECEIVED` | Sistema | `receivedAt`, `warehouseCode` | `receivedBy`, `note` |
| `INTERNATIONAL_SHIPMENT_DISPATCHED` | Sistema | `shipmentId`, `dispatchedAt` | `carrierName`, `trackingNumber` |
| `INTERNATIONAL_SHIPMENT_ARRIVED` | Sistema | `arrivedAt`, `countryCode` | `portOrTerminal`, `note` |
| `CUSTOMS_CLEARED` | Sistema | `clearedAt` | `clearanceReference`, `declaredAmountUsd`, `note` |
| `CUSTOMS_HELD` | Sistema | `heldAt`, `reason` | `expectedReleaseAt`, `note` |
| `LOCAL_DELIVERY_DISPATCHED` | Sistema | `shipmentId`, `dispatchedAt` | `carrierName`, `trackingNumber` |
| `PURCHASE_RECEIVED` | Usuario | `receivedAt`, `receivedBy` | `custodyNote`, `note` |
| `LEG_EXCEPTION` | Sistema o usuario | `shipmentId`, `leg`, `occurredAt`, `reason` | `expectedResolutionAt` |
| `LEG_RESOLVED` | Sistema o usuario | `shipmentId`, `leg`, `occurredAt`, `resolution` | `note` |

Notas de diseño:

1. **`leg` es un vocabulario nuevo y pequeño**: `SELLER`, `US_SHIPMENT`,
   `US_WAREHOUSE`, `INTERNATIONAL`, `CUSTOMS`, `LOCAL_DELIVERY`, `RECEPTION`. No
   es un estado de compra ni de envío; es una etiqueta de tramo dentro del
   payload.
2. **`PURCHASE_RECEIVED` no reemplaza `PURCHASE_DELIVERED`.** El primero registra
   quién recibió y cuándo (dato de custodia); el segundo sigue siendo el hecho
   que dispara la transición `IN_TRANSIT → DELIVERED`. La UI muestra ambos.
3. **Los eventos repetibles no son únicos.** `CUSTOMS_HELD` puede ocurrir dos
   veces; por eso no llevan una clave de deduplicación (ver §3.2).
4. **Un evento por tramo, no porlegación de shipment.status.** El estado del envío
   sigue siendo un resumen grueso; la precisión del trayecto vive en la bitácora.

### 2.3 El estado del envío mezcla dos dimensiones

`shipment_status` combina hoy el **tramo** (`DISPATCHED`, `IN_CUSTOMS`,
`OUT_FOR_DELIVERY`, `DELIVERED`) con el **resultado** (`EXCEPTION`,
`CANCELLED`). Son ejes ortogonales: un envío puede estar `IN_CUSTOMS` y además
tener una excepción.

Opciones, sin cambiar nada en Fase A:

| Opción | Coste | Nota |
| --- | --- | --- |
| **A. Mantener el enum y registrar el tramo sólo en eventos** (recomendada) | Cero | La bitácora ya da la precisión; `status` queda como resumen para filtrar |
| B. Añadir columna `current_leg` a `shipments` | Una columna y su `CHECK` | Proyección; se actualiza en la misma transacción que el evento |
| C. Separar en `leg` + `outcome` | Rediseño del enum | Limpio, pero cambia el dominio ya probado y sus 148 pruebas |

Recomiendo **A**, y **B** sólo si alguna consulta necesita filtrar por tramo con
índice. Con `A`, el único requisito de esquema es que `event_code` sea `text`: los
códigos nuevos entran sin migración.

### 2.4 Proyecciones de timestamp (sólo si se piden)

Si el detalle de compra quiere mostrar "en aduana desde el 12/03" sin recorrer
eventos, estas columnas nullable_evitan el recorrido. **Deben documentarse como
proyecciones**, nunca como fuente de verdad:

```text
us_warehouse_received_at      timestamptz
international_dispatched_at  timestamptz
customs_cleared_at           timestamptz
local_delivery_dispatched_at timestamptz
```

No las incluyo en el mapeo porque ningún esquema de validación actual las produce:
introducirlas sin un caso de uso real sería inventar columnas.

---

## 3. Lo que Prisma no expresa y debe ir en SQL manual

### 3.1 Lo que Prisma sí expresa, pero hay que declarar explícitamente

| Elemento | En Prisma | Aviso |
| --- | --- | --- |
| PK `bigint` | `BigInt @id @default(autoincrement())` | Hay que **revisar el SQL generado**: el diseño exige `generated always as identity` y `data-model-phase-1.md` advierte no asumirlo |
| Tipos nativos | `@db.Decimal(20,4)`, `@db.Timestamptz(3)`, `@db.Char(3)`, `@db.Text` | Sin esto Prisma genera `decimal(65,30)` |
| FK con `RESTRICT` | `@relation(onDelete: Restrict)` | **Ojo:** en relaciones opcionales Prisma usa `SetNull` por defecto; hay que declararlo en cada una |
| Índices compuestos | `@@index([a, b(sort: Desc)])` | Prisma 7 admite `sort:` |
| Unicidad simple | `@@unique([a, b])` | Parciales, no |

### 3.2 Lo que Prisma NO expresa: SQL manual obligatorio

| # | Objeto | Tipo | Motivo |
| --- | --- | --- | --- |
| 1 | `CHECK` de no negativos en los seis `*_usd` y `actual_weight_lb > 0` | `CHECK` | Prisma no tiene checks |
| 2 | `CHECK` de `currency_code` en tres mayúsculas | `CHECK` | Idem |
| 3 | `CHECK` de integridad de importes por estado: `status = 'DRAFT'` **o** los cinco componentes y `total_paid_usd` presentes | `CHECK` | Condicional sobre otra columna |
| 4 | `CHECK` de `total_paid_usd` = suma exacta de los cinco | `CHECK` | Aritmética entre columnas |
| 5 | `CHECK` de orden de instantes (`paid_at`, `delivered_at`, `cancelled_at` ≥ `ordered_at`; en envíos `delivered_at` ≥ `dispatched_at`, `estimated_delivery_at` ≥ `dispatched_at`) | `CHECK` | Idem |
| 6 | `CHECK` de terminación coherente: `DELIVERED` exige `delivered_at`; `CANCELLED` exige `cancelled_at` y motivo | `CHECK` | Idem |
| 7 | `CHECK` de `carrier_name` obligatorio si hay `tracking_number` | `CHECK` | Idem |
| 8 | `CHECK` de `sequence > 0` | `CHECK` | Idem |
| 9 | `CHECK` de `length(btrim(reference_code)) > 0` | `CHECK` | Idem |
| 10 | `purchases (created_by_user_id, reference_code)` **único** | Índice único | Prisma no hace únicos parciales, pero este es simple: sí puede ir en el modelo |
| 11 | `purchases (supplier_offer_id) WHERE status <> 'CANCELLED'` **único parcial** | Índice único parcial | Fuera del modelo |
| 12 | `shipments (carrier_name, tracking_number) WHERE tracking_number IS NOT NULL` **único parcial** | Índice único parcial | Fuera del modelo |
| 13 | `purchases (status, estimated_delivery_at) WHERE status IN ('CONFIRMED','PAID','IN_TRANSIT')` | Índice parcial | Fuera del modelo |
| 14 | `purchase_events (event_code, occurred_at DESC) WHERE source = 'SYSTEM'` | Índice parcial | Fuera del modelo |
| 15 | Índice de `opportunity_id` parcial `WHERE opportunity_id IS NOT NULL` | Índice parcial | Fuera del modelo |
| 16 | `purchase_events` **append-only**: `REVOKE UPDATE, DELETE` al rol de la aplicación | Permisos | Prisma no gestiona roles; hay que hacerlo con una conexión de migración |
| 17 | Comentarios `COMMENT ON TABLE/COLUMN` | Comentarios | El diccionario de datos vive en el DDL |
| 18 | Grants por esquema y `search_path` endurecido | Seguridad | Fuera del modelo |
| 19 | Idempotencia de la propia migración | `DO $$` + `pg_constraint` | PostgreSQL **no** soporta `ADD CONSTRAINT IF NOT EXISTS` |
| 20 | `NOT NULL` sobre `payload` más `jsonb_typeof(payload) = 'object'` | `CHECK` | El contrato por código no es SQL |

Los índices compuestos de lectura (`purchases (status, created_at DESC, id DESC)`
etc.) **sí** pueden declararse en el modelo con `@@index` y `sort: Desc`.

### 3.3 Orden recomendado de aplicación

1. Modelar en `schema.prisma` sólo lo que Prisma expresa bien; `prisma format` y
   `prisma validate`.
2. Migración en modo `create-only`.
3. Revisar el SQL: identidad, `numeric`, `timestamptz`, `char(3)`, `on delete`,
   nombres físicos.
4. Completar en SQL **sólo** los 20 objetos de §3.2, cada uno envuelto en `DO $$`
   con la comprobación previa en `pg_constraint`.
5. `prisma migrate diff` para confirmar que el cambio es aditivo: ninguna tabla
   existente se altera.
6. Pruebas de constraints contra PostgreSQL real de desarrollo y detector de FK
   sin índice.

---

## 4. Inconsistencias y decisiones pendientes

| # | Decisión | Situación actual | Impacto si no se decide | Recomendación |
| --- | --- | --- | --- | --- |
| **D1** | Importe pagado | `purchaseTransitionSchema` exige `paidAmountUsd` y el dominio exige `paidAt`; el diseño **no tiene columna** | La acción `RECORD_PAYMENT` no tiene dónde escribir lo que pagó | Añadir `paid_amount_usd numeric(20,4)` y `CHECK` de igualdad con `total_paid_usd` en `PAID`. Si difieren (pago parcial), exigir el motivo en el evento |
| **D2** | Quién incrementa `revision` | `revision` está en el diseño; el dominio no la conoce; `editPurchaseSchema` la usa como `expectedRevision` | Control de concurrencia optimista sin contraparte | El caso de uso incrementa `revision` en la misma transacción que registra `DATA_CORRECTED`; documentarlo como responsabilidad de aplicación |
| **D3** | Moneda del costo real del envío | `shipments.actual_cost_usd` es USD; `shipping_quotes` exige costos **normalizados a COP** en Fase 1 (`data-model-phase-1.md` §envío) | Dos monedas en la misma operación sin regla de conversión | Elegir una: `actual_cost_usd` en USD **y** una proyección en COP sólo cuando exista tasa. No mixing silencioso |
| **D4** | Columna `purchase_events.notes` | El diseño la tiene; el dominio no tiene `notes` en `PurchaseEvent` (la nota vive dentro de `payload` en `NOTE_ADDED`) | Columna siempre nula, o dos fuentes para la misma nota | Dejar la columna y mapear `NOTE_ADDED.payload.note` a ella, **o** eliminarla del diseño. Recomiendo eliminarla: el payload ya es la fuente |
| **D5** | Autor de los envíos | `shipments` no tiene `created_by_user_id`; las demás tablas de Fase 1 sí | Auditoría incompleta: no se sabe quién registró un envío | Añadir `created_by_user_id bigint` → `users(id)`, `NOT NULL`, con su índice de FK |
| **D6** | Enum de PostgreSQL o `text` + `CHECK` | El diseño difiere la decisión al gate de esquema | Dos migraciones distintas según quién escriba el esquema | `text` + `CHECK` para `event_code` (crece); enum nativo para los tres estados de ciclo de vida |
| **D7** | Estado del envío vs tramo | `shipment_status` mezcla tramo y resultado (§2.3) | Filtrar por tramo obliga a leer eventos | Opción A: mantener el enum y registrar el tramo en eventos |
| **D8** | Idempotencia de eventos automáticos | El diseño afirma idempotencia "por construcción"; dos transacciones concurrentes podrían escribir dos `SHIPMENT_DISPATCHED` | Bitácora con duplicados y `PURCHASE_DELIVERED` doble | Confiar en el bloqueo de la fila de `purchases` dentro de la transacción (`SELECT ... FOR UPDATE`) y documentarlo; alternativa más fuerte: única parcial sobre `(purchase_id, event_code)` para los eventos **de shipment**, con `shipment_id` en el payload |
| **D9** | `opportunities.status = 'PURCHASED'` | El enum ya existe; no hay regla que lo active ni columna inversa | La oportunidad y la compra pueden discrepar | Definir en el caso de uso: al crear la compra con `opportunity_id`, actualizar `opportunities.status` a `PURCHASED` en la misma transacción |
| **D10** | `updateShipmentSchema` permite `status` | El comentario del propio esquema dice que el estado "cambia por la máquina de estados, no por un parche libre", pero el esquema **sí** lo acepta | El comentario y el código se contradicen | Quitar `status` del parche y dejar el cambio de estado en una operación propia, **o** cambiar el comentario. No puede quedar así |
| **D11** | `currency_code` en `purchases` | Obligatorio y con `CHECK`, pero en Fase A siempre vale `USD` | Columna que nunca aporta información | Mantenerla: hace explícita la unidad del total y evita una migración cuando entre COP. Añadir `CHECK (currency_code = 'USD')` en Fase A |
| **D12** | Typo en el diseño | `shipments.notes` dice "NOTAS del operador" | Ruido en el diccionario | Corregir a "Notas del operador" |

---

## 5. Verificación realizada

- Los tres estados, tres enums de origen, once códigos de evento, cinco
  componentes de dinero y los siete estados de envío se contrastaron uno a uno
  contra `domain/contracts.ts`, `domain/purchase-status.ts`,
  `domain/purchase-events.ts`, `domain/purchase-money.ts` y contra los cinco
  esquemas de `application/validation/`.
- Se comprobó que cada campo de entrada de los esquemas tiene columna prevista, y
  se listaron los que no la tienen (§1.5, D1, D4, D5).
- Se verificó que `data-model-phase-1.md` y `purchases-fiscal-phase-a-design.md`
  no se contradicen en tipos, precisiones (`numeric(20,4)`, `numeric(10,3)`,
  `char(3)`, `timestamptz`) ni en la ausencia de cascadas.
- Comprobación documental: sin caracteres corruptos, tablas Markdown con columnas
  consistentes, enlaces internos resolubles y encabezados sin saltos de nivel.

No se modificó ningún archivo de código, `prisma/`, `.env*` ni `.gitignore`, y no
se creó ni se ejecutó ninguna migración.