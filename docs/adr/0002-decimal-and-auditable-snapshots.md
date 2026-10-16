# ADR-0002: Precisión Decimal y snapshots auditables

**Estado:** propuesto  
**Fecha:** 2026-10-16

## Contexto

ReventaIQ combina USD, COP, spreads, tasas, reservas, financiación y métricas derivadas. El punto flotante binario y la actualización retroactiva de parámetros pueden cambiar una señal de compra o impedir reconstruir por qué se tomó una decisión.

## Decisión

- Persistir importes en `numeric(20,4)` y tasas en `numeric(18,8)`.
- Usar una librería Decimal explícita en el dominio; no realizar aritmética monetaria con `number`.
- Serializar dinero y tasas como strings al cruzar fronteras JSON o Client Components.
- Versionar `BusinessSettings`, perfiles de canal, fórmula y score.
- Tratar `Opportunity` como un análisis inmutable: almacena referencias, resultados consultables y un snapshot JSONB versionado de los operandos y el desglose.
- Crear una nueva oportunidad al recalcular, enlazando la versión anterior cuando corresponda.
- Definir y probar dónde ocurre cada redondeo; la presentación no modifica valores de dominio.

## Consecuencias

- Resultados reproducibles y explicables incluso después de cambiar configuración.
- Mayor almacenamiento y conversión explícita en DTOs.
- Los JSONB necesitan esquema Zod versionado; no sustituyen columnas para filtros y agregaciones.
- Las comparaciones y tests deben usar Decimal, no coerciones implícitas.
