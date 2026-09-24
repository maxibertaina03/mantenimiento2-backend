/**
 * Llena el calendario de septiembre y octubre para poder mirar la impresión.
 *
 * No es un seed del sistema: es un juego de datos para ver cómo sale una hoja
 * con carga de verdad. Por eso las tareas no son todas iguales ni prolijas,
 * que es justo lo que no sirve para probar una impresión:
 *
 * - días con una sola tarea y días con cuatro, que es donde la celda se rompe;
 * - títulos cortos y títulos largos, que es donde el texto desborda;
 * - pendientes, hechas y canceladas, para ver los tres colores;
 * - repartidas entre los cuatro de mantenimiento, y algunas sin dueño;
 * - con equipo y sin equipo.
 *
 * **Solo corre contra la base local.** Inserta filas: apuntado a producción le
 * llenaría el calendario de tareas inventadas a gente que trabaja.
 *
 *   node -r dotenv/config scripts/datos-de-prueba-calendario.mjs dotenv_config_path=.env
 *   ... con --limpiar para borrarlas y dejar el calendario como estaba.
 */
import { PrismaClient } from '@prisma/client';

const LIMPIAR = process.argv.includes('--limpiar');
const url = process.env.DIRECT_URL ?? '';

// ── La guarda ─────────────────────────────────────────────────────────────
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();

if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  console.error(
    `\n⛔ Este script escribe, y la base es ${host || '(ilegible)'}, que no es local.\n` +
      '   Son datos inventados: en producción le llenarían el calendario a gente que trabaja.\n',
  );
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Un día de 2026 a medianoche UTC, que es como los guarda el sistema. */
const dia = (mes, numero) => new Date(Date.UTC(2026, mes - 1, numero));

const DESDE = dia(9, 1);
const HASTA = dia(10, 31);

// ── Limpieza ──────────────────────────────────────────────────────────────
// Se borra todo lo del rango y se vuelve a crear, para poder correrlo muchas
// veces sin acumular. En local no hay nada que conservar.
const borradas = await prisma.tareaProgramada.deleteMany({
  where: { fecha: { gte: DESDE, lte: HASTA } },
});
const rutinasBorradas = await prisma.rutinaTarea.deleteMany({});
console.log(`Limpieza: ${borradas.count} tarea(s) y ${rutinasBorradas.count} rutina(s).`);

if (LIMPIAR) {
  console.log('Listo: el calendario quedó vacío.');
  await prisma.$disconnect();
  process.exit(0);
}

// ── Con qué se arma ───────────────────────────────────────────────────────
const usuarios = await prisma.usuario.findMany({ select: { id: true, nombre: true, rol: true } });
const gente = usuarios.filter((u) => u.rol === 'MANTENIMIENTO');
const admin = usuarios.find((u) => u.rol === 'ADMIN') ?? null;

if (gente.length === 0) {
  console.error('No hay usuarios de mantenimiento en esta base. ¿Se copió producción?');
  await prisma.$disconnect();
  process.exit(1);
}

/** Equipos de verdad, para que los nombres del calendario sean los reales. */
const equipos = await prisma.equipo.findMany({
  select: { id: true, nombre: true },
  take: 40,
  orderBy: { nombre: 'asc' },
});

const buscarEquipo = (texto) =>
  equipos.find((e) => e.nombre.toLowerCase().includes(texto.toLowerCase()))?.id ?? null;

const quien = (i) => gente[i % gente.length].id;

/**
 * Las tareas: [mes, día, título, estado, a quién, equipo].
 *
 * `null` en el dueño es a propósito: son las que el calendario muestra como
 * "sin repartir", y son las que hay que poder ver de un vistazo en la hoja.
 */
const TAREAS = [
  // ── Septiembre ──
  [9, 1, 'Revisar presión de caldera y purgar', 'HECHA', quien(0), 'Bomba caldera 1'],
  [9, 2, 'Control de temperatura de cámaras', 'HECHA', quien(1), null],
  [9, 3, 'Limpieza de filtros del pasteurizador', 'HECHA', quien(0), 'Bomba de leche pasteurizador'],
  [9, 4, 'Engrase general de bombas de sala', 'HECHA', quien(2), 'Bomba 2'],
  [9, 7, 'Cambio de aceite del compresor', 'HECHA', quien(1), null],
  [9, 8, 'Revisar pérdida en la bomba del saladero', 'HECHA', quien(0), 'Bomba de agua saladero'],
  [9, 9, 'Calibración de balanza de expedición', 'HECHA', quien(3), 'Balanza 1'],
  [9, 10, 'Control de ablandador de agua y sal', 'HECHA', quien(2), 'Ablandador de agua'],
  [9, 11, 'Limpieza de condensadores', 'CANCELADA', quien(1), null],
  [9, 14, 'Revisar cinta de cremoso: hace ruido al arrancar', 'HECHA', quien(0), 'bomba cinta de cremoso'],
  [9, 15, 'Service mensual del aire del laboratorio', 'HECHA', quien(3), 'Aire acondicionado 1'],
  [9, 16, 'Control de niveles de aceite en acoplados', 'HECHA', null, 'Acoplado camión 4'],
  [9, 17, 'Verificar termómetros del baño maría', 'HECHA', quien(2), 'Baño maria'],
  [9, 18, 'Ajuste de prensa de moldes', 'HECHA', quien(1), null],
  [9, 21, 'Limpieza de la lavadora de bandejas', 'HECHA', quien(0), 'bomba de agua lavadora de bandeja'],
  [9, 22, 'Revisar válvulas del pretratamiento de suero', 'HECHA', quien(3), 'Bomba 2'],
  [9, 23, 'Cambio de sellos de la bomba autodeslodante', 'HECHA', quien(2), 'Bomba de agua autodeslodante'],
  // Desde acá, lo que todavía está por hacer.
  [9, 24, 'Control diario de caldera', 'PENDIENTE', quien(0), 'Bomba caldera 1'],
  [9, 24, 'Revisar pérdida de vapor en la línea de la cuadra', 'PENDIENTE', quien(1), null],
  [9, 24, 'Cambiar lámparas quemadas del saladero', 'PENDIENTE', null, null],
  [9, 25, 'Calibración de balanza analítica del laboratorio', 'PENDIENTE', quien(3), 'Balanza analitica 1'],
  [9, 25, 'Engrase de rodamientos de la bomba de agua caliente', 'PENDIENTE', quien(2), 'Bomba de agua caliente pausterizador'],
  [9, 28, 'Service trimestral del compresor de aire comprimido', 'PENDIENTE', quien(0), null],
  [9, 29, 'Revisar el sistema de frío de la cámara 2', 'PENDIENTE', quien(1), null],
  [9, 29, 'Control de ablandador', 'PENDIENTE', null, 'Ablandador de agua'],
  [9, 30, 'Cierre de mes: pasar las horas de parada al sistema', 'PENDIENTE', quien(3), null],

  // ── Octubre ──
  [10, 1, 'Control diario de caldera', 'PENDIENTE', quien(0), 'Bomba caldera 1'],
  [10, 1, 'Revisión general del pasteurizador antes de la temporada', 'PENDIENTE', quien(1), 'Bomba de leche pasteurizador'],
  [10, 2, 'Limpieza de filtros', 'PENDIENTE', quien(2), null],
  [10, 5, 'Cambio de aceite del compresor', 'PENDIENTE', quien(0), null],
  [10, 6, 'Verificar el acoplado 4 antes del viaje', 'PENDIENTE', quien(3), 'Acoplado camión 4'],
  [10, 6, 'Revisar bomba de agua del saladero', 'PENDIENTE', null, 'Bomba de agua saladero'],
  [10, 7, 'Control de temperatura de cámaras', 'PENDIENTE', quien(1), null],
  [10, 8, 'Engrase general de bombas', 'PENDIENTE', quien(2), 'Bomba 2'],
  [10, 9, 'Revisar la cinta de cremoso', 'PENDIENTE', quien(0), 'bomba cinta de cremoso'],
  [10, 13, 'Service mensual del aire del laboratorio', 'PENDIENTE', quien(3), 'Aire acondicionado 1'],
  [10, 14, 'Calibración de balanzas de expedición y laboratorio', 'PENDIENTE', quien(1), 'Balanza 1'],
  [10, 15, 'Control del baño maría y termómetros', 'PENDIENTE', quien(2), 'Baño maria'],
  [10, 15, 'Cambiar la correa de la lavadora de bandejas', 'PENDIENTE', null, 'bomba de agua lavadora de bandeja'],
  [10, 16, 'Revisar pérdidas en el pretratamiento de leche', 'PENDIENTE', quien(0), 'Bomba de agua autodeslodante'],
  [10, 19, 'Limpieza de condensadores', 'PENDIENTE', quien(3), null],
  [10, 20, 'Control diario de caldera', 'PENDIENTE', quien(0), 'Bomba caldera 1'],
  [10, 21, 'Ajuste de prensa de moldes', 'PENDIENTE', quien(1), null],
  [10, 22, 'Revisar el ablandador y cargar sal', 'PENDIENTE', quien(2), 'Ablandador de agua'],
  [10, 23, 'Verificar el estado de las bombas de la cuadra', 'PENDIENTE', null, null],
  [10, 26, 'Service del compresor', 'PENDIENTE', quien(3), null],
  [10, 27, 'Control de niveles y engrase general', 'PENDIENTE', quien(0), null],
  [10, 28, 'Revisar la instalación eléctrica del saladero: hay una térmica que salta', 'PENDIENTE', quien(1), null],
  [10, 29, 'Limpieza profunda del pasteurizador', 'PENDIENTE', quien(2), 'Bomba de leche pasteurizador'],
  [10, 30, 'Cierre de mes: revisar tareas pendientes y reprogramar', 'PENDIENTE', null, null],
];

const datos = TAREAS.map(([mes, numero, titulo, estado, asignadoAId, equipo]) => ({
  titulo,
  descripcion: null,
  fecha: dia(mes, numero),
  estado,
  asignadoAId,
  equipoId: equipo ? buscarEquipo(equipo) : null,
  creadaPorId: admin?.id ?? null,
}));

await prisma.tareaProgramada.createMany({ data: datos });

// ── Una rutina, para que el calendario también tenga lo que se repite ─────
// Se deja SIN generar sus tareas a propósito: las genera el propio sistema al
// abrir el calendario. Así lo que se imprime es lo que el sistema produce, no
// lo que este script invent
const rutina = await prisma.rutinaTarea.create({
  data: {
    titulo: 'Control de purga de caldera',
    descripcion: 'Purgar y anotar la presión al empezar el turno.',
    cadaDias: 3,
    desde: dia(9, 1),
    hasta: dia(10, 31),
    equipoId: buscarEquipo('Bomba caldera 1'),
    asignadoAId: quien(0),
    activa: true,
    creadaPorId: admin?.id ?? null,
  },
});

// ── Resumen ───────────────────────────────────────────────────────────────
const porEstado = await prisma.tareaProgramada.groupBy({
  by: ['estado'],
  where: { fecha: { gte: DESDE, lte: HASTA } },
  _count: true,
});

console.log(`\nCargadas ${datos.length} tareas entre el 01/09 y el 31/10:`);
for (const e of porEstado) console.log(`   ${String(e._count).padStart(3)}  ${e.estado}`);
console.log(`   sin repartir: ${datos.filter((d) => d.asignadoAId === null).length}`);
console.log(`\nY la rutina "${rutina.titulo}", cada ${rutina.cadaDias} días.`);
console.log('Sus tareas las genera el sistema al abrir el calendario.\n');

await prisma.$disconnect();
