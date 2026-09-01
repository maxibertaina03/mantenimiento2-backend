# Base de datos de prueba

Producción ya tiene datos reales: 868 materiales, 1067 proveedores, 65 equipos
IT y 41 movimientos de stock. Probar migraciones ahí es jugarse esos datos —
ya pasó una vez y los movimientos perdidos no se recuperaron.

Esta guía deja una segunda base, idéntica en estructura, donde romper lo que
haga falta.

## Crear la base de prueba (una sola vez)

1. En [supabase.com](https://supabase.com) → **New project**.
   - Nombre: `mantenimiento2-prueba`
   - **Tiene que ser un proyecto aparte**, no otro esquema dentro del de
     producción: si comparten proyecto, un reset se lleva puestos los datos
     reales y no habría ganado nada.
   - El plan gratuito permite dos proyectos.

2. Project Settings → **Database** → copiar las cadenas de conexión.

3. En `mantenimiento2-backend`:

   ```bash
   cp .env.prueba.example .env.prueba
   ```

   Completar `DATABASE_URL` y `DIRECT_URL` con las del proyecto **de prueba**.
   `.env.prueba` está en `.gitignore`; no se sube nunca.

4. Crear las tablas y cargar datos de ejemplo:

   ```bash
   npm run prueba:migrar
   npm run prueba:seed
   ```

## El día a día

| Comando | Qué hace |
|---|---|
| `npm run prueba:api` | Levanta la API contra la base de prueba |
| `npm run prueba:migrar` | Aplica las migraciones pendientes |
| `npm run prueba:nueva-migracion` | Crea una migración a partir de cambios en el schema |
| `npm run prueba:reset` | **Borra todo** y reconstruye desde cero |
| `npm run prueba:seed` | Carga datos de ejemplo |
| `npm run prueba:studio` | Abre Prisma Studio sobre la base de prueba |

Para trabajar en el frontend contra esta base, en `mantenimiento2-frontend`
poné `VITE_API_URL=http://localhost:3000/api` en tu `.env.local`.

`.env.prueba` trae `AUTH_DISABLED=true`, así se prueba sin depender del login de
Clerk. **Eso nunca va a producción**: deja la API completamente abierta.

También deja el envío de correo apagado, para no mandarle una orden a un
proveedor de verdad mientras se prueba.

## El freno

`scripts/guardia-entorno.js` bloquea los comandos que pueden borrar datos si el
entorno no declara `ENTORNO=prueba`. Como el `.env` de producción no lo declara,
apuntarle un `reset` falla ahí en vez de vaciar la base.

Por el mismo motivo se eliminó el script `prisma:migrate` (`prisma migrate dev`):
apuntaba al `.env` de producción y puede resetear la base sin avisar de forma
clara. Para producción quedó solo `prisma:deploy`, que aplica migraciones ya
revisadas y nunca borra nada.

**El freno no reemplaza el cuidado.** No protege contra un comando escrito a
mano con la URL de producción pegada, que es exactamente lo que pasó la vez que
se perdieron los datos. Regla: ningún comando de Prisma con una URL escrita a
mano, nunca.

## Cómo trabajar de ahora en más

1. Cambiar el `schema.prisma`.
2. `npm run prueba:nueva-migracion` → genera el SQL y lo aplica en la de prueba.
3. Probar la app con `npm run prueba:api`.
4. `npm run test:all` — 319 unitarios + 86 e2e.
5. Commit y push. Render corre `prisma migrate deploy` en el build y aplica la
   migración ya probada.

Si una migración toca datos existentes (renombrar columnas, cambiar tipos,
backfills), conviene ensayarla contra producción **dentro de una transacción con
ROLLBACK** antes de desplegarla, como se hizo con el catálogo de unidades. Ver
`scripts/` para los ejemplos.

## Lo que la base de prueba NO resuelve

Supabase en plan gratuito **no tiene backups restaurables**. Si producción se
rompe, no hay de dónde volver. Vale la pena, aparte de esto:

- Exportar periódicamente `materiales`, `proveedores` y `equipos_it` a CSV desde
  el Table Editor.
- O pasar al plan pago de Supabase, que incluye backups diarios.
