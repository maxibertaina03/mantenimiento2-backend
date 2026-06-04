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

## Autenticación (Clerk)

La API usa **Clerk** para autenticar. El `GuardAutenticacion` (en `src/common/auth/`) está
registrado como **guard global**: toda la app queda detrás del login, salvo rutas marcadas
con `@Public()`.

Flujo del guard:
1. Verifica el JWT de Clerk del header `Authorization: Bearer <token>`.
2. **Just-in-time provisioning**: en el primer request de cada usuario, crea (o vincula por
   email) su fila en la tabla `usuarios`, guardando el ID de Clerk en `idExterno` y rol
   `OPERARIO` por defecto.
3. Adjunta el usuario a la request (disponible vía `@UsuarioActual()`). Los movimientos
   registran automáticamente quién los creó.

### Configurar Clerk

1. Creá una aplicación en [clerk.com](https://clerk.com).
2. En **API Keys**, copiá la **Secret key** (`sk_test_…`).
3. En el `.env`:
   ```
   CLERK_SECRET_KEY="sk_test_..."
   AUTH_DISABLED="false"
   ```
4. Reiniciá la API. A partir de ahí, cada request necesita un JWT válido de Clerk
   (el frontend lo adjunta solo; en Swagger usá el botón **Authorize** y pegá un token).

### `AUTH_DISABLED` (solo desarrollo)

`AUTH_DISABLED="true"` deja **todos** los endpoints abiertos (sin verificar token). Útil
para probar sin login mientras configurás Clerk. Default seguro: `"false"`.

> El `Usuario.idExterno` (nullable) almacena el ID de Clerk. El guard es el único punto que
> toca la autenticación; la lógica de negocio de los módulos no cambia.

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
