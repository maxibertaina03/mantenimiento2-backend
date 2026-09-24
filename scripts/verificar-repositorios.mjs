/**
 * Comprueba que lo que se guarda es lo que se lee.
 *
 * Existe por un error real: el repositorio de órdenes de trabajo no guardaba la
 * resolución al crear una orden que nacía cerrada. Los tests no lo vieron
 * porque el repositorio en memoria copia el objeto entero, así que es más
 * permisivo que Prisma: cualquier campo que el de verdad se olvide de escribir,
 * el falso lo conserva igual.
 *
 * La única forma de ver esa diferencia es escribir y leer contra Postgres. Se
 * hace dentro de una transacción que se deshace al final: no queda ni una fila.
 *
 *   npm run build
 *   node -r dotenv/config scripts/verificar-repositorios.mjs dotenv_config_path=.env
 */
import { PrismaClient } from '@prisma/client';
import { PrismaRepositorioOrdenesTrabajo } from '../dist/contextos/trabajos/infraestructura/prisma-repositorio-ordenes-trabajo.js';
import { PrismaRepositorioTareas } from '../dist/contextos/trabajos/infraestructura/prisma-repositorio-tareas.js';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

class Deshacer extends Error {}
const resultados = [];
let fallos = 0;

/** Compara campo por campo y anota el que no volvió igual. */
function comparar(que, esperado, obtenido) {
  const malos = [];
  for (const [campo, valor] of Object.entries(esperado)) {
    const vuelto = obtenido[campo];
    const igual =
      valor instanceof Date ? vuelto?.getTime?.() === valor.getTime() : vuelto === valor;
    if (!igual) malos.push(`${campo}: se guardó ${JSON.stringify(valor)}, volvió ${JSON.stringify(vuelto)}`);
  }

  if (malos.length === 0) {
    resultados.push(`  OK  ${que}`);
  } else {
    fallos += 1;
    resultados.push(`  FALLA  ${que}`);
    for (const m of malos) resultados.push(`         ${m}`);
  }
}

try {
  await prisma.$transaction(
    async (tx) => {
      // `$transaction` se aplana: Postgres no anida transacciones.
      const fake = new Proxy(tx, {
        get: (obj, prop) => (prop === '$transaction' ? (fn) => fn(tx) : obj[prop]),
      });

      const [usuario] = await tx.$queryRawUnsafe(`select id from usuarios limit 1`);
      const [equipo] = await tx.$queryRawUnsafe(`select id from equipos limit 1`);
      const [proveedor] = await tx.$queryRawUnsafe(`select id from proveedores limit 1`);
      const [equipoIt] = await tx.$queryRawUnsafe(`select id from equipos_it limit 1`);
      const ahora = new Date();
      const dia = new Date(Date.UTC(2026, 8, 23));

      // ── Órdenes de trabajo ────────────────────────────────────────────────
      const ordenes = new PrismaRepositorioOrdenesTrabajo(fake);

      // Una orden que nace CERRADA, con todos los campos puestos. Es el caso
      // que se rompió: registrar un trabajo ya hecho.
      const cerrada = {
        titulo: 'Verificacion', descripcion: 'Detalle', tipo: 'CORRECTIVO', estado: 'CERRADA',
        equipoId: equipo.id, equipoItId: null, fecha: dia, ejecutor: 'EXTERNO', proveedorId: proveedor.id,
        costoManoObra: 45000, horasParada: 3.5, planId: null,
        abiertaEn: ahora, abiertaPorId: usuario.id, asignadoAId: usuario.id,
        resolucion: 'Se hizo esto', cerradaEn: ahora, cerradaPorId: usuario.id,
        motivoAnulacion: null,
      };
      const guardada = await ordenes.crear(cerrada);
      const leida = await ordenes.buscarPorId(guardada.id);
      comparar('orden que nace cerrada: vuelve completa', cerrada, leida);

      // Y la misma orden pero sobre un equipo de informatica: el campo es nuevo
      // y es exactamente el tipo de cosa que el repositorio se olvida de
      // escribir sin que ningun test en memoria lo note.
      const deInformatica = {
        titulo: 'Verificacion IT', descripcion: 'Limpieza', tipo: 'PREVENTIVO', estado: 'ABIERTA',
        equipoId: null, equipoItId: equipoIt.id, fecha: dia, ejecutor: 'INTERNO', proveedorId: null,
        costoManoObra: null, horasParada: null, planId: null,
        abiertaEn: ahora, abiertaPorId: usuario.id, asignadoAId: usuario.id,
        resolucion: null, cerradaEn: null, cerradaPorId: null, motivoAnulacion: null,
      };
      const guardadaIt = await ordenes.crear(deInformatica);
      comparar(
        'orden sobre un equipo de informatica: vuelve completa',
        deInformatica,
        await ordenes.buscarPorId(guardadaIt.id),
      );

      // ── Tareas programadas ────────────────────────────────────────────────
      const tareas = new PrismaRepositorioTareas(fake);
      const tarea = {
        titulo: 'Verificacion', descripcion: 'Detalle', fecha: dia, estado: 'PENDIENTE',
        asignadoAId: usuario.id, equipoId: equipo.id, equipoItId: null, planId: null, rutinaId: null,
        ordenTrabajoId: guardada.id, creadaPorId: usuario.id,
      };
      const tareaGuardada = await tareas.crear(tarea);
      comparar('tarea: vuelve completa', tarea, await tareas.buscarPorId(tareaGuardada.id));

      const tareaIt = { ...tarea, equipoId: null, equipoItId: equipoIt.id, ordenTrabajoId: null };
      const tareaItGuardada = await tareas.crear(tareaIt);
      comparar(
        'tarea de informatica: vuelve completa',
        tareaIt,
        await tareas.buscarPorId(tareaItGuardada.id),
      );

      // Y que actualizar tampoco pierda nada.
      const cambios = { estado: 'HECHA', asignadoAId: usuario.id, ordenTrabajoId: guardada.id };
      comparar('tarea actualizada: vuelve completa', cambios, await tareas.actualizar(tareaGuardada.id, cambios));

      // ── Rutinas ───────────────────────────────────────────────────────────
      const rutina = {
        titulo: 'Verificacion', descripcion: 'Detalle', cadaDias: 7,
        desde: dia, hasta: new Date(Date.UTC(2026, 11, 31)),
        equipoId: equipo.id, equipoItId: null, asignadoAId: usuario.id, activa: true,
        creadaPorId: usuario.id,
      };
      const rutinaGuardada = await tareas.crearRutina(rutina);
      comparar('rutina: vuelve completa', rutina, await tareas.buscarRutina(rutinaGuardada.id));

      const rutinaIt = { ...rutina, equipoId: null, equipoItId: equipoIt.id };
      const rutinaItGuardada = await tareas.crearRutina(rutinaIt);
      comparar(
        'rutina de informatica: vuelve completa',
        rutinaIt,
        await tareas.buscarRutina(rutinaItGuardada.id),
      );

      throw new Deshacer();
    },
    { timeout: 120_000 },
  );
} catch (error) {
  if (!(error instanceof Deshacer)) {
    console.log(resultados.join('\n'));
    console.error('\nERROR:', String(error.message).split('\n').slice(-4).join(' | '));
    await prisma.$disconnect();
    process.exit(1);
  }
}

console.log(resultados.join('\n'));
console.log(
  fallos === 0
    ? '\nTodo lo que se guarda vuelve igual. La base quedó intacta.'
    : `\n${fallos} repositorio(s) pierden datos. La base quedó intacta.`,
);

await prisma.$disconnect();
process.exit(fallos === 0 ? 0 : 1);
