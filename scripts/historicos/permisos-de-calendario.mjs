/**
 * Le da a mantenimiento y a gerencia los permisos del calendario.
 *
 * Hace falta un script porque el sembrado automático, a propósito, NO le agrega
 * permisos nuevos a un rol que ya fue configurado: si alguien le sacó un acceso
 * a gerencia, el arranque siguiente no se lo devuelve. La contracara es que un
 * módulo nuevo nace invisible para todos menos el administrador.
 *
 * Solo INSERTA filas. No borra ni cambia ningún permiso existente, y correrlo
 * dos veces no hace nada la segunda.
 *
 *   node -r dotenv/config scripts/permisos-de-calendario.mjs dotenv_config_path=.env
 *   ... agregando --ejecutar para que quede guardado.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

/**
 * El calendario SÍ es de mantenimiento: es donde ven lo que tienen que hacer en
 * el día y donde lo dan por hecho. Repartir el trabajo no: eso lo decide quien
 * organiza, y por eso `tareas.asignar` queda solo para el administrador.
 *
 * Gerencia mira y no toca, como en el resto del sistema.
 */
const A_DAR = [
  { rol: 'MANTENIMIENTO', permiso: 'tareas.ver' },
  { rol: 'MANTENIMIENTO', permiso: 'tareas.editar' },
  { rol: 'GERENCIA', permiso: 'tareas.ver' },
];

const existentes = await prisma.permisoRol.findMany();
const yaTiene = new Set(existentes.map((p) => `${p.rol}:${p.permiso}`));
const faltantes = A_DAR.filter((p) => !yaTiene.has(`${p.rol}:${p.permiso}`));

console.log(`Permisos en la base: ${existentes.length}`);
console.log(`\nA AGREGAR (${faltantes.length}):`);
for (const p of faltantes) console.log(`  ${p.rol.padEnd(15)} ${p.permiso}`);
if (faltantes.length === 0) console.log('  nada: ya los tienen');

if (!EJECUTAR) {
  console.log('\nENSAYO: no se guardó nada. Agregá --ejecutar para aplicarlo.');
  await prisma.$disconnect();
  process.exit(0);
}

if (faltantes.length > 0) {
  await prisma.permisoRol.createMany({ data: faltantes, skipDuplicates: true });
}

const despues = await prisma.permisoRol.count();
console.log(`\nPermisos antes: ${existentes.length} · ahora: ${despues}`);
console.log(
  despues === existentes.length + faltantes.length
    ? 'OK: solo se agregaron los que faltaban.'
    : 'ATENCIÓN: la cuenta no da. Revisar.',
);

await prisma.$disconnect();
