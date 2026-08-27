import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoMovimiento } from '@prisma/client';
import { MovimientosStockRepository } from './movimientos-stock.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal, aDecimal } from '../../common/dominio/decimal';

/**
 * Prisma falso en memoria: implementa lo justo que usa el repositorio para poder
 * ejercitar el recalculo de stock y la transaccion de edicion sin base real.
 * `$queryRaw` simula el SELECT ... FOR UPDATE (devuelve el stock vigente).
 */
function crearPrismaFalso(opciones: { stockInicial?: number; movimientos?: any[] } = {}) {
  const material = { id: 'mat-1', stockActual: aDecimal(opciones.stockInicial ?? 0) };
  const movimientos: any[] = opciones.movimientos ?? [];
  const existeMaterial = { valor: true };

  const tx = {
    $queryRaw: jest.fn(async () =>
      existeMaterial.valor ? [{ stockActual: material.stockActual }] : [],
    ),
    material: {
      update: jest.fn(async ({ data }: any) => {
        material.stockActual = aDecimal(data.stockActual);
        return material;
      }),
    },
    movimientoStock: {
      create: jest.fn(async ({ data }: any) => {
        const mov = { id: `mov-${movimientos.length + 1}`, creadoEn: new Date(), ...data };
        movimientos.push(mov);
        return mov;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const mov = movimientos.find((m) => m.id === where.id);
        Object.assign(mov, data, { cantidad: aDecimal(data.cantidad) });
        return mov;
      }),
      findMany: jest.fn(async () => movimientos),
      findUniqueOrThrow: jest.fn(async ({ where }: any) =>
        movimientos.find((m) => m.id === where.id),
      ),
    },
    edicionMovimiento: { create: jest.fn(async ({ data }: any) => data) },
  };

  const prisma = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  } as unknown as PrismaService;

  return { prisma, tx, material, movimientos, existeMaterial };
}

const datosEdicion = {
  tipo: TipoMovimiento.ENTRADA,
  motivo: 'COMPRA',
  cantidad: aDecimal(1),
  fecha: new Date(),
  proveedorId: null,
  referenciaTrabajo: null,
  notas: null,
};

/** Rechaza stock negativo, igual que hace el service en produccion. */
const validarStockNoNegativo = (stock: Decimal) => {
  if (stock.isNegative()) {
    throw new BadRequestException(`stock negativo: ${stock.toString()}`);
  }
};

describe('MovimientosStockRepository', () => {
  describe('crearConActualizacionDeStock()', () => {
    it('lanza 404 si el material no existe', async () => {
      const { prisma, existeMaterial } = crearPrismaFalso();
      existeMaterial.valor = false;
      const repo = new MovimientosStockRepository(prisma);
      await expect(
        repo.crearConActualizacionDeStock({ materialId: 'no-existe' } as any, (s) => s),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('toma lock de la fila del material antes de calcular', async () => {
      const { prisma, tx } = crearPrismaFalso({ stockInicial: 100 });
      const repo = new MovimientosStockRepository(prisma);

      await repo.crearConActualizacionDeStock(
        {
          materialId: 'mat-1',
          tipo: TipoMovimiento.ENTRADA,
          motivo: 'COMPRA',
          cantidad: aDecimal(5),
        } as any,
        (stock) => stock.plus(5),
      );

      // El primer argumento del tagged template son los fragmentos de SQL.
      const fragmentos = (tx.$queryRaw as jest.Mock).mock.calls[0][0] as string[];
      expect(fragmentos.join('')).toMatch(/FOR UPDATE/);
    });

    it('persiste el movimiento y el nuevo stock en la misma transaccion', async () => {
      const { prisma, tx, material } = crearPrismaFalso({ stockInicial: 100 });
      const repo = new MovimientosStockRepository(prisma);

      await repo.crearConActualizacionDeStock(
        {
          materialId: 'mat-1',
          tipo: TipoMovimiento.ENTRADA,
          motivo: 'COMPRA',
          cantidad: aDecimal(5),
        } as any,
        (stock) => stock.plus(5),
      );

      expect(tx.movimientoStock.create).toHaveBeenCalled();
      expect(material.stockActual.toNumber()).toBe(105);
      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
    });

    it('si calcularNuevoStock lanza, no se persiste nada', async () => {
      const { prisma, tx, material } = crearPrismaFalso({ stockInicial: 10 });
      const repo = new MovimientosStockRepository(prisma);

      await expect(
        repo.crearConActualizacionDeStock({ materialId: 'mat-1' } as any, () => {
          throw new Error('stock insuficiente');
        }),
      ).rejects.toThrow('stock insuficiente');

      expect(tx.movimientoStock.create).not.toHaveBeenCalled();
      expect(material.stockActual.toNumber()).toBe(10);
    });
  });

  describe('recalculo de stock en editarConAuditoria()', () => {
    function reproducir(movs: any[]) {
      return crearPrismaFalso({
        stockInicial: 0,
        movimientos: movs.map((m, i) => ({
          id: `mov-${i + 1}`,
          materialId: 'mat-1',
          creadoEn: new Date(2026, 0, i + 1),
          fecha: new Date(2026, 0, i + 1),
          ...m,
          cantidad: aDecimal(m.cantidad),
        })),
      });
    }

    it('reproduce ENTRADA/SALIDA en orden y deja el stock correcto', async () => {
      const { prisma, material } = reproducir([
        { tipo: 'ENTRADA', cantidad: 100 },
        { tipo: 'SALIDA', cantidad: 30 },
        { tipo: 'ENTRADA', cantidad: 5 },
      ]);
      const repo = new MovimientosStockRepository(prisma);

      await repo.editarConAuditoria({
        id: 'mov-3',
        materialId: 'mat-1',
        datos: { ...datosEdicion, cantidad: aDecimal(5) } as any,
        edicion: { usuarioId: null, motivo: 'test', cambios: {} },
        validarStock: validarStockNoNegativo,
      });

      expect(material.stockActual.toNumber()).toBe(75);
    });

    it('un AJUSTE intermedio descarta el historico previo', async () => {
      const { prisma, material } = reproducir([
        { tipo: 'ENTRADA', cantidad: 100 },
        { tipo: 'AJUSTE', cantidad: 8 },
        { tipo: 'ENTRADA', cantidad: 2 },
      ]);
      const repo = new MovimientosStockRepository(prisma);

      await repo.editarConAuditoria({
        id: 'mov-3',
        materialId: 'mat-1',
        datos: { ...datosEdicion, cantidad: aDecimal(2) } as any,
        edicion: { usuarioId: null, motivo: 'test', cambios: {} },
        validarStock: validarStockNoNegativo,
      });

      expect(material.stockActual.toNumber()).toBe(10); // 8 (ajuste) + 2
    });

    it('REGRESION: editar no puede dejar el stock en negativo', async () => {
      // Historico: entra 10, sale 10 -> stock 0.
      const { prisma, tx, material } = reproducir([
        { tipo: 'ENTRADA', cantidad: 10 },
        { tipo: 'SALIDA', cantidad: 10 },
      ]);
      const repo = new MovimientosStockRepository(prisma);

      // Se edita la ENTRADA bajandola a 1 => 1 - 10 = -9. Debe rechazarse.
      await expect(
        repo.editarConAuditoria({
          id: 'mov-1',
          materialId: 'mat-1',
          datos: { ...datosEdicion, cantidad: aDecimal(1) } as any,
          edicion: { usuarioId: null, motivo: 'correccion', cambios: {} },
          validarStock: validarStockNoNegativo,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Y no debe quedar ni el stock invalido ni el registro de auditoria.
      expect(material.stockActual.toNumber()).toBe(0);
      expect(tx.edicionMovimiento.create).not.toHaveBeenCalled();
    });

    it('REGRESION: cantidades decimales no acumulan error de punto flotante', async () => {
      const { prisma, material } = reproducir([
        { tipo: 'ENTRADA', cantidad: 0.1 },
        { tipo: 'ENTRADA', cantidad: 0.2 },
      ]);
      const repo = new MovimientosStockRepository(prisma);

      await repo.editarConAuditoria({
        id: 'mov-2',
        materialId: 'mat-1',
        datos: { ...datosEdicion, cantidad: aDecimal(0.2) } as any,
        edicion: { usuarioId: null, motivo: 'test', cambios: {} },
        validarStock: validarStockNoNegativo,
      });

      expect(material.stockActual.toString()).toBe('0.3');
    });
  });
});
