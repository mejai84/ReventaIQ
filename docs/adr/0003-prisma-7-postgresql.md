# ADR-0003: PostgreSQL con Prisma ORM 7

**Estado:** propuesto  
**Fecha:** 2026-10-16

## Contexto

El proyecto necesita integridad relacional, transacciones, precisión decimal, consultas tipadas y una ruta de migración mantenible dentro de Next.js. También requiere funciones de PostgreSQL —checks e índices parciales— que no siempre se expresan por completo en el DSL del ORM.

## Decisión

Usar PostgreSQL como fuente de verdad y fijar Prisma ORM en la major 7 mediante lockfile. Prisma queda confinado a adaptadores de infraestructura; ni el dominio ni la UI reciben modelos generados.

- El esquema lógico se mapea a nombres físicos `snake_case`.
- El cliente se genera en una ruta explícita y se importa sólo desde infraestructura.
- Se usará el adaptador PostgreSQL soportado por la versión fijada y una estrategia de pool compatible con el entorno de despliegue.
- La aplicación y las migraciones pueden usar conexiones/credenciales distintas.
- Los tipos Prisma Decimal se convierten en la frontera hacia los tipos Decimal del dominio.
- Checks, identity e índices parciales se verifican en el SQL generado y se completan manualmente dentro de la migración revisada cuando haga falta.

## Consecuencias

- Consultas y relaciones tipadas, migraciones versionadas y transacciones coherentes con el stack TypeScript.
- El repositorio no queda atado a Prisma fuera de infraestructura.
- Una actualización de Prisma requiere revisar notas de migración, regenerar el cliente y ejecutar toda la suite.
- El DSL no se considera sustituto del conocimiento de PostgreSQL ni de la revisión del DDL.
