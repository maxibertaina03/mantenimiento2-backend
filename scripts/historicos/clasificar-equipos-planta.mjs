/**
 * Le pone tipo a los equipos de planta, deduciéndolo del nombre.
 *
 * Los 326 equipos se cargaron desde las carpetas de fotos, sin tipo. El nombre
 * es el único dato que dice qué es cada cosa, y lo dice bastante bien: "Silo 3"
 * es un silo, "Bomba recibo 7" es una bomba.
 *
 * NO BORRA NADA. Solo crea filas en el catálogo de tipos y completa el campo
 * `tipoId`, que hoy está vacío en los 326. Ningún valor existente se pisa: si
 * un equipo ya tuviera tipo, se lo saltea.
 *
 *   node -r dotenv/config scripts/clasificar-equipos-planta.mjs dotenv_config_path=.env
 *   ... agregando --ejecutar para que los cambios queden guardados,
 *   ... o --detalle para ver qué equipo cae en cada tipo.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const DETALLE = process.argv.includes('--detalle');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

/** Sin acentos ni mayúsculas, que es como conviene comparar nombres escritos a mano. */
const clave = (t) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Las reglas, EN ORDEN. Gana la primera que coincide, así que lo específico va
 * antes que lo general: "Compresor equipo de frio 1" tiene que caer en Equipo
 * de frío y no en Compresor, y "Tablero caldera 3" en Tablero y no en Caldera.
 */
const REGLAS = [
  // Lo que NO es un equipo. Se marca para poder verlo junto y decidir después
  // qué hacer con eso; no se borra nada.
  ['Documentación', [/^cedula\b/, /^datos\b/]],

  ['Tablero eléctrico', [/^tablero/]],
  ['Sensor', [/^sensor/, /^pt\s?100/, /^caudalimetro/, /^microchip/]],
  ['Motor', [/^motor/]],
  ['Bomba', [/^bomba/]],
  ['Equipo de frío', [/equipo de fri/, /^condensador/, /^forzador/, /^heladera/]],
  [
    'Tanque y recipiente',
    [/^tanque/, /^tacho/, /^tina/, /^pileton/, /^pulmon/, /^contenedor/, /^tolva/, /^cono/],
  ],
  [
    'Herramienta',
    [
      /^destornillador/,
      /^pinza/,
      /^tester/,
      /^pincel/,
      /^crimpeadora/,
      /^caja de herramientas/,
      /^escalera/,
      /^impactadora/,
      /^trozadora/,
      /^gillotina/,
      /^hidrolavadora/,
      /^pasta termica/,
      /^mesa de trabajo/,
    ],
  ],
  [
    'Válvula',
    [/^valvula/, /^electrovalvula/, /^llave rotalock/, /^reguladora de caudal/, /^llave/],
  ],
  [
    'Vehículo',
    [/^camion/, /^acoplado/, /^zorra/, /^tractor/, /^toyota/, /^mula/, /^carro/, /^partner/],
  ],
  ['Silo', [/^silo/]],
  ['Cinta transportadora', [/^cinta/, /^malla de la cinta/]],
  ['Removedor', [/^removedor/]],
  [
    'Instrumento de laboratorio',
    [/^balanza/, /^termobalanza/, /^lactoscan/, /^ekomilk/, /^lectora/, /^estufa/, /^bano maria/],
  ],
  ['Cilindro neumático', [/^cilindro/, /^piston/]],
  ['Caldera y vapor', [/^caldera/, /^saca vapor/, /^trampa de vapor/, /^termotanque/, /^tubo gas/]],
  ['Tratamiento de agua', [/^ablandador/, /^clorinador/, /^filtro regulador/, /^trampa de agua/]],
  ['Ventilación', [/^extractor/, /^aire acondicionado/]],
  ['Envasadora', [/^envasadora/]],
  ['Desnatadora', [/^desnatadora/]],
  ['Prensa', [/^prens/, /^drenoprensa/]],
  ['Compresor', [/^compresor/]],
  ['Lavado', [/^lavadora/, /^equipo lavado/]],
  [
    'Máquina de proceso',
    [
      /^centrifuga/,
      /^desmigadora/,
      /^mezcladora/,
      /^procesadora/,
      /^encintadora/,
      /^rotuladora/,
      /^hidrociclone/,
      /^tunel/,
      /^horno/,
      /^placa de suero/,
      /^ricota sache/,
    ],
  ],
];

function tipoDe(nombre) {
  const k = clave(nombre);
  for (const [tipo, patrones] of REGLAS) {
    if (patrones.some((p) => p.test(k))) return tipo;
  }
  return null;
}

const equipos = await prisma.$queryRawUnsafe(
  `select id, nombre, "tipoId" from equipos order by lower(nombre)`,
);

const porTipo = new Map();
const sinClasificar = [];
const yaTenian = [];

for (const e of equipos) {
  if (e.tipoId) {
    yaTenian.push(e.nombre);
    continue;
  }
  const tipo = tipoDe(e.nombre);
  if (!tipo) {
    sinClasificar.push(e.nombre);
    continue;
  }
  if (!porTipo.has(tipo)) porTipo.set(tipo, []);
  porTipo.get(tipo).push(e);
}

const ordenados = [...porTipo.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`Equipos: ${equipos.length}`);
console.log(`Ya tenían tipo (no se tocan): ${yaTenian.length}\n`);
console.log('TIPOS Y CUÁNTOS EQUIPOS LLEVA CADA UNO');
for (const [tipo, lista] of ordenados) {
  console.log(`  ${String(lista.length).padStart(3)}  ${tipo}`);
}

if (DETALLE) {
  for (const [tipo, lista] of ordenados) {
    console.log(`\n--- ${tipo} (${lista.length})`);
    for (const e of lista) console.log('      ' + e.nombre);
  }
  console.log('');
}

console.log(`\n  ${String(sinClasificar.length).padStart(3)}  sin clasificar (quedan sin tipo)`);
for (const n of sinClasificar) console.log(`        ${n}`);

if (!EJECUTAR) {
  console.log('\nENSAYO: no se guardó nada. Agregá --ejecutar para aplicarlo.');
  await prisma.$disconnect();
  process.exit(0);
}

// ── Aplicar ────────────────────────────────────────────────────────────────
// Todo en una transacción: o quedan el catálogo y las asignaciones, o no queda
// nada a medias.
const antes = await prisma.$queryRawUnsafe(
  `select (select count(*)::int from equipos) equipos,
          (select count(*)::int from tipos_equipo_planta) tipos`,
);

let creados = 0;
let asignados = 0;

await prisma.$transaction(
  async (tx) => {
    const existentes = await tx.tipoEquipoPlanta.findMany({ select: { id: true, nombre: true } });

    for (const [indice, [tipo, lista]] of ordenados.entries()) {
      // Si el tipo ya existiera, se reusa: nunca se duplica ni se pisa.
      const yaEsta = existentes.find((t) => clave(t.nombre) === clave(tipo));
      const fila =
        yaEsta ?? (await tx.tipoEquipoPlanta.create({ data: { nombre: tipo, orden: indice } }));
      if (!yaEsta) {
        creados += 1;
        existentes.push({ id: fila.id, nombre: tipo });
      }

      // `tipoId: null` en el where: nunca se pisa un tipo ya cargado.
      const r = await tx.equipo.updateMany({
        where: { id: { in: lista.map((e) => e.id) }, tipoId: null },
        data: { tipoId: fila.id },
      });
      asignados += r.count;
    }
  },
  { timeout: 120_000 },
);

const despues = await prisma.$queryRawUnsafe(
  `select (select count(*)::int from equipos) equipos,
          (select count(*)::int from tipos_equipo_planta) tipos,
          (select count(*)::int from equipos where "tipoId" is not null) con_tipo`,
);

console.log(`\nTipos creados: ${creados}`);
console.log(`Equipos clasificados: ${asignados}`);
console.log(`\nEquipos antes: ${antes[0].equipos} · ahora: ${despues[0].equipos}`);
console.log(
  despues[0].equipos === antes[0].equipos
    ? 'OK: no se borró ni se creó ningún equipo.'
    : 'ATENCIÓN: cambió la cantidad de equipos.',
);
console.log(`Equipos con tipo: ${despues[0].con_tipo} de ${despues[0].equipos}`);

await prisma.$disconnect();
