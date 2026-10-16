# ADR-0005: Catálogo multiproducto y atributos tipados

**Estado:** aceptado  
**Fecha:** 2026-10-16

## Decisión

ReventaIQ deja de tener un catálogo centrado en iPhone. Su núcleo mantiene un único
motor de oportunidades y usa el catálogo administrable `ProductCategory → Brand →
Product → ProductVariant`. Las categorías y marcas son filas, no enums, para admitir
nuevas líneas de producto sin migraciones.

Los atributos consultables se modelan mediante `AttributeDefinition`, opciones
controladas y `ProductVariantAttributeValue` con columnas tipadas. Una constraint SQL
posterior garantizará que sólo se complete la columna compatible con el tipo del
atributo. JSON queda reservado para datos externos, snapshots y auditoría.

Los atributos de catálogo describen configuraciones vendibles (por ejemplo, edición y
capacidad de una consola). Los atributos de una oferta o unidad (batería, bloqueo,
estado observado) permanecen en la oferta; identificadores sensibles pertenecen al
inventario futuro, no al catálogo ni a Purchase.

## Identificadores comerciales (M6, ampliado 2026-10-16)

`ProductVariant` admite identificadores comerciales **opcionales** para matching,
búsqueda, normalización y comparación entre marketplaces:

- `gtin`: identificador canónico, sólo dígitos. Es el único que se almacena de la
  familia GS1.
- `manufacturer_part_number`: espacio de nombres distinto del GTIN, por eso tiene
  columna propia.
- `upc` y `ean`: **no son columnas**. UPC-12, EAN-13 y EAN-8 son GTIN de la misma
  familia y se derivan de `gtin` por longitud. Tres columnas admitirían
  identificadores contradictorios sin regla de desempate, que es exactamente lo que
  este ADR evita.
- `gtin = NULL` es un estado legítimo y frecuente: la mayoría de los *listings*
  usados y reacondicionados no publicarían un identificador fiable. Ningún flujo
  puede exigir `gtin`.
- Ninguno de estos campos es la clave primaria interna. La PK sigue siendo `id`.

Un identificador descubierto en una fuente externa (eBay, Best Buy, Walmart) **no**
se escribe en el catálogo. Se registra como observación en
`ProductVariantExternalIdentifier`, con su valor crudo, su fuente, su tipo y su
estado. La promoción a `product_variant_id` es un acto explícito y revisable. Ninguna
fuente externa modifica en silencio la identidad canónica de un producto.

Precedencia de matching prevista, sin motor implementado:

1. GTIN/UPC/EAN exacto
2. MPN + Brand
3. `ProductVariant` conocido
4. atributos comparables
5. título normalizado
6. revisión manual cuando la confianza sea insuficiente

## Consecuencias

- iPhone pasa a ser una especialización de `SMARTPHONE`; PS5 valida el segundo caso.
- `Purchase` sigue referenciando sólo `ProductVariant` y permanece genérica.
- Peso y dimensiones de producto/paquete quedan preparados para logística futura.
- Los comparables se podrán determinar por una huella auditable de categoría, variante
  y atributos marcados como comparables.

## Alternativas descartadas

- Tablas/engines separados por categoría: duplican el motor financiero.
- Decenas de columnas anulables: no escalan entre categorías.
- Un JSON libre para atributos filtrables: impide validación e índices selectivos.
