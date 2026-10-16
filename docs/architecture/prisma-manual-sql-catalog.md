# Catálogo canónico de SQL manual

**Estado:** aprobado, pendiente de aplicar en la migración `create-only`
**Fecha:** 2026-10-16
**Propósito:** lista **única y exhaustiva** de los objetos de base de datos que
Prisma no puede expresar y que deben escribirse a mano en el `migration.sql`.
**Entradas:** [data-model-phase-1.md](./data-model-phase-1.md),
[purchases-fiscal-phase-a-design.md](./purchases-fiscal-phase-a-design.md),
[multi-product-prisma-schema-checklist.md](./multi-product-prisma-schema-checklist.md),
[ADR-0005](../adr/0005-multi-product-catalog.md)

> **Regla de este documento.** Si un `CHECK`, un índice parcial, un índice por
> expresión o una regla de privilegio no está en esta lista, **no se escribe**.
> Si una regla nueva hace falta, se añade aquí primero con su ID y después se
> traduce a SQL. No existen objetos manuales fuera de esta lista.

**Convenciones de implementación, obligatorias:**

- PostgreSQL no soporta `ADD CONSTRAINT IF NOT EXISTS`. Cada objeto va envuelto en
  `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) THEN ... END IF; $$`.
- Los índices parciales y por expresión se crean con
  `CREATE INDEX IF NOT EXISTS` (esa forma sí es idempotente).
- Ningún `REVOKE` se emite antes de conocer el nombre real del rol de la
  aplicación: ver §5 y la nota previa a `SQL-034`.

---

## 1. CHECK CONSTRAINTS

| ID | Tabla | Nombre PostgreSQL | Propósito | Por qué Prisma no lo expresa | SQL aproximado | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| **SQL-001** | `product_variant_attribute_values` | `pvav_value_type_coherence_check` | Exactamente una columna de valor no nula, y la que corresponde a `attribute_definitions.value_type` | Prisma no tiene `CHECK` ni puede consultar otra tabla | `CHECK (...)` con subconsulta a `attribute_definitions.value_type` | **ALTO**: si se olvida, la fila acepta dos valores a la vez |
| **SQL-002** | `product_variant_attribute_values` | `pvav_value_text_not_blank_check` | `value_text` no vacío si se informa | Prisma no valida longitud ni `btrim` | `CHECK (value_text IS NULL OR length(btrim(value_text)) > 0)` | BAJO |
| **SQL-003** | `product_variants` | `product_variants_product_weight_positive_check` | `product_weight_g > 0` cuando está informado | Prisma no soporta `CHECK` | `CHECK (product_weight_g IS NULL OR product_weight_g > 0)` | BAJO |
| **SQL-004** | `product_variants` | `product_variants_product_dims_positive_check` | Las tres dimensiones de producto positivas cuando están informadas | Prisma no soporta `CHECK` | `CHECK (... length_cm > 0 AND width_cm > 0 AND height_cm > 0)` | BAJO |
| **SQL-005** | `product_variants` | `product_variants_product_volume_non_negative_check` | `product_volume_cm3` no negativo | Prisma no soporta `CHECK` | `CHECK (product_volume_cm3 IS NULL OR product_volume_cm3 >= 0)` | BAJO |
| **SQL-006** | `product_variants` | `product_variants_gtin_digits_check` | `gtin` contiene sólo dígitos, 8, 12, 13 o 14 (longitudes válidas de la familia GS1) | Prisma no valida con regex ni longitud | `CHECK (gtin IS NULL OR gtin ~ '^[0-9]{8}$' OR gtin ~ '^[0-9]{12}$' OR gtin ~ '^[0-9]{13}$' OR gtin ~ '^[0-9]{14}$')` | **ALTO**: es la regla que hace creíble la columna única de GTIN |
| **SQL-007** | `product_variants` | `product_variants_mpn_not_blank_check` | `manufacturer_part_number` no vacío si se informa | Prisma no valida longitud | `CHECK (manufacturer_part_number IS NULL OR length(btrim(manufacturer_part_number)) > 0)` | BAJO |
| **SQL-008** | `product_variant_external_identifiers` | `pvei_normalized_only_for_gtin_check` | `normalized_value` sólo existe si el tipo es de la familia GTIN | Prisma no puede condicionar una columna al valor de otra enumerada | `CHECK ((identifier_type IN ('GTIN','UPC','EAN')) = (normalized_value IS NOT NULL))` | **ALTO**: sin esto, un MPN "normalizado" contaminaría el matching de GTIN |
| **SQL-009** | `product_variant_external_identifiers` | `pvei_promotion_fields_coherent_check` | `promoted_at` y `product_variant_id` sólo existen si el estado es `CONFIRMED` | Prisma no puede condicionar columnas al valor de un enum | `CHECK (promotion_status <> 'CONFIRMED' OR (product_variant_id IS NOT NULL AND promoted_at IS NOT NULL))` | **ALTO**: impide que un identificador promotionado apunte a nada |
| **SQL-010** | `condition_grades` | `condition_grades_score_value_range_check` | `score_value` entre 0 y 100 | Prisma no soporta `CHECK` | `CHECK (score_value >= 0 AND score_value <= 100)` | BAJO |
| **SQL-011** | `purchases` | `purchases_amounts_non_negative_check` | Todos los `*_usd` no negativos | Prisma no soporta `CHECK` | `CHECK (... 7 columnas ... >= 0)` con `NULL` permitido | BAJO |
| **SQL-012** | `purchases` | `purchases_currency_uppercase_check` | `currency_code` en tres mayúsculas | Prisma no valida formato | `CHECK (currency_code = upper(currency_code) AND length(currency_code) = 3)` | BAJO |
| **SQL-013** | `purchases` | `purchases_currency_usd_phase_a_check` | Fase A sólo `USD` | Restricción de fase, no de diseño | `CHECK (currency_code = 'USD')` | BAJO (se retira al abrir Fase B) |
| **SQL-014** | `purchases` | `purchases_components_complete_check` | `status <> 'DRAFT'` exige los cinco componentes y `total_paid_usd` | Prisma no puede condicionar por estado | `CHECK (status = 'DRAFT' OR (purchase_price_usd IS NOT NULL AND ...))` | **ALTO** |
| **SQL-015** | `purchases` | `purchases_total_paid_sum_check` | `total_paid_usd` = suma exacta de los cinco componentes | Prisma no expresa aritmética entre columnas | `CHECK (total_paid_usd IS NULL OR total_paid_usd = purchase_price_usd + us_shipping_usd + us_sales_tax_usd + payment_fee_usd + other_cost_usd)` | **ALTO**: es la regla que hace auditable la compra |
| **SQL-016** | `purchases` | `purchases_paid_amount_matches_total_check` | En `PAID`, `paid_amount_usd = total_paid_usd` (P1) | Prisma no puede condicionar por estado | `CHECK (status <> 'PAID' OR (paid_amount_usd IS NOT NULL AND paid_amount_usd = total_paid_usd))` | **ALTO** |
| **SQL-017** | `purchases` | `purchases_reference_code_not_blank_check` | `reference_code` no vacío | Prisma no valida longitud | `CHECK (length(btrim(reference_code)) > 0)` | BAJO |
| **SQL-018** | `purchases` | `purchases_timeline_order_check` | `paid_at`, `delivered_at`, `cancelled_at` ≥ `ordered_at` | Prisma no compara columnas | `CHECK (paid_at IS NULL OR paid_at >= ordered_at) AND ...` | MEDIO |
| **SQL-019** | `purchases` | `purchases_terminal_state_coherence_check` | `DELIVERED` exige `delivered_at`; `CANCELLED` exige `cancelled_at` y motivo | Prisma no puede condicionar por estado | `CHECK (status <> 'DELIVERED' OR delivered_at IS NOT NULL) AND (status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL))` | MEDIO |
| **SQL-020** | `shipments` | `shipments_weight_source_values_check` | `weight_source` sólo `MEASURED` o `DECLARED` | Prisma no soporta `CHECK`; es texto y no enum a propósito | `CHECK (weight_source IS NULL OR weight_source IN ('MEASURED','DECLARED'))` | MEDIO |
| **SQL-021** | `shipments` | `shipments_actual_weight_positive_check` | `actual_weight_lb > 0` cuando estáinformado | Prisma no soporta `CHECK` | `CHECK (actual_weight_lb IS NULL OR actual_weight_lb > 0)` | MEDIO: un 0 aquí significa "pesado y cero", que no existe |
| **SQL-022** | `shipments` | `shipments_cost_non_negative_check` | `actual_cost_usd` no negativo | Prisma no soporta `CHECK` | `CHECK (actual_cost_usd IS NULL OR actual_cost_usd >= 0)` | BAJO |
| **SQL-023** | `shipments` | `shipments_timeline_order_check` | `delivered_at >= dispatched_at`; `estimated_delivery_at >= dispatched_at` | Prisma no compara columnas | `CHECK (...)` | BAJO |
| **SQL-024** | `shipments` | `shipments_tracking_requires_carrier_check` | `tracking_number` no nulo exige `carrier_name` no nulo | Prisma no puede condicionar columnas entre sí | `CHECK (tracking_number IS NULL OR carrier_name IS NOT NULL)` | BAJO |
| **SQL-025** | `shipping_quotes` | `shipping_quotes_weight_source_values_check` | `weight_source` sólo `MEASURED` o `DECLARED` (P7) | Prisma no soporta `CHECK` | `CHECK (weight_source IS NULL OR weight_source IN ('MEASURED','DECLARED'))` | MEDIO |
| **SQL-026** | `shipping_quotes` | `shipping_quotes_total_amount_sum_check` | `total_amount` = suma exacta de los componentes | Prisma no expresa aritmética entre columnas | `CHECK (total_amount = international_shipping + handling + coalesce(insurance,0) + ...)` | **ALTO**: sin esto la cotización no es auditable |
| **SQL-027** | `shipping_quotes` | `shipping_quotes_amounts_non_negative_check` | Componentes no negativos | Prisma no soporta `CHECK` | `CHECK (...)` | BAJO |
| **SQL-028** | `shipping_quotes` | `shipping_quotes_expiry_after_quote_check` | `expires_at > quoted_at` | Prisma no compara columnas | `CHECK (expires_at IS NULL OR expires_at > quoted_at)` | BAJO |
| **SQL-029** | `exchange_rates` | `exchange_rates_distinct_currencies_check` | `base_currency_code <> quote_currency_code` | Prisma no compara columnas | `CHECK (base_currency_code <> quote_currency_code)` | BAJO |
| **SQL-030** | `exchange_rates` | `exchange_rates_rate_positive_check` | `rate > 0` | Prisma no soporta `CHECK` | `CHECK (rate > 0)` | MEDIO |
| **SQL-031** | `purchase_events` | `purchase_events_payload_is_object_check` | `jsonb_typeof(payload) = 'object'` | Prisma no inspecciona el contenido de `Json` | `CHECK (jsonb_typeof(payload) = 'object')` | MEDIO |
| **SQL-032** | `supplier_offers` · `market_listings` | `<tabla>_expiry_after_observation_check` | `expires_at > observed_at` | Prisma no compara columnas | `CHECK (expires_at IS NULL OR expires_at > observed_at)` | BAJO |
| **SQL-033** | `opportunities` · `condition_grades` | `<tabla>_score_range_check` | `opportunity_score` entre 0 y 100 | Prisma no soporta `CHECK` | `CHECK (opportunity_score >= 0 AND opportunity_score <= 100)` | MEDIO |
| **SQL-034** | `opportunity_comparables` | `opportunity_comparables_exclusion_reason_check` | `included = false` exige `exclusion_reason` | Prisma no puede condicionar columnas entre sí | `CHECK (included OR exclusion_reason IS NOT NULL)` | MEDIO |

---

## 2. UNIQUE PARTIAL INDEXES

| ID | Tabla | Nombre PostgreSQL | Propósito | Por qué Prisma no lo expresa | SQL aproximado | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| **SQL-035** | `users` | `users_lower_email_key` | Unicidad de `lower(email)`, insensible a mayúsculas | Prisma no tiene índices por expresión | `CREATE UNIQUE INDEX ... ON users (lower(email))` | **ALTO**: es la unicidad real del login |
| **SQL-036** | `product_variants` | `product_variants_gtin_key` | Un solo `gtin` canónico por variante; `NULL` se repite | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON product_variants (gtin) WHERE gtin IS NOT NULL` | **ALTO**: sin esto, dos variantes afirmarían ser el mismo producto |
| **SQL-037** | `business_settings` | `business_settings_user_active_key` | Una sola versión activa por usuario | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON business_settings (user_id) WHERE is_active` | MEDIO |
| **SQL-038** | `sales_cost_profiles` | `sales_cost_profiles_channel_current_key` | Un solo perfil vigente por canal | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON sales_cost_profiles (sales_channel_id) WHERE valid_to IS NULL` | MEDIO |
| **SQL-039** | `supplier_offers` | `supplier_offers_supplier_external_id_key` | El mismo anuncio externo no se duplica por proveedor | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON supplier_offers (supplier_id, external_id) WHERE external_id IS NOT NULL` | MEDIO |
| **SQL-040** | `market_listings` | `market_listings_marketplace_external_id_key` | El mismo anuncio externo no se duplica por marketplace | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON market_listings (marketplace_id, external_id) WHERE external_id IS NOT NULL` | MEDIO |
| **SQL-041** | `purchases` | `purchases_live_supplier_offer_key` | **Una compra viva por oferta**: máximo una compra no cancelada por oferta | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON purchases (supplier_offer_id) WHERE status <> 'CANCELLED'` | **ALTO**: es la regla que evita registrar dos veces la misma unidad |
| **SQL-042** | `shipments` | `shipments_carrier_tracking_key` | Un seguimiento no pertenece a dos envíos | Prisma no admite unicidad parcial | `CREATE UNIQUE INDEX ... ON shipments (carrier_name, tracking_number) WHERE tracking_number IS NOT NULL` | MEDIO |
| **SQL-043** | `users` | `users_auth_subject_key` | Unicidad del sujeto de autenticación cuando existe | Ya declarado como `@unique` en Prisma **sólo si** se prefiere; se mantiene aquí como unicidad condicional coherente con el resto | `CREATE UNIQUE INDEX ... ON users (auth_subject) WHERE auth_subject IS NOT NULL` | BAJO |

---

## 3. PARTIAL INDEXES

| ID | Tabla | Nombre PostgreSQL | Propósito | Por qué Prisma no lo expresa | SQL aproximado | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| **SQL-044** | `purchases` | `purchases_live_queue_idx` | Cola de compras vivas por fecha estimada de entrega | Prisma no admite `WHERE` en índices | `CREATE INDEX ... ON purchases (status, estimated_delivery_at, id) WHERE status IN ('CONFIRMED','PAID','IN_TRANSIT')` | MEDIO |
| **SQL-045** | `purchases` | `purchases_opportunity_link_idx` | Compras que justifican una oportunidad concreta | Prisma no admite índices parciales | `CREATE INDEX ... ON purchases (opportunity_id) WHERE opportunity_id IS NOT NULL` | BAJO |
| **SQL-046** | `purchase_events` | `purchase_events_system_audit_idx` | Auditoría de eventos automáticos por código y fecha | Prisma no admite índices parciales | `CREATE INDEX ... ON purchase_events (event_code, occurred_at DESC) WHERE source = 'SYSTEM'` | MEDIO |
| **SQL-047** | `opportunities` | `opportunities_active_dashboard_idx` | Dashboard: señales activas ordenadas por score | Prisma no admite índices parciales | `CREATE INDEX ... ON opportunities (opportunity_score DESC, analyzed_at DESC, id DESC) WHERE status = 'ACTIVE'` | MEDIO |
| **SQL-048** | `opportunities` | `opportunities_active_signal_idx` | Filtro por señal sobre oportunidades activas | Prisma no admite índices parciales | `CREATE INDEX ... ON opportunities (signal, opportunity_score DESC, id DESC) WHERE status = 'ACTIVE'` | MEDIO |
| **SQL-049** | `product_variant_external_identifiers` | `pvei_pending_review_idx` | Identificadores observados que esperan promoción o descarte | Prisma no admite índices parciales | `CREATE INDEX ... ON pvei (identifier_type, observed_at DESC, id DESC) WHERE promotion_status = 'OBSERVED'` | BAJO |

---

## 4. EXPRESSION INDEXES

| ID | Tabla | Nombre PostgreSQL | Propósito | Por qué Prisma no lo expresa | SQL aproximado | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| **SQL-050** | `users` | `users_email_lookup_idx` | Búsqueda de usuario por correo sin aplicar `lower()` dos veces | Prisma no tiene índices por expresión | `CREATE INDEX ... ON users (lower(email))` | BAJO |

---

## 5. PERMISSION / APPEND-ONLY RULES

| ID | Tabla | Nombre PostgreSQL | Propósito | Por qué Prisma no lo expresa | SQL aproximado | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| **SQL-051** | `purchase_events` | `purchase_events_append_only` | Revocar `UPDATE` y `DELETE` al rol de la aplicación | Prisma no gestiona privilegios | `REVOKE UPDATE, DELETE ON purchase_events FROM <app_role>` | **ALTO si se emite con un nombre de rol equivocado**: ver §5.1 |

### 5.1 Qué protege realmente el `REVOKE`, y qué no

`REVOKE UPDATE, DELETE ON purchase_events FROM app_role` **sí** impide que el rol
de la aplicación borre o reescriba el histórico **usando ese rol**.

**No** protege contra:

| Vector | Por qué el `REVOKE` no alcanza |
| --- | --- |
| El **propietario de la tabla** | El dueño siempre puede `UPDATE` y `DELETE` sobre lo suyo, sin `REVOKE` que lo detenga. Un `REVOKE` contra el propietario es un no-op. |
| El **rol de migraciones** | Si es el propietario (lo habitual con objetos creados por Prisma), puede saltarse el `REVOKE` por completo. |
| `service_role` de Supabase | Tiene permisos de servidor y no queda sujeto a los privilegios de la sesión de aplicación. |
| SQL remoto o `psql` con otro rol | Cualquier rol con `OWNER` o `SUPERUSER` escribe donde quiera. |
| `INSERT` fraudulento | El `REVOKE` no impide insertar eventos falsos: no restringe el `INSERT`. |

Es decir: `REVOKE` es una **barrera de intención y un detector de errores**, no un
mecanismo de *append-only*.

Qué haría falta si en el futuro se exige append-only real (nada de esto se
implementa ahora, por decisión explícita):

| Opción | Qué resuelve | Coste |
| --- | --- | --- |
| `REVOKE` al rol de aplicación | Errores y negligencia desde el backend | Bajo; deja vías abiertas |
| **Trigger** `BEFORE UPDATE OR DELETE` que lance excepción | Cerrado incluso para el propietario; el `REVOKE` se vuelve redundante | Medio: bloquea cualquier corrección legítira, que es justamente la razón por la que las correcciones se registran como evento nuevo |
| **RLS** con políticas por rol | El motor de PostgreSQL aplica la regla, no la aplicación | Alto: mezcla autorización con integridad y complica las migraciones |
| **Restricción en la capa de servicio** | Ninguna por sí sola: se puede saltar con un cliente directo | Bajo |

**Recomendación, para una etapa posterior y no ahora:** `REVOKE` como primera
barrera + `trigger` como cierre real, cuando exista un segundo consumidor de la
base de datos. Con un solo backend, la barrera honesta es la capa de servicio más
el `REVOKE`; el *trigger* es la defensa que se activa cuando el `REVOKE` deja de
ser suficiente.

---

## 6. OTHER

| ID | Tipo | Propósito | Por qué Prisma no lo expresa | Riesgo |
| --- | --- | --- | --- | --- |
| **SQL-052** | Comprobación | Detector de FK sin índice | Prisma no conoce los índices que una migración anterior dejó sin cubrir | MEDIO |
| **SQL-053** | Comprobación | `prisma migrate diff` vacío para confirmar que la migración es **aditiva** | Prisma no valida la intención de la migración | **ALTO**: es la comprobación que garantiza que no se altera una tabla existente |

---

## 7. Objetos que NO están en esta lista

- **No hay índices GIN ni de tipo funcional.** No existe consulta con plan que
  los justifique; se revisan cuando exista una consulta real sobre `payload` o
  sobre los `jsonb` de snapshot.
- **No hay reglas de Trigger.** Se aaden cuando se decida cerrar el *append-only*
  de `purchase_events` (ver §5.1).
- **No hay políticas RLS.** Se documenta la clasificación en
  [supabase-rls-classification.md](./supabase-rls-classification.md) y se aplican
  sólo cuando se conecte Supabase.
- **No hay unicidad por expresión sobre `lower(email)` en Prisma**: por diseño
  vive como `SQL-035`.
- **No hay columnas calculadas.** Todo se calcula en la aplicación y se persiste
  sólo cuando es evidencia.

---

## 8. Totales

| Categoría | Objetos |
| --- | --- |
| CHECK CONSTRAINTS | 34 (`SQL-001` … `SQL-034`) |
| UNIQUE PARTIAL INDEXES | 9 (`SQL-035` … `SQL-043`) |
| PARTIAL INDEXES | 6 (`SQL-044` … `SQL-049`) |
| EXPRESSION INDEXES | 1 (`SQL-050`) |
| PERMISSION / APPEND-ONLY RULES | 1 (`SQL-051`) |
| OTHER | 2 (`SQL-052`, `SQL-053`) |

**TOTAL MANUAL SQL OBJECTS = 53**

Conteo por naturaleza: 34 son *restricciones de integridad* (`CHECK`) y 19 son
*índices, permisos o comprobaciones*. De los 53, 16 llevan riesgo **ALTO** y deben
revisarse uno por uno contra la migración antes de aplicar en desarrollo.
