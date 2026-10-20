# Mantenimiento — API

[![CI](https://github.com/maxibertaina03/mantenimiento2-backend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/maxibertaina03/mantenimiento2-backend/actions/workflows/ci.yml)

La API del sistema de mantenimiento de planta de **Lácteos Las Tres**: el pañol, las compras,
las máquinas y sus services, las órdenes de trabajo y el inventario de informática.

Las pantallas viven en otro repo,
[`mantenimiento2-frontend`](https://github.com/maxibertaina03/mantenimiento2-frontend), y le
hablan a esta API por HTTP.

| | |
|---|---|
| **En producción** | `https://mantenimiento2-backend.onrender.com/api` (Render) |
| **Documentación de la API** | [`/docs`](https://mantenimiento2-backend.onrender.com/docs) (Swagger) |
| **Versión que corre** | `info.version` en [`/docs-json`](https://mantenimiento2-backend.onrender.com/docs-json): versión + commit |
| **Base** | PostgreSQL en Supabase |

## Qué hace

El código está partido en cinco **contextos**, cada uno con sus reglas:

| Contexto | Qué maneja |
|---|---|
| **Pañol** | Materiales, stock y cada entrada, salida o ajuste, con su corrección auditada. |
| **Compras** | Órdenes de compra: borrador, envío al proveedor (correo o WhatsApp), recepción en partes con remito, reclamo de lo que falta, comprobantes. |
| **Equipos** | Ficha de cada máquina: fotos, manuales, repuestos, componentes, QR y planes de mantenimiento con aviso de lo que vence. |
| **Trabajos** | Órdenes de trabajo (en fábrica o en un taller de afuera), materiales usados y el calendario de tareas y rutinas. |
| **Informática** | Inventario de PCs, cámaras y celulares, y un baúl de contraseñas cifradas. |

La descripción completa —contextos, tablas, pantallas, permisos, procesos automáticos— está en
**[docs/sistema.md](docs/sistema.md)**.

## Stack

Node 24 · NestJS 12 · TypeScript · Prisma 5 · PostgreSQL · Clerk (login) · Brevo (correo) ·
Supabase Storage (archivos) · Sentry · Jest

## Arquitectura en una línea

Cada contexto (`src/contextos/<contexto>`) tiene cuatro capas —`dominio`, `puertos`,
`aplicacion`, `infraestructura`— y las dependencias apuntan hacia adentro: las reglas de negocio
no conocen Nest, ni Prisma, ni HTTP, y se prueban en milisegundos. Un contexto usa a otro solo
por su `index.ts`; el lint lo controla. Detalle en [docs/sistema.md](docs/sistema.md#3-el-backend-mantenimiento2-backend)
y en [docs/plan-arquitectura.md](docs/plan-arquitectura.md).

```
src/
├── contextos/      panol · compras · equipos · trabajos · informatica
├── modules/        catálogos simples (proveedores, categorías, unidades, usuarios…)
├── common/         login y permisos, base, correo, almacén, errores, monitoreo
└── main.ts
prisma/             schema.prisma y las migraciones (escritas a mano)
test/               de punta a punta (base en memoria) y de integración (Postgres real)
scripts/            conteos, ensayo de migraciones, copias locales, backups
docs/               documentación técnica
```

## Levantarlo en una máquina

Hace falta **Node 24** con **npm 11.19 o más nuevo** (`npm install -g npm@11.19.1`). npm se niega a instalar con
una versión más vieja: el `package-lock.json` que arma no coincide con el del CI y `npm ci` falla en
GitHub aunque acá ande. Y un **PostgreSQL local** (por ejemplo, `mantenimiento`).

```bash
npm ci
cp .env.example .env        # ENTORNO=local y una base local: ver los comentarios del archivo
npm run local:migrar        # crea las tablas en la base local
npm run local:api           # API en http://localhost:3000/api, Swagger en /docs
```

Para probar sin Clerk: `AUTH_DISABLED="true"` y `USUARIO_DEV` con el correo de un usuario de la
base local. Para trabajar con datos reales sin tocar producción,
`npm run local:copiar-produccion` trae una copia a la base local.

> **El `.env` es siempre local.** Producción se toca solo nombrando `.env.produccion` a propósito,
> y dos guardias impiden levantar contra Supabase o correr un comando destructivo por error. Ver
> [CONTRIBUTING.md](CONTRIBUTING.md#las-bases-y-los-archivos-de-entorno).

## Tests

```bash
npm test                    # unitarios: reglas y casos de uso, sin base
npm run test:e2e            # la API por HTTP, con la app real y una base en memoria
npm run test:integracion    # contra un Postgres real y vacío (docs/tests-de-integracion.md)
```

El CI corre los tres, más el lint y la compilación, en cada push y pull request.

## Cómo se trabaja

Ramas, formato de los commits, pull requests, versiones y migraciones:
**[CONTRIBUTING.md](CONTRIBUTING.md)**. Los cambios de cada versión: **[CHANGELOG.md](CHANGELOG.md)**.

## Documentación

| Documento | De qué trata |
|---|---|
| [docs/sistema.md](docs/sistema.md) | El sistema completo: qué hace cada parte y cómo está armado |
| [docs/plan-arquitectura.md](docs/plan-arquitectura.md) | Por qué está organizado en contextos y capas, y cómo se llegó |
| [docs/tests-de-integracion.md](docs/tests-de-integracion.md) | Los tests contra Postgres real |
| [docs/backups.md](docs/backups.md) | El backup nocturno cifrado y cómo restaurarlo |
| [docs/avisos-de-mantenimiento.md](docs/avisos-de-mantenimiento.md) | El correo diario con los services que vencen |
| [docs/base-de-prueba.md](docs/base-de-prueba.md) | Las bases de datos y los archivos de entorno |
