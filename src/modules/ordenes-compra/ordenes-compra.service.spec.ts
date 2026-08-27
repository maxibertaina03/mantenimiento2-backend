import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoOrdenCompra, Usuario } from '@prisma/client';
import { OrdenesCompraService } from './ordenes-compra.service';
import { OrdenesCompraRepository } from './ordenes-compra.repository';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { MaterialesService } from '../materiales/materiales.service';
import { aDecimal } from '../../common/dominio/decimal';

const ordenBase = {
  id: 'oc-1',
  numero: 'OC-2026-0001',
  estado: EstadoOrdenCompra.BORRADOR,
  proveedorId: 'prov-1',
  fecha: new Date('2026-08-01T10:00:00.000Z'),
  fechaEntregaEstimada: null,
  observaciones: null,
  creadoPorId: null,
  emitidaEn: null,
  recibidaEn: null,
  recibidaPorId: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  renglones: [
    {
      id: 'r1',
      ordenId: 'oc-1',
      materialId: 'mat-1',
      cantidad: aDecimal(100),
      precioUnitario: aDecimal(10),
      notas: null,
      movimientoId: null,
    },
  ],
};

const dtoBase = {
  proveedorId: 'prov-1',
  renglones: [{ materialId: 'mat-1', cantidad: 100, precioUnitario: 10 }],
};

function armar(orden: any = ordenBase) {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => orden),
    buscarConFiltros: jest.fn<Promise<any>, any[]>(async () => [orden]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => orden),
    actualizar: jest.fn<Promise<any>, any[]>(async () => orden),
    cambiarEstado: jest.fn<Promise<any>, any[]>(async () => orden),
    recibir: jest.fn<Promise<any>, any[]>(async () => ({
      ...orden,
      estado: EstadoOrdenCompra.RECIBIDA,
    })),
    eliminar: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
  const proveedores = { obtener: jest.fn<Promise<any>, any[]>(async () => ({ id: 'prov-1' })) };
  const materiales = { obtener: jest.fn<Promise<any>, any[]>(async () => ({ id: 'mat-1' })) };

  return {
    repo,
    proveedores,
    materiales,
    service: new OrdenesCompraService(
      repo as unknown as OrdenesCompraRepository,
      proveedores as unknown as ProveedoresService,
      materiales as unknown as MaterialesService,
    ),
  };
}

describe('OrdenesCompraService - crear()', () => {
  it('valida que el proveedor exista', async () => {
    const { service, proveedores } = armar();
    await service.crear(dtoBase as any);
    expect(proveedores.obtener).toHaveBeenCalledWith('prov-1');
  });

  it('valida que cada material exista', async () => {
    const { service, materiales } = armar();
    await service.crear({
      proveedorId: 'prov-1',
      renglones: [
        { materialId: 'mat-1', cantidad: 1 },
        { materialId: 'mat-2', cantidad: 2 },
      ],
    } as any);
    expect(materiales.obtener).toHaveBeenCalledTimes(2);
  });

  it('propaga 404 si el proveedor no existe', async () => {
    const { service, proveedores } = armar();
    proveedores.obtener.mockRejectedValue(new NotFoundException('no existe'));
    await expect(service.crear(dtoBase as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('REGRESION: rechaza el mismo material repetido en dos renglones', async () => {
    const { service } = armar();
    await expect(
      service.crear({
        proveedorId: 'prov-1',
        renglones: [
          { materialId: 'mat-1', cantidad: 10 },
          { materialId: 'mat-1', cantidad: 5 },
        ],
      } as any),
    ).rejects.toThrow(/mismo material/);
  });

  it('registra quien creo la orden', async () => {
    const { service, repo } = armar();
    await service.crear(dtoBase as any, { id: 'user-9' } as Usuario);
    expect(repo.crear.mock.calls[0][0].creadoPorId).toBe('user-9');
  });

  it('la orden nace en BORRADOR y editable', async () => {
    const { service } = armar();
    const res = await service.crear(dtoBase as any);
    expect(res.estado).toBe(EstadoOrdenCompra.BORRADOR);
    expect(res.editable).toBe(true);
  });
});

describe('OrdenesCompraService - numero y totales', () => {
  it('expone el numero correlativo asignado', async () => {
    const { service } = armar();
    const res = await service.crear(dtoBase as any);
    expect(res.numero).toBe('OC-2026-0001');
  });

  it('calcula el total sumando los subtotales', async () => {
    const { service } = armar();
    const res = await service.crear(dtoBase as any);
    expect(res.renglones[0].subtotal).toBe(1000); // 100 x 10
    expect(res.total).toBe(1000);
  });

  it('el total es null si algun renglon no tiene precio', async () => {
    const sinPrecio = {
      ...ordenBase,
      renglones: [
        { ...ordenBase.renglones[0] },
        {
          id: 'r2',
          ordenId: 'oc-1',
          materialId: 'mat-2',
          cantidad: aDecimal(5),
          precioUnitario: null,
          notas: null,
          movimientoId: null,
        },
      ],
    };
    const { service } = armar(sinPrecio);
    const res = await service.crear(dtoBase as any);
    expect(res.total).toBeNull();
  });
});

describe('OrdenesCompraService - transiciones de estado', () => {
  function conEstado(estado: EstadoOrdenCompra) {
    return armar({ ...ordenBase, estado });
  }

  it('BORRADOR -> EMITIDA se permite', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.BORRADOR);
    await service.emitir('oc-1');
    expect(repo.cambiarEstado.mock.calls[0][1]).toBe(EstadoOrdenCompra.EMITIDA);
  });

  it('EMITIDA -> RECIBIDA se permite', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.EMITIDA);
    await service.recibir('oc-1', {} as any);
    expect(repo.recibir).toHaveBeenCalled();
  });

  it('REGRESION: BORRADOR -> RECIBIDA NO se permite (hay que emitir primero)', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.BORRADOR);
    await expect(service.recibir('oc-1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.recibir).not.toHaveBeenCalled();
  });

  it('REGRESION: una orden RECIBIDA no se puede volver a recibir (duplicaria el stock)', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.RECIBIDA);
    await expect(service.recibir('oc-1', {} as any)).rejects.toThrow(/no puede pasar a RECIBIDA/);
    expect(repo.recibir).not.toHaveBeenCalled();
  });

  it('una orden ANULADA no se puede emitir ni recibir', async () => {
    const { service } = conEstado(EstadoOrdenCompra.ANULADA);
    await expect(service.emitir('oc-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.recibir('oc-1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('una orden RECIBIDA no se puede anular (ya movio stock)', async () => {
    const { service } = conEstado(EstadoOrdenCompra.RECIBIDA);
    await expect(service.anular('oc-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BORRADOR y EMITIDA se pueden anular', async () => {
    for (const estado of [EstadoOrdenCompra.BORRADOR, EstadoOrdenCompra.EMITIDA]) {
      const { service, repo } = conEstado(estado);
      await service.anular('oc-1');
      expect(repo.cambiarEstado.mock.calls[0][1]).toBe(EstadoOrdenCompra.ANULADA);
    }
  });

  it('lanza 404 si la orden no existe', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.emitir('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdenesCompraService - recepcion', () => {
  it('usa el numero de orden como referencia del movimiento', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', {} as any);
    expect(repo.recibir.mock.calls[0][0].referencia).toBe('OC-2026-0001');
  });

  it('si hay remito, queda en la referencia (trazabilidad)', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', { remito: 'R-0001-00012345' } as any);
    expect(repo.recibir.mock.calls[0][0].referencia).toBe('OC-2026-0001 · Remito R-0001-00012345');
  });

  it('registra quien recibio', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', {} as any, { id: 'user-7' } as Usuario);
    expect(repo.recibir.mock.calls[0][0].recibidaPorId).toBe('user-7');
  });

  it('sin fecha explicita usa el momento actual', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    const antes = Date.now();
    await service.recibir('oc-1', {} as any);
    const usada = repo.recibir.mock.calls[0][0].fechaRecepcion as Date;
    expect(usada.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('respeta la fecha de recepcion informada', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', { fechaRecepcion: '2026-08-20T09:00:00.000Z' } as any);
    expect((repo.recibir.mock.calls[0][0].fechaRecepcion as Date).toISOString()).toBe(
      '2026-08-20T09:00:00.000Z',
    );
  });
});

describe('OrdenesCompraService - edicion y borrado', () => {
  it('REGRESION: no se edita una orden ya emitida', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await expect(service.actualizar('oc-1', { observaciones: 'cambio' } as any)).rejects.toThrow(
      /no se puede editar/,
    );
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('se edita una orden en BORRADOR', async () => {
    const { service, repo } = armar();
    await service.actualizar('oc-1', { observaciones: 'urgente' } as any);
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('rechaza dejar la orden sin renglones', async () => {
    const { service } = armar();
    await expect(service.actualizar('oc-1', { renglones: [] } as any)).rejects.toThrow(
      /al menos un renglón/,
    );
  });

  it('solo se elimina una orden en BORRADOR', async () => {
    const { service, repo } = armar();
    await service.eliminar('oc-1');
    expect(repo.eliminar).toHaveBeenCalledWith('oc-1');
  });

  it('REGRESION: una orden recibida no se elimina, se anula', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.RECIBIDA });
    await expect(service.eliminar('oc-1')).rejects.toThrow(/anulala/);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });
});

describe('OrdenesCompraService - listado', () => {
  it('expande fechaHasta al fin del dia', async () => {
    const { service, repo } = armar();
    await service.listar({ pagina: 1, limite: 20, skip: 0, fechaHasta: '2026-08-25' } as any);
    const filtro = repo.buscarConFiltros.mock.calls[0][0];
    expect(filtro.fechaHasta.toISOString()).toBe('2026-08-25T23:59:59.999Z');
  });

  it('devuelve la forma paginada', async () => {
    const { service } = armar();
    const res = await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
    expect(res).toMatchObject({ total: 1, pagina: 1, limite: 20 });
  });
});
