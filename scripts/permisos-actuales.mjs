/**
 * Qué permisos tiene hoy cada rol, leídos de la base.
 *
 * Existe porque la pregunta se repite —"¿qué le falta a mantenimiento para
 * poder hacer X?"— y la respuesta no está en el código: los permisos se
 * siembran una sola vez por rol, así que lo que hay en la base puede no
 * coincidir con lo que dice el seed. Solo lee.
 *
 *   node -r dotenv/config scripts/permisos-actuales.mjs dotenv_config_path=.env
 *   ... con un prefijo opcional para filtrar:  --prefijo=it.
 */
import { PrismaClient } from '@prisma/client';

// Explicito y no "el argumento que parezca un prefijo": argv[0] es la ruta de
// node, que tambien tiene puntos.
const prefijo = process.argv.find((a) => a.startsWith('--prefijo='))?.slice('--prefijo='.length);
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const filas = await prisma.permisoRol.findMany({
  select: { rol: true, permiso: true },
  orderBy: [{ rol: 'asc' }, { permiso: 'asc' }],
});

const porRol = new Map();
for (const { rol, permiso } of filas) {
  if (prefijo && !permiso.startsWith(prefijo)) continue;
  if (!porRol.has(rol)) porRol.set(rol, []);
  porRol.get(rol).push(permiso);
}

for (const [rol, claves] of porRol) {
  console.log(`\n${rol} (${claves.length})`);
  console.log(`  ${claves.join('  ')}`);
}

console.log(prefijo ? `\nFiltrado por "${prefijo}".` : '');
await prisma.$disconnect();
