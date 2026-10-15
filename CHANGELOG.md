# Cambios

Lo que cambia en cada versión de la API, escrito para quien usa el sistema. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[versionado semántico](https://semver.org/lang/es/) (ver [CONTRIBUTING.md](CONTRIBUTING.md#las-versiones)).

## [1.3.0] — 2026-10-16

### Cambiado

- **La toma de inventario tiene permisos propios:** ver las tomas, abrir y contar, y confirmar
  (ajusta el stock), cerrar y anular. Antes usaba los de movimientos. Arrancan solo para el
  administrador, que los reparte desde la pantalla Permisos.

## [1.2.0] — 2026-10-16

### Agregado

- **Toma de inventario.** Se abre sobre una categoría, una estantería o todo el pañol, y se
  cuenta material por material. Al confirmar, cada diferencia se ajusta con un movimiento de
  AJUSTE que lleva la nota de la toma. Si un material se movió después de contarlo, no se
  ajusta: queda para volver a contar. Se puede contar por tandas: la toma sigue abierta
  mientras falte contar, y se cierra sola cuando está todo (o a mano, dejando lo no contado
  como estaba).

## [1.1.0] — 2026-10-15

### Agregado

- **Respetar el calendario.** Cada plan de mantenimiento elige cómo se cuenta el próximo
  service: desde que se hizo (como siempre) o respetando las fechas planificadas. Tocaba el
  sábado 10/10, se hizo el 14/10, cada 14 días: el próximo es el 28/10 o el 24/10. Si se hizo
  tan tarde que la fecha siguiente también pasó, salta a la que viene. Los planes que ya
  existían siguen contando desde que se hizo.
- **Postergar tareas** que todavía no vencieron, con el motivo, sin pasar de la vez siguiente
  que tocan. Si la tarea es de un plan, el service se corre con ella y no figura vencido.
  Queda registrado quién la postergó, de qué día a qué día y por qué.

### Documentación

- Los backups: PowerShell normal (no como administrador) y el client_id propio de Google.
- Las listas guardan filtro y página en la dirección.

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

[1.3.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.3.0
[1.2.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.2.0
[1.1.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.1.0
[1.0.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.0.0
