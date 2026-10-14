# Cambios

Lo que cambia en cada versión de la API, escrito para quien usa el sistema. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[versionado semántico](https://semver.org/lang/es/) (ver [CONTRIBUTING.md](CONTRIBUTING.md#las-versiones)).

## [1.0.0] — 2026-10-14

Primera versión numerada: es el sistema tal como está en producción desde junio de 2026, con
todo lo que se le fue sumando. A partir de acá, cada publicación tiene su número y su entrada.

### Qué incluye

- **Pañol:** materiales con categoría, unidad, ubicación, stock mínimo y QR; entradas, salidas y
  ajustes, con la corrección auditada y la regla de no cargar antes del último ajuste.
- **Compras:** órdenes de compra de materiales y equipos nuevos; envío al proveedor por correo
  (con el PDF) o WhatsApp; **recepción en partes** con su remito, reclamo de lo que falta y
  cierre con faltante; comprobantes adjuntos; precios corregibles.
- **Equipos:** ficha de cada máquina con fotos, manuales, repuestos, componentes y QR; planes de
  mantenimiento con los días que trabaja la planta y avisos de lo que vence; la máquina figura
  «En reparación» mientras está en un taller de afuera.
- **Trabajos:** órdenes de trabajo con responsable, materiales usados y costo; **servicio
  externo**: mandarle la orden al taller por correo o WhatsApp y registrar la vuelta con su
  remito; calendario con services, rutinas y tareas a mano.
- **Informática:** inventario de equipos IT con su historial de asignaciones y baúl de
  contraseñas cifradas.
- **Permisos por rol**, configurables desde el sistema.
- **Operación:** CI con tests unitarios, de punta a punta y de integración contra Postgres;
  guardias que impiden tocar producción por error; backup nocturno cifrado (pendiente de sus
  claves).

[1.0.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.0.0
