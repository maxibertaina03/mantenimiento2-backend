/**
 * Corre una migración contra producción y la DESHACE.
 *
 * Es el paso que falta entre "anda en local" y "va a main": ejecuta el SQL de
 * verdad, contra los datos de verdad, y tira un error al final para que la
 * transacción se revierta entera. Si el SQL iba a fallar por una fila que solo
 * existe en producción, falla acá y no durante el despliegue.
 *
 * Va por DIRECT_URL (5432) y no por el pooler (6543): PgBouncer en modo
 * transacción no garantiza que todas las sentencias caigan en la misma sesión,
 * y entonces el ROLLBACK podría no alcanzar a todo.
 *
 *   node -r dotenv/config scripts/ensayar-migracion.mjs dotenv_config_path=.env.produccion \
 *     --migracion=20260925130000_equipos_y_herramientas_en_compras
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const arg = process.argv.find((a) => a.startsWith('--migracion='));
if (!arg) {
  console.error('Falta --migracion=<carpeta dentro de prisma/migrations>');
  process.exit(1);
}
const carpeta = arg.slice('--migracion='.length);
const sql = readFileSync(join('prisma', 'migrations', carpeta, 'migration.sql'), 'utf8');

const url = process.env.DIRECT_URL ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '(ilegible)';
  }
})();

/** Las sentencias, sin los comentarios y sin las vacías. */
const sentencias = sql
  .split(';')
  .map((s) =>
    s
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
      .trim(),
  )
  .filter((s) => s.length > 0);

console.log(`\nBase:      ${host}`);
console.log(`Migración: ${carpeta}`);
console.log(`Sentencias: ${sentencias.length}\n`);

const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Se tira a propósito al final para que la transacción se revierta. */
class Deshacer extends Error {}

// Antes: una foto de las tablas que la migración toca.
const antes = {
  equipos: await prisma.equipo.count(),
  renglones: await prisma.renglonOrdenCompra.count(),
  materiales: await prisma.material.count(),
  movimientos: await prisma.movimientoStock.count(),
};

try {
  await prisma.$transaction(
    async (tx) => {
      for (const [i, sentencia] of sentencias.entries()) {
        await tx.$executeRawUnsafe(sentencia);
        console.log(`  ${String(i + 1).padStart(2)}/${sentencias.length}  ok`);
      }

      // Con el esquema ya cambiado, se comprueba que los datos sigan enteros.
      const [{ n: equipos }] = await tx.$queryRawUnsafe('select count(*)::int as n from equipos');
      const [{ n: renglones }] = await tx.$queryRawUnsafe(
        'select count(*)::int as n from renglones_orden_compra',
      );
      const [{ n: sinClasificar }] = await tx.$queryRawUnsafe(
        `select count(*)::int as n from equipos where clasificacion is null`,
      );
      const [{ n: sinMaterial }] = await tx.$queryRawUnsafe(
        'select count(*)::int as n from renglones_orden_compra where "materialId" is null',
      );

      console.log(`\n  equipos:   ${antes.equipos} -> ${equipos}`);
      console.log(`  renglones: ${antes.renglones} -> ${renglones}`);
      console.log(`  equipos sin clasificar:      ${sinClasificar}  (esperado 0)`);
      console.log(`  renglones que quedan sin material: ${sinMaterial}  (esperado 0)`);

      if (equipos !== antes.equipos || renglones !== antes.renglones) {
        throw new Error('LA MIGRACION CAMBIO LA CANTIDAD DE FILAS. Revisar antes de aplicarla.');
      }
      if (sinClasificar > 0) {
        throw new Error('Quedaron equipos sin clasificacion. El DEFAULT no se aplico.');
      }

      throw new Deshacer();
    },
    { timeout: 120_000 },
  );
} catch (error) {
  if (!(error instanceof Deshacer)) {
    console.error(`\n❌ EL ENSAYO FALLO: ${String(error.message).split('\n')[0]}`);
    console.error('   La base quedó intacta: la transacción se revirtió.\n');
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Después: que todo haya vuelto a como estaba.
const despues = {
  equipos: await prisma.equipo.count(),
  renglones: await prisma.renglonOrdenCompra.count(),
  materiales: await prisma.material.count(),
  movimientos: await prisma.movimientoStock.count(),
};

const igual = Object.keys(antes).every((k) => antes[k] === despues[k]);
console.log(`\n✅ El SQL corre entero contra producción.`);
console.log(
  igual
    ? '   ENSAYO DESHECHO: la base quedó exactamente como estaba.\n'
    : '   ATENCION: los conteos no volvieron a su valor. Revisar.\n',
);

await prisma.$disconnect();
process.exit(igual ? 0 : 1);
