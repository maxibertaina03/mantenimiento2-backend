/**
 * Seed con datos de ejemplo.
 * Ejecutar con: npm run seed  (o)  npx prisma db seed
 *
 * Crea categorías, proveedores, usuarios, materiales y algunos movimientos.
 * Mantiene la coherencia: el stockActual de cada material queda igual a la suma
 * de los movimientos cargados (mismo criterio que usa la app en runtime).
 */
import { PrismaClient, TipoMovimiento, MotivoMovimiento, RolUsuario } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Limpieza (orden inverso a las FKs) para que el seed sea idempotente.
  await prisma.movimientoStock.deleteMany();
  await prisma.material.deleteMany();
  await prisma.categoriaMaterial.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.usuario.deleteMany();

  // ── Usuarios ──
  const admin = await prisma.usuario.create({
    data: { nombre: 'Admin Mantenimiento', email: 'admin@mantenimiento.local', rol: RolUsuario.ADMIN },
  });
  const operario = await prisma.usuario.create({
    data: { nombre: 'Juan Operario', email: 'juan@mantenimiento.local', rol: RolUsuario.OPERARIO },
  });

  // ── Proveedores ──
  const ferreteria = await prisma.proveedor.create({
    data: {
      nombre: 'Ferretería Central',
      cuit: '30-12345678-9',
      email: 'ventas@ferreteriacentral.com',
      telefono: '+54 11 4000-0000',
    },
  });
  const electricidad = await prisma.proveedor.create({
    data: {
      nombre: 'Electricidad del Sur',
      cuit: '30-98765432-1',
      email: 'pedidos@elecsur.com',
      telefono: '+54 11 5000-0000',
    },
  });

  // ── Categorías ──
  const catTornilleria = await prisma.categoriaMaterial.create({
    data: { nombre: 'Tornillería', descripcion: 'Tornillos, tuercas, arandelas y bulones' },
  });
  const catElectrico = await prisma.categoriaMaterial.create({
    data: { nombre: 'Material eléctrico', descripcion: 'Cables, llaves, tomas, etc.' },
  });
  const catLubricantes = await prisma.categoriaMaterial.create({
    data: { nombre: 'Lubricantes', descripcion: 'Aceites, grasas y solventes' },
  });

  // ── Materiales ──
  const tornillo = await prisma.material.create({
    data: {
      nombre: 'Tornillo autorroscante 6x40',
      categoriaId: catTornilleria.id,
      unidad: 'u',
      stockMinimo: 100,
      stockActual: 0,
    },
  });
  const cable = await prisma.material.create({
    data: {
      nombre: 'Cable unipolar 2.5mm²',
      categoriaId: catElectrico.id,
      unidad: 'm',
      stockMinimo: 50,
      stockActual: 0,
    },
  });
  const aceite = await prisma.material.create({
    data: {
      nombre: 'Aceite hidráulico ISO 68',
      categoriaId: catLubricantes.id,
      unidad: 'lt',
      stockMinimo: 20,
      stockActual: 0,
    },
  });

  // ── Movimientos de ejemplo + actualización de stockActual coherente ──
  // Tornillo: compra 500, salida 50 por trabajo -> stock 450
  await prisma.movimientoStock.createMany({
    data: [
      {
        materialId: tornillo.id,
        tipo: TipoMovimiento.ENTRADA,
        motivo: MotivoMovimiento.COMPRA,
        cantidad: 500,
        proveedorId: ferreteria.id,
        usuarioId: admin.id,
        notas: 'Compra inicial',
      },
      {
        materialId: tornillo.id,
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: 50,
        usuarioId: operario.id,
        referenciaTrabajo: 'OT-1001',
        notas: 'Montaje de estantería',
      },
    ],
  });
  await prisma.material.update({ where: { id: tornillo.id }, data: { stockActual: 450 } });

  // Cable: compra 100, salida 70 -> stock 30 (queda BAJO el mínimo de 50)
  await prisma.movimientoStock.createMany({
    data: [
      {
        materialId: cable.id,
        tipo: TipoMovimiento.ENTRADA,
        motivo: MotivoMovimiento.COMPRA,
        cantidad: 100,
        proveedorId: electricidad.id,
        usuarioId: admin.id,
      },
      {
        materialId: cable.id,
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: 70,
        usuarioId: operario.id,
        referenciaTrabajo: 'OT-1002',
      },
    ],
  });
  await prisma.material.update({ where: { id: cable.id }, data: { stockActual: 30 } });

  // Aceite: compra 40 -> stock 40
  await prisma.movimientoStock.create({
    data: {
      materialId: aceite.id,
      tipo: TipoMovimiento.ENTRADA,
      motivo: MotivoMovimiento.COMPRA,
      cantidad: 40,
      proveedorId: ferreteria.id,
      usuarioId: admin.id,
    },
  });
  await prisma.material.update({ where: { id: aceite.id }, data: { stockActual: 40 } });

  console.log('✅ Seed completado.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
