/**
 * Borra nueve materiales que se cargaron por error y no son del pañol.
 *
 * Son cosas de informática —gabinete, mouse, teclado, monitor, cámaras— que
 * entraron como material cuando en realidad son equipos de IT. No es que estén
 * fuera de circulación: no corresponden. Por eso se borran en vez de jubilarse.
 *
 * Borra el material y SUS movimientos. Nada más:
 *
 * - Los nombres se comparan EXACTOS y uno por uno. Si alguno no aparece, o
 *   aparece dos veces, no se borra nada y se avisa. Un borrado por aproximación
 *   sobre 508 materiales es como se termina perdiendo lo que no se quería.
 * - Si alguno estuviera en una orden de compra o en una orden de trabajo, se
 *   corta: eso sería borrar historia de otra cosa.
 * - Todo en una transacción: o se van los nueve con sus movimientos, o no se va
 *   ninguno.
 *
 *   node -r dotenv/config scripts/borrar-materiales-de-informatica.mjs dotenv_config_path=.env
 *   ... agregando --ejecutar para que quede guardado.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const NOMBRES = [
  'Gabinete PC con fuente',
  'Mouse',
  'Alimentacion PoE',
  'Zapatilla enchufe',
  'Soporte monitor',
  'Teclado',
  'Monitor samsung 18"',
  'Camara wifi 360° PTZ',
  'Camara wifi fija',
];

/** Corta con un mensaje claro en vez de seguir y romper algo. */
function abortar(motivo) {
  console.error(`\nNO SE BORRA NADA: ${motivo}`);
  process.exitCode = 1;
}

const todos = await prisma.material.findMany({ select: { id: true, nombre: true } });

// Uno por uno, y exacto. Nada de "contiene" ni "empieza con".
const aBorrar = [];
for (const nombre of NOMBRES) {
  const coinciden = todos.filter((m) => m.nombre === nombre);
  if (coinciden.length !== 1) {
    abortar(`"${nombre}" coincide con ${coinciden.length} materiales, y tiene que ser exactamente 1.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  aBorrar.push(coinciden[0]);
}

const ids = aBorrar.map((m) => m.id);

// Ataduras que harían de esto un borrado de historia ajena.
const enCompras = await prisma.renglonOrdenCompra.count({ where: { materialId: { in: ids } } });
const enTrabajos = await prisma.materialUsadoTrabajo.count({ where: { materialId: { in: ids } } });
if (enCompras > 0 || enTrabajos > 0) {
  abortar(
    `alguno figura en ${enCompras} renglón(es) de compra y ${enTrabajos} trabajo(s). ` +
      'Borrarlo se llevaría puesto el historial de esas órdenes.',
  );
  await prisma.$disconnect();
  process.exit(1);
}

const movimientos = await prisma.movimientoStock.findMany({
  where: { materialId: { in: ids } },
  select: { id: true, materialId: true, tipo: true, motivo: true, cantidad: true, fecha: true },
});

console.log(`Materiales en total: ${todos.length}`);
console.log(`\nA BORRAR (${aBorrar.length} materiales, ${movimientos.length} movimientos):`);
for (const m of aBorrar) {
  const suyos = movimientos.filter((v) => v.materialId === m.id);
  console.log(`  ${m.nombre}`);
  for (const v of suyos) {
    console.log(`      ${v.fecha.toISOString().slice(0, 10)}  ${v.tipo}/${v.motivo}  ${v.cantidad}`);
  }
}

const antesMateriales = todos.length;
const antesMovimientos = await prisma.movimientoStock.count();

if (!EJECUTAR) {
  console.log('\nENSAYO: no se borró nada. Agregá --ejecutar para aplicarlo.');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  // Primero los movimientos: el material los tiene como hijos y la clave
  // foránea no deja borrarlo antes.
  await tx.movimientoStock.deleteMany({ where: { materialId: { in: ids } } });
  await tx.material.deleteMany({ where: { id: { in: ids } } });
});

const despuesMateriales = await prisma.material.count();
const despuesMovimientos = await prisma.movimientoStock.count();

console.log(`\nMateriales:  ${antesMateriales} -> ${despuesMateriales}  (esperado ${antesMateriales - aBorrar.length})`);
console.log(`Movimientos: ${antesMovimientos} -> ${despuesMovimientos}  (esperado ${antesMovimientos - movimientos.length})`);

const bien =
  despuesMateriales === antesMateriales - aBorrar.length &&
  despuesMovimientos === antesMovimientos - movimientos.length;
console.log(bien ? 'OK: se borró exactamente lo previsto.' : 'ATENCIÓN: las cuentas no dan. Revisar.');

await prisma.$disconnect();
process.exit(bien ? 0 : 1);
