# Plan: llevar el backend a bounded contexts

Estado al 2026-09-24. Este documento decide **qué se migra, qué no, y en qué
orden**. La respuesta corta es que sí es viable, que ya estamos a mitad de
camino, y que migrar *todo* sería un error.

## Dónde estamos hoy

El backend son unas 16.800 líneas de `src`, partidas casi por la mitad:

| | Líneas | Tests |
|---|---|---|
| `contextos/` (DDD completo) | 8.380 | 4.007 |
| `modules/` (Nest convencional) | 8.403 | 5.373 |

Tres cosas que ya están resueltas y que son las que suelen hacer inviable una
migración así:

- **La persistencia ya está separada.** 10 de los 12 módulos tienen su
  `*.repository.ts`, y **ningún service toca `PrismaService` directo**. La
  mitad difícil del patrón repository ya está hecha.
- **Los módulos casi no se conocen entre sí.** En todo `src` hay *un* import
  que cruza un límite de módulo (trabajos → movimientos-stock), y ya pasa por
  un puerto. No hay una maraña que desarmar.
- **Hay tests, y muchos.** Los módulos grandes están cubiertos casi uno a uno
  (órdenes de compra: 1.387 líneas de test sobre 1.613 de código).

Lo que falta para "clean architecture" son tres cosas concretas:

1. Los repositorios son **clases de Prisma**, no interfaces. Falta el puerto y
   el símbolo de inyección: hoy el service depende de la implementación.
2. Las reglas de negocio están escritas **como excepciones HTTP de Nest**.
   En `ordenes-compra.service.ts` hay 17 `throw` de `BadRequestException` y
   compañía. "No se puede emitir una orden sin renglones" es una regla del
   negocio, no un código 400: hoy el dominio depende del framework web.
3. No hay casos de uso. El service es una clase grande que hace todo.

## Qué NO conviene migrar

De los 12 módulos, **7 son catálogos**: categorías, estanterías, proveedores,
responsables, tipos de equipo, unidades de medida y usuarios. Son 1.991 líneas
entre todos, y lo que hacen es guardar un nombre y devolverlo.

Darles dominio, puertos, casos de uso e infraestructura significa cinco
archivos y tres carpetas para envolver un `findMany`. El "dominio" de unidades
de medida sería una función que comprueba que el símbolo no esté vacío. Eso no
es arquitectura limpia: es ceremonia, y hace el código **más** difícil de leer,
que es exactamente lo contrario de lo que buscamos.

**Se quedan como están.** Si alguna vez a un catálogo le crecen reglas de
verdad, se migra ese, ese día.

Usuarios es un caso aparte: no es dominio del negocio, es autenticación y
permisos. También se queda.

## Los contextos que quedarían

La parte que de verdad vale de este trabajo no es migrar módulo por módulo:
es **reagrupar**. Un bounded context no se corresponde con una tabla. Hoy el
pañol está repartido en cinco módulos que solo tienen sentido juntos.

| Contexto | Qué se lleva | Estado |
|---|---|---|
| `equipos` | máquinas de planta, planes, intervenciones, avisos | **hecho** |
| `trabajos` | órdenes de trabajo, tareas, rutinas, calendario | **hecho** |
| `panol` | materiales y movimientos de stock (los catálogos quedan como módulos) | **hecho** (en develop) |
| `compras` | órdenes de compra, comprobantes y envío (proveedores queda como módulo) | **hecho** (en develop) |
| `informatica` | equipos IT y credenciales (tipos y responsables quedan como módulos) | **hecho** (en develop) |
| `usuarios` | auth y permisos | queda como módulo |

## El riesgo real, y cómo se evita

**El peligro no es romper el código: es quedarse sin red a mitad del salto.**

Los tests de hoy prueban el service tal como está. Al partirlo en dominio y
casos de uso, esos tests dejan de compilar y hay que reescribirlos — y se
reescriben *mientras* se mueve el código, que es justo cuando más falta hacen.
Así es como un refactor "seguro" rompe la recepción de mercadería.

La mitigación es una sola, y es innegociable:

> Antes de tocar un módulo, escribir tests **contra el controller**, a nivel
> HTTP: esta petición devuelve este cuerpo y este código. Esos tests no saben
> cómo está organizado el código por dentro, así que **sobreviven al refactor**
> y son los que avisan si algo cambió de comportamiento.

Y una regla dura que hace todo esto verificable:

> **Ningún refactor cambia una ruta, un DTO ni un código de estado.** El
> frontend está desplegado y andando: si la API pública no se mueve, el
> frontend no se entera de nada. Un cambio de comportamiento visible ya no es
> un refactor, es otra tarea.

## El orden

Va del más aislado al más riesgoso, no del más chico al más grande.

### Fase 0 — Unificar el patrón (1 sesión)

No mueve ningún módulo. Deja escrito el molde:

- Unificar `filtro-errores-dominio.ts` (equipos) y `filtro-errores-trabajo.ts`
  (trabajos) en uno solo: es el que traduce un error de dominio a un código
  HTTP, y es lo que permite que el dominio no importe nada de Nest.
- Escribir la guía corta del patrón en `CONTRIBUTING.md`: qué va en `dominio`,
  qué en `aplicacion`, qué en `puertos`, qué en `infraestructura`.

### Fase 1 — `informatica`, empezando por credenciales (2-3 sesiones)

Credenciales es el candidato ideal para estrenar: **1.137 líneas, reglas de
verdad** (cifrado, revelado auditado) y **nadie depende de él**. Si el patrón
no cierra, se descubre acá y no en el módulo que mueve stock.

Después equipos IT, tipos y responsables entran al mismo contexto.

### Fase 2 — `panol` (3-4 sesiones)

Materiales y movimientos de stock son **la verdad del inventario**: lo que
dice cuánto hay. Es el contexto con más para ganar, porque las reglas de stock
hoy están repartidas entre dos services.

Acá aparece el trabajo de reagrupar de verdad: cinco módulos entran, un
contexto sale.

**Cómo quedó (2026-09-29).** Entraron materiales y movimientos; categorías,
estanterías y unidades siguieron como módulos, igual que tipos y responsables
en informática: son catálogos, y se los consulta por un puerto angosto.

- Las reglas de stock —qué hace cada tipo de movimiento, que nada quede
  negativo, el ajuste que no se puede pisar por detrás, quién corrige qué— son
  funciones puras en `panol/dominio`.
- La transacción con `SELECT ... FOR UPDATE` y el recálculo del historial al
  editar se movieron **sin cambiar una línea** de lógica al adaptador Prisma.
- El pañol **no** usa `FiltroErroresDominio`: traduce sus errores a las mismas
  excepciones de Nest de antes (`traducir-errores.ts`). Así la respuesta es
  idéntica byte a byte, y órdenes de compra —que no es un contexto— sigue
  recibiendo un 400 y no un 500 cuando el stock no alcanza.
- `MaterialesService` y `MovimientosStockService` conservan nombre y firmas:
  compras y trabajos solo cambiaron la ruta del import.

Dos redes lo verificaron: los e2e HTTP (`test/panol.e2e-spec.ts`, escritos
antes de mover nada) y una comparación contra la copia local de producción
(`scripts/caracterizar-panol.mjs`): 42 pedidos, incluida la suma del stock de
los 506 materiales, con respuestas idénticas antes y después.

### Fase 3 — `compras` (3-4 sesiones)

Última a propósito. Órdenes de compra es el corazón operativo: máquina de
estados (BORRADOR → EMITIDA → RECIBIDA / ANULADA), mueve stock al recibir y
manda correo a proveedores de verdad. Se toca cuando el patrón ya se probó dos
veces.

**Cómo quedó (2026-09-29).** El ciclo de vida, el comprobante obligatorio y
la revisión de los renglones son funciones puras en `compras/dominio`; el
armado del correo también. Dos casos de uso: gestionar las órdenes y
enviarlas.

- La recepción sigue siendo UNA transacción en el adaptador Prisma —stock con
  lock, fichas de equipo y cierre de la orden—, movida sin cambiar su lógica.
  Partirla para que pase por el pañol haría posible una orden recibida a
  medias. Lo que sí pasa por el pañol, por su puerta pública, es la pregunta:
  si el material se puede comprar y si la fecha choca con un ajuste.
- Proveedores quedó como módulo (es un catálogo) y comprobantes como un
  service de infraestructura (es casi solo el almacén de archivos).
- Igual que el pañol, traduce sus errores a las excepciones de antes. Los del
  renglón (`ErrorRenglonInvalido`) ya salían por el filtro de dominio y se
  dejan pasar, para que sigan saliendo igual.

Antes de moverlo, la red encontró un error de producción: editar un borrador
perdía los datos del equipo de sus renglones y la orden ya no se podía
recibir. Se arregló en un commit aparte (ninguna orden real estaba afectada).
Después del refactor, los 163 e2e y la comparación de 63 pedidos contra la
copia de producción (`scripts/caracterizar-compras.mjs`) dan idéntico.

## Qué mejora esto, y qué no

**No mejora** nada de lo que ve la gente en la planta: ni una pantalla más
rápida ni una función nueva. Tampoco arregla ningún error de hoy.

**Mejora** la capacidad de cambiar sin miedo:

- Las reglas quedan en archivos sin framework, sin base y sin HTTP, que se
  prueban en milisegundos y se leen como lo que el negocio hace.
- Un cambio de regla toca un archivo de dominio, no un service de 429 líneas
  donde la regla está mezclada con el mapeo de DTOs.
- Cambiar Prisma, Supabase o el proveedor de correo pasa a ser escribir un
  adaptador nuevo.

**Cuesta** más archivos y más indirección. Ese costo se paga solo donde hay
reglas — por eso los catálogos se quedan afuera.

## El frontend

Fuera de alcance. "Clean architecture" en React no es lo mismo y no se traduce
uno a uno; lo que le haría bien es otra discusión (separar las llamadas a la
API del render, sobre todo en las páginas que ya pasan las 900 líneas).

## Resumen

Viable, y a mitad de camino. **Unas 6.400 líneas a migrar** en cinco módulos
con reglas reales, **1.991 líneas que se quedan como están** porque son
catálogos, y **8-12 sesiones** repartidas en cuatro fases que se pueden frenar
en cualquier punto: cada fase deja el sistema andando y desplegable.

El orden importa más que la velocidad. Credenciales primero, compras último.
