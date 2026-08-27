import { EstadoOrdenCompra } from '@prisma/client';
import { OrdenesCompraRepository } from './ordenes-compra.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import { aDecimal } from '../../common/dominio/decimal';

/**
 * El fake de Prisma que usan los E2E hace matching por texto sobre el SQL, asi
 * que una query invalida igual "pasa". Estos tests miran el SQL que se genera,
 * que es donde estuvo el bug de produccion: castear el id a ::uuid contra una
 * columna TEXT rompia la recepcion entera con 42883.
 */
function crearPrismaFalso() {
  const material = { id: 'mat-1', stockActual: aDecimal(0) };
  const sqlEjecutado: string[] = [];

  const tx = {
    $queryRaw: jest.fn(async (fragmentos: TemplateStringsArray) => {
      sqlEjecutado.push(fragmentos.join('?'));
      return [{ stockActual: material.stockActual }];
    }),
    ordenCompra: {
      findUnique: jest.fn(async () => ({
        id: 'oc-1',
        proveedorId: 'prov-1',
        renglones: [{ id: 'r1', materialId: 'mat-1', cantidad: aDecimal(5) }],
      })),
      update: jest.fn(async () => ({ id: 'oc-1', estado: EstadoOrdenCompra.RECIBIDA })),
    },
    movimientoStock: { create: jest.fn(async () => ({ id: 'mov-1' })) },
    material: { update: jest.fn(async () => material) },
    renglonOrdenCompra: { update: jest.fn(async () => ({})) },
  };

  const prisma = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  } as unknown as PrismaService;

  return { prisma, tx, material, sqlEjecutado };
}

const paramsRecibir = {
  id: 'oc-1',
  fechaRecepcion: new Date('2026-08-27T12:00:00.000Z'),
  recibidaPorId: 'user-1',
  referencia: 'OC-2026-0001',
  notas: null,
};

describe('OrdenesCompraRepository.recibir()', () => {
  it('REGRESION: el id del material NO se castea a ::uuid', async () => {
    const { prisma, sqlEjecutado } = crearPrismaFalso();
    const repo = new OrdenesCompraRepository(prisma);

    await repo.recibir(paramsRecibir);

    expect(sqlEjecutado.length).toBeGreaterThan(0);
    for (const sql of sqlEjecutado) {
      expect(sql).not.toMatch(/::uuid/);
    }
  });

  it('toma lock del material antes de tocar el stock', async () => {
    const { prisma, sqlEjecutado } = crearPrismaFalso();
    const repo = new OrdenesCompraRepository(prisma);

    await repo.recibir(paramsRecibir);

    expect(sqlEjecutado.some((s) => /FOR UPDATE/.test(s))).toBe(true);
  });

  it('genera un movimiento por renglon y lo enlaza', async () => {
    const { prisma, tx } = crearPrismaFalso();
    const repo = new OrdenesCompraRepository(prisma);

    await repo.recibir(paramsRecibir);

    expect(tx.movimientoStock.create).toHaveBeenCalledTimes(1);
    expect(tx.renglonOrdenCompra.update).toHaveBeenCalledTimes(1);
  });

  it('el movimiento lleva la referencia de la orden', async () => {
    const { prisma, tx } = crearPrismaFalso();
    const repo = new OrdenesCompraRepository(prisma);

    await repo.recibir(paramsRecibir);

    const datos = (tx.movimientoStock.create as jest.Mock).mock.calls[0][0].data;
    expect(datos.referenciaTrabajo).toBe('OC-2026-0001');
    expect(datos.tipo).toBe('ENTRADA');
    expect(datos.motivo).toBe('COMPRA');
  });

  it('suma la cantidad del renglon al stock', async () => {
    const { prisma, tx } = crearPrismaFalso();
    const repo = new OrdenesCompraRepository(prisma);

    await repo.recibir(paramsRecibir);

    const nuevoStock = (tx.material.update as jest.Mock).mock.calls[0][0].data.stockActual;
    expect(nuevoStock.toNumber()).toBe(5); // 0 + 5
  });

  it('deja la orden en RECIBIDA', async () => {
    const { prisma, tx } = crearPrismaFalso();
    const repo = new OrdenesCompraRepository(prisma);

    await repo.recibir(paramsRecibir);

    expect((tx.ordenCompra.update as jest.Mock).mock.calls[0][0].data.estado).toBe(
      EstadoOrdenCompra.RECIBIDA,
    );
  });
});
