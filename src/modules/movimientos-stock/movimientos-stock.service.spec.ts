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
    // Se resuelve desde la lista en memoria, no con un stub: asi la regla de la
    // fecha se ejerce de verdad en vez de quedar siempre en verde.
    fechaDelUltimoAjuste: jest.fn(async (materialId: string, excluir?: string) => {
      const ajustes = estado.movimientos
        .filter(
          (m) =>
            m.materialId === materialId && m.tipo === TipoMovimiento.AJUSTE && m.id !== excluir,
        )
        .map((m) => m.fecha as Date)
        .sort((a, b) => b.getTime() - a.getTime());
      return ajustes[0] ?? null;
    }),
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

describe('MovimientosStockService - fecha por detras de un ajuste', () => {
  const f = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

  /** Deja el material con un AJUSTE a 100 con fecha del 1 de septiembre. */
  async function conAjusteDelPrimeroDeSeptiembre() {
    const repo = crearRepoFalso(0);
    const service = new MovimientosStockService(repo);
    await service.crear({
      materialId: 'mat-1',
      tipo: TipoMovimiento.AJUSTE,
      motivo: MotivoMovimiento.AJUSTE,
      cantidad: 100,
      fecha: f('2026-09-01').toISOString(),
    } as any);
    return { repo, service };
  }

  it('REGRESION: no deja cargar una SALIDA con fecha anterior al ultimo ajuste', async () => {
    // Es el caso que dejaba el stock guardado y el recalculo en desacuerdo. El
    // alta restaba la salida (90) y el recalculo por fecha la ignoraba (100),
    // porque el ajuste posterior borra lo anterior. Nadie lo notaba hasta que
    // alguien editaba cualquier movimiento del material y el stock saltaba solo.
    const { repo, service } = await conAjusteDelPrimeroDeSeptiembre();

    await expect(
      service.crear({
        materialId: 'mat-1',
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: 10,
        fecha: f('2026-08-15').toISOString(),
      } as any),
    ).rejects.toThrow(BadRequestException);

    // Y el stock no se movio.
    expect(repo.estado.stock.toNumber()).toBe(100);
  });

  it('la misma salida con fecha posterior al ajuste entra sin problema', async () => {
    const { repo, service } = await conAjusteDelPrimeroDeSeptiembre();

    await service.crear({
      materialId: 'mat-1',
      tipo: TipoMovimiento.SALIDA,
      motivo: MotivoMovimiento.TRABAJO,
      cantidad: 10,
      fecha: f('2026-09-02').toISOString(),
    } as any);

    expect(repo.estado.stock.toNumber()).toBe(90);
  });

  it('tampoco deja meter un AJUSTE por detras de otro', async () => {
    // Arrastra el mismo desacuerdo: el alta guarda el valor del ajuste nuevo,
    // pero en el orden por fecha el que manda sigue siendo el viejo.
    const { service } = await conAjusteDelPrimeroDeSeptiembre();

    await expect(
      service.crear({
        materialId: 'mat-1',
        tipo: TipoMovimiento.AJUSTE,
        motivo: MotivoMovimiento.AJUSTE,
        cantidad: 55,
        fecha: f('2026-08-01').toISOString(),
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('un material sin ajustes acepta cualquier fecha', async () => {
    // Retrofechar es normal: "me olvide de cargar la salida del martes". La
    // regla solo aparece donde hace falta.
    const repo = crearRepoFalso(100);
    const service = new MovimientosStockService(repo);

    await service.crear({
      materialId: 'mat-1',
      tipo: TipoMovimiento.SALIDA,
      motivo: MotivoMovimiento.TRABAJO,
      cantidad: 10,
      fecha: f('2020-01-01').toISOString(),
    } as any);

    expect(repo.estado.stock.toNumber()).toBe(90);
  });

  it('el ajuste de OTRO material no bloquea', async () => {
    const { service, repo } = await conAjusteDelPrimeroDeSeptiembre();

    await service.crear({
      materialId: 'mat-2',
      tipo: TipoMovimiento.SALIDA,
      motivo: MotivoMovimiento.TRABAJO,
      cantidad: 1,
      fecha: f('2020-01-01').toISOString(),
    } as any);

    expect(repo.estado.movimientos).toHaveLength(2);
  });

  it('REGRESION: la edicion tampoco puede retrofechar por detras de un ajuste', async () => {
    // Por esta puerta el salto era peor: la edicion recalcula y persiste, asi
    // que el stock cambiaba en el acto sin que nadie lo hubiera pedido.
    const repo = crearRepoFalso(0);
    const service = new MovimientosStockService(repo);
    (repo.buscarPorId as jest.Mock).mockResolvedValue({
      ...movimientoBase,
      id: 'mov-9',
      tipo: TipoMovimiento.SALIDA,
      motivo: MotivoMovimiento.TRABAJO,
      fecha: f('2026-09-05'),
    });
    (repo.fechaDelUltimoAjuste as jest.Mock).mockResolvedValue(f('2026-09-01'));

    await expect(
      service.editar('mov-9', { fecha: f('2026-08-15').toISOString(), motivoEdicion: 'x' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(repo.editarConAuditoria).not.toHaveBeenCalled();
  });

  it('un ajuste no se compara contra si mismo al editarlo', async () => {
    // Si no, ninguna edicion de un ajuste seria posible: siempre encontraria su
    // propia fecha y se rechazaria a si mismo.
    const repo = crearRepoFalso(0);
    const service = new MovimientosStockService(repo);
    (repo.buscarPorId as jest.Mock).mockResolvedValue({
      ...movimientoBase,
      id: 'mov-aj',
      tipo: TipoMovimiento.AJUSTE,
      motivo: MotivoMovimiento.AJUSTE,
      fecha: f('2026-09-01'),
    });

    await service.editar('mov-aj', {
      fecha: f('2026-08-20').toISOString(),
      motivoEdicion: 'la fecha estaba mal',
    } as any);

    expect(repo.fechaDelUltimoAjuste).toHaveBeenCalledWith('mat-1', 'mov-aj');
    expect(repo.editarConAuditoria).toHaveBeenCalled();
  });
});
