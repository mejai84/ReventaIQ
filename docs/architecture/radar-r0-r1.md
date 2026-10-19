# Radar R0/R1 — dominio preparado

## Alcance
Esta fase no crea migraciones ni toca Supabase. El dominio `src/modules/radar` modela perfiles, targets de catálogo, fuentes, listings y observaciones; su adaptador de persistencia se implementará sólo después de aprobar el SQL.

## Decisiones
- `ProductVariant` es canónico y nunca contiene marketplace. `buildVariantKey` conserva compatibilidad de entrada pero ignora marketplace.
- Un `Listing` es la identidad estable por fuente + external id, con URL canónica como fallback. `ListingObservation` es inmutable y sólo se agrega cuando cambia el fingerprint efectivo.
- El payload crudo saneado puede quedar asociado a una observación con retención definida; no se crea `RawObservation` independiente en R1.
- GTIN/UPC/EAN/MPN siguen siendo identificadores de producto en `ProductVariantExternalIdentifier`; IDs de publicación pertenecen a Listing.
- Atributos de teléfono se representan en `attributes` observados. PS5 no requiere atributos de teléfono.
- MANUAL y CSV son los únicos source modes funcionales previstos ahora; no se realizan fetches externos.

## Flujo
`Manual/CSV → ScanRun (persistencia futura) → Listing → ListingObservation → normalización/match → ProductVariant → Opportunity Engine → Opportunity`.

## Persistencia futura
La futura migración deberá introducir ScanProfile, ScanProfileTarget, ScanRun, ScanSourceRun, Listing y ListingObservation con unicidad para `(source, external_listing_id)` cuando exista e idempotency key por import/run. No se debe modificar una migración existente hasta saber si ya fue aplicada.

## SQL manual
SQL-001 no puede usar un CHECK con subconsulta a `attribute_definitions`: PostgreSQL exige que un CHECK sólo dependa de la fila. La coherencia entre tipo de definición y columna de valor deberá validarse mediante trigger revisado o validación transaccional de aplicación; los checks locales de “exactamente una columna” sí son válidos.
