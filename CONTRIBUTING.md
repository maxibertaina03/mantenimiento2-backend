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

2. **Probar en local**:

   ```bash
   npm run local:api          # la API en :3000 contra la base local (.env)
   npm run test:all           # unitarios + de punta a punta
   npm run test:integracion   # si tocaste consultas, el calendario o una migración
   ```

3. **Que lo apruebe quien lo pidió.** No alcanza con que los tests pasen: los
   tests dicen que el código hace lo que se le pidió, no que lo pedido sea lo
   que hacía falta. Hay que verlo funcionando.

4. **Commit con el formato acordado** (ver [Los commits](#los-commits)) y push a
   `develop`. El CI corre solo; hay que esperarlo en verde:

   ```bash
   git push origin develop
   gh run watch          # o mirar la pestaña Actions
   ```

5. **Pull request `develop` → `main`.** `main` no acepta pushes directos: solo
   entra por pull request y con el CI en verde, también para el administrador.
   El pull request lleva el resumen de lo que entra (la plantilla lo pide) y,
   si es una versión nueva, el `CHANGELOG.md` y el `package.json` ya
   actualizados (ver [Las versiones](#las-versiones)).

   ```bash
   gh pr create --base main --head develop --title "v1.2.0: recepción en partes"
   ```

6. **Mergear con «Create a merge commit»** (los otros modos están apagados):
   `develop` sigue viva, y un *squash* la dejaría desfasada de `main`. Al
   mergear, Render se publica solo.

7. **Marcar la versión y traer `main` a `develop`**:

   ```bash
   git fetch origin
   git tag -a v1.2.0 origin/main -m "v1.2.0"
   git push origin v1.2.0
   gh release create v1.2.0 --notes-from-tag   # o --notes con la entrada del CHANGELOG
   git checkout develop && git merge --ff-only origin/main && git push origin develop
   ```

## Los commits

Cada commit dice qué cambia, con este formato
([Conventional Commits](https://www.conventionalcommits.org/es/)):

```
tipo(ámbito): qué cambia, en presente y en castellano

Por qué hacía falta, si no es obvio: el problema que había, la decisión que se
tomó y lo que se descartó. Esto es lo que se lee dentro de un año.
```

- **El título**, hasta 72 caracteres. El **ámbito** es la parte que toca:
  `compras`, `trabajos`, `equipos`, `panol`, `informatica`, `hoy`, `modales`…
- **Los tipos**:

  | Tipo | Cuándo |
  |---|---|
  | `feat` | Algo nuevo que se puede usar |
  | `fix` | Un error arreglado |
  | `docs` | Solo documentación |
  | `refactor` | Cambia el código sin cambiar lo que hace |
  | `test` | Solo tests |
  | `perf` | Más rápido, mismo resultado |
  | `ci`, `build`, `chore` | El CI, la compilación, dependencias y orden |
  | `style` | Formato, sin cambio de código |
  | `revert` | Deshace un commit anterior |

- Ejemplos: `feat(compras): recibir una orden en varias entregas`,
  `fix(calendario): un service adelantado no cae en un día ya hecho`.
- **Un commit, un cambio.** Si el título necesita un «y», probablemente son dos.

El CI rechaza un push o pull request con commits que no siguen el formato
(`scripts/verificar-commits.mjs`). Se puede revisar antes de subir:

```bash
node scripts/verificar-commits.mjs origin/develop..HEAD
```

## Las versiones

Cada vez que algo llega a producción se marca una versión `vMAYOR.MENOR.PARCHE`
([versionado semántico](https://semver.org/lang/es/)):

| Sube | Cuándo | Ejemplo |
|---|---|---|
| **PARCHE** | Solo arreglos | 1.2.0 → 1.2.1 |
| **MENOR** | Algo nuevo, compatible con lo que había | 1.2.1 → 1.3.0 |
| **MAYOR** | Un cambio que obliga a cambiar el otro repo a la vez, o que rompe algo que se usaba | 1.3.0 → 2.0.0 |

Los dos repos se versionan por separado. En el mismo pull request:

1. `npm version <nueva> --no-git-tag-version` (actualiza `package.json` y el lock);
2. una entrada nueva arriba de todo en `CHANGELOG.md`, con lo que cambió **para
   quien usa el sistema**, no la lista de commits.

Después del merge, el tag y el Release en GitHub (paso 7 del flujo).

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

### Dónde se arma cada caso de uso

En `infraestructura/casos-de-uso.providers.ts` de su contexto, con una fábrica
de parámetros tipados, y nunca con `new` dentro de un controlador:

```ts
{
  provide: GestionarFotos,
  useFactory: (fotos: RepositorioFotos, almacen: AlmacenImagenes, equipos: RepositorioEquipos) =>
    new GestionarFotos(fotos, almacen, equipos),
  inject: [REPOSITORIO_FOTOS, ALMACEN_IMAGENES, REPOSITORIO_EQUIPOS],
},
```

El controlador lo recibe armado (`constructor(private readonly gestionar:
GestionarFotos) {}`) y solo traduce HTTP. Los casos de uso siguen sin saber que
existe Nest: se prueban con `new` y dobles en memoria, como siempre.

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

El adaptador usa al otro contexto **solo por su puerta pública**, el `index.ts`
de su carpeta: `import { MovimientosStockService } from '../../panol'`. Entrar a
sus carpetas (`../../panol/infraestructura/...`) es un error de lint —la regla
está en `.eslintrc.cjs`— y el CI no lo deja pasar. Si hace falta algo que la
puerta no ofrece, se agrega a la puerta, a la vista.

Cuando una regla cruza contextos, tiene **un** caso de uso dueño. El ejemplo es
`trabajos/aplicacion/registrar-trabajo-de-plan.ts`: hacer el trabajo de un plan
corre el plan (equipos) y cierra la tarea (calendario), siempre juntas. No se
reparte entre un caso de uso y un controlador.

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

- [ ] Los tests pasan (`npm run test:all`) y, si tocaste el calendario, los
      planes o una consulta, también `npm run test:integracion`
      ([docs/tests-de-integracion.md](docs/tests-de-integracion.md)). El CI corre
      los tres.
- [ ] Compila (`npm run build`)
- [ ] Sin errores de lint (`npx eslint "src/**/*.ts" "test/**/*.ts"`)
- [ ] Probado a mano en local contra tu base local
- [ ] Si hay migración: ensayada, y con ROLLBACK contra producción si toca datos
- [ ] Aprobado por quien pidió el cambio
- [ ] Commits con el formato acordado
- [ ] Si es una versión nueva: `package.json` y `CHANGELOG.md` actualizados
- [ ] Si cambió una parte del sistema: [docs/sistema.md](docs/sistema.md) actualizado
