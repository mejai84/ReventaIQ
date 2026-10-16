# Lista de verificación — esquema Prisma multiproducto

**Estado:** propuesto, pendiente de aprobación
**Fecha:** 2026-10-16
**Propósito:** revisar el esquema **antes** de que se escriba `schema.prisma`, para que la
primera migración salga correcta y revisable.
**Entradas:** [data-model-phase-1.md](./data-model-phase-1.md),
[purchases-fiscal-phase-a-design.md](./purchases-fiscal-phase-a-design.md),
[ADR-0005](../adr/0005-multi-product-catalog.md),
[multi-product-code-audit.md](./multi-product-code-audit.md),
[purchases-phase-a-schema-review.md](./purchases-phase-a-schema-review.md)

> Este documento **no** escribe el esquema. No se creó ni se modificará
> `prisma/schema.prisma`, no se generó SQL y no se aplicó ninguna migración, según el
> gate de [ADR-0004](../adr/0004-gated-database-migrations.md).

---

## 0. Resumen

| Grupo | Modelos | Nuevos por ADR-0005 | Nuevos por Fase A |
| --- | --- | --- | --- |
| Identidad y configuración | 5 | `product_categories`, `brands` | — |
| Catálogo | 4 | `attribute_definitions`, `product_variant_attribute_values` | — |
| Fuentes de compra y mercado | 4 | — | — |
| Envío, cambio y venta | 5 | — | — |
| Análisis | 2 | — | — |
| Compras (Fase A) | 3 | — | `purchases`, `purchase_events`, `shipments` |
| **Total** | **23** | **4** | **3** |

Cadena de catálogo que decide ADR-0005, con el nombre físico de la tabla que
debe existir:

```text
ProductCategory                product_categories
Brand                          brands
Product                        products
ProductVariant                 product_variants
AttributeDefinition            attribute_definitions
ProductVariantAttributeValue   product_variant_attribute_values
```

Tres advertencias que cambian el modelo propuesto original:

1. **`products.brand` pasa de texto a `brand_id`.** El modelo de datos actual
   guarda la marca como `text`; ADR-0005 la vuelve fila. Es una migración de
   diseño, no un añadido.
2. **`family`, `generation` y `edition` de `products` dejan de ser columnas** y
   pasan a atributos, igual que la edición de una consola.
3. **`product_variants` ya no tiene `storage_gb`, `color_key`, `region_code` ni
   `sim_type` como columnas**: son atributos tipados. Esto **rompe** la unicidad
   `(product_id, storage_gb, color_key, region_code, sim_type)` del documento
   actual.

---

## 1. Modelos exactos que deben existir

☐ **Identidad y configuración (5)**

`users` · `business_settings` · `condition_grades` · `product_categories` · `brands`

☐ **Catálogo (4)**

`products` · `product_variants` · `attribute_definitions` ·
`product_variant_attribute_values`

☐ **Fuentes de compra y mercado (4)**

`suppliers` · `supplier_offers` · `marketplaces` · `market_listings`

☐ **Envío, cambio y venta (5)**

`shipping_providers` · `shipping_quotes` · `exchange_rates` · `sales_channels` ·
`sales_cost_profiles`

☐ **Análisis (2)**

`opportunities` · `opportunity_comparables`

☐ **Compras, Fase A (3)**

`purchases` · `purchase_events` · `shipments`

☐ **No debe existir todavía** (diferidos por el modelo de datos, §"Entidades
diferidas"): `inventory_items` con IMEI, `sales`, `expenses`,
`capital_transactions`, `watchlists`, `price_snapshots`, `alerts`.

---

## 2. Columnas, tipos Prisma y mapeo PostgreSQL esperado

### 2.1 Mapeo de tipos (se repite en cada modelo)

| Prisma | PostgreSQL esperado | Nota |
| --- | --- | --- |
| `BigInt @id @default(autoincrement())` | `bigint generated always as identity` | **Verificar en el SQL generado**: el modelo exige identity, no `serial` |
| `String @db.Text` | `text` | Sin `varchar(n)` arbitrario |
| `String @db.Char(3)` | `char(3)` | Códigos monetarios |
| `Decimal @db.Decimal(20,4)` | `numeric(20,4)` | Dinero |
| `Decimal @db.Decimal(18,8)` | `numeric(18,8)` | Tasas y porcentajes, como fracciones |
| `Decimal @db.Decimal(10,3)` | `numeric(10,3)` | Pesos |
| `Decimal @db.Decimal(7,4)` | `numeric(7,4)` | Scores, con rango 0..100 |
| `DateTime @db.Timestamptz(3)` | `timestamptz` | Siempre UTC; nunca `timestamp` |
| `Json` | `jsonb` | Sólo snapshots, auditoría y datos externos |
| `Boolean` | `boolean` | Nunca `varchar` |
| `Int` | `int` | Versiones, días, secuencia |
| Enum de Prisma | `enum` de PostgreSQL | Ver §3 |

☐ Sin `@db.` el ORM genera `decimal(65,30)` y `timestamp(3)`: revisar columna por
columna.

☐ En DTOs y JSON, `BigInt` viaja como **cadena decimal** y `Decimal` como
**cadena** (ADR-0002). El BigInt de JavaScript no es seguro.

### 2.2 Catálogo nuevo (ADR-0005)

| Modelo | Columna | Prisma | PG |
| --- | --- | --- | --- |
| `product_categories` | `id` | `BigInt @id @default(autoincrement())` | `bigint identity` |
| | `code` | `String @unique @db.Text` | `text` |
| | `name` | `String @db.Text` | `text` |
| | `is_active` | `Boolean @default(true)` | `boolean` |
| | `sort_order` | `Int?` | `int` |
| | `created_at`, `updated_at` | `DateTime @default(now()) @updatedAt @db.Timestamptz(3)` | `timestamptz` |
| `brands` | `id` | `BigInt @id @default(autoincrement())` | `bigint identity` |
| | `slug` | `String @unique @db.Text` | `text` |
| | `name` | `String @db.Text` | `text` |
| | `is_active` | `Boolean @default(true)` | `boolean` |
| | `created_at`, `updated_at` | `DateTime` | `timestamptz` |
| `attribute_definitions` | `id` | `BigInt @id @default(autoincrement())` | `bigint identity` |
| | `category_id` | `BigInt` → `product_categories(id)` | `bigint` |
| | `key` | `String @db.Text` | `text` |
| | `label` | `String @db.Text` | `text` |
| | `value_type` | `AttributeValueType` | `enum` |
| | `is_comparable` | `Boolean @default(false)` | `boolean` |
| | `is_required` | `Boolean @default(false)` | `boolean` |
| | `unit` | `String? @db.Text` | `text` |
| | `is_active` | `Boolean @default(true)` | `boolean` |
| | `created_at`, `updated_at` | `DateTime` | `timestamptz` |
| `product_variant_attribute_values` | `id` | `BigInt @id @default(autoincrement())` | `bigint identity` |
| | `product_variant_id` | `BigInt` → `product_variants(id)` | `bigint` |
| | `attribute_definition_id` | `BigInt` → `attribute_definitions(id)` | `bigint` |
| | `value_text` | `String? @db.Text` | `text` |
| | `value_number` | `Decimal? @db.Decimal(18,8)` | `numeric(18,8)` |
| | `value_boolean` | `Boolean?` | `boolean` |
| | `created_at`, `updated_at` | `DateTime` | `timestamptz` |

### 2.3 Catálogo modificado

| Modelo | Cambio | Columna | Prisma |
| --- | --- | --- | --- |
| `products` | **Sustituye** `brand` texto | `brand_id` | `BigInt` → `brands(id)` |
| | **Sustituye** `family`, `generation`, `edition` | — | pasan a `attribute_definitions` + valores |
| | Mantiene | `normalized_key` | `String @unique @db.Text` |
| | Mantiene | `display_name`, `release_year?`, `is_active` | `String @db.Text`, `Int?`, `Boolean` |
| `product_variants` | **Sustituye** `storage_gb`, `color_key`, `color_label`, `region_code`, `sim_type` | — | pasan a atributos tipados |
| | Mantiene | `product_id`, `manufacturer_sku?`, `is_active` | `BigInt`, `String? @db.Text`, `Boolean` |
| | **Añade** peso de producto | `product_weight_g` | `Decimal? @db.Decimal(10,3)` |
| | **Añade** dimensiones de producto | `product_length_cm`, `product_width_cm`, `product_height_cm` | `Decimal? @db.Decimal(10,3)` |
| | **Añade** peso volumétrico de referencia | `product_volume_cm3` | `Decimal? @db.Decimal(12,3)` |
| `condition_grades` | **Añade** | `category_id` | `BigInt` → `product_categories(id)` |

☐ Las dimensiones de **producto** sirven para decidir embalaje y comparar fichas.
**Nunca** se usan como peso o dimensiones de paquete (ver §6.4).

☐ `product_volume_cm3` es una ayuda de referencia para capacidad de envío; el
peso volumétrico facturable se calcula con el divisor del transportista.

### 2.4 Compras, Fase A

| Modelo | Columna | Prisma | PG |
| --- | --- | --- | --- |
| `purchases` | `created_by_user_id` | `BigInt` → `users(id)` | `bigint` |
| | `reference_code` | `String @db.Text` | `text` |
| | `status` | `PurchaseStatus @default(DRAFT)` | `enum` |
| | `supplier_id` | `BigInt` → `suppliers(id)` | `bigint` |
| | `supplier_offer_id` | `BigInt` → `supplier_offers(id)` | `bigint` |
| | `opportunity_id` | `BigInt?` → `opportunities(id)` | `bigint` |
| | `product_variant_id` | `BigInt` → `product_variants(id)` | `bigint` |
| | `condition_grade_id` | `BigInt` → `condition_grades(id)` | `bigint` |
| | `currency_code` | `String @db.Char(3)` | `char(3)` |
| | `purchase_price_usd`, `us_shipping_usd`, `us_sales_tax_usd`, `payment_fee_usd`, `other_cost_usd`, `total_paid_usd` | `Decimal? @db.Decimal(20,4)` | `numeric(20,4)` |
| | `ordered_at` | `DateTime @db.Timestamptz(3)` | `timestamptz` |
| | `paid_at?`, `estimated_delivery_at?`, `delivered_at?`, `cancelled_at?` | `DateTime?` | `timestamptz` |
| | `cancellation_reason?`, `source_url?`, `notes?` | `String? @db.Text` | `text` |
| | `revision` | `Int @default(1)` | `int` |
| `purchase_events` | `purchase_id` | `BigInt` → `purchases(id)` | `bigint` |
| | `event_code` | `String @db.Text` | `text` — **no enum** |
| | `source` | `EventSource` | `enum` |
| | `occurred_at`, `recorded_at` | `DateTime @db.Timestamptz(3)` | `timestamptz` |
| | `created_by_user_id?` | `BigInt?` → `users(id)` | `bigint` |
| | `payload` | `Json` | `jsonb` |
| `shipments` | `purchase_id`, `sequence` | `BigInt`, `Int` | `bigint`, `int` |
| | `status` | `ShipmentStatus @default(PENDING)` | `enum` |
| | `shipping_provider_id?`, `shipping_quote_id?` | `BigInt?` | `bigint` |
| | `carrier_name?`, `tracking_number?`, `tracking_url?`, `notes?` | `String? @db.Text` | `text` |
| | `dispatched_at?`, `estimated_delivery_at?`, `delivered_at?` | `DateTime?` | `timestamptz` |
| | `actual_cost_usd?` | `Decimal? @db.Decimal(20,4)` | `numeric(20,4)` |
| | `actual_weight_lb?` | `Decimal? @db.Decimal(10,3)` | `numeric(10,3)` |

☐ `purchases` referencia **sólo** `product_variant_id`: sin columnas de marca,
categoría ni modelo. Es la consecuencia directa de ADR-0005 y mantiene la compra
genérica.

☐ `shipments.actual_weight_lb` es el peso **del paquete**, medido. No se rellena
con el peso de la ficha técnica del producto.

☐ `shipments` **no** lleva columnas de peso ni dimensiones de paquete en Fase A:
se capturan con la logística (ver §8).

☐ `purchases` **no** lleva columna para el importe pagado: el código de aplicación
ya exige `paidAmountUsd` (ver §8, decisión P1).

☐ `shipments` **no** lleva `created_by_user_id` en el diseño actual, mientras
`supplier_offers`, `market_listings`, `shipping_quotes` y `opportunities` sí lo
llevan (ver §8, decisión P5).

---

## 3. Enums reales versus catálogos administrables

### 3.1 Sí deben ser enums (estados y tipos técnicos estables)

| Enum | Valores |
| --- | --- |
| `UserRole` | `ADMIN` |
| `IntegrationMode` | `MANUAL`, `API`, `FEED`, `CSV` |
| `AttributeValueType` | `TEXT`, `NUMBER`, `BOOLEAN` — **nuevo**, selecciona la columna a llenar |
| `PurchaseStatus` | `DRAFT`, `CONFIRMED`, `PAID`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED` |
| `ShipmentStatus` | `PENDING`, `DISPATCHED`, `IN_CUSTOMS`, `OUT_FOR_DELIVERY`, `DELIVERED`, `EXCEPTION`, `CANCELLED` |
| `EventSource` | `USER`, `SYSTEM`, `IMPORT` |
| `OfferStatus` | `ACTIVE`, `INACTIVE`, `SOLD_OUT`, `EXPIRED` |
| `ListingStatus` | `ACTIVE`, `INACTIVE`, `REMOVED`, `EXPIRED` |
| `OpportunityStatus` | `ACTIVE`, `EXPIRED`, `DISMISSED`, `PURCHASED` |
| `OpportunitySignal` | `STRONG_BUY`, `BUY`, `WATCH`, `REJECT` |
| `PartAuthenticity` | `ORIGINAL`, `REPLACED_OEM`, `REPLACED_THIRD_PARTY`, `UNKNOWN` |
| `FeatureState` | `PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE` |
| `ImeiStatus` · `CarrierLockStatus` · `IcloudStatus` | estados de calidad con `UNKNOWN` |
| `WarrantyReserveBasis` | `LANDED_COST`, `SALE_PRICE` |
| `ConservativePriceStrategy` | `MEDIAN_DISCOUNT`, `PERCENTILE`, `MINIMUM` |
| `ExchangeRateSource` | `MANUAL`, `AUTOMATIC` |
| `CostTiming` · `MetricSource` · `DecisionMetric` | tipos de costo, fuente de métrica y métrica del dashboard |

☐ `FeatureState` incluye `NOT_APPLICABLE`: es lo que impide tratar "una consola no
tiene salud de batería" como dato faltante.

### 3.2 NO deben ser enums (catálogos administrables)

| Catálogo | Por qué |
| --- | --- |
| `product_categories` | Una categoría nueva es una fila, no una migración |
| `brands` | Igual: `sony` entra sin tocar código |
| `condition_grades` | Dependen de la categoría y los define el usuario |
| `attribute_definitions` | Un atributo nuevo es una fila |
| `sales_channels` | Catálogo de negocio |
| `suppliers` · `marketplaces` · `shipping_providers` | Catálogos con `connector_key` |

☐ **`sim_type` deja de ser enum.** El modelo de datos lo lista como enum
`PHYSICAL`, `ESIM`, `DUAL`, `HYBRID`, `UNKNOWN`, pero ADR-0005 lo convierte en
atributo tipado de la variante. Es un cambio de diseño que hay que decidir
explícitamente (ver §8, decisión M1).

---

## 4. Relaciones, claves foráneas y `onDelete`

☐ **Todas las relaciones usan `onDelete: Restrict`**, sin excepción salvo la
señalada abajo. En Prisma, una relación opcional toma `SetNull` **por defecto**:
declararlo en cada una no es opcional.

| Origen | Destino | Nulable | `onDelete` |
| --- | --- | --- | --- |
| `purchases` | `users`, `suppliers`, `supplier_offers`, `product_variants`, `condition_grades` | No | `Restrict` |
| `purchases` | `opportunities` | Sí | `Restrict` |
| `purchase_events` | `purchases`, `users` | `users` sí | `Restrict` |
| `shipments` | `purchases` | No | `Restrict` |
| `shipments` | `shipping_providers`, `shipping_quotes` | Sí | `Restrict` |
| `products` | `brands`, `product_categories` (vía variantes) | No | `Restrict` |
| `product_variants` | `products` | No | `Restrict` |
| `attribute_definitions` | `product_categories` | No | `Restrict` |
| `product_variant_attribute_values` | `product_variants`, `attribute_definitions` | No | `Restrict` |
| `condition_grades` | `users`, `product_categories` | No | `Restrict` |
| `supplier_offers` | `users`, `suppliers`, `product_variants`, `condition_grades` | No | `Restrict` |
| `market_listings` | `users`, `marketplaces`, `product_variants`, `condition_grades` | No | `Restrict` |
| `shipping_quotes` | `users`, `supplier_offers`, `shipping_providers` | No | `Restrict` |
| `business_settings` | `users` | No | `Restrict` |
| `sales_cost_profiles` | `sales_channels` | No | `Restrict` |
| `opportunities` | `supplier_offers`, `business_settings`, `exchange_rates`, `sales_cost_profiles` | No | `Restrict` |
| `opportunities` | `selected_shipping_quote` | Sí | `Restrict` |
| `opportunities_comparables` | `opportunities`, `market_listings` | No | `Restrict` |

☐ **Única excepción deliberada:** `opportunities.supersedes_opportunity_id` con
`onDelete: SetNull`. Encadenar reevaluaciones no debe borrarse en cascada cuando
se depura un análisis viejo.

☐ Ninguna relación usa `onDelete: Cascade`. Catálogos se desactivan con
`is_active`; los registros con evidencia no se borran.

☐ Toda FK lleva índice: PostgreSQL no los crea solo (ver §5 y §6).

---

## 5. Índices y unicidades normales

☐ Los siguientes **sí** pueden declararse en Prisma:

| Modelo | Declaración | Tipo |
| --- | --- | --- |
| `users` | `@@index([email])` sobre `lower(email)` se resuelve en SQL manual | ver §6 |
| `business_settings` | `@@unique([userId, version])`, `@@unique([userId])` parcial | ver §6 |
| `product_categories` | `code` `@unique` | única |
| `brands` | `slug` `@unique` | única |
| `products` | `normalized_key` `@unique` | única |
| `attribute_definitions` | `@@unique([categoryId, key])` | única |
| `product_variant_attribute_values` | `@@unique([productVariantId, attributeDefinitionId])` | única |
| `product_variants` | `@@index([productId])` | FK |
| `condition_grades` | `@@unique([userId, code])` | única |
| `suppliers`, `marketplaces`, `shipping_providers`, `sales_channels` | `slug` / `code` `@unique` | únicas |
| `supplier_offers` | `@@index([productVariantId, status, observedAt(sort: Desc), id(sort: Desc)])` | lectura |
| `supplier_offers` | `@@index([supplierId, status, observedAt(sort: Desc), id(sort: Desc)])` | lectura |
| `market_listings` | `@@index([productVariantId, status, observedAt(sort: Desc), id(sort: Desc)])` | lectura |
| `market_listings` | `@@index([productVariantId, conditionGradeId, status, observedAt(sort: Desc)])` | comparables |
| `shipping_quotes` | `@@index([supplierOfferId, quotedAt(sort: Desc), id(sort: Desc)])` | lectura |
| `exchange_rates` | `@@index([baseCurrencyCode, quoteCurrencyCode, observedAt(sort: Desc), id(sort: Desc)])` | lectura |
| `sales_cost_profiles` | `@@unique([salesChannelId, version])` | única |
| `opportunities` | `@@index([supplierOfferId, analyzedAt(sort: Desc), id(sort: Desc)])` | historial |
| `opportunity_comparables` | `@@index([marketListingId])` | FK inversa |
| `purchases` | `@@unique([createdByUserId, referenceCode])` | única |
| `purchases` | `@@index([status, createdAt(sort: Desc), id(sort: Desc)])` | lectura |
| `purchases` | `@@index([supplierOfferId, createdAt(sort: Desc), id(sort: Desc)])` | FK + historial |
| `purchase_events` | `@@index([purchaseId, occurredAt(sort: Desc), id(sort: Desc)])` | FK + línea de tiempo |
| `shipments` | `@@unique([purchaseId, sequence])` | única |

☐ En índices compuestos, primero igualdad, después rango y orden, y `id` como
desempate estable para la paginación por cursor.

☐ **Índice nuevo y necesario para comparables multiproducto** (decisión M4):
consultar los atributos marcados `is_comparable` de una variante exige un índice
por tipo de valor:

- `product_variant_attribute_values (attribute_definition_id, value_number)`
- `product_variant_attribute_values (attribute_definition_id, value_text)`
- `product_variant_attribute_values (attribute_definition_id, value_boolean)`

Sin ellos, filtrar por "misma edición y misma capacidad" es un escaneo secuencial.

☐ **No** se crea índice GIN sobre `payload` ni sobre `jsonb` de snapshots hasta que
exista una consulta con su plan que lo justifique.

---

## 6. Constraints, índices parciales y append-only: SQL manual posterior

Nada de esta sección es expresable en Prisma. Va en la migración `create-only`,
cada objeto envuelto en `DO $$` con comprobación previa en `pg_constraint`, porque
PostgreSQL no soporta `ADD CONSTRAINT IF NOT EXISTS`.

### 6.1 Catálogo y atributos

| # | Constraint | Regla |
| --- | --- | --- |
| 1 | Valor de atributo coherente con su tipo | Exactamente una columna de valor no nula según `attribute_definitions.value_type`; las demás en `NULL` |
| 2 | Texto no vacío si es el tipo activo | `length(btrim(value_text)) > 0` |
| 3 | Booleano preenchido | `value_boolean IS NOT NULL` cuando el tipo es `BOOLEAN` |
| 4 | Peso de producto positivo | `product_weight_g > 0` cuando no sea nulo |
| 5 | Dimensiones de producto positivas | Las tres, cuando no sean nulas |
| 6 | Volumen coherente | `product_volume_cm3` no negativo |
| 7 | Grados de condición por categoría | Unicidad `(user_id, category_id, code)` |

### 6.2 Compras

| # | Constraint o índice | Regla |
| --- | --- | --- |
| 8 | Importes no negativos | Todos los `*_usd` de `purchases` y `actual_cost_usd` |
| 9 | Moneda | `currency_code` en tres mayúsculas; `CHECK (currency_code = 'USD')` en Fase A |
| 10 | Integridad por estado | `status = 'DRAFT'` **o** los cinco componentes y `total_paid_usd` presentes |
| 11 | Suma exacta | `total_paid_usd` = suma de los cinco componentes |
| 12 | Orden de instantes | `paid_at`, `delivered_at`, `cancelled_at` ≥ `ordered_at` |
| 13 | Terminación coherente | `DELIVERED` exige `delivered_at`; `CANCELLED` exige `cancelled_at` y motivo |
| 14 | Referencia no vacía | `length(btrim(reference_code)) > 0` |
| 15 | Peso de paquete | `actual_weight_lb > 0` cuando no sea nulo |
| 16 | Envío coherente | `delivered_at >= dispatched_at`; `estimated_delivery_at >= dispatched_at` |
| 17 | Transportista con seguimiento | `tracking_number` no nulo exige `carrier_name` no nulo |
| 18 | Payload de evento | `jsonb_typeof(payload) = 'object'` |
| 19 | **Una compra viva por oferta** | Único parcial `(supplier_offer_id) WHERE status <> 'CANCELLED'` |
| 20 | **Seguimiento único** | Único parcial `(carrier_name, tracking_number) WHERE tracking_number IS NOT NULL` |
| 21 | **Cola de compras vivas** | Índice parcial `(status, estimated_delivery_at) WHERE status IN ('CONFIRMED','PAID','IN_TRANSIT')` |
| 22 | **Vínculo con oportunidad** | Índice parcial `(opportunity_id) WHERE opportunity_id IS NOT NULL` |
| 23 | **Auditoría de sistema** | Índice parcial `(event_code, occurred_at DESC) WHERE source = 'SYSTEM'` |
| 24 | **Append-only** | `REVOKE UPDATE, DELETE ON purchase_events` al rol de la aplicación |

### 6.3 Análisis

| # | Constraint o índice | Regla |
| --- | --- | --- |
| 25 | Una versión activa de settings | Único parcial `(user_id) WHERE is_active` |
| 26 | Un perfil vigente por canal | Único parcial `(sales_channel_id) WHERE valid_to IS NULL` |
| 27 | Suma de cotización | `shipping_quotes.total_amount` = suma de sus componentes |
| 28 | Vencimientos | `expires_at > observed_at` / `> quoted_at` |
| 29 | Rangos de score | `0..100` en `opportunity_score` y `condition_grades.score_value` |
| 30 | Tasa coherente | `base_currency_code <> quote_currency_code` |
| 31 | Cotización de la misma oferta | La oportunidad referencia una cotización de la oferta analizada |
| 32 | Dashboard | Índice parcial `(opportunity_score DESC, analyzed_at DESC, id DESC) WHERE status = 'ACTIVE'` |
| 33 | Señales activas | Índice parcial `(signal, opportunity_score DESC, id DESC) WHERE status = 'ACTIVE'` |
| 34 | Exclusiones | `opportunity_comparables.exclusion_reason` obligatorio cuando `included = false` |

### 6.4 Peso de producto frente a peso de paquete

☐ La única regla de este bloque que se comprueba en base de datos: **el peso del
paquete no se rellena desde la ficha técnica**. Se documenta como invariante de
aplicación, porque una `CHECK` no puede expresar "no copies este valor".

☐ `shipping_quotes` no tiene todavía columna para el peso usado ni para el
divisor volumétrico aplicado. Sin eso no se puede auditar por qué una cotización
difiere de otra (decisión P7).

### 6.5 Comprobaciones que no son de esquema pero deben ejecutarse

☐ Detector de FK sin índice.
☐ Pruebas de constraints contra PostgreSQL real de desarrollo.
☐ `prisma migrate diff` para confirmar que la migración es **aditiva**: ninguna
tabla existente se altera.

---

## 7. Verificación en el SQL generado

☐ `bigint generated always as identity`, no `serial`.
☐ `numeric(20,4)`, `numeric(18,8)`, `numeric(10,3)`, `numeric(7,4)` correctos.
☐ `timestamptz` en todas las fechas; ninguna `timestamp` sin zona.
☐ `char(3)` en códigos monetarios.
☐ Todas las FK con `on delete restrict`, incluidas las opcionales.
☐ `on delete set null` **sólo** en `opportunities.supersedes_opportunity_id`.
☐ Ninguna FK con `on delete cascade`.
☐ `jsonb` sólo en `payload`, snapshots y auditoría.
☐ Nombres físicos en `snake_case` minúsculas.

---

## 8. Decisiones pendientes e inconsistencias detectadas

### 8.1 Del catálogo multiproducto

| # | Decisión | Situación | Recomendación |
| --- | --- | --- | --- |
| **M1** | `sim_type` | El modelo de datos lo define como enum; ADR-0005 lo convierte en atributo | Atributo tipado. El enum desaparece |
| **M2** | `color_key`, `color_label`, `region_code` | Hoy son columnas de `product_variants`; el color no es económico y suele ignorarse al comparar | Atributos, con `is_comparable = false` para el color |
| **M3** | `products.family`, `generation`, `edition` | Columnas de texto en `products` | Atributos. Decidir si viven en el producto o en la variante: la edición afecta a la variante vendible |
| **M4** | Huella de comparables | La lógica está hoy en tres sitios con tres formatos | Un módulo único y determinista: categoría, variante, grado y atributos `is_comparable`. Sin ML y sin `raw_title` |
| **M5** | Unidad de peso de producto | `product_weight_g` en gramos frente a `actual_weight_lb` en libras | Fijar gramos para producto y libras para paquete, o unificar. Hoy hay dos unidades en la misma operación |
| **M6** | Identificadores de búsqueda | No hay columna para GTIN, UPC o EAN, que los conectores necesitan para buscar por producto | Añadir `gtin` en `product_variants` con único parcial; sin él, el buscador por código no tiene dónde apoyarse |
| **M7** | Versión del snapshot | `opportunities.calculation_snapshot` tiene esquema versionado | Si la oferta lleva atributos, el snapshot necesita versión nueva; los análisis históricos no se reinterpretan |
| **M8** | Condición por categoría | `condition_grades` no tiene categoría y las escalas difieren (teléfono frente a consola) | Añadir `category_id` y versionar la escala por categoría |

### 8.2 De las compras, Fase A

| # | Decisión | Situación | Recomendación |
| --- | --- | --- | --- |
| **P1** | Importe pagado | El código exige `paidAmountUsd` y no hay columna | `paid_amount_usd numeric(20,4)` con igualdad contra `total_paid_usd` al pagar |
| **P2** | Quién incrementa `revision` | La columna existe; el dominio no la conoce | El caso de uso la incrementa junto con `DATA_CORRECTED` |
| **P3** | Moneda del costo real del envío | `shipments.actual_cost_usd` en USD frente a cotizaciones normalizadas a COP | Una sola moneda, o una proyección en COP sólo cuando exista tasa |
| **P4** | `purchase_events.notes` | Columna en el diseño; el dominio guarda la nota dentro del `payload` | Eliminar la columna: el payload ya es la fuente |
| **P5** | Autor de los envíos | `shipments` sin `created_by_user_id`; las demás tablas sí lo llevan | Añadirlo con su índice de FK |
| **P6** | Enum o `CHECK` | El diseño difiere la decisión al gate | `text` + `CHECK` para `event_code`; enum nativo para estados |
| **P7** | Peso usado y divisor | La cotización no registra si usó peso real o volumétrico | Añadir ambos a `shipping_quotes` para poder auditar el total |
| **P8** | Idempotencia de eventos | "Idempotente por construcción" no impide duplicados concurrentes | Bloquear la fila de `purchases` en la misma transacción |
| **P9** | `opportunities.status = 'PURCHASED'` | El valor existe y ninguna regla lo activa | Definir la actualización dentro de la transacción que crea la compra |
| **P10** | Estado del envío en el parche | El esquema lo acepta y el comentario dice que no | Quitar `status` del parche o cambiar el comentario; no puede quedar así |

---

## 9. Orden de trabajo sugerido

1. Aprobar este documento y cerrar M1, M2, M3, M5 y M6.
2. Traducir a `schema.prisma`: catálogo nuevo, catálogo modificado, compras.
3. `prisma format` y `prisma validate`.
4. Migración en modo `create-only`.
5. Revisar el SQL contra §7.
6. Completar en SQL los 34 objetos de §6, cada uno con `DO $$`.
7. Aplicar sólo en desarrollo y ejecutar las pruebas de constraints y el detector
   de FK sin índice.
8. Obtener aprobación del diff antes de promover.

Ninguna de estas etapas autoriza por sí sola una migración en otro entorno.