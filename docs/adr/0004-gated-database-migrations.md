# ADR-0004: Migraciones condicionadas a aprobación

**Estado:** propuesto  
**Fecha:** 2026-10-16

## Contexto

El brief exige diseñar y presentar el esquema antes de migrarlo. Una migración aplicada convierte supuestos todavía discutibles en estado persistente y hace más costoso corregir relaciones, precisión o invariantes.

## Decisión

Toda modificación estructural sigue este gate:

1. actualizar ERD, diccionario, invariantes, índices y ADR relevante;
2. obtener aprobación explícita;
3. modificar `schema.prisma`;
4. validar y crear la migración en modo `create-only`;
5. revisar y, si procede, completar el SQL;
6. obtener aprobación del diff de migración;
7. aplicar primero en desarrollo y ejecutar pruebas de integridad;
8. promover mediante el proceso de despliegue, nunca con cambios manuales en producción.

Las correcciones a una migración ya aplicada se realizan con otra migración; no se reescribe el historial compartido.

## Consecuencias

- El modelo y su intención permanecen sincronizados y revisables.
- Los cambios de base de datos son deliberados y auditables.
- Hay un paso adicional de aprobación antes de implementar persistencia.
- Estado actual: sólo existe la propuesta documental; no se ha generado ni aplicado ninguna migración.
