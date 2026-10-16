# markets — capa de conectores de mercados

**Estado:** implementado (MVP manual + esqueletos)

Convierte observaciones de mercados de EE. UU. en un único objeto interno,
`ProductOffer`, para que el Opportunity Engine nunca sepa de dónde salió el
precio.

```
ManualConnector  EbayConnector  BestBuyConnector  WalmartConnector  (futuros)
        │               │              │                │
        └───────────────┴──────┬───────┴────────────────┘
                               ▼
                   normalización (domain/normalization.ts)
                               ▼
                        ProductOffer
                               ▼
                    Opportunity Engine (otro módulo)
```

Reglas heredadas de la arquitectura:

- El dominio no importa React, Next.js, Prisma ni SDKs externos (ADR-0001).
- Todo importe y toda tasa es `Decimal`; nada monetario usa `number` (ADR-0002).
- Ningún conector escribe en tablas ni devuelve modelos del proveedor.
- **No se implementa un conector sin API, feed o permiso confirmado**
  (`docs/architecture/overview.md`).
- Lo desconocido es `UNKNOWN`, nunca un valor supuesto ni un cero silencioso.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `domain/product-offer.ts` | `ProductOffer` normalizado, vocabularios canónicos y helpers derivados |
| `domain/market-connector.ts` | Puerto `MarketConnector`, `ConnectorQuery`, capacidades, filtros compartidos y errores de dominio |
| `domain/normalization.ts` | Normalización de condición, operador, almacenamiento, variante, carrier y SIM |
| `connectors/manual-connector.ts` | Conector funcional del MVP (entrada manual + CSV futuro) |
| `connectors/connector-contract.ts` | Suite de contrato común reutilizable por cualquier conector |
| `connectors/sample-offers.ts` | Datos de ejemplo **ficticios** para desarrollo y pruebas |
| `connectors/ebay-connector.ts` | Esqueleto eBay (Browse API) — sin llamadas reales |
| `connectors/best-buy-connector.ts` | Esqueleto Best Buy (Products + Open Box) — sin llamadas reales |
| `connectors/walmart-connector.ts` | Esqueleto Walmart (Item Search) — sin llamadas reales |
| `validation/product-offer-schema.ts` | Esquema Zod del contrato de frontera |
| `application/market-offer-adapter.ts` | Traduce `ProductOffer` de mercados al contrato del Opportunity Engine |

El dominio no importa adaptadores ni frameworks de prueba: `domain/` no conoce
`vitest` ni los conectores. La suite de contrato vive en `connectors/` porque se
ejecuta contra adaptadores.

## `ProductOffer`

```ts
{
  id, marketplace, externalId?,          // identidad de la observación
  seller: { name, ratingRate?, ... },    // operador normalizado
  model, variant, variantKey, storageGb,
  condition, batteryHealthRate?,
  carrier?: { name, lockState }, simFormat,
  priceUSD, shippingUSD, salesTaxUSD,    // Decimal
  url, imageUrl?, warrantyDays?,
  observedAt, fetchedAt?, notes?
}
```

`id` es `<marketplace>:<referencia>`, estable y suficiente para deduplicar.
Dinero y tasas viajan como `string` en los bordes JSON y se convierten a
`Decimal` al entrar al dominio (`toWireOffer` / `productOfferSchema`).

`offerCashOutflowUsd` devuelve la **suma exacta** de precio + envío + impuesto.
Este módulo no redondea: el redondeo es una decisión de `finance`, que aplica su
política nombrada en sus fronteras. Este módulo no conoce fórmulas financieras.

### Vocabularios canónicos

- **Condición:** `NEW`, `SEALED`, `OPEN_BOX`, `LIKE_NEW`, `EXCELLENT`, `GOOD`,
  `FAIR`, `USED`, `FOR_PARTS`, `UNKNOWN`.
- **Almacenamiento:** `32 | 64 | 128 | 256 | 512 | 1024` GB. `1TB` → `1024`.
- **Carrier:** `UNLOCKED`, `CARRIER_LOCKED`, `FINANCE_LOCKED`,
  `PARTIALLY_LOCKED`, `UNKNOWN`.
- **SIM:** `PHYSICAL`, `ESIM`, `HYBRID`, `UNKNOWN`.

## Normalización

| Entrada del mercado | Función | Regla |
| --- | --- | --- |
| `New`, `Sealed`, `Open Box` | `normalizeCondition` | Tabla de tokens exactos por vocabulario de cada mercado |
| `Used - Excellent`, `Very Good Renewed`, `For parts or not working` | `normalizeCondition` | Patrones ordenados; gana el más específico |
| `estado no informado` | `normalizeCondition` | **`UNKNOWN`**, nunca `GOOD` |
| `98.5%`, `0.985` | `normalizeSeller` | Siempre fracción en `[0, 1]`; fuera de rango se **rechaza**, no se recorta |
| Vendedor vacío, reseñas `-1` | `normalizeSeller` | `TypeError` / `RangeError` explícitos |
| `128GB`, `256 gb`, `1TB`, `1 terabyte`, `128` | `normalizeStorageGb` | Primer número que mapea a una capacidad real (`iPhone 15 Pro 128GB` → 128, no 15) |
| `iPhone 15 Pro` + 128 GB | `buildVariantKey` | `ebay:iphone-15-pro-128` (agrupa por mercado) |
| dos mercados, mismo equipo | `buildComparableGroupKey` | `iphone-15-pro-128` (agrupa para comparar) |
| `Factory unlocked`, `Financed / locked` | `normalizeCarrierLockState` | `UNLOCKED` se evalúa antes que `LOCK` |
| `eSIM`, `Dual SIM` | `normalizeSimFormat` | Una frase de bloqueo **no** es formato SIM: queda `UNKNOWN` |

Una oferta con `UNKNOWN` en condición, SIM o bloqueo —o sin perfil de operador—
se puede guardar y mostrar, pero `isOfferIncomplete` / `offerGaps` la marcan y el
motor no debe auto-comprar con ella.

Envío e impuesto son **obligatorios** en la entrada manual: el operador escribe la
cifra real, incluido `0`. Dejarlos vacíos se trataría como "envío gratis", que es
exactamente el supuesto favorable que este módulo no se permite.

## Variables de entorno

Los conectores **nunca** leen `process.env`: reciben un `ConnectorEnv` inyectado,
lo que mantiene los secretos fuera de logs, trazas y pruebas.

| Conector | Variables requeridas (nombres, sin valores) |
| --- | --- |
| `manual` | ninguna |
| `ebay` | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_ENVIRONMENT` |
| `best-buy` | `BEST_BUY_API_KEY` |
| `walmart` | `WALMART_CLIENT_ID`, `WALMART_CLIENT_SECRET` |
| `back-market` | `BACK_MARKET_API_KEY`, `BACK_MARKET_API_SECRET` |
| `amazon` | `AMAZON_SP_API_CLIENT_ID`, `AMAZON_SP_API_CLIENT_SECRET` |

Reglas:

1. Los valores viven **solo** en el entorno o en un almacén de secretos; nunca
   en el repositorio. `.env.example` todavía **no** incluye marcadores para estas
   variables: añadirlos es un cambio compartido y requiere aviso previo.
2. `describeSettings(env)` informa `configured` y la **lista de nombres de
   variables faltantes**, nunca sus valores.
3. Un conector sin configuración lanza `ConnectorConfigurationError`; no devuelve
   listas vacías, porque "no configurado" no es "no hay ofertas".
4. Ningún conector lee `process.env`, escribe logs con secretos ni los incluye en
   el mensaje de error.

## Cómo agregar un conector nuevo

1. **Confirma la fuente.** API oficial, feed autorizado o permiso escrito. Sin
   eso no se escribe el conector; se documenta la intención.
2. **Añade el `marketplace`** a `MARKETPLACES` y el `key` a `CONNECTOR_KEYS` y
   a `CONNECTOR_ENV_VARS`.
3. **Crea `connectors/<nombre>-connector.ts`** implementando `MarketConnector`:
   - `describeSettings(env)` sin I/O.
   - `search(query, env)`: autenticar, paginar, y **normalizar cada elemento**
     con `domain/normalization.ts`. Reutiliza `applyQueryFilters` y
     `buildConnectorPage` para que los filtros y el cursor se comporten igual que
     en el resto de conectores. Nunca devolver el modelo del proveedor.
   - `fetchOffer(id, env)`: `undefined` si la oferta ya no existe.
   - `requestedAt` es la única fuente de tiempo; no leas el reloj.
4. **Valida en la frontera** con `productOfferSchema` antes de construir el
   `ProductOffer`; lanza `OfferNormalizationError` con la causa adjunta.
5. **Prueba con el contrato común** de `connectors/connector-contract.ts`:

   ```ts
   it("cumple el contrato común", async () => {
     await expectConnectorContract(new MiConnector(), envWithSanitizedFixture);
     await expectConnectorIsDeterministic(new MiConnector(), envWithSanitizedFixture);
   });
   ```

   Usa una respuesta grabada y saneada: la prueba no debe salir a la red. La
   suite exige un `search` funcional, así que un esqueleto todavía no la pasa;
   los esqueletos se prueban aparte (`api-connector-scaffolds.test.ts`).
6. **Registra el conector** en `connectors/index.ts` y documenta aquí su fuente,
   su plan de acceso y sus limitaciones (p. ej. `openBoxInventory: false`).
7. **Checklist antes de dar por terminado un conector**
   - [ ] No escribe en tablas ni devuelve DTOs del proveedor
   - [ ] No inventa importes, tasas ni condiciones
   - [ ] No registra secretos ni los incluye en errores
   - [ ] Determinista para la misma entrada (`requestedAt` inyectado)
   - [ ] `fetchOffer` de un id inexistente devuelve `undefined`
   - [ ] Una oferta sin condición, SIM o bloqueo queda marcada, no completada
   - [ ] Un conector nuevo no requiere cambios en el adaptador ni en el motor
   - [ ] Este README documenta la fuente y el plan de acceso del conector
   - [ ] Los tests pasan sin red

Un conector vacío se representa con `ConnectorNotImplementedError`, nunca con un
resultado vacío: un esqueleto nunca debe parecer "este mercado no tiene ofertas".

## Adaptador hacia el Opportunity Engine

`application/market-offer-adapter.ts` es el **único punto de integración** entre
`markets` y `opportunities`. Es una traducción, nunca un enriquecimiento: todo
lo que el motor exige y un mercado no puede reportar entra desde el llamador como
dato aprobado; si falta, la oferta queda `NOT_EVALUABLE`.

```ts
const conversions = toOpportunityOffers(page.offers, policy, resolveVariant);
const summary = summarizeConversions(conversions);
```

### Datos que el adaptador necesita antes de ejecutar el motor

| Dato | De dónde sale | Si falta |
| --- | --- | --- |
| `productVariantId`, `supplierId` | `VariantResolver` sobre un snapshot de catálogo aprobado (`buildCatalogResolver`) | `CATALOG_VARIANT_NOT_FOUND`; no se inventan ids |
| `paymentFeeUSD` | Configuración de medios de pago | `PAYMENT_FEE_UNKNOWN`; **nunca** `0` por omisión |
| `otherPurchaseCostsUSD` | Configuración (p. ej. autenticación) | `[]` con nota `OTHER_COSTS_UNKNOWN`: ausencia es "desconocido", no "cero" |
| `offerExpiresAt` | Fuente que lo reporte (oferta con vencimiento) | `EXPIRY_UNKNOWN`; la oferta no se trata como vencida |
| `requireUnlockedCarrier` | Política del negocio | **Activo salvo que se fije en `false`** explícitamente |
| `observedAt` | Instante de observación de la oferta | `OBSERVATION_INSTANT_INVALID` |

Además, fuera del adaptador, el motor necesita su propia entrada habitual: tipo
de cambio, cotizaciones de envío, comparables de mercado, settings versionadas,
capital disponible y `evaluatedAt`. Eso no lo resuelve este adaptador.

`assertValidConversionPolicy(policy)` valida la política una vez antes de
convertir un lote y falla de inmediato si un dato configurado es inválido
(comisión negativa o no finita, costo adicional negativo, código de costo que
reutiliza `PURCHASE_PRICE`/`US_SHIPPING`/`US_SALES_TAX`/`PAYMENT_FEE`, o un
`offerExpiresAt` mal formado). Un error de política no es un problema de una
oferta individual, así que aborta antes de procesar nada en lugar de dejar un
resultado a medias.

**Acoplamiento a tener en cuenta:** los comparables que consume el motor deben
usar el mismo `productVariantId` y el mismo vocabulario `ConditionCode` que
produce este adaptador, es decir, deben venir del mismo snapshot de catálogo. Si
el catálogo cambia entre la captura y el análisis, el motor no encontrará
comparables y lo reportará como `NO_MARKET_COMPARABLES`.

### Mapeo de condición (explícito y conservador)

| Mercados | Motor | Nota |
| --- | --- | --- |
| `NEW` | `NEW` | |
| `SEALED` | `SEALED` | |
| `OPEN_BOX` | `OPEN_BOX` | |
| `LIKE_NEW` | `PREMIUM` | única aproximación; se reporta `CONDITION_APPROXIMATED` |
| `EXCELLENT` | `EXCELLENT` | |
| `GOOD` | `GOOD` | |
| `FAIR` | `FAIR` | |
| `USED` | `USED` | |
| `FOR_PARTS` | — | `NOT_EVALUABLE` (`CONDITION_FOR_PARTS`) |
| `UNKNOWN` | — | `NOT_EVALUABLE` (`CONDITION_UNKNOWN`) |

El motor compara los listados de mercado por **igualdad exacta de condición**
(`opportunity-engine.ts:202`) y usa la condición en el score, así que un mapeo
aproximado mezclaría grados silenciosamente. Por eso la única aproximación
posible es `LIKE_NEW → PREMIUM` y queda registrada en las notas.

### Lo que el contrato del motor no puede expresar

El contrato `opportunities.ProductOffer` no tiene campos para operador, SIM,
variante, almacenamiento, imagen ni notas. La consecuencia práctica:

- El **bloqueo** no se propaga: el adaptador lo verifica y bloquea la oferta si
  es desconocido o distinto de `UNLOCKED` (o `requireUnlockedCarrier: false`).
- `carrier`, `simFormat`, `storageGb`, `variant`, `marketplace`, `imageUrl`,
  identidad del vendedor y `notes` se descartan y quedan listados en la nota
  `SOURCE_DETAIL_DROPPED`.
- `externalId` tampoco existe: la identidad del motor es el `id` canónico
  `<marketplace>:<referencia>`.

### Notas de conversión

Una conversión trae `notes` con todo dato que el contrato del motor no puede
llevar, para que nada desaparezca en silencio: `CONDITION_APPROXIMATED`,
`BATTERY_HEALTH_UNKNOWN`, `SELLER_RATING_UNKNOWN`, `SELLER_REVIEWS_UNKNOWN`,
`WARRANTY_UNKNOWN`, `EXPIRY_UNKNOWN`, `OTHER_COSTS_UNKNOWN`,
`OTHER_COSTS_INCLUDED`, `CARRIER_NOT_REPRESENTED`, `SIM_FORMAT_NOT_REPRESENTED`
y `SOURCE_DETAIL_DROPPED`. Una oferta rechazada también las conserva.

`summarizeConversions` agrega un lote por código de bloqueo, para que el radar
informe por qué se descartó cada oferta sin recorrerlas.

## Relación con el módulo `opportunities`

`opportunities` define su propio `ProductOffer`. El adaptador lo importa **solo
como tipo** (`import type`), de modo que el motor no acquires ningún
conocimiento en tiempo de ejecución sobre fuentes de mercado, y `opportunities`
no importa nada de `markets`. La dependencia va en un solo sentido y en una sola
capa.

## Comandos

```bash
npx vitest run src/modules/markets
npx tsc --noEmit
npx eslint src/modules/markets
```

## Orden de integración previsto

1. Manual (este módulo, operativo).
2. eBay Browse API — búsqueda por keyword/GTIN y notificaciones de cambio.
3. Best Buy Products + Open Box — inventario reconditionado con condición.
4. Walmart Item Search — sujeto a onboarding en el ecosistema Marketplace.
5. Back Market y Amazon — solo con acceso autorizado; mientras tanto, manual o CSV.

Amazon y Back Market **no** se implementan ahora: el mismo esqueleto del punto 2
los cubre cuando exista acceso confirmado.