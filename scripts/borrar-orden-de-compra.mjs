/**
 * Borra UNA orden de compra, por número, y nada más.
 *
 * Se usó para la OC-2026-0013, que fue una prueba cargada por error.
 *
 * Las guardas, que son el motivo por el que esto es un script y no un DELETE
 * a mano:
 *
 * - El número se compara EXACTO y tiene que coincidir con una sola orden.
 * - Si algún renglón tiene un movimiento de stock asociado, se corta. Ese
 *   movimiento ya sumó al pañol y NO se borra en cascada: borrar la orden lo
 *   dejaría huérfano, con el stock sumado y sin nada que lo explique. Una
 *   orden que movió stock se anula, no se borra.
 * - Se listan los hijos que se van en cascada (renglones, envíos y
 *   comprobantes) ANTES de borrar, para poder mirarlos.
 * - Si tiene comprobantes adjuntos se avisa: el archivo vive en Supabase y
 *   este script no lo toca.
 * - Todo en una transacción.
 *
 *   node -r dotenv/config scripts/borrar-orden-de-compra.mjs dotenv_config_path=.env --numero=OC-2026-0013
 *   ... agregando --ejecutar para que quede guardado.
 */
import { PrismaClient } from '@prisma/client';

const EJECUTAR = process.argv.includes('--ejecutar');
const NUMERO = process.argv.find((a) => a.startsWith('--numero='))?.slice('--numero='.length);

if (!NUMERO) {
  console.error('Falta --numero=OC-2026-0013');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

function abortar(motivo) {
  console.error(`\nNO SE BORRA NADA: ${motivo}`);
}

const candidatas = await prisma.ordenCompra.findMany({
  where: { numero: NUMERO },
  include: {
    proveedor: { select: { nombre: true } },
    renglones: {
      include: { material: { select: { nombre: true } } },
    },
    envios: true,
    comprobantes: true,
  },
});

if (candidatas.length !== 1) {
  abortar(`"${NUMERO}" coincide con ${candidatas.length} órdenes, y tiene que ser exactamente 1.`);
  await prisma.$disconnect();
  process.exit(1);
}

const orden = candidatas[0];

console.log(`\n${orden.numero}  ${orden.estado}`);
console.log(`  Proveedor:  ${orden.proveedor.nombre}`);
console.log(`  Fecha:      ${orden.fecha.toISOString()}`);
console.log(`  Comprobante: remito ${orden.remito ?? '—'} / factura ${orden.factura ?? '—'}`);
console.log(`  Recibida:   ${orden.recibidaEn ? orden.recibidaEn.toISOString() : 'nunca'}`);

console.log(`\n  Renglones (${orden.renglones.length}):`);
for (const r of orden.renglones) {
  console.log(
    `    ${r.material.nombre}  x${r.cantidad}` +
      `  movimiento: ${r.movimientoId ?? 'ninguno'}`,
  );
}
console.log(`  Envíos por correo (${orden.envios.length})`);
console.log(`  Comprobantes adjuntos (${orden.comprobantes.length})`);

// La guarda que importa: stock ya movido.
const conMovimiento = orden.renglones.filter((r) => r.movimientoId !== null);
if (conMovimiento.length > 0) {
  abortar(
    `${conMovimiento.length} renglón(es) ya generaron movimiento de stock. Ese movimiento no se ` +
      'va en cascada: borrar la orden lo dejaría huérfano, con el stock sumado y sin nada que lo ' +
      'explique. Una orden que movió stock se anula, no se borra.',
  );
  await prisma.$disconnect();
  process.exit(1);
}

if (orden.comprobantes.length > 0) {
  console.log(
    '\n  AVISO: tiene comprobantes adjuntos. La fila se borra, pero el archivo queda en Supabase.',
  );
}

const antes = {
  ordenes: await prisma.ordenCompra.count(),
  renglones: await prisma.renglonOrdenCompra.count(),
  movimientos: await prisma.movimientoStock.count(),
  materiales: await prisma.material.count(),
};

if (!EJECUTAR) {
  console.log('\nENSAYO: no se borró nada. Agregá --ejecutar para aplicarlo.');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  // Renglones, envíos y comprobantes se van solos: la clave foránea es
  // ON DELETE CASCADE. Nada más cuelga de la orden.
  await tx.ordenCompra.delete({ where: { id: orden.id } });
});

const despues = {
  ordenes: await prisma.ordenCompra.count(),
  renglones: await prisma.renglonOrdenCompra.count(),
  movimientos: await prisma.movimientoStock.count(),
  materiales: await prisma.material.count(),
};

console.log(`\nÓrdenes:     ${antes.ordenes} -> ${despues.ordenes}  (esperado ${antes.ordenes - 1})`);
console.log(
  `Renglones:   ${antes.renglones} -> ${despues.renglones}` +
    `  (esperado ${antes.renglones - orden.renglones.length})`,
);
console.log(`Movimientos: ${antes.movimientos} -> ${despues.movimientos}  (esperado IGUAL)`);
console.log(`Materiales:  ${antes.materiales} -> ${despues.materiales}  (esperado IGUAL)`);

const bien =
  despues.ordenes === antes.ordenes - 1 &&
  despues.renglones === antes.renglones - orden.renglones.length &&
  despues.movimientos === antes.movimientos &&
  despues.materiales === antes.materiales;

console.log(bien ? '\nOK: se borró exactamente lo previsto.' : '\nATENCIÓN: las cuentas no dan.');

await prisma.$disconnect();
process.exit(bien ? 0 : 1);
