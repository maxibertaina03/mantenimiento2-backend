# Tests de integración

La aplicación entera —módulos, guard, validación, filtro de errores— contra un
**Postgres de verdad y vacío**, con todas las migraciones aplicadas. Están en
`test/integracion/*.int-spec.ts`.

Cubren lo que los e2e no pueden, porque corren contra un Prisma en memoria que
no modela tareas ni planes:

- las consultas reales del calendario (los OR, los filtros por plan, «lo mío o
  lo de nadie» de la pantalla Hoy);
- la columna `INTEGER[]` de los días de trabajo;
- que cerrar el trabajo de un plan corra el plan **y** deje hecha la tarea del
  calendario, por cualquiera de los caminos.

## La guarda: nunca contra otra base

Cada test **vacía la base**. Por eso solo corren si `INTEGRACION_DATABASE_URL`
apunta a una base que cumple las dos cosas:

1. está en esta máquina (`localhost`, `127.0.0.1`) o es el servicio `postgres`
   del CI;
2. su nombre termina en `_integracion`.

Producción no cumple ninguna; la copia local de producción (`mantenimiento`)
no cumple la segunda. La URL sale solo de esa variable, nunca de `DATABASE_URL`
ni del `.env`. La guarda tiene su propio test
(`test/integracion/base-de-integracion.int-spec.ts`).

## Correrlos en tu PC

Con el Postgres local que ya usás para la copia de producción, en una base
aparte (si no existe, Prisma la crea):

```bash
INTEGRACION_DATABASE_URL="postgresql://USUARIO:CLAVE@localhost:5432/mantenimiento_integracion" \
  npm run test:integracion
```

Antes de empezar se corre `prisma migrate deploy` contra esa base —nunca
`migrate dev` ni `reset`—. Correos, Supabase y Sentry quedan apagados.

## En el CI

El workflow `ci.yml` levanta un Postgres 16 vacío como servicio y corre estos
tests después de los e2e. Ese Postgres nace y muere con cada corrida.

## Escribir uno nuevo

- `levantarApp()` y `vaciarBase(t)` en `beforeAll` / `beforeEach`
  (`test/integracion/app-de-integracion.ts`).
- Fechas fijas y pasadas cuando se puede, así el resultado no depende del día.
  Lo que el calendario genera solo cerca de hoy (de 30 días atrás a 90
  adelante) va con `lunesQueViene()`.
