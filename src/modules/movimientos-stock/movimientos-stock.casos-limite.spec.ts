import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import { MovimientosStockService } from './movimientos-stock.service';
import { MovimientosStockRepository } from './movimientos-stock.repository';
import { RepositorioMovimientos } from './movimientos-stock.puerto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal, aDecimal } from '../../common/dominio/decimal';

/** Repo falso con stock en memoria (mismo patron que el spec principal). */
function crearRepoFalso(stockInicial = 0) {
  const estado = { stock: aDecimal(stockInicial) };
  return {
    estado,
    crearConActualizacionDeStock: jest.fn(async (data: any, calcular: (s: Decimal) => Decimal) => {
      estado.stock = calcular(estado.stock);
      return { id: 'm', ...data, fecha: new Date(), creadoEn: new Date() };
    }),
    buscarPorId: jest.fn(),
    buscarConFiltros: jest.fn(async () => []),
    contar: jest.fn(async () => 0),
    editarConAuditoria: jest.fn(),
    listarEdiciones: jest.fn(async () => []),
    // Estos casos miran la precision decimal, no las fechas: sin ajustes
    // previos, la regla de la fecha no interviene.
    fechaDelUltimoAjuste: jest.fn(async () => null),
    datosDelMaterial: jest.fn(async () => ({ nombre: 'Material de prueba', activo: true })),
  } as unknown as RepositorioMovimientos & { estado: { stock: Decimal } };
}

describe('Casos limite y riesgos', () => {
  describe('Precision decimal en la validacion de stock', () => {
    it('REGRESION: permite retirar exactamente todo el stock con decimales', async () => {
      // Stock 0.3 (resultado tipico de 0.1 + 0.2 acumulado en JS).
      const repo = crearRepoFalso(0.1 + 0.2);
      const service = new MovimientosStockService(repo);

      await expect(
        service.crear({
          materialId: 'mat-1',
          tipo: TipoMovimiento.SALIDA,
          motivo: MotivoMovimiento.TRABAJO,
          cantidad: 0.3,
        } as any),
      ).resolves.toBeDefined();

      expect(repo.estado.stock.toString()).toBe('0');
    });

    it('REGRESION: el stock resultante no arrastra basura decimal', async () => {
      const repo = crearRepoFalso(1.1);
      const service = new MovimientosStockService(repo);
      await service.crear({
        materialId: 'mat-1',
        tipo: TipoMovimiento.SALIDA,
        motivo: MotivoMovimiento.TRABAJO,
        cantidad: 1.0,
      } as any);
      expect(repo.estado.stock.toString()).toBe('0.1');
    });

    it('suma repetida de decimales se mantiene exacta', async () => {
      const repo = crearRepoFalso(0);
      const service = new MovimientosStockService(repo);
      for (let i = 0; i < 10; i++) {
        await service.crear({
          materialId: 'mat-1',
          tipo: TipoMovimiento.ENTRADA,
          motivo: MotivoMovimiento.COMPRA,
          cantidad: 0.1,
        } as any);
      }
      expect(repo.estado.stock.toString()).toBe('1');
    });
  });

  describe('Filtro por rango de fechas', () => {
    it('REGRESION: fechaHasta en formato YYYY-MM-DD incluye todo ese dia', async () => {
      const repo = crearRepoFalso();
      const service = new MovimientosStockService(repo);
      await service.listar({ pagina: 1, limite: 20, skip: 0, fechaHasta: '2026-08-25' } as any);

      const filtro = (repo.buscarConFiltros as jest.Mock).mock.calls[0][0];
      // Un movimiento cargado a las 15:00 de ese dia debe entrar en el rango.
      const movimientoDeEseDia = new Date('2026-08-25T15:00:00.000Z');
      expect(filtro.fechaHasta.getTime()).toBeGreaterThanOrEqual(movimientoDeEseDia.getTime());
      expect(filtro.fechaHasta.toISOString()).toBe('2026-08-25T23:59:59.999Z');
    });

    it('fechaDesde YYYY-MM-DD arranca a las 00:00 de ese dia', async () => {
      const repo = crearRepoFalso();
      const service = new MovimientosStockService(repo);
      await service.listar({ pagina: 1, limite: 20, skip: 0, fechaDesde: '2026-01-01' } as any);
      const filtro = (repo.buscarConFiltros as jest.Mock).mock.calls[0][0];
      expect(filtro.fechaDesde.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('un ISO completo con hora se respeta tal cual', async () => {
      const repo = crearRepoFalso();
      const service = new MovimientosStockService(repo);
      await service.listar({
        pagina: 1,
        limite: 20,
        skip: 0,
        fechaHasta: '2026-08-25T10:30:00.000Z',
      } as any);
      const filtro = (repo.buscarConFiltros as jest.Mock).mock.calls[0][0];
      expect(filtro.fechaHasta.toISOString()).toBe('2026-08-25T10:30:00.000Z');
    });

    it('sin filtros de fecha no agrega cotas', async () => {
      const repo = crearRepoFalso();
      const service = new MovimientosStockService(repo);
      await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
      const filtro = (repo.buscarConFiltros as jest.Mock).mock.calls[0][0];
      expect(filtro.fechaDesde).toBeUndefined();
      expect(filtro.fechaHasta).toBeUndefined();
    });
  });

  describe('Concurrencia en la actualizacion de stock', () => {
    it('REGRESION: dos SALIDAS simultaneas no pierden una actualizacion', async () => {
      // Simula el lock de fila: SELECT ... FOR UPDATE serializa a los competidores.
      const material = { id: 'mat-1', stockActual: aDecimal(100) };
      let lecturas = 0;
      let lockTomado = false;
      const esperandoLock: (() => void)[] = [];

      const tx = {
        $queryRaw: jest.fn(async () => {
          lecturas++;
          // Si otra transaccion tiene el lock, esperar a que lo suelte.
          if (lockTomado) {
            await new Promise<void>((r) => esperandoLock.push(r));
          }
          lockTomado = true;
          await new Promise((r) => setImmediate(r)); // cede el turno
          return [{ stockActual: material.stockActual }];
        }),
        material: {
          update: jest.fn(async ({ data }: any) => {
            material.stockActual = aDecimal(data.stockActual);
            // Fin de la transaccion: libera el lock.
            lockTomado = false;
            esperandoLock.shift()?.();
            return material;
          }),
        },
        movimientoStock: { create: jest.fn(async ({ data }: any) => ({ id: 'm', ...data })) },
      };
      const prisma = {
        $transaction: jest.fn(async (cb: any) => cb(tx)),
        // La regla de la fecha consulta el ultimo ajuste antes de abrir la
        // transaccion. Sin ajustes previos no interviene, que es lo que este
        // caso necesita: lo que se mide aca es el lock, no las fechas.
        movimientoStock: { findFirst: jest.fn(async () => null) },
        material: { findUnique: jest.fn(async () => ({ nombre: 'Material', activo: true })) },
      } as unknown as PrismaService;
      const service = new MovimientosStockService(new MovimientosStockRepository(prisma));

      const salida = () =>
        service.crear({
          materialId: 'mat-1',
          tipo: TipoMovimiento.SALIDA,
          motivo: MotivoMovimiento.TRABAJO,
          cantidad: 10,
        } as any);

      await Promise.all([salida(), salida()]);

      expect(lecturas).toBe(2);
      // 100 - 10 - 10 = 80. Con lost update quedaria en 90.
      expect(material.stockActual.toNumber()).toBe(80);
    });
  });
});
