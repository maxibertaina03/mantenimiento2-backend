/**
 * Marca como HERRAMIENTA los equipos que están en el sector Taller.
 *
 * Existe por un caso concreto: al importar la carpeta del taller, noventa y
 * seis herramientas entraron como máquinas. El servidor detectaba bien, pero
 * la pantalla en el navegador de quien importó era una versión anterior y
 * mandaba solo nombre y sector, sin la clasificación.
 *
 * El servidor ya no depende de eso —la deduce del sector—, así que esto es
 * solo para arreglar lo que quedó de aquella importación.
 *
 * NO toca el tipo: quedan sin tipo, como entraron, para que se les pueda poner
 * el que corresponda desde la pantalla. Solo cambia la clasificación.
 *
 *   node -r dotenv/config scripts/reclasificar-taller.mjs dotenv_config_path=.env
 *   ... con --ejecutar para aplicarlo.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const ubicacion = await prisma.ubicacionEquipo.findFirst({
  where: { nombre: { equals: 'Taller', mode: 'insensitive' } },
  select: { id: true, nombre: true },
});

if (!ubicacion) {
  console.error('No existe el sector "Taller". Nada que hacer.');
  await prisma.$disconnect();
  process.exit(1);
}

const aMarcar = await prisma.equipo.findMany({
  where: { ubicacionId: ubicacion.id, clasificacion: 'EQUIPO' },
  select: { id: true, nombre: true },
  orderBy: { nombre: 'asc' },
});

const yaEstaban = await prisma.equipo.count({
  where: { ubicacionId: ubicacion.id, clasificacion: 'HERRAMIENTA' },
});

console.log(`\nSector "${ubicacion.nombre}"`);
console.log(`  ya marcados como herramienta: ${yaEstaban}`);
console.log(`  a marcar (hoy figuran como equipo): ${aMarcar.length}\n`);
for (const e of aMarcar.slice(0, 12)) console.log(`   ${e.nombre}`);
if (aMarcar.length > 12) console.log(`   ... y ${aMarcar.length - 12} mas`);

const antes = {
  total: await prisma.equipo.count(),
  herramientas: await prisma.equipo.count({ where: { clasificacion: 'HERRAMIENTA' } }),
};

if (aMarcar.length === 0) {
  console.log('\nNo hay nada que cambiar.\n');
  await prisma.$disconnect();
  process.exit(0);
}

if (!EJECUTAR) {
  console.log('\nENSAYO: no se cambio nada. Agrega --ejecutar para aplicarlo.\n');
  await prisma.$disconnect();
  process.exit(0);
}

// updateMany y no una transaccion con noventa y seis updates: es una sola
// sentencia, entra sin pelearse con el tiempo limite y no puede quedar a medias.
const { count } = await prisma.equipo.updateMany({
  where: { ubicacionId: ubicacion.id, clasificacion: 'EQUIPO' },
  data: { clasificacion: 'HERRAMIENTA' },
});

const despues = {
  total: await prisma.equipo.count(),
  herramientas: await prisma.equipo.count({ where: { clasificacion: 'HERRAMIENTA' } }),
};

console.log(`\nMarcados: ${count}  (esperado ${aMarcar.length})`);
console.log(`Total de equipos: ${antes.total} -> ${despues.total}  (esperado IGUAL)`);
console.log(`Herramientas:     ${antes.herramientas} -> ${despues.herramientas}`);

const bien =
  count === aMarcar.length &&
  despues.total === antes.total &&
  despues.herramientas === antes.herramientas + aMarcar.length;

console.log(bien ? '\nOK: se marco exactamente lo previsto.\n' : '\nATENCION: las cuentas no dan.\n');

await prisma.$disconnect();
process.exit(bien ? 0 : 1);
