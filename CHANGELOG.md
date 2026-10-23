# Cambios

Lo que cambia en cada versión de la API, escrito para quien usa el sistema. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones,
[versionado semántico](https://semver.org/lang/es/) (ver [CONTRIBUTING.md](CONTRIBUTING.md#las-versiones)).

## [1.9.0] — 2026-10-23

### Agregado

- **`GET /api/version`**: la versión del servidor y el commit desplegado, para que las pantallas
  la muestren al pie del menú. Pide solo haber entrado.

## [1.8.1] — 2026-10-23

### Documentación

- **`docs/como-probar.md`**, nueva: cómo se prueba sin tocar producción (archivos de entorno,
  copia local, migración escrita a mano, ensayo con ROLLBACK, conteo de filas, los frenos).
  Reemplaza a `base-de-prueba.md`, que explicaba la base en Neon que ya no responde.
- El plan de arquitectura, ya cumplido, pasa a `docs/historico/`, marcado como registro.

## [1.8.0] — 2026-10-23

### Agregado

- **Contar en cero de una vez** (`POST /tomas-inventario/:id/contar-en-cero`): los renglones
  que figuran en 0 y todavía no se contaron quedan contados en 0, a nombre de quien confirma.
  Llegan los renglones que la persona vio; si a alguno le entró stock mientras tanto, se saltea
  y se avisa en `salteados`. Sin cambios en la base.

## [1.7.0] — 2026-10-22

### Agregado

- **Reubicar materiales durante la toma de inventario**
  (`POST /tomas-inventario/:id/renglones/:renglonId/reubicar`). Con la toma abierta, quien
  cuenta (`inventario.contar`) puede cambiar un material de estantería o de fila: queda así en
  todo el sistema, y la toma guarda de dónde a dónde, quién y cuándo. El detalle de la toma trae
  esas reubicaciones, y cada renglón, su `estanteriaId`.

### Base de datos

- Migración aditiva: la tabla `reubicaciones_toma`, nueva y vacía. Ensayada contra producción
  con ROLLBACK.

## [1.6.1] — 2026-10-22

### Documentación

- `docs/sistema.md`: una coma que faltaba en la lista de endpoints de Trabajos.

## [1.6.0] — 2026-10-22

### Agregado

- **Anotador de pendientes** (`/api/pendientes`): lo que quedó por hacer y no es una tarea del
  calendario («comprar rulemanes», «mandar a rebobinar el motor»), compartido por todo
  mantenimiento. Lleva el texto, si es urgente y, si hace falta, a quién le toca y el equipo.
  Los urgentes van primero; los hechos se ven 60 días y se pueden reabrir.
  - Si le toca a alguien, **solo esa persona (o un administrador) lo da por hecho**.
  - Si es sobre una máquina, al darlo por hecho se guarda la orden de trabajo que se registró
    (tiene que ser de esa misma máquina).
  - Borrar solo puede quien lo anotó o un administrador.
  - Permisos nuevos `pendientes.ver` y `pendientes.editar`: como todo permiso nuevo, le llegan
    solos al administrador; a los demás roles se les dan desde la pantalla Permisos.
- **Cada tarea del calendario dice cada cuántos días se repite** (`cadaDias`, la del plan o la
  de la rutina). Con eso las pantallas separan lo de todos los días de los services.

### Base de datos

- Dos migraciones aditivas: la tabla `pendientes` y su columna `ordenTrabajoId`. No tocan
  ningún dato existente; ensayadas contra producción con ROLLBACK.

## [1.5.3] — 2026-10-20

### Documentación

- Cómo está hecho el diseño de las pantallas (variables, tipografía, íconos, celular), con el
  rediseño del frontend v1.6.0.

## [1.5.2] — 2026-10-20

### Documentación

- `docs/sistema.md` al día con las actualizaciones de octubre: versiones del frontend (React
  Router 7, jsPDF 4), Node 24 y npm 11.19 en todos lados y por qué, y los pendientes nuevos
  (pnpm, autorizar los scripts de instalación; Sentry en un solo punto).

## [1.5.1] — 2026-10-20

### Cambiado (para quien desarrolla)

- **npm fijado en 11.19 o más nuevo** (`engines` + `.npmrc` con `engine-strict`), y
  `packageManager: npm@11.19.1`. Con un npm más viejo el `package-lock.json` sale distinto al
  que espera el CI y `npm ci` falla en GitHub; ahora npm se niega a instalar y dice qué
  versión hace falta.

## [1.5.0] — 2026-10-19

### Seguridad

- **NestJS 12** (desde la 10, pasando por la 11, que trae Express 5) y **Node 24**. El backend
  queda sin alertas altas ni críticas; las moderadas que quedan son de Sentry, que todavía no
  está activo.
- La API responde igual que antes: se grabaron 176 pedidos contra una copia de producción con
  NestJS 10 y con NestJS 12, y coinciden. Lo único distinto: un filtro escrito con corchetes
  (`?buscar[x]=…`), que las pantallas nunca mandan, ahora se rechaza en vez de ignorarse.

### Arreglado

- Un pedido de más de 8 MB respondía «500, error del servidor»; ahora es «413, demasiado
  grande» con el máximo en el mensaje, y no se reporta como falla.
- El `path` de los errores es siempre la dirección completa pedida (con `/api`).
- La documentación de la API (`/docs`) muestra por separado el alta y la edición de equipos
  de planta y de informática: con el mismo nombre, una pisaba a la otra.

### Cambiado (para quien desarrolla)

- Los tests se corren con `npm test`, `npm run test:e2e` y `npm run test:integracion`: Jest 30
  necesita que Node arranque con `--experimental-vm-modules` para cargar NestJS 12.
- `dotenv` declarado en las dependencias de desarrollo: los scripts lo usaban sin declararlo.

## [1.4.1] — 2026-10-19

### Seguridad

- Dependencias al día sin cambios de comportamiento: `proxy-addr` (vulnerabilidad crítica),
  `brace-expansion` y `nodemailer` 10, que envía los correos cuando no se usa Brevo.

### Cambiado

- Los scripts de arreglos de una sola vez, ya aplicados, pasaron a `scripts/historicos/` con
  una nota de qué hizo cada uno y la advertencia de no volver a correrlos.

### Documentación

- Los números del sistema, la pantalla de una toma de inventario y los scripts que faltaban.

## [1.4.0] — 2026-10-19

### Agregado

- **Foto del material.** Cada material puede tener una foto, para reconocer en el estante los
  repuestos que por el nombre solo no se sabe qué son. Se pone, se cambia o se saca desde la
  ficha (permiso de editar materiales).
- **Último inventario.** La ficha del material dice cuándo se lo contó por última vez: en qué
  toma, cuánto se contó y cuánto figuraba. Un ajuste cargado a mano también cuenta.

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

[1.9.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.9.0
[1.8.1]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.8.1
[1.8.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.8.0
[1.7.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.7.0
[1.6.1]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.6.1
[1.6.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.6.0
[1.5.3]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.5.3
[1.5.2]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.5.2
[1.5.1]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.5.1
[1.5.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.5.0
[1.4.1]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.4.1
[1.4.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.4.0
[1.3.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.3.0
[1.2.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.2.0
[1.1.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.1.0
[1.0.0]: https://github.com/maxibertaina03/mantenimiento2-backend/releases/tag/v1.0.0
