# Scripts históricos: NO volver a correr

Son arreglos de una sola vez: cada uno resolvió algo puntual en su momento y ya
cumplió. Quedan acá para saber qué se hizo y cómo, no para reusarlos.

**No los corras.** Varios borran o cambian datos y la mayoría no tiene freno
contra producción: correrlos de nuevo puede deshacer trabajo cargado después,
o repetir un borrado. Si algún día hace falta algo parecido, se escribe uno
nuevo partiendo de este, con la guardia de entorno y un ensayo con ROLLBACK
(ver `docs/sistema.md`, «Reglas de oro»).

| Script | Fecha | Qué hizo |
|---|---|---|
| `limpiar-movimientos-y-stock.sql` | 2026-08-28 | Dejó la base lista para arrancar a cargar stock en serio. |
| `borrar-orden.sql` | 2026-09-01 | Borró una orden de compra puntual. |
| `vaciar-ordenes-compra.sql` | 2026-09-09 | Vació el módulo de órdenes de compra para empezar de nuevo. |
| `limpiar-usuarios-fantasma.sql` | 2026-09-14 | Borró los usuarios que nunca fueron usuarios. |
| `clasificar-equipos-planta.mjs` | 2026-09-15 | Les puso tipo a los equipos de planta, deduciéndolo del nombre. |
| `permisos-de-trabajos.mjs` | 2026-09-21 | Les dio a mantenimiento y gerencia los permisos de órdenes de trabajo. |
| `trabajos-solo-admin.mjs` | 2026-09-21 | Dejó órdenes de trabajo solo para el administrador. |
| `borrar-materiales-de-informatica.mjs` | 2026-09-23 | Borró nueve materiales que se habían cargado por error. |
| `permisos-de-calendario.mjs` | 2026-09-23 | Les dio a mantenimiento y gerencia los permisos del calendario. |
| `datos-de-prueba-calendario.mjs` | 2026-09-24 | Llenó el calendario de una base local con datos inventados, para mirar la impresión. |
| `clasificar-herramientas.mjs` | 2026-09-28 | Pasó a HERRAMIENTA lo que ya estaba marcado así y le dio tipos. |
| `reclasificar-taller.mjs` | 2026-09-28 | Marcó como HERRAMIENTA los equipos del sector Taller. |
| `borrar-orden-de-compra.mjs` | 2026-09-30 | Borró una orden de compra por número. |

Hoy los permisos se reparten desde la pantalla Permisos, así que los scripts de
permisos tampoco hacen falta.
