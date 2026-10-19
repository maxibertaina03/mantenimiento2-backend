/**
 * Pasa a HERRAMIENTA lo que ya estaba marcado como tal, y le da tipos de verdad.
 *
 * El catálogo tenía un tipo "Herramienta" que se usaba como parche, porque no
 * existía la clasificación. Ahora que existe, ese tipo queda diciendo lo mismo
 * dos veces: Herramienta / Herramienta.
 *
 * Así que las 18 pasan a clasificación HERRAMIENTA, y el tipo se reemplaza por
 * uno que aporte: eléctrica, manual o de medición. Recién ahí el filtro por
 * tipo dentro de Herramientas sirve para algo.
 *
 * El reparto va escrito a mano y no adivinado por palabras: son dieciocho, se
 * leen de una, y una regla automática que se equivoca en una deja un dato malo
 * que nadie revisa.
 *
 *   node -r dotenv/config scripts/clasificar-herramientas.mjs dotenv_config_path=.env
 *   ... con --ejecutar para aplicarlo.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const url = process.env.DIRECT_URL ?? '';
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Los tipos nuevos, con el nombre que se lee bien en los dos lados. */
const TIPOS = {
  electrica: 'Herramienta eléctrica',
  manual: 'Herramienta manual',
  medicion: 'Herramienta de medición',
};

/** Qué es cada una. Lo que no está acá queda con el tipo que tenga. */
const REPARTO = {
  'Hidrolavadora 1': 'electrica',
  'Trozadora 1': 'electrica',
  'Impactadora 1': 'electrica',
  'Tester 2': 'medicion',
  'Tester de red 1': 'medicion',
  'Gillotina': 'manual',
  'Crimpeadora 1': 'manual',
  'Pinza 11': 'manual',
  'Pinza10': 'manual',
  'Destornillador 7': 'manual',
  'Destornillador 8': 'manual',
  'Destornillador 9': 'manual',
  'Pincel 1': 'manual',
  'Pincel 2': 'manual',
  'Pasta térmica 1': 'manual',
  'Escalera 3': 'manual',
  'Caja de herramientas 2': 'manual',
  'Mesa de trabajo ricotta': 'manual',
};

const tipoViejo = await prisma.tipoEquipoPlanta.findFirst({
  where: { nombre: { equals: 'Herramienta', mode: 'insensitive' } },
});

if (!tipoViejo) {
  console.error('No existe el tipo "Herramienta". Nada que hacer.');
  await prisma.$disconnect();
  process.exit(1);
}

const aMover = await prisma.equipo.findMany({
  where: { tipoId: tipoViejo.id },
  select: { id: true, nombre: true, clasificacion: true },
  orderBy: { nombre: 'asc' },
});

console.log(`\nEquipos con tipo "Herramienta": ${aMover.length}\n`);

const sinReparto = aMover.filter((e) => !REPARTO[e.nombre]);
for (const e of aMover) {
  const destino = REPARTO[e.nombre];
  console.log(`  ${e.nombre.padEnd(28)} -> ${destino ? TIPOS[destino] : '(sin reparto: solo cambia la clasificacion)'}`);
}

if (sinReparto.length > 0) {
  console.log(
    `\nATENCION: ${sinReparto.length} no estan en el reparto. Van a quedar como HERRAMIENTA ` +
      'pero con el tipo viejo. Agregalas al script si corresponde.',
  );
}

const antes = {
  equipos: await prisma.equipo.count(),
  herramientas: await prisma.equipo.count({ where: { clasificacion: 'HERRAMIENTA' } }),
};

if (!EJECUTAR) {
  console.log('\nENSAYO: no se cambio nada. Agrega --ejecutar para aplicarlo.\n');
  await prisma.$disconnect();
  process.exit(0);
}

// El timeout por defecto de una transaccion interactiva son 5 segundos, y
// contra una base remota veintiuna escrituras no entran. Se vencia a la mitad
// y deshacia todo: correcto, pero nunca terminaba.
await prisma.$transaction(
  async (tx) => {
    // Los tipos nuevos, creados solo si no estaban.
    const ids = {};
    for (const [clave, nombre] of Object.entries(TIPOS)) {
      const existente = await tx.tipoEquipoPlanta.findFirst({ where: { nombre } });
      ids[clave] = existente
        ? existente.id
        : (await tx.tipoEquipoPlanta.create({ data: { nombre } })).id;
    }

    for (const equipo of aMover) {
      const destino = REPARTO[equipo.nombre];
      await tx.equipo.update({
        where: { id: equipo.id },
        data: {
          clasificacion: 'HERRAMIENTA',
          ...(destino ? { tipoId: ids[destino] } : {}),
        },
      });
      }
  },
  { timeout: 120_000, maxWait: 30_000 },
);

const despues = {
  equipos: await prisma.equipo.count(),
  herramientas: await prisma.equipo.count({ where: { clasificacion: 'HERRAMIENTA' } }),
};

console.log(`\nEquipos:      ${antes.equipos} -> ${despues.equipos}  (esperado IGUAL)`);
console.log(`Herramientas: ${antes.herramientas} -> ${despues.herramientas}  (esperado ${aMover.length})`);

const bien = despues.equipos === antes.equipos && despues.herramientas === aMover.length;
console.log(bien ? '\nOK: se clasifico exactamente lo previsto.\n' : '\nATENCION: las cuentas no dan.\n');

await prisma.$disconnect();
process.exit(bien ? 0 : 1);
