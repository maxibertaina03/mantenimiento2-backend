/**
 * Cuenta las filas de todas las tablas. Es la foto de control.
 *
 * Se corre ANTES y DESPUÉS de cada migración o deploy y se comparan las dos
 * salidas: si una tabla que no era el objetivo cambió, algo se llevó puesto
 * algo. Es la comprobación que hizo falta cuando un `migrate dev` borró la base
 * de verdad, y desde entonces se hace siempre.
 *
 *   node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

// Los nombres de tabla salen del catálogo, no de una lista escrita a mano: una
// tabla nueva tiene que aparecer sola en la foto.
const tablas = await prisma.$queryRawUnsafe(`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);

const lineas = [];
for (const { table_name: tabla } of tablas) {
  // count(*) y no n_live_tup: el estimado del planificador puede estar viejo, y
  // acá lo que importa es el número exacto.
  const [{ n }] = await prisma.$queryRawUnsafe(`select count(*)::int as n from "${tabla}"`);
  lineas.push(`${String(n).padStart(7)}  ${tabla}`);
}

console.log(lineas.join('\n'));
console.log(`\n${tablas.length} tablas.`);

await prisma.$disconnect();
