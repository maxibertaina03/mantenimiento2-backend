# Cómo se prueba sin tocar producción

Producción tiene los datos de verdad del pañol, las compras y los equipos. Ya
pasó una vez que un comando de Prisma apuntado a producción borró la base, y lo
perdido no se recuperó. Esta guía es cómo se trabaja desde entonces: todo se
prueba antes en una copia, y a producción solo llega lo que ya se ensayó.

## Las bases y los archivos de entorno

| Archivo | Apunta a | Para qué |
|---|---|---|
| `.env` | El Postgres **local** (`localhost`, `ENTORNO=local`) | El trabajo de todos los días |
| `.env.produccion` | Producción (Supabase) | **Solo** para leer: copiar a local, contar filas, ensayar migraciones con ROLLBACK |
| `.env.prueba` | Una base de prueba remota (`ENTORNO=prueba`) | Hoy sin uso: la de Neon no responde desde 2026-09-23 |

Ninguno se sube a git (están en `.gitignore`); los modelos son `.env.example` y
`.env.prueba.example`. Los tests de integración usan una base aparte,
`mantenimiento_integracion`, que vacían antes de cada test (ver
[tests-de-integracion.md](tests-de-integracion.md)).

En el `.env` local conviene poner `AUTH_DISABLED=true` (el modelo trae `false`): se
prueba sin login y la API trata al que entra como administrador. **Eso nunca va a producción**: deja la API
abierta. Tampoco hay almacén de archivos configurado en local, a propósito: una
foto que se sube probando no llega al almacén real.

## 1. Traer los datos de producción a local

```bash
npm run local:copiar-produccion
```

Copia producción entera a la base local. **De producción solo lee** (`pg_dump`
en una transacción de solo lectura); lo que se rehace es la base local. El
script corta antes de tocar nada si el destino no es `localhost`, por si algún
día se invierten los archivos.

Con eso se prueba cada cambio contra los datos de verdad: los mismos
materiales, equipos y tomas que ve la planta.

## 2. Trabajar y probar en local

| Comando | Qué hace |
|---|---|
| `npm run local:api` | Levanta la API contra la base local |
| `npm run local:migrar` | Aplica las migraciones pendientes a la base local |
| `npm run local:studio` | Abre Prisma Studio sobre la base local |
| `npm test` · `npm run test:e2e` · `npm run test:integracion` | Las tres tandas de tests |

Para el frontend contra esta API: `VITE_API_URL=http://localhost:3000/api` en el
`.env.local` de `mantenimiento2-frontend`.

## 3. Una migración nueva

Las migraciones se escriben a mano, a partir de la diferencia entre el esquema
de antes y el nuevo, **nunca** con `prisma migrate dev` contra una base que
importe:

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-viejo.prisma
npx prisma migrate diff \
  --from-schema-datamodel /tmp/schema-viejo.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

El SQL que sale va en `prisma/migrations/<fecha>_<nombre>/migration.sql`, con un
comentario arriba que diga qué hace y si toca datos. Después
`npm run local:migrar` la aplica en local.

## 4. Ensayarla contra producción, y deshacerla

```bash
node -r dotenv/config scripts/ensayar-migracion.mjs dotenv_config_path=.env.produccion \
  --migracion=20261022160000_reubicaciones_en_la_toma
```

Corre el SQL de verdad, contra los datos de verdad, dentro de una transacción
que **se deshace siempre** al final. Si iba a fallar por una fila que solo
existe en producción, falla acá y no durante el despliegue. Varias migraciones
que dependen una de otra van separadas por comas y se ensayan juntas.

Va por `DIRECT_URL` y no por el pooler: en modo transacción, PgBouncer no
garantiza que todas las sentencias caigan en la misma sesión, y el ROLLBACK
podría no alcanzar a todas.

## 5. La foto de antes y la de después

```bash
node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env.produccion
```

Cuenta las filas de todas las tablas. Se corre **antes** de publicar y
**después** de que Render aplicó la migración, y se comparan las dos salidas:
solo puede cambiar lo que la migración tenía que cambiar (una tabla nueva, la
fila de `_prisma_migrations`). Si cambió otra cosa, algo se llevó puesto algo.

Ojo: sin `dotenv_config_path=.env.produccion` cuenta la base **local**. El
script imprime a qué base se conectó; conviene mirarlo siempre.

## 6. Publicar

El flujo de ramas, commits y versiones está en [CONTRIBUTING.md](../CONTRIBUTING.md).
Render corre `prisma migrate deploy` al desplegar: aplica las migraciones ya
ensayadas y nunca borra nada.

## Los frenos

- `scripts/guardia-entorno.js` bloquea los comandos que pueden borrar datos
  (`local:nueva-migracion`, `local:reset` y sus pares `prueba:*`) si el entorno
  no declara `ENTORNO=local` o `ENTORNO=prueba`. `.env.produccion` declara
  `produccion`, así que un `reset` apuntado ahí falla antes de empezar.
- No hay ningún script que corra `migrate dev` o `reset` contra producción.
  Para producción quedó solo `prisma:deploy`.
- **Los frenos no reemplazan el cuidado.** No protegen contra un comando escrito
  a mano con la URL de producción pegada, que es exactamente lo que pasó la vez
  que se perdieron los datos. Regla: ningún comando de Prisma con una URL
  escrita a mano, nunca.

## Si algo sale mal igual

Todas las noches se guarda una copia cifrada de producción en Google Drive. Cómo
restaurarla está en [backups.md](backups.md).
