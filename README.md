# Mantenimiento — Backend (API)

API REST para la **gestión de stock de materiales** de un área de mantenimiento, con
trazabilidad completa de movimientos (entradas, salidas y ajustes).

Construida con **NestJS + Prisma + PostgreSQL (Supabase)**.

> Este repo es **autónomo**. El frontend vive en un repo separado (`mantenimiento2-frontend`)
> y se comunica con esta API por HTTP.

---

## Stack

- **NestJS** (TypeScript), arquitectura modular (un módulo por dominio).
- **Patrón repository**: los servicios no tocan Prisma; cada módulo tiene su repositorio.
- **Prisma** como ORM. Schema en `prisma/schema.prisma`.
- **PostgreSQL** alojado en **Supabase** (usado solo como Postgres gestionado).
- **class-validator / class-transformer** + `ValidationPipe` global (whitelist + transform).
- **Swagger** en `/docs`.
- Filtro de excepciones global → respuestas JSON uniformes.
- **CORS** habilitado para el origen del frontend.

---

## Requisitos

- Node.js 18+ y npm.
- Una base PostgreSQL (recomendado: proyecto en [Supabase](https://supabase.com)).

---

## 1. Instalar dependencias

```bash
npm install
```

## 2. Variables de entorno

Copiá el ejemplo y completá con tus datos:

```bash
cp .env.example .env
```

| Variable       | Descripción                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL` | Connection string del **pooler** de Supabase (con `?pgbouncer=true`). Runtime. |
| `DIRECT_URL`   | Connection string **directa** (puerto 5432). Solo para migraciones.         |
| `PORT`         | Puerto del servidor (default `3000`).                                       |
| `FRONTEND_URL` | Origen permitido por CORS (default `http://localhost:5173`).                |

> En Supabase: **Project Settings → Database → Connection string**.
> Usá el pooler (puerto 6543) para `DATABASE_URL` y la conexión directa (5432) para `DIRECT_URL`.

## 3. Generar el cliente Prisma y aplicar migraciones

```bash
npm run prisma:generate     # genera el cliente tipado
npm run prisma:migrate      # crea/aplica la migración inicial (usa DIRECT_URL)
```

## 4. Cargar datos de ejemplo (seed)

```bash
npm run seed
```

Crea categorías, proveedores, usuarios y materiales con algunos movimientos
(incluye un material que queda bajo el stock mínimo, para probar la alerta).

## 5. Levantar la API

```bash
npm run start:dev      # desarrollo (watch)
# o
npm run build && npm run start:prod
```

- API:     `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`

---

## Endpoints principales

Todos bajo el prefijo `/api`.

| Recurso       | Endpoints                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------ |
| Proveedores   | `GET/POST /proveedores`, `GET/PATCH/DELETE /proveedores/:id`                                |
| Categorías    | `GET/POST /categorias-material`, `GET/PATCH/DELETE /categorias-material/:id`                |
| Materiales    | `GET/POST /materiales`, `GET/PATCH/DELETE /materiales/:id`                                  |
|               | `GET /materiales/bajo-stock` — materiales con stock ≤ mínimo                                |
|               | `GET /materiales/:id/historial` — material + sus movimientos                               |
| Movimientos   | `POST /movimientos` — registra y actualiza stock (transacción)                             |
|               | `GET /movimientos?materialId=&tipo=&motivo=&fechaDesde=&fechaHasta=` — listado con filtros |
| Usuarios      | `GET/POST /usuarios`, `GET/PATCH/DELETE /usuarios/:id`                                      |

### Reglas de negocio del stock

- `stockActual` es **derivado**: solo cambia al registrar movimientos (nunca se edita a mano).
- `ENTRADA` suma, `SALIDA` resta, `AJUSTE` **fija** el stock al valor de `cantidad` (absoluto).
- No se permiten salidas que dejen el stock negativo (devuelve `400`). Para corregir, usar `AJUSTE`.
- Cada movimiento registra su `motivo` (COMPRA, TRABAJO, AJUSTE, DEVOLUCION, OTRO) para trazabilidad.

---

## Autenticación (preparada para Clerk)

Hoy la API está **sin autenticación** (endpoints abiertos). Está todo listo para enchufar Clerk:

- `Usuario.idExterno` (nullable) almacenará el ID de Clerk.
- `src/common/auth/guards/auth.guard.ts` es un guard **no-op** (deja pasar todo). Es el
  único punto a reemplazar por la verificación real del JWT de Clerk, sin tocar la lógica de negocio.

---

## Escalabilidad (preparado, no implementado)

El sistema apunta a gestionar también **herramientas, máquinas, equipos y vehículos**, que
son **activos individuales rastreables** (con número de serie, estado, ubicación, asignación),
a diferencia de los materiales que son **consumibles** (cantidad + movimientos).

La carpeta `src/common/` concentra lo reutilizable (Prisma, filtros, auth, DTOs comunes) para
agregar a futuro un módulo `activos` sin reescribir lo existente.

---

## Estructura

```
src/
├── main.ts                 # bootstrap: ValidationPipe, CORS, Swagger, filtro global
├── app.module.ts
├── config/                 # validación del .env
├── common/                 # prisma, filtros, auth no-op, DTOs comunes
└── modules/                # un módulo por dominio (controller + service + repository + dto)
    ├── proveedores/
    ├── categorias-material/
    ├── materiales/
    ├── movimientos-stock/
    └── usuarios/
```

## Scripts

| Script                    | Acción                              |
| ------------------------- | ----------------------------------- |
| `npm run start:dev`       | Levanta en modo watch               |
| `npm run build`           | Compila a `dist/`                   |
| `npm run start:prod`      | Corre el build                      |
| `npm run prisma:generate` | Genera el cliente Prisma            |
| `npm run prisma:migrate`  | Crea/aplica migraciones (dev)       |
| `npm run prisma:deploy`   | Aplica migraciones (producción)     |
| `npm run seed`            | Carga datos de ejemplo              |
| `npm run prisma:studio`   | Abre Prisma Studio                  |
| `npm run lint`            | ESLint + fix                        |
```
