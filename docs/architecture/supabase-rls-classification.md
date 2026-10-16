# Clasificación RLS para la conexión con Supabase

**Estado:** documento de planificación. **No se crea ninguna política RLS.**
**Fecha:** 2026-10-16
**Ámbito:** decidir qué exigirá políticas cuando ReventaIQ se conecte a Supabase.

> **Nada de esto está aplicado.** No hay `ENABLE ROW LEVEL SECURITY`, no hay
> `CREATE POLICY`, no se ha conectado ninguna base de datos y Supabase no ha sido
> modificado. El esquema se genera con Prisma, no con Supabase, y hoy el único
> consumidor es el backend.

---

## 1. Por qué hace falta una clasificación

Activar RLS sin decidir quién lee qué deja dos riesgos simétricos:政策 demasiado
abiertas que no aportan nada, o políticas demasiado cerradas que rompen el backend
sin avisar. La clasificación fija la **intención** antes de escribir una sola línea
de SQL.

Principio rector: **el backend es el único consumidor**. RLS no se usa aquí como
mecanismo de autorización de negocio, sino como red de contención para el día en que
exista un cliente que hable con la base de datos sin pasar por el servidor.

---

## 2. USER-OWNED

Filas que pertenecen a un operador y que nunca deben ser visibles para otro.

| Tabla | `user_id` | Lectura | Escritura | Nota |
| --- | --- | --- | --- | --- |
| `users` | la propia fila | `auth.uid() = id` | servicio | La política de `users` es sensible: una política que compare `id` con el sujeto de autenticación sólo puede escribirse cuando exista el proveedor de autenticación. |
| `business_settings` | `user_id` | `auth.uid() = user_id` | `auth.uid() = user_id AND is_active = false` al insertar versión nueva | Actualizar no: cada versión es inmutable. La corrección es una fila nueva. |
| `condition_grades` | `user_id` | `auth.uid() = user_id` | `auth.uid() = user_id` | Escala por usuario y categoría. |
| `supplier_offers` | `created_by_user_id` | `auth.uid() = created_by_user_id` | servicio | El conector escribe con rol de servicio, no con el del usuario. |
| `market_listings` | `created_by_user_id` | `auth.uid() = created_by_user_id` | servicio | Igual que ofertas. |
| `shipping_quotes` | `created_by_user_id` | `auth.uid() = created_by_user_id` | servicio | |
| `purchases` | `created_by_user_id` | `auth.uid() = created_by_user_id` | `auth.uid() = created_by_user_id AND status = 'DRAFT'` | Las compras confirmadas se vuelven evidencia: pasan a lectura y bloquean edición directa. |
| `purchase_events` | `created_by_user_id`, `NULL` si es del sistema | `purchase.created_by_user_id = auth.uid()` | **ninguna** | Append-only. La política de escritura debe permitir sólo `INSERT`; `UPDATE` y `DELETE` se niegan aquí además del `REVOKE`. |

## 3. REFERENCE DATA

Catálogos administrables. Son de sólo lectura para todos y sólo escritura por
servicio. No son datos de usuario y no deben filtrarse por `auth.uid()`.

| Tabla | Lectura | Escritura |
| --- | --- | --- |
| `product_categories` | todos | servicio |
| `brands` | todos | servicio |
| `products` | todos | servicio |
| `product_variants` | todos | servicio |
| `attribute_definitions` | todos | servicio |
| `product_variant_attribute_values` | todos | servicio |
| `condition_grades` | ver §2 (tiene dueño) | servicio |
| `suppliers` · `marketplaces` · `shipping_providers` · `sales_channels` | todos | servicio |
| `product_variant_external_identifiers` | todos | servicio |

**Decisión a confirmar antes de aplicar:** si el proyecto es multiusuario real,
`products`, `product_variants` y los catálogos dejan de ser de lectura global y
pasan a ser de lectura por `users.id`. La lista anterior asume un único operador,
que es el estado actual del producto. **Esta decisión está abierta y no debe
resolverse escribiendo políticas.**

## 4. SYSTEM DATA

Datos que produce o posee el sistema, no el usuario. Sólo lectura para la
aplicación; ninguna escritura desde cliente.

| Tabla | Lectura | Escritura | Nota |
| --- | --- | --- | --- |
| `exchange_rates` | todos | servicio | El spread aplicado pertenece a `business_settings`, no aquí. |
| `sales_cost_profiles` | todos | servicio | Versiones inmutables; la vigente se elige por `valid_to IS NULL`. |
| `opportunities` | **revisar** | servicio | En un proyecto de un solo operador es lectura global. Con varios, `opportunities` se filtra por el `user_id` de la oferta que se analizó, no por un `user_id` propio: **no tiene columna de usuario** y habría que decidir si se expone. |
| `opportunity_comparables` | según `opportunity` | servicio | Evidencia; se lee con su oportunidad. |

**Riesgo señalado:** `opportunities` no tiene `user_id`. Es la tabla con más
decisión pendiente y la razón por la que no conviene activar RLS antes de resolver
la pregunta de multiusuario.

## 5. AUDIT DATA

Histórico inmutable. Una vez escrito, nadie lo modifica.

| Tabla | Lectura | Escritura | Nota |
| --- | --- | --- | --- |
| `purchase_events` | según compra | `INSERT` únicamente | `REVOKE UPDATE, DELETE` (SQL-051) más política que niegue `UPDATE` y `DELETE`. Ver el análisis de *append-only* en [prisma-manual-sql-catalog.md](./prisma-manual-sql-catalog.md) §5.1. |
| `purchase_events` de `source = 'SYSTEM'` | servicio | servicio | Ningún cliente los produce. |
| `opportunities` (filas `EXPIRED`, `DISMISSED`, `PURCHASED`) | servicio | ninguna | Un análisis terminado no se reescribe. |

## 6. Tablas que no existe(n) política porque todavía no existe

`inventory_items` con IMEI, `sales`, `expenses`, `capital_transactions`,
`watchlists`, `price_snapshots` y `alerts` están diferidas. **El IMEI es el caso
más delicado**: cuando exista, exigirá cifrado en columna, enmascarado en
lectura y una política que jamás devuelva el valor completo. No se adelanta aquí
ninguna política para tablas que no existen.

---

## 7. Orden de trabajo cuando se conecte Supabase

1. Resolver la pregunta de multiusuario. Todo lo anterior depende de ella.
2. Decidir el proveedor de autenticación, para poder escribir la política de `users`.
3. Migrar el backend al rol restringido en vez de al propietario de las tablas.
4. Activar RLS tabla por tabla, empezando por `purchase_events` y `purchases`.
5. Verificar que el backend sigue funcionando con el rol de aplicación.
6. Sólo entonces considerar `service_role` y cualquier cliente directo.

**Ningún paso de esta lista se ejecuta ahora.**
