# Sistema de Mantenimiento · Lácteos Las Tres

**Documentación técnica: cómo está armado el código y qué hace cada parte.**
Estado al 14 de octubre de 2026 (versión 1.0.0). Cubre los dos repos: este (la API) y
[`mantenimiento2-frontend`](https://github.com/maxibertaina03/mantenimiento2-frontend).

> Este documento se actualiza junto con el código: un cambio que agrega o cambia una parte del
> sistema actualiza también la sección que la describe, en el mismo pull request.

---

## 1. Qué es el sistema

Es la aplicación web con la que el área de mantenimiento de la planta maneja su trabajo diario:

- **Pañol:** materiales, stock y cada entrada o salida, con trazabilidad.
- **Compras:** órdenes de compra a proveedores, desde el borrador hasta la recepción, que suma el stock.
- **Equipos y herramientas:** la ficha de cada máquina, con fotos, manuales, repuestos, componentes y QR.
- **Servicios:** planes de mantenimiento preventivo, con avisos de lo que vence.
- **Trabajos y calendario:** órdenes de trabajo, tareas del día, rutinas que se repiten y quién hace cada cosa.
- **Informática:** inventario de PCs, cámaras y celulares, y un baúl de contraseñas cifradas.

Se usa desde la computadora y desde el celular. En el celular se puede escanear el QR pegado en una máquina o en un estante.

### Dónde corre

| Parte | Dónde vive | Dirección |
|---|---|---|
| Pantallas (frontend) | Vercel | `https://mantenimiento2-frontend.vercel.app` |
| Servidor (API) | Render, plan gratuito | `https://mantenimiento2-backend.onrender.com/api` |
| Documentación de la API | Render | `https://mantenimiento2-backend.onrender.com/docs` |
| Base de datos | Supabase (Postgres) | región us-west-2 |
| Fotos, manuales y comprobantes | Supabase Storage | buckets `equipos`, manuales y comprobantes |
| Inicio de sesión | Clerk | — |
| Correo | Brevo | — |
| Código | GitHub | `maxibertaina03/mantenimiento2-backend` y `…-frontend` |

> El servidor de Render en plan gratuito **se apaga después de unos 15 minutos sin uso**. La primera vez que alguien entra puede tardar hasta un minuto. La pantalla lo sabe y espera en vez de mostrar un error.

---

## 2. Mapa general

```
  Celular / PC
       │  (navegador)
       ▼
  FRONTEND  (React, en Vercel)
       │  HTTPS + token de Clerk
       ▼
  BACKEND  (NestJS, en Render)  ──►  Clerk (¿quién es?)
       │                         ──►  Brevo (correos)
       │                         ──►  Supabase Storage (fotos, PDFs)
       ▼
  BASE DE DATOS  (Postgres en Supabase)

  GitHub Actions:  CI en cada push · backup nocturno · avisos por correo
```

Todo lo que hace la pantalla pasa por la API. La pantalla nunca habla directo con la base.

### Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack React Query, jsPDF (PDFs), Clerk (login), Sentry |
| Backend | Node 22, NestJS 10, TypeScript, Prisma 5 (acceso a la base), class-validator, Clerk, Nodemailer / Brevo, Sentry |
| Base | PostgreSQL (Supabase) |
| Tests | Jest (backend), Vitest + Testing Library (frontend), Postgres real en el CI |

### Tamaño

| Repo | Código | Tests |
|---|---|---|
| Backend | 5 contextos, 41 tablas, 40 migraciones | 1.116 unitarios, 194 de punta a punta, 20 de integración |
| Frontend | 16 pantallas | 591 tests |

---

## 3. El backend (`mantenimiento2-backend`)

### 3.1 Las carpetas

```
mantenimiento2-backend/
├── src/
│   ├── main.ts               arranque: validación, filtro de errores, /api, Swagger, CORS
│   ├── app.module.ts         junta todos los módulos
│   ├── config/               validación de las variables de entorno al arrancar
│   ├── contextos/            LO QUE TIENE REGLAS DE NEGOCIO (5 contextos)
│   │   ├── panol/            materiales y movimientos de stock
│   │   ├── compras/          órdenes de compra
│   │   ├── equipos/          máquinas, planes, fotos, manuales, repuestos…
│   │   ├── trabajos/         órdenes de trabajo y calendario
│   │   └── informatica/      equipos IT y contraseñas
│   ├── modules/              catálogos simples (guardan un nombre y lo devuelven)
│   └── common/               lo compartido: login, permisos, base, correo, errores…
├── prisma/
│   ├── schema.prisma         el modelo de la base (41 tablas)
│   └── migrations/           cada cambio a la base, en orden y escrito a mano
├── test/                     tests de punta a punta y de integración
├── scripts/                  herramientas de mantenimiento (conteos, ensayos, copias)
├── docs/                     documentos técnicos
└── .github/workflows/        CI, backup nocturno, avisos
```

### 3.2 La arquitectura: contextos y capas

El backend está partido en **cinco contextos** (*bounded contexts*). Cada uno es un pedazo del negocio con su propio vocabulario y sus propias reglas. Por dentro, cada contexto tiene **cuatro capas**:

| Capa | Qué tiene | Qué puede usar |
|---|---|---|
| `dominio/` | Las reglas del negocio, en funciones puras. Ej.: «un equipo dado de baja no vuelve», «una OC recibida no se edita». | Nada de afuera: ni Nest, ni Prisma, ni HTTP. |
| `puertos/` | Interfaces: lo que el dominio necesita del mundo (un repositorio, un reloj, un almacén de fotos). | Solo tipos. |
| `aplicacion/` | Los casos de uso: orquestan el dominio y los puertos. Ej.: `GestionarFotos`, `RegistrarTrabajoDePlan`. | Dominio y puertos. |
| `infraestructura/` | Lo concreto: controladores HTTP, DTOs, repositorios Prisma, Supabase, correo, y el módulo de Nest. | Todo lo anterior. |

**La regla que ordena todo:** las dependencias apuntan hacia adentro. La infraestructura conoce a la aplicación, que conoce al dominio, nunca al revés. Gracias a eso las reglas se prueban en milisegundos, con implementaciones en memoria, sin base ni servidor.

**Dónde se arma cada caso de uso:** en `infraestructura/casos-de-uso.providers.ts` de cada contexto. Los controladores reciben el caso de uso ya armado y solo traducen HTTP.

**Cómo se hablan los contextos:** cada contexto tiene una *puerta pública*, el `index.ts` de su carpeta. Otro contexto solo puede usarlo por ahí, por ejemplo `import { PanolModule } from '../../panol'`. Si alguien entra a las carpetas internas de otro contexto, el lint da error y el CI no deja pasar el cambio. La regla está en `.eslintrc.cjs`.

**Los errores:** el dominio no conoce HTTP. Lanza errores propios (`ErrorNoEncontrado`, `ErrorDatosInvalidos`, `ErrorConflicto`, …) y `FiltroErroresDominio` los traduce a códigos HTTP: 404, 400, 409, 403. Los mensajes están en castellano y la pantalla los muestra tal cual.

### 3.3 Los cinco contextos

#### Pañol (`contextos/panol`)

Materiales, stock y movimientos.

- **Materiales:** nombre, categoría, unidad de medida, ubicación (estantería y fila), stock actual y mínimo, QR. Un material con historia no se borra: se desactiva y conserva su historial.
- **Movimientos:** cada entrada, salida o ajuste. El stock se calcula con ellos. Un movimiento se puede corregir y la corrección queda auditada (`EdicionMovimiento`).
- **Regla de la fecha de ajuste:** no se puede cargar un movimiento con fecha anterior al último ajuste de inventario de ese material, porque desarmaría el conteo.
- **Avisos de bajo stock:** materiales por debajo del mínimo y cobertura de alertas.
- **Puerta pública:** `MaterialesService` y `MovimientosStockService`, que usan compras (al recibir) y trabajos (al usar materiales).
- **Endpoints:** `/api/materiales…`, `/api/movimientos…`.

#### Compras (`contextos/compras`)

Órdenes de compra a proveedores.

- **Ciclo:** BORRADOR → EMITIDA → RECIBIDA, o ANULADA. Solo el borrador se edita.
- **Recepción en partes:** se recibe lo que llegó, renglón por renglón (cada uno arranca en 0 y se carga mirando el remito). Cada entrega es una `RecepcionOrden` con su remito o factura, y cada renglón recibido genera su entrada de stock en el pañol. Si falta algo, la orden queda **RECIBIDA_PARCIAL** («Recibida en parte»): se recibe la próxima entrega, se le **reclama al proveedor** lo que falta (correo o WhatsApp, registrado como reclamo) o se **cierra con lo que llegó**, con el motivo. Una orden que ya movió stock no se anula.
- **Renglones:** pueden ser un material del pañol o un equipo nuevo (descripción, clasificación, tipo, marca, modelo). Los equipos se dan de alta como fichas al recibir la orden. Cada renglón guarda su posición, para mostrarse en el orden en que se cargó.
- **Precios:** se pueden cargar o corregir aunque la orden ya esté emitida o recibida.
- **Envío:** por correo con el PDF adjunto, o por WhatsApp, que solo deja constancia. Cada envío queda registrado.
- **Comprobantes:** remitos y facturas adjuntos, guardados en un bucket privado y abiertos con un enlace que vence.
- **Archivos clave:** `dominio/orden-compra.ts`, `aplicacion/gestionar-ordenes-compra.ts`, `aplicacion/enviar-ordenes.ts`, `infraestructura/adaptadores.ts` (el único lugar que habla con el pañol, proveedores y el correo).
- **Endpoints:** `/api/ordenes-compra…`.

#### Equipos (`contextos/equipos`)

Máquinas de planta y herramientas.

- **Ficha del equipo:** código, ubicación, tipo, marca, modelo, número de serie, proveedor, horas de uso, garantía, estado (operativo, en reparación, fuera de servicio, dado de baja) y QR.
- **Estado por taller externo** (`EstadoPorTaller`): cuando trabajos avisa que la máquina salió a un taller de afuera, queda «En reparación»; cuando vuelve, «Operativo». Equipos decide: una dada de baja no cambia, y si alguien la marcó fuera de servicio mientras tanto, se respeta.
- **Catálogos:** ubicaciones, tipos, marcas y modelos. Marcas y modelos tienen un *ámbito* (planta, IT o ambos), y se pueden agregar desde el mismo formulario del equipo.
- **Fotos:** una principal, la de la lista, y hasta 12 más con descripción, por ejemplo la chapa característica. Cualquiera puede pasar a principal y no se pierde ninguna.
- **Manuales:** PDFs de hasta 25 MB, como máximo 10 por equipo, en un bucket privado.
- **Componentes (montajes):** un motor montado en una bomba. Se puede trasladar y queda el historial.
- **Repuestos:** qué materiales del pañol lleva cada máquina, con cantidad y si hay stock.
- **Planes de mantenimiento:** «cada N días», con los **días de la semana que trabaja la planta**, por defecto de lunes a viernes. Si la próxima fecha cae un día no marcado, pasa al siguiente que sí. Cada plan elige **cómo se cuenta el próximo** (`modoProxima`):
  - **desde que se hizo** (`DESDE_TRABAJO`, el de siempre): tocaba el sábado 10/10, se hizo el 14/10, cada 14 días → 28/10;
  - **respetando el calendario** (`CALENDARIO`): el mismo caso → 24/10. Si se hizo tan tarde que la fecha siguiente también pasó, salta a la primera que todavía no pasó.
  En los dos, nunca vuelve a caer en un día que ya se hizo.
- **Postergar** (`postergarPlan`): el próximo service se puede correr unos días, solo si todavía no venció y sin pasar de la vez siguiente. Se guarda la fecha original (`postergadoDesde`) para seguir contando desde ahí.
- **Avisos por correo:** los servicios que vencen. Los dispara un workflow de GitHub, que hoy está apagado a pedido.
- **Importación:** alta masiva a partir de las fotos de la planta.
- **Puerta pública:** `EquiposModule`, `GestionarPlanes` (trabajos avisa que un service se hizo, o que se postergó) y `EstadoPorTaller` (trabajos avisa que una máquina salió a un taller o volvió).
- **Endpoints:** `/api/equipos…`, `/api/equipos/:id/fotos|manuales|repuestos|componentes`, `/api/equipos/planes/vencen`, `/api/ubicaciones-equipo`, catálogos y `/api/avisos/procesar`.

#### Trabajos (`contextos/trabajos`)

Órdenes de trabajo y calendario.

- **Órdenes de trabajo:** abiertas o cerradas, de tipo preventivo, correctivo o mejora, sobre una máquina de planta o un equipo IT. Llevan responsable, quién lo hizo (fábrica o servicio externo), costo, horas de parada y los materiales usados, que se descuentan del pañol. Se pueden imprimir. «Registrar trabajo» desde la ficha del equipo crea la orden ya cerrada en un solo paso.
- **Calendario:** junta tres orígenes en una sola lista de tareas:
  - los services que vencen según cada plan;
  - las rutinas que se repiten («cada N días», con sus días de la semana);
  - lo que alguien programó a mano.
- **Servicio externo:** una orden puede hacerse en un taller de afuera (llenar un tubo, rebobinar un motor). Desde la ficha del equipo, «Mandar a servicio externo» la abre y baja el PDF que viaja con el equipo. La orden se le **manda al taller** por correo (con el PDF, el destinatario lo arma el servidor) o por WhatsApp, y cada envío queda en `EnvioOrdenTrabajo`. Mientras está abierta, la máquina figura «En reparación». «**Volvió del taller**» la cierra con lo que hizo el taller, su **remito o factura** (`comprobanteExterno`) y lo que cobró.
- **Postergar una tarea** que todavía no venció: a otro día, con el motivo, y sin pasar de la vez siguiente que toca. Queda en `PostergacionTarea` (quién, de qué día a qué día, por qué). La tarea guarda su día original (`fechaOriginal`), así el calendario no vuelve a generar una rutina en el día que se dejó. Si es de un plan, el plan se mueve con ella.
- **Dar por hecha** una tarea crea su orden de trabajo, descuenta los materiales y, si la tarea es de un plan, corre el plan.
- **Hoy:** lo de cada persona más lo que no es de nadie.
- **`RegistrarTrabajoDePlan`:** es el único lugar que sabe qué pasa cuando se hace el trabajo de un plan: el plan corre y la tarea del calendario queda hecha, venga el trabajo de donde venga.
- **Endpoints:** `/api/ordenes-trabajo…` (con `?ejecutor=EXTERNO`, `/:id/enviar-correo`, `/:id/registrar-whatsapp`, `/:id/envios`) y `/api/calendario…` (tareas, rutinas, `mias`, `planes/:id/tarea`).

#### Informática (`contextos/informatica`)

- **Equipos IT:** PCs, notebooks, cámaras, celulares y servidores, con especificaciones, red y acceso remoto. Cada cambio de manos queda en el historial de asignaciones. Se pueden importar desde CSV y tienen QR.
- **Credenciales (baúl):** contraseñas **cifradas** con una clave que vive solo en el servidor (`CLAVE_SECRETOS`) y nunca en la base ni en los backups.
  - Ver una contraseña es una acción aparte, «revelar», y queda registrada.
  - Al rotarla se guarda que se cambió, pero no la contraseña vieja.
- **Endpoints:** `/api/equipos-it…` y `/api/credenciales…`.

### 3.4 Los catálogos simples (`src/modules`)

Son módulos de Nest tradicionales, sin las cuatro capas, a propósito: guardan un nombre y lo devuelven. Envolver eso en capas solo lo alargaría.

| Módulo | Para qué |
|---|---|
| `categorias-material` | Categorías del pañol |
| `unidades-medida` | Unidades (u, kg, m, l…) |
| `estanterias-material` | Dónde está cada material |
| `proveedores` | Proveedores, con CUIT, correo y teléfono |
| `tipos-equipo` | Tipos de equipo IT |
| `responsables` | A quién se asigna un equipo IT. Se pueden unificar duplicados. |
| `usuarios` | Usuarios del sistema y su rol |

### 3.5 Lo compartido (`src/common`)

| Carpeta | Qué hace |
|---|---|
| `auth/` | Login con Clerk, el guard global, los **permisos por rol** y los decoradores `@Permisos()`, `@Public()` y `@UsuarioActual()`. |
| `prisma/` | Conexión a la base, con una guardia que impide apuntar por error a producción desde local. |
| `correo/` | Envío de correos (Brevo por API, o SMTP). |
| `almacen/` | Cliente de Supabase Storage. |
| `dominio/` | Errores comunes, el filtro que los traduce a HTTP, decimales, fechas, nombres y los días de trabajo de la planta. |
| `monitoreo/` | Sentry: reporta solo los errores 500, sin datos personales. Inactivo si no hay DSN. |
| `filters/` | El formato de error de toda la API. |

### 3.6 Roles y permisos

Hay cuatro roles: **ADMIN**, **GERENCIA**, **ADMINISTRATIVO** y **MANTENIMIENTO**. Cada pantalla y cada endpoint piden un permiso puntual. Qué permisos tiene cada rol se configura desde la pantalla **Permisos**, sin tocar código. El administrador siempre los tiene todos.

| Grupo | Permisos |
|---|---|
| Materiales | `materiales.ver/editar`, `movimientos.ver/crear/editar`, `catalogos.ver/editar` |
| Compras | `proveedores.ver/editar`, `ordenes.ver/editar/recibir/enviar` |
| Trabajos | `trabajos.ver/editar/eliminar/asignar`, `tareas.ver/editar/asignar` |
| Equipos | `equipos.ver/editar`, `servicios.ver/editar` |
| Informática | `it.ver/editar`, `credenciales.ver/revelar/editar` |
| Administración | `usuarios.administrar`, `permisos.administrar` |

### 3.7 La base de datos

41 tablas, definidas en `prisma/schema.prisma`, agrupadas así:

| Área | Tablas |
|---|---|
| Pañol | `Material`, `CategoriaMaterial`, `UnidadMedida`, `EstanteriaMaterial`, `MovimientoStock`, `EdicionMovimiento` |
| Compras | `OrdenCompra`, `RenglonOrdenCompra`, `RecepcionOrden`, `RecepcionRenglon`, `EnvioOrden`, `ComprobanteOrden`, `Proveedor`, `ContadorDocumento` |
| Equipos | `Equipo`, `UbicacionEquipo`, `TipoEquipoPlanta`, `MarcaEquipo`, `ModeloEquipo`, `FotoEquipo`, `ManualEquipo`, `MontajeEquipo`, `RepuestoEquipo`, `PlanMantenimiento`, `AvisoEnviado`, `Intervencion` (sin uso, ver abajo) |
| Trabajos | `OrdenTrabajo`, `MaterialUsadoTrabajo`, `EnvioOrdenTrabajo`, `TareaProgramada`, `PostergacionTarea`, `RutinaTarea` |
| Informática | `EquipoIT`, `AsignacionEquipoIT`, `TipoEquipo`, `Responsable`, `Credencial`, `RotacionCredencial`, `VistaCredencial` |
| Usuarios | `Usuario`, `PermisoRol` |

- `ContadorDocumento` lleva la numeración correlativa: OC-2026-0001, OT-2026-0001.
- `Intervencion` quedó **sin uso**: los trabajos son órdenes de trabajo. La tabla sigue, vacía, porque borrarla sería una migración destructiva y no hace falta.

**Migraciones:** cada cambio a la base es una carpeta en `prisma/migrations/`, escrita a mano. Render la aplica sola al desplegar (`prisma migrate deploy`). Las reglas para hacerlas están en la sección 6.

---

## 4. El frontend (`mantenimiento2-frontend`)

### 4.1 Las carpetas

```
mantenimiento2-frontend/src/
├── main.tsx              arranque: Clerk, React Query, Sentry, pantalla de error
├── App.tsx               las rutas (qué página va en cada dirección)
├── paginas/              una por pantalla
├── componentes/          piezas reutilizables y modales
│   ├── ordenesCompra/    modales de la página de compras
│   ├── ordenesTrabajo/   modales de la página de órdenes de trabajo
│   └── equiposIt/        modales de la página de equipos IT
├── api/                  un archivo por recurso, con los hooks que hablan con la API
├── lib/                  utilidades: cliente HTTP, PDFs, QR, fechas, permisos…
├── tipos/                los tipos de datos que devuelve la API
└── index.css             todos los estilos, con variables de color
```

### 4.2 Las pantallas

| Dirección | Página | Qué se hace |
|---|---|---|
| `/inicio` | Hoy | Las tareas de cada uno y una tarjeta por cada cosa pendiente (equipos parados, services, talleres externos, reponer, mercadería por llegar, órdenes sin enviar); tocando una se ve su lista |
| `/materiales` | Materiales | Buscar y filtrar el pañol, editar, imprimir QR de estantes |
| `/materiales/:id` | Detalle de material | Ficha, historial de movimientos y equipos que lo usan |
| `/movimientos` | Historial | Todas las entradas y salidas, con su corrección auditada |
| `/movimientos/nuevo` | Nuevo movimiento | Cargar entradas y salidas, también con el lector de QR |
| `/calendario` | Calendario | Mes con tareas por persona, rutinas, nuevas tareas, imprimir por semana o por mes |
| `/ordenes-trabajo` | Órdenes de trabajo | Abrir, cargar materiales, cerrar, reabrir, imprimir; mandarla a un taller y registrar la vuelta. Filtro «En talleres externos» (`?afuera=1`) |
| `/ordenes-compra` | Órdenes de compra | Crear, emitir, enviar, recibir en partes, reclamar lo que falta, precios, comprobantes, PDF |
| `/equipos` | Equipos y herramientas | Lista de máquinas, alta, importación, QR |
| `/equipos/:id` | Ficha del equipo | Resumen, repuestos, trabajos, planes, componentes, manuales y fotos; «Mandar a servicio externo» y el aviso de en qué taller está. Con `?desde=qr`, modo rápido «al pie de la máquina». |
| `/servicios` | Servicios | Lo que vence (semana, 15 días, mes, 3 meses), «Postergar» y «Dar por hecho» |
| `/equipos-it` | Equipos IT | Inventario, alta, asignar a una persona, importar CSV, QR |
| `/credenciales` | Contraseñas | El baúl: ver, revelar, rotar |
| `/proveedores` | Proveedores | Alta y edición |
| `/usuarios` | Usuarios | Usuarios y su rol |
| `/permisos` | Permisos | Qué puede hacer cada rol |

Cada ruta pide su permiso (`RutaConPermiso`). Lo que el usuario no puede usar no aparece en el menú.

### 4.3 Cómo está hecho

- **Datos:** cada recurso tiene su archivo en `api/`, con hooks de React Query (`useEquipos`, `useCrearOrden`, …). Los hooks guardan en caché, reintentan y refrescan solos después de un cambio.
- **Listas con filtros:** Materiales y Equipos guardan el filtro, la búsqueda y la página en la dirección (`lib/listaEnUrl.ts`). Entrar a una ficha y volver deja la lista como estaba, y un enlace como `/equipos?estado=EN_REPARACION` abre la lista ya filtrada.
- **Cliente HTTP:** `lib/apiClient.ts` agrega el token de Clerk, espera el arranque en frío de Render y muestra los errores de la API en castellano.
- **Permisos en pantalla:** `usePuede()` y `P` (en `lib/permisos.ts`) esconden los botones que el usuario no puede usar. El servidor igual controla todo.
- **PDFs:** con jsPDF y membrete (`lib/pdf*.ts`): orden de compra, orden de trabajo, etiquetas QR.
- **Fotos:** se achican en el navegador antes de subirse (`lib/comprimirImagen.ts`). La chapa de un equipo se achica menos, para que se pueda leer.
- **Escaneo:** `lib/escaneo.ts` reconoce un QR leído con la pistola o la cámara y lleva directo al material o a la máquina.
- **Impresión del calendario:** la vista de papel aparte (`componentes/CalendarioImpreso.tsx`), por semana o por mes.
- **Errores inesperados:** `PantallaConError` los muestra sin dejar la pantalla en blanco, y Sentry los reporta.
- **Modales:** `componentes/Modal.tsx`. Tocar afuera o Escape no cierran de golpe: preguntan si hay algo cargado. Los detalles largos (orden de compra, orden de trabajo) usan un encabezado con la acción que toca y pestañas abajo, para que entren en una pantalla.

---

## 5. Calidad y operación

### 5.1 Los tests

| Tipo | Dónde | Cuántos | Qué prueban |
|---|---|---|---|
| Unitarios (backend) | `src/**/*.spec.ts` | 1.116 | Reglas del dominio y casos de uso, con dobles en memoria |
| De punta a punta (backend) | `test/*.e2e-spec.ts` | 194 | La API por HTTP, con la app real y una base en memoria |
| De integración (backend) | `test/integracion/` | 20 | Calendario, planes, compras y servicio externo contra un **Postgres real y vacío** |
| Frontend | `src/**/*.test.tsx` | 591 | Pantallas y componentes, como los usa una persona |

Los tests de integración tienen una guardia: solo corren contra una base local o la del CI, cuyo nombre termine en `_integracion`. Nunca pueden tocar producción.

### 5.2 Integración continua y despliegue

- Cada push a `develop` o `main`, y cada pull request, corre en GitHub Actions: formato de los commits, lint, compilación y todos los tests. En el backend, además, un Postgres de prueba aplica todas las migraciones desde cero.
- **`main` está protegida:** solo recibe cambios por **pull request** y con el CI en verde, también para el administrador.
- **El flujo** (detallado en `CONTRIBUTING.md`):
  1. commits en `develop`, con el formato `tipo(ámbito): qué cambia`;
  2. push a `develop` y CI en verde;
  3. pull request `develop` → `main`, con el resumen de lo que entra;
  4. al mergearlo, Render y Vercel despliegan solos;
  5. se marca la versión: tag `vX.Y.Z` y Release en GitHub, con la entrada del `CHANGELOG.md`.
- **Ver qué versión corre:** en `/docs-json`, el campo `info.version` dice la versión y el commit que están corriendo en producción.

### 5.3 Procesos automáticos (`.github/workflows`)

| Workflow | Cuándo | Estado |
|---|---|---|
| `ci.yml` | En cada push y pull request | Activo |
| `backup-produccion.yml` | Todas las noches a las 03:00 | **Pendiente:** faltan 3 claves (ver `docs/backups.md`) |
| `avisos-mantenimiento.yml` | 07:00, correo con los servicios que vencen | Apagado a pedido; se dispara a mano |

### 5.4 Scripts útiles (`scripts/`)

| Script | Para qué |
|---|---|
| `contar-filas.mjs` | Cuenta las filas de todas las tablas. Se corre antes y después de cada despliegue. |
| `ensayar-migracion.mjs` | Corre una migración contra producción dentro de una transacción y la deshace (ROLLBACK). |
| `copiar-produccion-a-local.mjs` | Trae una copia de producción a la base local, solo para leer. |
| `foto-local.mjs` | Guarda o repone una foto de la base local, para comparar dos versiones del código. |
| `caracterizar-compras.mjs`, `caracterizar-panol.mjs` | Graban las respuestas de la API para comparar antes y después de un cambio. |
| `restaurar-backup.mjs` | Descifra un backup y lo restaura, solo en la base local. |
| `guardia-entorno.js` | Bloquea los comandos peligrosos de Prisma si la base no es local. |

### 5.5 Variables de entorno

Los valores no se escriben en ningún lado del código. Viven en el panel de Render y Vercel, o en el `.env` local.

| Dónde | Variables |
|---|---|
| Backend | `DATABASE_URL`, `CLERK_SECRET_KEY`, `FRONTEND_URL`, `CLAVE_SECRETOS`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET*`, `BREVO_API_KEY` o `SMTP_*`, `MAIL_FROM`, `MAIL_AVISOS`, `MAIL_ADMINISTRACION`, `WHATSAPP_ADMINISTRACION`, `TOKEN_AVISOS`, `SENTRY_DSN` |
| Solo en local | `AUTH_DISABLED`, `USUARIO_DEV` (para probar sin login) |
| Frontend | `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_URL_PUBLICA`, `VITE_SENTRY_DSN` |

---

## 6. Reglas de oro

1. **Nunca** se corre `prisma migrate dev`, `migrate reset` ni una base sombra (*shadow DB*) contra producción. Ya borró la base una vez.
2. Las migraciones se escriben a mano: se generan con `prisma migrate diff` y se revisan. Antes de desplegarlas se **ensayan contra producción con ROLLBACK**.
3. Antes y después de cada despliegue se cuentan las filas de producción. El script siempre muestra a qué base está conectado.
4. Producción se toca solo con `.env.produccion`. El `.env` es siempre local.
5. Ningún cambio de datos en producción se hace sin aprobación.
6. Un refactor no cambia ninguna ruta, DTO ni respuesta. Si cambia algo visible, ya no es un refactor.
7. Las reglas de negocio van en `dominio/`, con su test. Si hace falta algo de otro contexto, se pide por su puerta pública.

---

## 7. Pendientes conocidos

- **Activar el backup nocturno:** cargar `RCLONE_CONFIG`, `DIRECT_URL_PRODUCCION` y `CLAVE_BACKUP` en GitHub, siguiendo `docs/backups.md`. Hoy no hay copia de producción.
- **Sentry:** cargar `SENTRY_DSN` en Render y `VITE_SENTRY_DSN` en Vercel.
- **Pasar los dos repos de GitHub a privados.** Hoy son públicos: se ve el código (no hay claves en el historial; se revisó entero).
- **Tabla `Intervencion`:** se puede borrar en una migración propia y ensayada, si algún día se quiere.

---

## 8. Glosario

| Término | Significado |
|---|---|
| **Contexto** (*bounded context*) | Una parte del negocio con sus propias reglas y vocabulario: pañol, compras, equipos, trabajos, informática. |
| **Dominio** | El código que expresa las reglas del negocio, sin nada técnico. |
| **Caso de uso** | Una acción completa del sistema, por ejemplo «dar por hecha una tarea». |
| **Puerto** | Lo que el dominio necesita del mundo, descripto como interfaz. |
| **Adaptador** | La implementación concreta de un puerto: Prisma, Supabase, el correo. |
| **DTO** | La forma de los datos que entran o salen por la API, validada. |
| **Migración** | Un cambio a la estructura de la base, versionado y aplicado en orden. |
| **CI** | Integración continua: los controles automáticos en cada cambio. |
| **Plan de mantenimiento** | «Cada N días, en estos días de la semana», sobre un equipo. |
| **Rutina** | Una tarea que se repite sola en el calendario. |
| **OC / OT** | Orden de compra / orden de trabajo. |
