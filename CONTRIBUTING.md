# Cómo se trabaja en este proyecto

## La regla

> **Ningún cambio va a `main` sin haber sido aprobado en `develop`.**

`main` es lo que usa la gente todos los días: Render lo despliega automáticamente
y pega contra la base de Supabase con los datos reales — 870 materiales, 1067
proveedores, 65 equipos IT y el historial de movimientos de stock.

Esto no es una formalidad. El sistema está en uso: un error en `main` no es un
test que falla, es alguien que no puede cargar un movimiento.

## Las ramas

| Rama | Qué es | Base de datos | Se despliega |
|---|---|---|---|
| `main` | Producción | Supabase | Render + Vercel, automático |
| `develop` | Desarrollo y prueba | Postgres de tu máquina | No, se corre local |

### Las bases y los archivos de entorno

| Archivo | `ENTORNO` | A dónde apunta | Cuándo se usa |
|---|---|---|---|
| `.env` | `local` | Postgres de tu máquina | Siempre. Es el que toman todos los comandos |
| `.env.produccion` | `produccion` | Supabase | Solo a propósito, pasándolo a mano |

**Producción es lo explícito.** Para leer o tocar la base real hay que nombrar
el archivo:

```bash
node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env.produccion
```

Dos frenos cuidan esto, y conviene saber qué cubre cada uno:

- `src/common/prisma/guardia-base.ts` corta el **arranque** si la base no
  corresponde al entorno. Con `ENTORNO=local` en tu `.env`, el backend no puede
  levantar contra Supabase ni por accidente.
- `scripts/guardia-entorno.js` bloquea los **comandos destructivos** de Prisma
  (`migrate dev`, `migrate reset`) salvo en `local` o `prueba`.

## El flujo

1. **Trabajar en `develop`**, nunca directo en `main`.

   ```bash
   git checkout develop
   ```

2. **Probar en local, contra la base de desarrollo**:

   ```bash
   npm run prueba:api        # backend en :3000 contra .env.prueba
   npm run test:all          # 332 unitarios + 97 e2e
   ```

3. **Que lo apruebe quien lo pidió.** No alcanza con que los tests pasen: los
   tests dicen que el código hace lo que se le pidió, no que lo pedido sea lo
   que hacía falta. Hay que verlo funcionando.

4. **Recién ahí, pasar a `main`**:

   ```bash
   git checkout main
   git merge develop
   git push origin main      # esto despliega a producción
   ```

5. **Volver a `develop`** para lo siguiente.

## Cómo se organiza el código

Hay dos formas conviviendo, y es a propósito:

- **`src/contextos/`** — bounded contexts con las capas separadas. Ahí va lo que
  tiene reglas de negocio.
- **`src/modules/`** — módulos Nest de toda la vida. Ahí viven los catálogos:
  guardan un nombre y lo devuelven.

Cuál usar para algo nuevo: **si no tiene reglas, módulo**. Envolver un
`findMany` en cuatro capas no lo hace más limpio, lo hace más largo. El plan
de para dónde va esto está en [docs/plan-arquitectura.md](docs/plan-arquitectura.md).

### Las cuatro capas

Tomando `contextos/trabajos` como ejemplo:

```
dominio/          las reglas. No importa NADA: ni Nest, ni Prisma, ni HTTP
puertos/          interfaces de lo que el dominio necesita del mundo
aplicacion/       casos de uso: orquestan dominio + puertos
infraestructura/  Prisma, controllers, DTOs, el módulo de Nest
```

La regla que ordena todo: **las dependencias apuntan hacia adentro**.
`infraestructura` conoce `aplicacion`, que conoce `dominio`. Nunca al revés. Si
un archivo de `dominio/` importa algo de `@nestjs` o `@prisma`, está mal puesto.

Cómo darse cuenta de que se respeta: los tests de `dominio/` corren en
milisegundos y no levantan nada.

### Los errores

El dominio no sabe que existe HTTP, así que no lanza `BadRequestException`.
Lanza un error propio que extiende una categoría de
`common/dominio/errores.ts`, y el filtro lo traduce en el borde:

| Categoría | Código |
|---|---|
| `ErrorNoEncontrado` | 404 |
| `ErrorNoAutorizado` | 403 |
| `ErrorConflicto` | 409 |
| `ErrorTransicionInvalida` | 409 |
| `ErrorDatosInvalidos` | 400 |

Cada contexto define **sus** clases en su `dominio/errores.ts`, extendiendo la
categoría que corresponda. Lo que se comparte es la categoría, no los errores:
dos contextos que comparten sus errores dejan de poder cambiar por separado.

El controller se registra con `@UseFilters(FiltroErroresDominio)` y listo.

### Hablar con otro contexto

Nunca importando su repositorio. Se define un **puerto** con lo mínimo que hace
falta y un adaptador que lo implementa. Ejemplo: `trabajos` necesita saber que
un equipo existe y cómo se llama, así que tiene
`puertos/consulta-equipos.ts` con tres campos, y no el modelo entero de equipos.

Así el día que el otro contexto cambie por dentro, acá no se entera nadie.

### Antes de mover un módulo a un contexto

> **Primero los tests contra el controller, a nivel HTTP.**

Los tests que prueban el service dejan de compilar apenas se parte en capas, y
hay que reescribirlos justo mientras se mueve el código — sin red. Los que
prueban la respuesta HTTP no saben cómo está organizado por dentro, así que
sobreviven al refactor y avisan si algo cambió.

Y la regla que hace esto verificable: **ningún refactor cambia una ruta, un DTO
ni un código de estado.** El frontend está desplegado: si la API pública no se
mueve, no se entera. Un cambio de comportamiento visible ya no es un refactor.

## Migraciones

Una migración se prueba primero en la base de desarrollo:

```bash
npm run local:nueva-migracion    # crea el SQL y lo aplica en tu base local
```

Si la migración **toca datos que ya existen** (renombrar columnas, cambiar
tipos, backfills), antes de llevarla a `main` hay que ensayarla contra
producción **dentro de una transacción con ROLLBACK**, verificando los conteos
antes y después. Hay ejemplos de eso en `scripts/`.

Render corre `prisma migrate deploy` en el build, así que la migración se aplica
sola al mergear a `main`. Eso significa que **una migración mal probada llega a
producción sin que nadie la revise de nuevo**.

## Lo que nunca se hace

- Correr `prisma migrate dev`, `migrate reset` o `--shadow-database-url` contra
  producción. Ya vació la base una vez. `scripts/guardia-entorno.js` bloquea los
  comandos que pasan por npm, pero **no protege contra un comando escrito a mano
  con la URL pegada**, que es exactamente como pasó.
- Pushear a `main` sin que el cambio haya estado funcionando en `develop`.
- Apuntar el `.env` a Supabase "un rato para ver algo". Para eso está
  `.env.produccion`, y los scripts de solo lectura.
- Dejar `AUTH_DISABLED=true` en producción: deja la API completamente abierta.

## Antes de mergear a `main`

- [ ] Los tests pasan (`npm run test:all`)
- [ ] Compila (`npm run build`)
- [ ] Sin errores de lint (`npx eslint "src/**/*.ts" "test/**/*.ts"`)
- [ ] Probado a mano en local contra tu base local
- [ ] Si hay migración: ensayada, y con ROLLBACK contra producción si toca datos
- [ ] Aprobado por quien pidió el cambio
