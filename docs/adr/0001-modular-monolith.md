# ADR-0001: Monolito modular

**Estado:** propuesto  
**Fecha:** 2026-10-16

## Contexto

La Fase 1 debe validar rápidamente lógica financiera compleja, mientras deja fronteras claras para conectores, inventario, ventas y un SaaS futuro. Distribuir el sistema desde el inicio aumentaría despliegues, contratos de red y consistencia transaccional sin aportar valor al MVP privado.

## Decisión

Construir un único despliegue Next.js App Router organizado por módulos de dominio. Cada módulo separa dominio, aplicación, infraestructura y UI. El motor financiero es puro; los repositorios y conectores implementan puertos definidos por la capa de aplicación.

No se permiten importaciones desde dominio hacia Next.js, React, Prisma o SDKs externos. Las operaciones que abarcan varios repositorios se coordinan mediante una transacción en la capa de aplicación.

## Consecuencias

- Desarrollo, pruebas y despliegue simples durante el MVP.
- Integridad transaccional local y menor costo operativo.
- Los límites dependen de disciplina de código y pruebas de arquitectura, no de procesos separados.
- Un módulo sólo se extraerá a servicio independiente cuando exista una necesidad medida de escalado, aislamiento o propiedad organizacional.
