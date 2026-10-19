/**
 * Deja el módulo de órdenes de trabajo solo para el administrador.
 *
 * Órdenes de trabajo se apoya en los equipos: una orden se ata a la máquina que
 * se arregló. Mantenimiento todavía no tiene el módulo de equipos, así que
 * abrirles trabajos sería darles la mitad de una función.
 *
 * Solo BORRA filas de permisos de ese módulo, y solo de roles que no sean
 * administrador. No toca ningún otro permiso ni ninguna orden ya cargada.
 *
 *   node -r dotenv/config scripts/trabajos-solo-admin.mjs dotenv_config_path=.env
 *   ... agregando --ejecutar para que quede guardado.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const todos = await prisma.permisoRol.findMany();
const aQuitar = todos.filter((p) => p.permiso.startsWith('trabajos.') && p.rol !== 'ADMIN');

console.log(`Permisos en la base: ${todos.length}`);
console.log(`\nA QUITAR (${aQuitar.length}):`);
for (const p of aQuitar) console.log(`  ${p.rol.padEnd(15)} ${p.permiso}`);
if (aQuitar.length === 0) console.log('  nada: el módulo ya es solo del administrador');

console.log('\nQUEDAN (los del administrador, intactos):');
for (const p of todos.filter((x) => x.permiso.startsWith('trabajos.') && x.rol === 'ADMIN')) {
  console.log(`  ${p.rol.padEnd(15)} ${p.permiso}`);
}

if (!EJECUTAR) {
  console.log('\nENSAYO: no se borró nada. Agregá --ejecutar para aplicarlo.');
  await prisma.$disconnect();
  process.exit(0);
}

if (aQuitar.length > 0) {
  // `permisos_rol` tiene clave compuesta (rol + permiso), no un id: se borra
  // por esos dos campos. El `not: ADMIN` es el cinturón de seguridad, además
  // del filtro de arriba.
  await prisma.permisoRol.deleteMany({
    where: { permiso: { startsWith: 'trabajos.' }, rol: { not: 'ADMIN' } },
  });
}

const despues = await prisma.permisoRol.count();
console.log(`\nPermisos antes: ${todos.length} · ahora: ${despues}`);
console.log(
  despues === todos.length - aQuitar.length
    ? 'OK: solo se quitaron los del módulo de trabajos.'
    : 'ATENCIÓN: la cuenta no da. Revisar.',
);

await prisma.$disconnect();
