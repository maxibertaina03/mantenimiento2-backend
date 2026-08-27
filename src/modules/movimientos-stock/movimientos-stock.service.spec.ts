import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MotivoMovimiento, RolUsuario, TipoMovimiento, Usuario } from '@prisma/client';
import { MovimientosStockService, MOTIVOS_POR_TIPO } from './movimientos-stock.service';
import { RepositorioMovimientos } from './movimientos-stock.puerto';
import { Decimal, aDecimal } from '../../common/dominio/decimal';

/**
 * Doble del repositorio que simula el material en memoria y ejecuta el
 * `calcularNuevoStock` del service igual que lo haria la transaccion real.
 */
function crearRepoFalso(stockInicial = 0) {
  const estado = { stock: aDecimal(stockInicial), movimientos: [] as any[] };
  const repo = {
    estado,
    crearConActualizacionDeStock: jest.fn(async (data: any, calcular: (s: Decimal) => Decimal) => {
      const nuevo = calcular(estado.stock); // puede lanzar (stock insuficiente)
      estado.stock = nuevo;
      const mov = {
        id: 'mov-1',
        ...data,
        fecha: data.fecha ?? new Date(),
        creadoEn: new Date(),
      };
      estado.movimientos.push(mov);
      return mov;
    }),
    buscarPorId: jest.fn(),
    buscarConFiltros: jest.fn(async () => []),
    contar: jest.fn(async () => 0),
    editarConAuditoria: jest.fn(async (p: any) => ({
      id: p.id,
      materialId: p.materialId,
      ...p.datos,
      creadoEn: new Date(),
    })),
    listarEdiciones: jest.fn(async () => []),
  };
  return repo as unknown as RepositorioMovimientos & typeof repo;
}

const movimientoBase = {
  id: 'mov-1',
  materialId: 'mat-1',
  tipo: TipoMovimiento.ENTRADA,
  motivo: MotivoMovimiento.COMPRA,
  cantidad: aDecimal(10),
  fecha: new Date('2026-01-01T10:00:00.000Z'),
  proveedorId: null,
  usuarioId: 'user-1',
  referenciaTrabajo: null,
  notas: null,
  creadoEn: new Date('2026-01-01T10:00:00.000Z'),
};

const dtoBase = {
  materialId: 'mat-1',
  tipo: TipoMovimiento.ENTRADA,
  motivo: MotivoMovimiento.COMPRA,
  cantidad: 10,
};

describe('MovimientosStockService', () => {
  describe('crear() - reglas de stock', () => {
    it('ENTRADA suma al stock actual', async () => {
      const repo = crearRepoFalso(100);
      const service = new MovimientosStockService(repo);
      await service.crear({ ...dtoBase, tipo: TipoMovimiento.ENTRADA, cantidad: 25 } as any);
      expect(repo.estado.stock.toNumber()).toBe(125);
    });

    it('SALIDA resta del stock actual', async () => {
      const repo = crearRepoFalso(100);
      const service = new MovimientosStockService(repo);
      await service.crear({
        ...dtoBase,
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: 30,
      } as any);
      expect(repo.estado.stock.toNumber()).toBe(70);
    });

    it('AJUSTE fija el stock al valor absoluto (no es delta)', async () => {
      const repo = crearRepoFalso(100);
      const service = new MovimientosStockService(repo);
      await service.crear({
        ...dtoBase,
        tipo: TipoMovimiento.AJUSTE,
        motivo: MotivoMovimiento.AJUSTE,
        cantidad: 7,
      } as any);
      expect(repo.estado.stock.toNumber()).toBe(7);
    });

    it('AJUSTE a 0 es valido (vaciar stock)', async () => {
      const repo = crearRepoFalso(100);
      const service = new MovimientosStockService(repo);
      await service.crear({
        ...dtoBase,
        tipo: TipoMovimiento.AJUSTE,
        motivo: MotivoMovimiento.AJUSTE,
        cantidad: 0,
      } as any);
      expect(repo.estado.stock.toNumber()).toBe(0);
    });

    it('SALIDA que deja stock negativo es rechazada con 400', async () => {
      const repo = crearRepoFalso(10);
      const service = new MovimientosStockService(repo);
      await expect(
        service.crear({
          ...dtoBase,
          tipo: TipoMovimiento.SALIDA,
          motivo: MotivoMovimiento.TRABAJO,
          cantidad: 11,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('SALIDA que deja el stock exactamente en 0 se permite', async () => {
      const repo = crearRepoFalso(10);
      const service = new MovimientosStockService(repo);
      await service.crear({
        ...dtoBase,
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: 10,
      } as any);
      expect(repo.estado.stock.toNumber()).toBe(0);
    });

    it('ENTRADA con cantidad 0 es rechazada', async () => {
      const repo = crearRepoFalso(0);
      const service = new MovimientosStockService(repo);
      await expect(service.crear({ ...dtoBase, cantidad: 0 } as any)).rejects.toThrow(/mayor a 0/);
    });

    it('SALIDA con cantidad 0 es rechazada', async () => {
      const repo = crearRepoFalso(50);
      const service = new MovimientosStockService(repo);
      await expect(
        service.crear({
          ...dtoBase,
          tipo: TipoMovimiento.SALIDA,
          motivo: MotivoMovimiento.TRABAJO,
          cantidad: 0,
        } as any),
      ).rejects.toThrow(/mayor a 0/);
    });
  });

  describe('crear() - coherencia tipo/motivo', () => {
    it.each([
      [TipoMovimiento.ENTRADA, MotivoMovimiento.COMPRA],
      [TipoMovimiento.ENTRADA, MotivoMovimiento.OTRO],
      [TipoMovimiento.SALIDA, MotivoMovimiento.TRABAJO],
      [TipoMovimiento.SALIDA, MotivoMovimiento.DEVOLUCION],
      [TipoMovimiento.AJUSTE, MotivoMovimiento.AJUSTE],
    ])('acepta %s con motivo %s', async (tipo, motivo) => {
      const repo = crearRepoFalso(1000);
      const service = new MovimientosStockService(repo);
      await expect(
        service.crear({ ...dtoBase, tipo, motivo, cantidad: 5 } as any),
      ).resolves.toBeDefined();
    });

    it.each([
      [TipoMovimiento.ENTRADA, MotivoMovimiento.TRABAJO],
      [TipoMovimiento.ENTRADA, MotivoMovimiento.AJUSTE],
      [TipoMovimiento.SALIDA, MotivoMovimiento.COMPRA],
      [TipoMovimiento.AJUSTE, MotivoMovimiento.COMPRA],
    ])('rechaza %s con motivo %s', async (tipo, motivo) => {
      const repo = crearRepoFalso(1000);
      const service = new MovimientosStockService(repo);
      await expect(service.crear({ ...dtoBase, tipo, motivo, cantidad: 5 } as any)).rejects.toThrow(
        /no corresponde/,
      );
    });

    it('la tabla MOTIVOS_POR_TIPO cubre todos los tipos del enum', () => {
      for (const tipo of Object.values(TipoMovimiento)) {
        expect(MOTIVOS_POR_TIPO[tipo]).toBeDefined();
        expect(MOTIVOS_POR_TIPO[tipo].length).toBeGreaterThan(0);
      }
    });
  });

  describe('crear() - autoria', () => {
    it('el usuario autenticado tiene prioridad sobre el usuarioId del body', async () => {
      const repo = crearRepoFalso(100);
      const service = new MovimientosStockService(repo);
      await service.crear({ ...dtoBase, usuarioId: 'body-falsificado' } as any, 'user-real');
      const args = (repo.crearConActualizacionDeStock as jest.Mock).mock.calls[0][0];
      expect(args.usuarioId).toBe('user-real');
    });
  });

  describe('obtener()', () => {
    it('lanza 404 si no existe', async () => {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(null);
      const service = new MovimientosStockService(repo);
      await expect(service.obtener('inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('editar() - permisos', () => {
    const creador = { id: 'user-1', rol: RolUsuario.OPERARIO } as Usuario;
    const otro = { id: 'user-2', rol: RolUsuario.OPERARIO } as Usuario;
    const admin = { id: 'user-3', rol: RolUsuario.ADMIN } as Usuario;

    function servicioConMovimiento(mov: any = movimientoBase) {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(mov);
      return { repo, service: new MovimientosStockService(repo) };
    }

    it('el creador puede editar', async () => {
      const { service } = servicioConMovimiento();
      await expect(
        service.editar('mov-1', { motivoEdicion: 'error de carga' } as any, creador),
      ).resolves.toBeDefined();
    });

    it('un ADMIN puede editar un movimiento ajeno', async () => {
      const { service } = servicioConMovimiento();
      await expect(
        service.editar('mov-1', { motivoEdicion: 'correccion' } as any, admin),
      ).resolves.toBeDefined();
    });

    it('otro OPERARIO no puede editar', async () => {
      const { service } = servicioConMovimiento();
      await expect(
        service.editar('mov-1', { motivoEdicion: 'x' } as any, otro),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lanza 404 si el movimiento no existe', async () => {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(null);
      const service = new MovimientosStockService(repo);
      await expect(
        service.editar('nope', { motivoEdicion: 'x' } as any, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('editar() - auditoria', () => {
    it('guarda snapshot antes/despues y el motivo de edicion', async () => {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(movimientoBase);
      const service = new MovimientosStockService(repo);
      const admin = { id: 'admin-1', rol: RolUsuario.ADMIN } as Usuario;

      await service.editar(
        'mov-1',
        { cantidad: 99, motivoEdicion: 'se cargo de mas' } as any,
        admin,
      );

      const args = (repo.editarConAuditoria as jest.Mock).mock.calls[0][0];
      expect(args.edicion.motivo).toBe('se cargo de mas');
      expect(args.edicion.usuarioId).toBe('admin-1');
      expect(args.edicion.cambios.antes.cantidad).toBe(10);
      expect(args.edicion.cambios.despues.cantidad).toBe(99);
    });

    it('los campos no enviados conservan su valor actual', async () => {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(movimientoBase);
      const service = new MovimientosStockService(repo);

      await service.editar('mov-1', { cantidad: 42, motivoEdicion: 'ajuste' } as any, undefined);

      const args = (repo.editarConAuditoria as jest.Mock).mock.calls[0][0];
      expect(args.datos.tipo).toBe(TipoMovimiento.ENTRADA);
      expect(args.datos.motivo).toBe(MotivoMovimiento.COMPRA);
      expect(args.datos.cantidad.toNumber()).toBe(42);
    });
  });

  describe('editar() - validaciones de negocio', () => {
    it('rechaza dejar una ENTRADA en cantidad 0', async () => {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(movimientoBase);
      const service = new MovimientosStockService(repo);
      await expect(
        service.editar('mov-1', { cantidad: 0, motivoEdicion: 'x' } as any),
      ).rejects.toThrow(/mayor a 0/);
    });

    it('rechaza un cambio de tipo que deja el motivo incoherente', async () => {
      const repo = crearRepoFalso();
      (repo.buscarPorId as jest.Mock).mockResolvedValue(movimientoBase); // motivo COMPRA
      const service = new MovimientosStockService(repo);
      // COMPRA no es motivo valido para SALIDA
      await expect(
        service.editar('mov-1', { tipo: TipoMovimiento.SALIDA, motivoEdicion: 'x' } as any),
      ).rejects.toThrow(/no corresponde/);
    });
  });
});
